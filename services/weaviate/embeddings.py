"""
Embedding generation service for Weaviate personalization.

Uses OpenAI text-embedding-3-small for generating embeddings from
project content, user preferences, and tool descriptions.
"""

import logging
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    from core.projects.models import Project

    User = get_user_model()

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings using OpenAI.

    Handles embedding generation for:
    - Projects (title + description + topics + tools + categories)
    - User profiles (tags + bio + behavioral summary)
    - Tools (name + description + use cases)
    """

    def __init__(self):
        self.model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')
        self._client = None

    @property
    def client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            from openai import OpenAI

            api_key = getattr(settings, 'OPENAI_API_KEY', '')
            if not api_key:
                raise ValueError('OPENAI_API_KEY not configured for embeddings')
            self._client = OpenAI(api_key=api_key)
        return self._client

    def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding vector for text.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector
        """
        if not text or not text.strip():
            logger.warning('Attempted to generate embedding for empty text')
            return []

        try:
            # Truncate text if too long (max ~8000 tokens for embedding models)
            truncated_text = text[:30000]  # Rough character limit

            response = self.client.embeddings.create(
                model=self.model,
                input=truncated_text,
            )

            return response.data[0].embedding

        except Exception as e:
            logger.error(
                f'Failed to generate embedding: {e}',
                extra={
                    'model': self.model,
                    'text_length': len(text) if text else 0,
                },
                exc_info=True,
            )
            raise RuntimeError(f'Embedding generation failed: {e}') from e

    def generate_batch_embeddings(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts in a batch.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        try:
            # Filter out empty texts and track indices
            valid_texts = []
            valid_indices = []
            for i, text in enumerate(texts):
                if text and text.strip():
                    valid_texts.append(text[:30000])
                    valid_indices.append(i)

            if not valid_texts:
                return [[] for _ in texts]

            response = self.client.embeddings.create(
                model=self.model,
                input=valid_texts,
            )

            # Map embeddings back to original indices
            result = [[] for _ in texts]
            for i, embedding_data in enumerate(response.data):
                original_idx = valid_indices[i]
                result[original_idx] = embedding_data.embedding

            return result

        except Exception as e:
            logger.error(
                f'Failed to generate batch embeddings: {e}',
                extra={
                    'model': self.model,
                    'batch_size': len(texts),
                    'valid_texts': len(valid_texts) if 'valid_texts' in dir() else 0,
                },
                exc_info=True,
            )
            raise RuntimeError(f'Batch embedding generation failed: {e}') from e

    def generate_project_embedding_text(self, project: 'Project') -> str:
        """
        Generate combined text for project embedding.

        Combines:
        - Title (weighted high - repeated)
        - Description
        - Topics
        - Tool names
        - Category names
        - Reddit/external content if available

        Args:
            project: Project model instance

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Title (repeat for higher weight)
        if project.title:
            parts.append(project.title)
            parts.append(project.title)  # Repeat for weight

        # Description
        if project.description:
            parts.append(project.description)

        # Topics
        if project.topics:
            topics_text = ', '.join(project.topics)
            parts.append(f'Topics: {topics_text}')

        # Tools
        tool_names = list(project.tools.values_list('name', flat=True))
        if tool_names:
            tools_text = ', '.join(tool_names)
            parts.append(f'Tools used: {tools_text}')

        # Categories
        category_names = list(project.categories.values_list('name', flat=True))
        if category_names:
            categories_text = ', '.join(category_names)
            parts.append(f'Categories: {categories_text}')

        # Content blocks (extract text from structured content)
        if project.content:
            content_text = self._extract_text_from_content(project.content)
            if content_text:
                parts.append(content_text)

        return '\n'.join(parts)

    def _extract_text_from_content(self, content: dict) -> str:
        """Extract readable text from project content blocks."""
        texts = []

        # Handle different content structures
        if isinstance(content, dict):
            # Check for blocks array
            blocks = content.get('blocks', [])
            if isinstance(blocks, list):
                for block in blocks:
                    if isinstance(block, dict):
                        # Text blocks
                        if block.get('type') == 'text':
                            text = block.get('content', '') or block.get('text', '')
                            if text:
                                texts.append(text)
                        # Header blocks
                        elif block.get('type') == 'header':
                            text = block.get('text', '')
                            if text:
                                texts.append(text)

            # Check for description/summary fields
            if content.get('description'):
                texts.append(content['description'])
            if content.get('summary'):
                texts.append(content['summary'])

        return ' '.join(texts)[:5000]  # Limit extracted content

    def generate_user_profile_embedding_text(self, user: 'User') -> str:
        """
        Generate combined text for user profile embedding.

        Combines:
        - UserTags (weighted by confidence score)
        - Bio/about text
        - Behavioral summary from interactions

        Args:
            user: User model instance

        Returns:
            Combined text string for embedding
        """
        from core.taxonomy.models import UserTag

        parts = []

        # User bio/about if available
        if hasattr(user, 'profile') and user.profile:
            if hasattr(user.profile, 'bio') and user.profile.bio:
                parts.append(f'About: {user.profile.bio}')
            if hasattr(user.profile, 'headline') and user.profile.headline:
                parts.append(user.profile.headline)

        # UserTags (high confidence first)
        user_tags = UserTag.objects.filter(user=user).order_by('-confidence_score')[:50]

        if user_tags:
            # Group by source for structured text
            manual_tags = []
            auto_tags = []

            for tag in user_tags:
                if tag.source == UserTag.TagSource.MANUAL:
                    manual_tags.append(tag.name)
                else:
                    # Weight auto tags by confidence
                    if tag.confidence_score >= 0.7:
                        auto_tags.append(tag.name)

            if manual_tags:
                parts.append(f'Interests: {", ".join(manual_tags)}')
            if auto_tags:
                parts.append(f'Related interests: {", ".join(auto_tags)}')

        # Add behavioral summary from recent interactions
        behavioral_text = self._get_behavioral_summary(user)
        if behavioral_text:
            parts.append(behavioral_text)

        return '\n'.join(parts)

    def _get_behavioral_summary(self, user: 'User') -> str:
        """Generate summary of user's recent behavioral patterns."""
        from collections import Counter

        from core.taxonomy.models import UserInteraction

        # Get recent interactions
        recent_interactions = UserInteraction.objects.filter(user=user).order_by('-created_at')[:100]

        if not recent_interactions.exists():
            return ''

        # Extract keywords from interactions
        all_keywords = []
        for interaction in recent_interactions:
            keywords = interaction.extracted_keywords or []
            all_keywords.extend(keywords)

        if not all_keywords:
            return ''

        # Get top keywords
        keyword_counts = Counter(all_keywords)
        top_keywords = [kw for kw, _ in keyword_counts.most_common(20)]

        if top_keywords:
            return f'Activity patterns: {", ".join(top_keywords)}'

        return ''

    def generate_tool_embedding_text(self, tool) -> str:
        """
        Generate combined text for tool embedding.

        Args:
            tool: Tool or Taxonomy model instance

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Tool name (repeat for weight)
        if hasattr(tool, 'name') and tool.name:
            parts.append(tool.name)
            parts.append(tool.name)

        # Description
        if hasattr(tool, 'description') and tool.description:
            parts.append(tool.description)

        # Best for / use cases
        if hasattr(tool, 'best_for') and tool.best_for:
            if isinstance(tool.best_for, list):
                parts.append(f'Best for: {", ".join(tool.best_for)}')

        # Usage tips
        if hasattr(tool, 'usage_tips') and tool.usage_tips:
            if isinstance(tool.usage_tips, list):
                parts.append(f'Tips: {", ".join(tool.usage_tips)}')

        # Category if available
        if hasattr(tool, 'category') and tool.category:
            parts.append(f'Category: {tool.category}')

        return '\n'.join(parts)


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get singleton embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
