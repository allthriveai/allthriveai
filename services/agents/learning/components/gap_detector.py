"""
Learning Gap Detection Service.

Detects knowledge gaps from:
- Low mastery concepts that have been practiced
- Missing prerequisites for current topic
- Confusion patterns in conversations

Uses Weaviate for semantic gap detection - enabling queries like
"What concepts similar to X does this user NOT know?"
"""

import logging
import re
from datetime import timedelta
from typing import TypedDict

from django.utils import timezone

logger = logging.getLogger(__name__)


class DetectedGap(TypedDict):
    """A detected knowledge gap."""

    topic: str
    topic_display: str
    concept: str | None
    concept_id: int | None
    confidence: float  # 0.0 - 1.0
    reason: str  # low_mastery, missing_prerequisite, past_struggle, confusion_pattern
    reason_display: str


class GapDetector:
    """
    Detects knowledge gaps for proactive learning support.

    Combines database queries with Weaviate semantic search to identify
    where a user might need help.
    """

    # Confusion patterns to detect in messages
    # Format: (pattern, confidence_weight, pattern_type)
    CONFUSION_PATTERNS = [
        (r"i don'?t understand", 0.8, 'explicit_confusion'),
        (r'can you explain again', 0.7, 'request_repeat'),
        (r'what do you mean', 0.6, 'clarification'),
        (r"i'?m confused", 0.85, 'explicit_confusion'),
        (r'this is confusing', 0.8, 'explicit_confusion'),
        (r"i'?m lost", 0.75, 'explicit_confusion'),
        (r"i don'?t get it", 0.75, 'explicit_confusion'),
        (r'could you simplify', 0.6, 'request_simplify'),
        (r'in simpler terms', 0.6, 'request_simplify'),
        (r'what does .{1,50} mean', 0.5, 'definition_request'),
        (r'i thought .{1,50} was', 0.6, 'misconception'),
        (r'wait,? so', 0.4, 'processing'),
        (r'let me make sure i understand', 0.5, 'verification'),
        (r'so basically', 0.3, 'verification'),
    ]

    def __init__(self):
        self._weaviate_client = None

    @property
    def weaviate_client(self):
        """Lazy load Weaviate client."""
        if self._weaviate_client is None:
            from services.weaviate.client import WeaviateClient

            self._weaviate_client = WeaviateClient()
        return self._weaviate_client

    def detect_gaps(
        self,
        user_id: int,
        current_topic: str | None = None,
        limit: int = 5,
    ) -> list[DetectedGap]:
        """
        Detect knowledge gaps for a user.

        Combines multiple signals:
        1. Low mastery concepts that have been practiced
        2. Missing prerequisites for current topic
        3. Past struggles from Weaviate LearningGap collection
        4. Human feedback signals (negative feedback on topics)

        Args:
            user_id: User to detect gaps for
            current_topic: Current topic context (optional)
            limit: Maximum gaps to return

        Returns:
            List of DetectedGap dicts sorted by confidence
        """
        gaps: list[DetectedGap] = []
        seen_concepts: set[str] = set()
        seen_topics: set[str] = set()

        # 1. Human feedback gaps (highest priority - explicit user signal)
        feedback_gaps = self._get_feedback_gaps(user_id, limit=2)
        for gap in feedback_gaps:
            topic_key = gap['topic'] or 'general'
            if gap['concept'] and gap['concept'] not in seen_concepts:
                seen_concepts.add(gap['concept'])
                gaps.append(gap)
            elif not gap['concept'] and topic_key not in seen_topics:
                seen_topics.add(topic_key)
                gaps.append(gap)

        # 2. Low mastery concepts that have been practiced
        mastery_gaps = self._get_mastery_gaps(user_id, limit=3)
        for gap in mastery_gaps:
            if gap['concept'] and gap['concept'] not in seen_concepts:
                seen_concepts.add(gap['concept'])
                gaps.append(gap)

        # 3. Missing prerequisites for current topic
        if current_topic:
            prereq_gaps = self._get_prerequisite_gaps(user_id, current_topic, limit=2)
            for gap in prereq_gaps:
                if gap['concept'] and gap['concept'] not in seen_concepts:
                    seen_concepts.add(gap['concept'])
                    gaps.append(gap)

        # 4. Past struggles from Weaviate
        try:
            struggle_gaps = self._get_weaviate_gaps(user_id, limit=2)
            for gap in struggle_gaps:
                if gap['concept'] and gap['concept'] not in seen_concepts:
                    seen_concepts.add(gap['concept'])
                    gaps.append(gap)
        except Exception as e:
            logger.warning(f'Failed to get Weaviate gaps: {e}')

        # Sort by confidence and return top results
        gaps.sort(key=lambda x: x['confidence'], reverse=True)
        return gaps[:limit]

    async def detect_gaps_async(
        self,
        user_id: int,
        current_topic: str | None = None,
        limit: int = 5,
    ) -> list[DetectedGap]:
        """Async version of detect_gaps."""
        from asgiref.sync import sync_to_async

        return await sync_to_async(self.detect_gaps)(user_id, current_topic, limit)

    def analyze_message_for_confusion(
        self,
        message: str,
        topic: str | None = None,
    ) -> dict | None:
        """
        Analyze a single message for confusion signals.

        Args:
            message: The message text to analyze
            topic: Optional topic context

        Returns:
            Dict with confusion analysis or None if no confusion detected
        """
        if not message:
            return None

        message_lower = message.lower().strip()
        matched_patterns: list[tuple[str, float, str]] = []

        for pattern, confidence, pattern_type in self.CONFUSION_PATTERNS:
            if re.search(pattern, message_lower):
                matched_patterns.append((pattern, confidence, pattern_type))

        if not matched_patterns:
            return None

        # Calculate combined confidence (weighted average)
        total_confidence = sum(p[1] for p in matched_patterns)
        avg_confidence = total_confidence / len(matched_patterns)
        # Boost confidence if multiple patterns match
        final_confidence = min(0.95, avg_confidence + (len(matched_patterns) - 1) * 0.1)

        # Determine primary confusion type
        pattern_types = [p[2] for p in matched_patterns]
        if 'explicit_confusion' in pattern_types:
            confusion_type = 'explicit_confusion'
        elif 'request_repeat' in pattern_types or 'request_simplify' in pattern_types:
            confusion_type = 'comprehension_difficulty'
        elif 'misconception' in pattern_types:
            confusion_type = 'misconception'
        else:
            confusion_type = 'processing'

        return {
            'confidence': round(final_confidence, 2),
            'confusion_type': confusion_type,
            'matched_patterns': [p[0] for p in matched_patterns],
            'topic': topic,
        }

    def record_confusion(
        self,
        user_id: int,
        concept_name: str | None,
        topic_slug: str,
        evidence: str,
        confidence: float = 0.7,
    ) -> None:
        """
        Record a detected confusion in Weaviate for future reference.

        Args:
            user_id: User ID
            concept_name: Concept they're confused about (optional)
            topic_slug: Topic slug
            evidence: Summary of the confusion evidence
            confidence: Confidence score (0.0-1.0)
        """
        try:
            from services.weaviate.tasks import record_learning_gap

            record_learning_gap.delay(
                user_id=user_id,
                concept_name=concept_name or 'general',
                topic_slug=topic_slug,
                gap_type='confusion',
                confidence=confidence,
                evidence_summary=evidence[:500],  # Truncate for storage
            )
            logger.debug(
                f'Recorded confusion for user {user_id}: topic={topic_slug}, '
                f'concept={concept_name}, confidence={confidence}'
            )
        except Exception as e:
            logger.warning(f'Failed to record confusion: {e}')

    def _get_mastery_gaps(self, user_id: int, limit: int = 3) -> list[DetectedGap]:
        """Get gaps from low mastery concepts that have been practiced."""
        from core.learning_paths.models import UserConceptMastery

        gaps: list[DetectedGap] = []

        # Find concepts user has practiced but still has low mastery
        low_mastery = (
            UserConceptMastery.objects.filter(
                user_id=user_id,
                mastery_level__in=['unknown', 'aware', 'learning'],
                times_practiced__gt=0,  # They've tried but still struggling
            )
            .select_related('concept', 'concept__topic_taxonomy')
            .order_by('mastery_score')[:limit]
        )

        for mastery in low_mastery:
            concept = mastery.concept
            topic_taxonomy = concept.topic_taxonomy

            # Calculate confidence based on how much they've practiced
            # More practice with low mastery = higher confidence gap
            practice_factor = min(mastery.times_practiced / 5, 1.0)
            confidence = 0.5 + (0.4 * practice_factor) - (mastery.mastery_score * 0.3)
            confidence = max(0.3, min(0.9, confidence))

            gaps.append(
                {
                    'topic': topic_taxonomy.slug if topic_taxonomy else concept.topic,
                    'topic_display': topic_taxonomy.name if topic_taxonomy else concept.topic,
                    'concept': concept.name,
                    'concept_id': concept.id,
                    'confidence': round(confidence, 2),
                    'reason': 'low_mastery',
                    'reason_display': 'Needs more practice',
                }
            )

        return gaps

    def _get_prerequisite_gaps(
        self,
        user_id: int,
        current_topic: str,
        limit: int = 2,
    ) -> list[DetectedGap]:
        """Get gaps from missing prerequisites for current topic."""
        from core.learning_paths.models import Concept, UserConceptMastery

        gaps: list[DetectedGap] = []

        # Find concepts in current topic
        topic_concepts = Concept.objects.filter(
            topic=current_topic,
            is_active=True,
        ).prefetch_related('prerequisites', 'prerequisites__topic_taxonomy')

        # Get user's mastered concepts
        mastered_concepts = set(
            UserConceptMastery.objects.filter(
                user_id=user_id,
                mastery_level__in=['practicing', 'proficient', 'expert'],
            ).values_list('concept_id', flat=True)
        )

        # Find prerequisites that aren't mastered
        missing_prereqs: list[tuple[Concept, int]] = []  # (concept, depth)
        for concept in topic_concepts:
            for prereq in concept.prerequisites.all():
                if prereq.id not in mastered_concepts:
                    # Check if we've seen this prerequisite
                    depth = 1  # Could expand to check prereq chains
                    missing_prereqs.append((prereq, depth))

        # Dedupe and sort by importance
        seen_prereqs: set[int] = set()
        for prereq, depth in missing_prereqs:
            if prereq.id in seen_prereqs:
                continue
            seen_prereqs.add(prereq.id)

            topic_taxonomy = prereq.topic_taxonomy
            confidence = 0.7 + (depth * 0.05)  # Deeper prereqs are more foundational

            gaps.append(
                {
                    'topic': topic_taxonomy.slug if topic_taxonomy else prereq.topic,
                    'topic_display': topic_taxonomy.name if topic_taxonomy else prereq.topic,
                    'concept': prereq.name,
                    'concept_id': prereq.id,
                    'confidence': round(min(confidence, 0.9), 2),
                    'reason': 'missing_prerequisite',
                    'reason_display': 'Prerequisite not learned',
                }
            )

            if len(gaps) >= limit:
                break

        return gaps

    def _get_weaviate_gaps(self, user_id: int, limit: int = 2) -> list[DetectedGap]:
        """Get past struggles from Weaviate LearningGap collection."""
        from services.weaviate.schema import WeaviateSchema

        gaps: list[DetectedGap] = []

        if not self.weaviate_client.is_available():
            return gaps

        try:
            # Query for unaddressed learning gaps
            collection = self.weaviate_client.get_collection(WeaviateSchema.LEARNING_GAP_COLLECTION)
            if not collection:
                return gaps

            # Filter for this user's unaddressed gaps from last 30 days
            cutoff = timezone.now() - timedelta(days=30)

            response = collection.query.fetch_objects(
                filters=(
                    self.weaviate_client.build_filter('user_id', 'Equal', user_id)
                    & self.weaviate_client.build_filter('addressed', 'Equal', False)
                    & self.weaviate_client.build_filter('detected_at', 'GreaterThan', cutoff.isoformat())
                ),
                limit=limit,
                sort=self.weaviate_client.build_sort('confidence', 'desc'),
            )

            for obj in response.objects:
                props = obj.properties
                gaps.append(
                    {
                        'topic': props.get('topic_slug', 'general'),
                        'topic_display': props.get('topic_slug', 'General').replace('-', ' ').title(),
                        'concept': props.get('concept_name'),
                        'concept_id': None,  # Weaviate gaps don't have concept IDs
                        'confidence': props.get('confidence', 0.5),
                        'reason': 'past_struggle',
                        'reason_display': 'Previously struggled with this',
                    }
                )

        except Exception as e:
            logger.warning(f'Error querying Weaviate for learning gaps: {e}')

        return gaps

    def _get_feedback_gaps(self, user_id: int, limit: int = 2) -> list[DetectedGap]:
        """
        Get gaps from human feedback signals.

        Uses negative conversation feedback and content helpfulness ratings
        to identify topics/concepts where the user is struggling.

        This is the most reliable signal because it's explicit user feedback.
        """
        from django.db.models import Count

        gaps: list[DetectedGap] = []

        try:
            from core.learning_paths.models import ContentHelpfulness, ConversationFeedback

            # Get topics with recent negative conversation feedback
            cutoff = timezone.now() - timedelta(days=14)

            # Aggregate negative feedback by topic
            negative_feedback = (
                ConversationFeedback.objects.filter(
                    user_id=user_id,
                    created_at__gte=cutoff,
                    feedback__in=['confusing', 'not_helpful', 'too_advanced', 'incorrect'],
                )
                .exclude(topic_slug='')
                .values('topic_slug', 'concept__name', 'concept__id')
                .annotate(
                    count=Count('id'),
                )
                .order_by('-count')[:limit]
            )

            for feedback in negative_feedback:
                # Higher confidence if more negative feedback
                confidence = min(0.95, 0.6 + (feedback['count'] * 0.1))

                topic_slug = feedback['topic_slug']
                concept_name = feedback.get('concept__name')
                concept_id = feedback.get('concept__id')

                # Get topic display name
                try:
                    from core.taxonomy.models import Taxonomy

                    topic = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic').first()
                    topic_display = topic.name if topic else topic_slug.replace('-', ' ').title()
                except Exception:
                    topic_display = topic_slug.replace('-', ' ').title()

                gaps.append(
                    {
                        'topic': topic_slug,
                        'topic_display': topic_display,
                        'concept': concept_name,
                        'concept_id': concept_id,
                        'confidence': round(confidence, 2),
                        'reason': 'user_feedback',
                        'reason_display': 'You found this confusing',
                    }
                )

            # Also check content helpfulness for "confusing" ratings
            if len(gaps) < limit:
                confusing_content = (
                    ContentHelpfulness.objects.filter(
                        user_id=user_id,
                        created_at__gte=cutoff,
                        helpfulness='confusing',
                    )
                    .exclude(topic_slug='')
                    .values('topic_slug', 'concept_slug')
                    .annotate(count=Count('id'))
                    .order_by('-count')[: limit - len(gaps)]
                )

                for content in confusing_content:
                    topic_slug = content['topic_slug']
                    concept_slug = content.get('concept_slug')

                    # Skip if we already have this topic
                    if any(g['topic'] == topic_slug for g in gaps):
                        continue

                    confidence = min(0.9, 0.55 + (content['count'] * 0.15))

                    try:
                        from core.taxonomy.models import Taxonomy

                        topic = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic').first()
                        topic_display = topic.name if topic else topic_slug.replace('-', ' ').title()
                    except Exception:
                        topic_display = topic_slug.replace('-', ' ').title()

                    # Try to get concept details if we have a slug
                    concept_name = None
                    concept_id = None
                    if concept_slug:
                        try:
                            from core.learning_paths.models import Concept

                            concept = Concept.objects.filter(slug=concept_slug).first()
                            if concept:
                                concept_name = concept.name
                                concept_id = concept.id
                        except Exception:
                            logger.debug('Could not find concept for slug %s', concept_slug)

                    gaps.append(
                        {
                            'topic': topic_slug,
                            'topic_display': topic_display,
                            'concept': concept_name,
                            'concept_id': concept_id,
                            'confidence': round(confidence, 2),
                            'reason': 'content_feedback',
                            'reason_display': 'Content was confusing',
                        }
                    )

        except Exception as e:
            logger.warning(f'Failed to get feedback gaps for user {user_id}: {e}')

        return gaps


# Singleton instance for convenience
_gap_detector: GapDetector | None = None


def get_gap_detector() -> GapDetector:
    """Get singleton GapDetector instance."""
    global _gap_detector
    if _gap_detector is None:
        _gap_detector = GapDetector()
    return _gap_detector
