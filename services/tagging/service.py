"""
AI-powered taxonomy tagging service.

Fully agentic - no human review required. Tags are auto-applied
with confidence scores for quality tracking.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from django.db import transaction
from django.utils import timezone

from core.taxonomy.models import Taxonomy
from services.ai.provider import AIProvider

from .prompts import (
    CONTENT_ANALYSIS_PROMPT,
    TAXONOMY_EXTRACTION_SYSTEM,
    build_additional_context,
    build_content_preview,
    build_taxonomy_context,
)

logger = logging.getLogger(__name__)

# Tier to AI purpose mapping
TIER_PURPOSE_MAP = {
    'bulk': 'tagging',
    'premium': 'tagging_premium',
}


@dataclass
class TagResult:
    """Result of a single tag extraction."""

    taxonomy_type: str
    slug: str
    confidence: float
    taxonomy_id: int | None = None

    def to_dict(self) -> dict:
        return {
            'slug': self.slug,
            'confidence': self.confidence,
            'taxonomy_id': self.taxonomy_id,
        }


@dataclass
class TaggingResult:
    """Result of content tagging operation."""

    success: bool
    content_type: TagResult | None = None
    time_investment: TagResult | None = None
    difficulty: TagResult | None = None
    pricing: TagResult | None = None
    topics: list[TagResult] = field(default_factory=list)
    tools: list[TagResult] = field(default_factory=list)
    categories: list[TagResult] = field(default_factory=list)
    model_used: str = ''
    tokens_used: int = 0
    error: str | None = None

    def to_metadata(self) -> dict:
        """Convert to JSON-serializable metadata for ai_tag_metadata field."""
        metadata = {
            'tagged_at': timezone.now().isoformat(),
            'model': self.model_used,
            'tokens': self.tokens_used,
        }

        if self.content_type:
            metadata['content_type'] = self.content_type.to_dict()
        if self.time_investment:
            metadata['time_investment'] = self.time_investment.to_dict()
        if self.difficulty:
            metadata['difficulty'] = self.difficulty.to_dict()
        if self.pricing:
            metadata['pricing'] = self.pricing.to_dict()
        if self.topics:
            metadata['topics'] = [t.to_dict() for t in self.topics]
        if self.tools:
            metadata['tools'] = [t.to_dict() for t in self.tools]
        if self.categories:
            metadata['categories'] = [t.to_dict() for t in self.categories]

        return metadata

    @property
    def average_confidence(self) -> float:
        """Calculate average confidence across all extracted tags."""
        confidences = []
        if self.content_type:
            confidences.append(self.content_type.confidence)
        if self.time_investment:
            confidences.append(self.time_investment.confidence)
        if self.difficulty:
            confidences.append(self.difficulty.confidence)
        if self.pricing:
            confidences.append(self.pricing.confidence)
        confidences.extend(t.confidence for t in self.topics)
        confidences.extend(t.confidence for t in self.tools)
        confidences.extend(t.confidence for t in self.categories)

        return sum(confidences) / len(confidences) if confidences else 0.0


class AITaggingService:
    """
    Fully agentic AI-powered taxonomy extraction.

    Features:
    - Tiered model selection (bulk vs premium)
    - Confidence scoring for quality tracking
    - Automatic taxonomy resolution
    - No human review required

    Usage:
        service = AITaggingService()
        result = service.tag_content(project, tier='bulk')
        if result.success:
            service.apply_tags(project, result)
    """

    def __init__(self):
        self._taxonomy_cache: dict[str, dict[str, int]] = {}
        self._taxonomy_cache_time: datetime | None = None
        self._cache_ttl_seconds = 300  # 5 minutes

    def _get_taxonomy_lookup(self) -> dict[str, dict[str, int]]:
        """
        Get slug -> id lookup for all active taxonomies.

        Returns:
            Dict mapping taxonomy_type -> {slug: id}
        """
        now = timezone.now()
        if (
            self._taxonomy_cache
            and self._taxonomy_cache_time
            and (now - self._taxonomy_cache_time).total_seconds() < self._cache_ttl_seconds
        ):
            return self._taxonomy_cache

        # Rebuild cache
        self._taxonomy_cache = {}
        taxonomies = Taxonomy.objects.filter(is_active=True).values('id', 'slug', 'taxonomy_type')

        for tax in taxonomies:
            tax_type = tax['taxonomy_type']
            if tax_type not in self._taxonomy_cache:
                self._taxonomy_cache[tax_type] = {}
            self._taxonomy_cache[tax_type][tax['slug']] = tax['id']

        self._taxonomy_cache_time = now
        return self._taxonomy_cache

    def _get_taxonomy_context(self) -> dict[str, list[dict]]:
        """Get taxonomy context for AI prompt."""
        taxonomies = Taxonomy.objects.filter(is_active=True).values('slug', 'name', 'taxonomy_type')

        by_type: dict[str, list[dict]] = {}
        for tax in taxonomies:
            tax_type = tax['taxonomy_type']
            if tax_type not in by_type:
                by_type[tax_type] = []
            by_type[tax_type].append({'slug': tax['slug'], 'name': tax['name']})

        return by_type

    def _resolve_tag(self, taxonomy_type: str, slug: str, confidence: float) -> TagResult | None:
        """Resolve a slug to a TagResult with taxonomy_id."""
        lookup = self._get_taxonomy_lookup()
        type_lookup = lookup.get(taxonomy_type, {})

        taxonomy_id = type_lookup.get(slug)
        if taxonomy_id:
            return TagResult(
                taxonomy_type=taxonomy_type,
                slug=slug,
                confidence=confidence,
                taxonomy_id=taxonomy_id,
            )

        # Try fuzzy match (lowercase, strip hyphens)
        normalized = slug.lower().replace('-', '').replace('_', '')
        for existing_slug, tid in type_lookup.items():
            if existing_slug.lower().replace('-', '').replace('_', '') == normalized:
                return TagResult(
                    taxonomy_type=taxonomy_type,
                    slug=existing_slug,
                    confidence=confidence * 0.9,  # Slight penalty for fuzzy match
                    taxonomy_id=tid,
                )

        logger.warning(f'Could not resolve taxonomy: {taxonomy_type}/{slug}')
        return None

    def _parse_ai_response(self, response_text: str | None) -> dict[str, Any]:
        """Parse AI response JSON, handling common issues."""
        # Handle None or non-string input
        if not response_text:
            logger.warning('Empty AI response received')
            return {}

        if not isinstance(response_text, str):
            logger.warning(f'Non-string AI response received: {type(response_text)}')
            return {}

        # Clean up response
        text = response_text.strip()

        if not text:
            logger.warning('Whitespace-only AI response received')
            return {}

        # Remove markdown code blocks if present (handles ```json, ```JSON, ``` etc.)
        if text.startswith('```'):
            lines = text.split('\n')
            # Find the closing ``` and extract content between
            end_idx = len(lines)
            for i in range(len(lines) - 1, 0, -1):
                if lines[i].strip() == '```':
                    end_idx = i
                    break
            text = '\n'.join(lines[1:end_idx])

        # Try to find JSON object if wrapped in other text
        if not text.startswith('{') and '{' in text:
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end > start:
                text = text[start : end + 1]

        try:
            parsed = json.loads(text)
            # Validate it's actually a dict
            if not isinstance(parsed, dict):
                logger.warning(f'AI response parsed to non-dict type: {type(parsed)}')
                return {}
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f'Failed to parse AI response: {e}\nResponse: {text[:500]}')
            return {}

    def tag_content(
        self,
        content: Any,
        tier: Literal['bulk', 'premium'] = 'bulk',
        min_confidence: float = 0.5,
    ) -> TaggingResult:
        """
        Extract taxonomy tags from content using AI.

        Args:
            content: Content model instance (Project, Quiz, Tool, MicroLesson)
            tier: 'bulk' for cheap model, 'premium' for better quality
            min_confidence: Minimum confidence threshold for tags

        Returns:
            TaggingResult with extracted tags
        """
        purpose = TIER_PURPOSE_MAP.get(tier, 'tagging')

        try:
            # Build prompts
            taxonomy_context = self._get_taxonomy_context()
            context_str = build_taxonomy_context(taxonomy_context)

            system_prompt = TAXONOMY_EXTRACTION_SYSTEM.format(taxonomy_context=context_str)

            title = getattr(content, 'title', getattr(content, 'name', 'Untitled'))
            description = getattr(content, 'description', '') or ''
            content_preview = build_content_preview(content)
            additional_context = build_additional_context(content)

            user_prompt = CONTENT_ANALYSIS_PROMPT.format(
                title=title,
                description=description[:1000],
                content_preview=content_preview,
                additional_context=additional_context,
            )

            # Call AI
            ai = AIProvider()
            response = ai.complete(
                prompt=user_prompt,
                purpose=purpose,
                temperature=0.2,  # Low for consistency
                system_message=system_prompt,
            )

            if not response or not response.get('content'):
                return TaggingResult(success=False, error='Empty AI response')

            # Parse response
            parsed = self._parse_ai_response(response['content'])
            if not parsed:
                return TaggingResult(success=False, error='Failed to parse AI response')

            # Build result
            result = TaggingResult(
                success=True,
                model_used=response.get('model', ''),
                tokens_used=response.get('usage', {}).get('total_tokens', 0),
            )

            # Process single-value fields
            for field_name in ['content_type', 'time_investment', 'difficulty', 'pricing']:
                field_data = parsed.get(field_name)
                if field_data and isinstance(field_data, dict):
                    slug = field_data.get('value')
                    confidence = field_data.get('confidence', 0.0)
                    if slug and confidence >= min_confidence:
                        tag = self._resolve_tag(field_name, slug, confidence)
                        if tag:
                            setattr(result, field_name, tag)

            # Process multi-value fields
            for field_name in ['topics', 'tools', 'categories']:
                # Map field to taxonomy_type
                taxonomy_type = 'topic' if field_name == 'topics' else field_name.rstrip('s')
                if field_name == 'categories':
                    taxonomy_type = 'category'

                field_data = parsed.get(field_name, [])
                if isinstance(field_data, list):
                    tags = []
                    for item in field_data:
                        if isinstance(item, dict):
                            slug = item.get('value')
                            confidence = item.get('confidence', 0.0)
                            if slug and confidence >= min_confidence:
                                tag = self._resolve_tag(taxonomy_type, slug, confidence)
                                if tag:
                                    tags.append(tag)
                    setattr(result, field_name, tags)

            return result

        except Exception as e:
            logger.exception(f'Error tagging content: {e}')
            return TaggingResult(success=False, error=str(e))

    def apply_tags(
        self,
        content: Any,
        result: TaggingResult,
        source: Literal['ai', 'manual'] = 'ai',
    ) -> bool:
        """
        Apply extracted tags to content model.

        Updates:
        - ContentMetadataMixin fields (content_type_taxonomy, etc.)
        - ai_tag_metadata JSON field
        - M2M relationships for topics/categories

        Args:
            content: Content model instance
            result: TaggingResult from tag_content()
            source: 'ai' or 'manual' (manual takes precedence)

        Returns:
            True if tags were applied successfully
        """
        if not result.success:
            return False

        try:
            with transaction.atomic():
                update_fields = ['ai_tag_metadata']

                # Update ContentMetadataMixin FK fields
                if result.content_type and result.content_type.taxonomy_id:
                    if not getattr(content, 'content_type_taxonomy_id', None) or source == 'manual':
                        content.content_type_taxonomy_id = result.content_type.taxonomy_id
                        update_fields.append('content_type_taxonomy')

                if result.time_investment and result.time_investment.taxonomy_id:
                    if not getattr(content, 'time_investment_id', None) or source == 'manual':
                        content.time_investment_id = result.time_investment.taxonomy_id
                        update_fields.append('time_investment')

                if result.difficulty and result.difficulty.taxonomy_id:
                    if not getattr(content, 'difficulty_taxonomy_id', None) or source == 'manual':
                        content.difficulty_taxonomy_id = result.difficulty.taxonomy_id
                        update_fields.append('difficulty_taxonomy')

                if result.pricing and result.pricing.taxonomy_id:
                    if not getattr(content, 'pricing_taxonomy_id', None) or source == 'manual':
                        content.pricing_taxonomy_id = result.pricing.taxonomy_id
                        update_fields.append('pricing_taxonomy')

                # Store metadata
                metadata = result.to_metadata()
                metadata['source'] = source

                # Merge with existing metadata if present
                existing = getattr(content, 'ai_tag_metadata', {}) or {}
                existing.update(metadata)
                content.ai_tag_metadata = existing

                content.save(update_fields=update_fields)

                # Update M2M relationships if model supports them
                if result.topics and hasattr(content, 'topics_taxonomy'):
                    topic_ids = [t.taxonomy_id for t in result.topics if t.taxonomy_id]
                    if topic_ids:
                        # Add new topics without removing existing ones
                        content.topics_taxonomy.add(*topic_ids)

                if result.categories and hasattr(content, 'categories'):
                    cat_ids = [c.taxonomy_id for c in result.categories if c.taxonomy_id]
                    if cat_ids:
                        content.categories.add(*cat_ids)

                logger.info(
                    f'Applied tags to {content.__class__.__name__} {content.pk}: '
                    f'confidence={result.average_confidence:.2f}'
                )
                return True

        except Exception as e:
            logger.exception(f'Error applying tags to content: {e}')
            return False

    def should_retag(
        self,
        content: Any,
        force: bool = False,
        stale_hours: int = 168,  # 1 week
    ) -> bool:
        """
        Check if content should be (re)tagged.

        Returns True if:
        - Never tagged (no ai_tag_metadata)
        - Tagged more than stale_hours ago
        - force=True

        Args:
            content: Content model instance
            force: Force retagging regardless of existing tags
            stale_hours: Consider tags stale after this many hours

        Returns:
            True if content should be tagged
        """
        if force:
            return True

        metadata = getattr(content, 'ai_tag_metadata', None)
        if not metadata:
            return True

        tagged_at = metadata.get('tagged_at')
        if not tagged_at:
            return True

        try:
            tagged_time = datetime.fromisoformat(tagged_at.replace('Z', '+00:00'))
            # Ensure timezone-aware for comparison
            if tagged_time.tzinfo is None:
                tagged_time = timezone.make_aware(tagged_time)
            age_hours = (timezone.now() - tagged_time).total_seconds() / 3600
            return age_hours > stale_hours
        except (ValueError, TypeError):
            return True
