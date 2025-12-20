"""
Learner context aggregation service.

Aggregates user learning state for injection into Ember agent.
Uses Redis caching with 5-minute TTL for performance at scale.

Usage:
    # Sync (from tools_node)
    context = LearnerContextService.get_context(user_id)

    # Async (from agent initialization)
    context = await LearnerContextService.get_context_async(user_id)
"""

import logging
from typing import TypedDict

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache settings
LEARNER_CONTEXT_CACHE_TTL = 300  # 5 minutes
LEARNER_CONTEXT_CACHE_PREFIX = 'learner_context:'


class LearnerProfile(TypedDict):
    """Learner profile preferences."""

    learning_style: str  # visual, hands_on, conceptual, mixed
    difficulty_level: str  # beginner, intermediate, advanced
    session_length: int  # preferred minutes
    learning_goal: str  # build_projects, understand_concepts, career, exploring


class LearnerStats(TypedDict):
    """Aggregate learning statistics."""

    streak_days: int
    total_xp: int
    quizzes_completed: int
    concepts_mastered: int


class LearnerProgress(TypedDict):
    """Progress in a specific topic."""

    topic: str
    topic_display: str
    skill_level: str
    progress_pct: int
    points: int


class LearnerSuggestion(TypedDict):
    """Learning suggestion based on gaps or trends."""

    topic: str
    topic_display: str
    reason: str  # knowledge_gap, trending, continue, due_review
    reason_display: str


class LearnerContext(TypedDict):
    """Full learner context for Ember agent."""

    profile: LearnerProfile
    stats: LearnerStats
    progress: list[LearnerProgress]
    suggestions: list[LearnerSuggestion]
    interests: list[str]


class LearnerContextService:
    """
    Service for aggregating learner context.

    Provides both sync and async methods. Uses Redis caching to avoid
    expensive database queries on every conversation message.
    """

    @classmethod
    def get_cache_key(cls, user_id: int) -> str:
        """Get the cache key for a user's learner context."""
        return f'{LEARNER_CONTEXT_CACHE_PREFIX}{user_id}'

    @classmethod
    def invalidate_cache(cls, user_id: int) -> None:
        """Invalidate cached learner context (call after profile updates)."""
        cache.delete(cls.get_cache_key(user_id))
        logger.debug('Invalidated learner context cache', extra={'user_id': user_id})

    @classmethod
    def get_context(cls, user_id: int | None) -> LearnerContext | None:
        """
        Get learner context synchronously.

        Uses Redis cache with 5-minute TTL.

        Args:
            user_id: The user ID to get context for.

        Returns:
            LearnerContext dict or None if user not authenticated.
        """
        if not user_id:
            return None

        # Check cache first
        cache_key = cls.get_cache_key(user_id)
        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug('Learner context cache hit', extra={'user_id': user_id})
            return cached

        logger.debug('Learner context cache miss', extra={'user_id': user_id})

        try:
            context = cls._aggregate_context(user_id)
            cache.set(cache_key, context, timeout=LEARNER_CONTEXT_CACHE_TTL)
            return context
        except Exception as e:
            logger.error(
                'Failed to aggregate learner context',
                extra={'user_id': user_id, 'error': str(e)},
                exc_info=True,
            )
            return cls._get_default_context()

    @classmethod
    async def get_context_async(cls, user_id: int | None) -> LearnerContext | None:
        """
        Get learner context asynchronously.

        Uses Redis cache with 5-minute TTL.

        Args:
            user_id: The user ID to get context for.

        Returns:
            LearnerContext dict or None if user not authenticated.
        """
        if not user_id:
            return None

        # Check cache first
        cache_key = cls.get_cache_key(user_id)
        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug('Learner context cache hit', extra={'user_id': user_id})
            return cached

        logger.debug('Learner context cache miss', extra={'user_id': user_id})

        try:
            context = await cls._aggregate_context_async(user_id)
            cache.set(cache_key, context, timeout=LEARNER_CONTEXT_CACHE_TTL)
            return context
        except Exception as e:
            logger.error(
                'Failed to aggregate learner context',
                extra={'user_id': user_id, 'error': str(e)},
                exc_info=True,
            )
            return cls._get_default_context()

    @classmethod
    def _get_default_context(cls) -> LearnerContext:
        """Return default context for new users or on error."""
        return {
            'profile': {
                'learning_style': 'mixed',
                'difficulty_level': 'beginner',
                'session_length': 15,
                'learning_goal': 'exploring',
            },
            'stats': {
                'streak_days': 0,
                'total_xp': 0,
                'quizzes_completed': 0,
                'concepts_mastered': 0,
            },
            'progress': [],
            'suggestions': [
                {
                    'topic': 'ai-agents',
                    'topic_display': 'AI Agents',
                    'reason': 'trending',
                    'reason_display': 'Popular topic',
                },
                {
                    'topic': 'prompt-engineering',
                    'topic_display': 'Prompt Engineering',
                    'reason': 'trending',
                    'reason_display': 'Popular topic',
                },
            ],
            'interests': [],
        }

    @classmethod
    def _aggregate_context(cls, user_id: int) -> LearnerContext:
        """Aggregate learner context from database (sync)."""
        from core.learning_paths.models import LearnerProfile, UserConceptMastery, UserLearningPath

        # Get or create learner profile
        profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)

        # Build profile dict
        profile_data: LearnerProfile = {
            'learning_style': profile.preferred_learning_style,
            'difficulty_level': profile.current_difficulty_level,
            'session_length': profile.preferred_session_length,
            'learning_goal': profile.learning_goal or 'exploring',
        }

        # Build stats dict
        stats_data: LearnerStats = {
            'streak_days': profile.learning_streak_days,
            'total_xp': cls._calculate_total_xp(user_id),
            'quizzes_completed': profile.total_quizzes_completed,
            'concepts_mastered': UserConceptMastery.objects.filter(
                user_id=user_id,
                mastery_level__in=['proficient', 'expert'],
            ).count(),
        }

        # Get learning path progress (top 5 by activity)
        paths = list(
            UserLearningPath.objects.filter(user_id=user_id)
            .select_related('topic_taxonomy')
            .order_by('-last_activity_at')[:5]
        )

        progress_data: list[LearnerProgress] = []
        for path in paths:
            topic_name = path.topic_taxonomy.name if path.topic_taxonomy else path.get_topic_display()
            topic_slug = path.topic_taxonomy.slug if path.topic_taxonomy else path.topic
            progress_data.append(
                {
                    'topic': topic_slug,
                    'topic_display': topic_name,
                    'skill_level': path.current_skill_level,
                    'progress_pct': path.progress_percentage,
                    'points': path.topic_points,
                }
            )

        # Generate suggestions based on gaps and activity
        suggestions_data = cls._generate_suggestions(user_id, paths)

        # Get interests from profile or recent activity
        interests = cls._get_interests(user_id, profile)

        return {
            'profile': profile_data,
            'stats': stats_data,
            'progress': progress_data,
            'suggestions': suggestions_data,
            'interests': interests,
        }

    @classmethod
    async def _aggregate_context_async(cls, user_id: int) -> LearnerContext:
        """Aggregate learner context from database (async)."""
        from asgiref.sync import sync_to_async

        # Use sync_to_async to wrap the sync method
        return await sync_to_async(cls._aggregate_context)(user_id)

    @classmethod
    def _calculate_total_xp(cls, user_id: int) -> int:
        """Calculate total XP from learning paths."""
        from django.db.models import Sum

        from core.learning_paths.models import UserLearningPath

        total = UserLearningPath.objects.filter(user_id=user_id).aggregate(total=Sum('topic_points'))['total']
        return total or 0

    @classmethod
    def _generate_suggestions(
        cls,
        user_id: int,
        paths: list,
    ) -> list[LearnerSuggestion]:
        """Generate learning suggestions based on user state."""
        from django.utils import timezone

        from core.learning_paths.models import UserConceptMastery

        suggestions: list[LearnerSuggestion] = []

        # 1. Knowledge gaps (low mastery concepts)
        gaps = list(
            UserConceptMastery.objects.filter(
                user_id=user_id,
                mastery_level__in=['unknown', 'aware', 'learning'],
                times_practiced__gt=0,
            )
            .select_related('concept', 'concept__topic_taxonomy')
            .order_by('mastery_score')[:2]
        )

        for gap in gaps:
            topic_taxonomy = gap.concept.topic_taxonomy
            if topic_taxonomy:
                suggestions.append(
                    {
                        'topic': topic_taxonomy.slug,
                        'topic_display': topic_taxonomy.name,
                        'reason': 'knowledge_gap',
                        'reason_display': 'Needs practice',
                    }
                )

        # 2. Due for review (spaced repetition)
        now = timezone.now()
        due_reviews = list(
            UserConceptMastery.objects.filter(
                user_id=user_id,
                next_review_at__lte=now,
            )
            .select_related('concept', 'concept__topic_taxonomy')
            .order_by('next_review_at')[:2]
        )

        for review in due_reviews:
            topic_taxonomy = review.concept.topic_taxonomy
            if topic_taxonomy:
                suggestions.append(
                    {
                        'topic': topic_taxonomy.slug,
                        'topic_display': topic_taxonomy.name,
                        'reason': 'due_review',
                        'reason_display': 'Due for review',
                    }
                )

        # 3. Continue recent activity
        if paths and len(suggestions) < 3:
            recent_path = paths[0]
            topic_taxonomy = recent_path.topic_taxonomy
            if topic_taxonomy:
                suggestions.append(
                    {
                        'topic': topic_taxonomy.slug,
                        'topic_display': topic_taxonomy.name,
                        'reason': 'continue',
                        'reason_display': 'Continue learning',
                    }
                )

        # 4. Fill with trending topics if needed
        trending = [
            {'slug': 'ai-agents', 'name': 'AI Agents'},
            {'slug': 'rag', 'name': 'RAG'},
            {'slug': 'prompt-engineering', 'name': 'Prompt Engineering'},
        ]

        existing_topics = {s['topic'] for s in suggestions}
        for topic in trending:
            if len(suggestions) >= 5:
                break
            if topic['slug'] not in existing_topics:
                suggestions.append(
                    {
                        'topic': topic['slug'],
                        'topic_display': topic['name'],
                        'reason': 'trending',
                        'reason_display': 'Popular topic',
                    }
                )

        return suggestions[:5]

    @classmethod
    def _get_interests(cls, user_id: int, profile) -> list[str]:
        """Get user interests from profile or activity."""
        interests = []

        # From profile's focus topic
        if profile.current_focus_topic:
            interests.append(profile.current_focus_topic)

        # From generated path if exists
        if profile.generated_path and isinstance(profile.generated_path, dict):
            path_topics = profile.generated_path.get('topics', [])
            interests.extend(path_topics[:3])

        # Deduplicate while preserving order
        seen = set()
        unique_interests = []
        for interest in interests:
            if interest not in seen:
                seen.add(interest)
                unique_interests.append(interest)

        return unique_interests[:10]
