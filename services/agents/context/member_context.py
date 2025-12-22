"""
Member context aggregation service.

Aggregates comprehensive member state for injection into Ember agent.
Combines learning context with personalization data for a complete picture.

Uses Redis caching with 5-minute TTL for performance at scale.

Usage:
    # Sync (from tools_node)
    context = MemberContextService.get_context(user_id)

    # Async (from agent initialization)
    context = await MemberContextService.get_context_async(user_id)
"""

import logging
from typing import TypedDict

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache settings
MEMBER_CONTEXT_CACHE_TTL = 300  # 5 minutes
MEMBER_CONTEXT_CACHE_PREFIX = 'member_context:'


# =============================================================================
# Learning-related TypedDicts
# =============================================================================


class LearningPreferences(TypedDict):
    """Learning preferences from LearnerProfile."""

    learning_style: str  # visual, hands_on, conceptual, mixed
    difficulty_level: str  # beginner, intermediate, advanced
    session_length: int  # preferred minutes
    learning_goal: str  # build_projects, understand_concepts, career, exploring


class LearningStats(TypedDict):
    """Aggregate learning statistics."""

    streak_days: int
    total_xp: int
    quizzes_completed: int
    concepts_mastered: int


class LearningProgress(TypedDict):
    """Progress in a specific topic."""

    topic: str
    topic_display: str
    skill_level: str
    progress_pct: int
    points: int


class LearningSuggestion(TypedDict):
    """Learning suggestion based on gaps or trends."""

    topic: str
    topic_display: str
    reason: str  # knowledge_gap, trending, continue, due_review
    reason_display: str


# =============================================================================
# Personalization TypedDicts
# =============================================================================


class ToolPreference(TypedDict):
    """A tool the member is interested in."""

    name: str
    slug: str
    confidence: float  # 0.0 - 1.0
    source: str  # manual, auto_project, auto_conversation, auto_activity


class Interest(TypedDict):
    """A general interest/topic the member has."""

    name: str
    slug: str
    confidence: float


class TaxonomyPreferences(TypedDict):
    """User-configured taxonomy preferences from settings."""

    personality: str | None  # MBTI type (e.g., INTJ, ENFP)
    learning_styles: list[str]  # Visual, hands-on, conceptual, etc.
    roles: list[str]  # Developer, designer, marketer, etc.
    goals: list[str]  # Career growth, learn new skills, etc.
    user_interests: list[str]  # Interest areas from settings (different from auto-detected)
    industries: list[str]  # Healthcare, finance, etc.


class FeatureInterests(TypedDict):
    """Features the user is excited about."""

    excited_features: list[str]  # portfolio, battles, learning, etc.
    discovery_balance: int  # 0-100, 0=familiar, 100=surprise me


# =============================================================================
# Learning Intelligence TypedDicts (Weaviate-powered)
# =============================================================================


class DetectedGap(TypedDict):
    """A detected knowledge gap from Weaviate."""

    topic: str
    topic_display: str
    concept: str | None
    concept_id: int | None
    confidence: float  # 0.0 - 1.0
    reason: str  # low_mastery, missing_prerequisite, past_struggle, confusion_pattern
    reason_display: str


class StruggleSignal(TypedDict):
    """Real-time struggle signal from conversation analysis."""

    confidence: float  # 0.0 - 1.0
    struggle_type: str  # concept_confusion, frustration, stuck_on_topic, rapid_questions
    topic: str | None
    signals: list[str]  # List of signals that contributed to detection
    suggested_intervention: str  # simplify_explanation, suggest_prerequisite, etc.


class ProactiveOffer(TypedDict):
    """A proactive intervention offer."""

    intervention_type: str  # simplify_explanation, suggest_prerequisite, etc.
    message_hint: str  # Suggested phrasing for the agent
    context_prefix: str  # Context to add to system prompt
    topic: str | None


class SemanticSuggestion(TypedDict):
    """A Weaviate-powered learning suggestion."""

    topic: str
    topic_display: str
    reason: str  # fills_gap, next_in_path, reinforces_learning
    content_type: str | None  # quiz, project, micro_lesson
    content_id: int | None


# =============================================================================
# Feedback Context TypedDicts (Human Feedback Loop)
# =============================================================================


class FeedbackPreferences(TypedDict):
    """User's inferred preferences from feedback patterns."""

    prefers_simple_explanations: bool
    prefers_examples: bool
    prefers_detailed_theory: bool
    prefers_proactive_help: bool
    difficulty_sweet_spot: str  # too_easy, just_right, too_hard
    best_content_types: list[str]
    problematic_topics: list[str]


class FeedbackContext(TypedDict):
    """Aggregated feedback for personalization."""

    preferences: FeedbackPreferences
    proactive_acceptance_rate: float  # 0-100
    satisfaction_trend: str | None  # improving, stable, declining
    current_blockers: list[str]  # From goal check-ins
    recent_struggles: list[str]  # Topics with recent negative feedback


class ProfileCompletion(TypedDict):
    """Profile completion status for triggering profile questions."""

    score: float  # 0.0 - 1.0
    missing_fields: list[str]  # Fields that can be filled by profile questions


# =============================================================================
# Full Member Context
# =============================================================================


class MemberContext(TypedDict):
    """
    Full member context for Ember agent.

    This combines learning data with personalization signals to give
    Ember a complete picture of the member.
    """

    # Top-level skill level (for easy access - same as learning.difficulty_level)
    # Values: 'beginner', 'intermediate', 'advanced'
    skill_level: str

    # Learning context
    learning: LearningPreferences
    stats: LearningStats
    progress: list[LearningProgress]
    suggestions: list[LearningSuggestion]

    # Personalization context (auto-detected)
    tool_preferences: list[ToolPreference]  # Tools they're interested in
    interests: list[Interest]  # General interests/topics (auto-detected)
    recent_queries: list[str]  # Recent search queries/messages (last 7 days)

    # User-configured preferences from settings
    taxonomy_preferences: TaxonomyPreferences  # Personality, roles, goals, etc.
    feature_interests: FeatureInterests  # What features they're excited about

    # Profile context
    has_projects: bool  # Have they created any projects?
    project_count: int  # How many projects do they have?
    is_new_member: bool  # Are they a new member (< 7 days)?

    # Learning Intelligence (Weaviate-powered) - populated at runtime
    detected_gaps: list[DetectedGap]  # Knowledge gaps from gap detector
    current_struggle: StruggleSignal | None  # Real-time struggle (set by agent)
    proactive_offer: ProactiveOffer | None  # Intervention offer (set by agent)
    semantic_suggestions: list[SemanticSuggestion]  # Weaviate-powered suggestions

    # Human feedback loop context
    feedback: FeedbackContext | None  # Aggregated feedback for personalization

    # Profile completion (for triggering profile questions)
    profile_completion: ProfileCompletion


class MemberContextService:
    """
    Service for aggregating member context.

    Provides both sync and async methods. Uses Redis caching to avoid
    expensive database queries on every conversation message.
    """

    @classmethod
    def get_cache_key(cls, user_id: int) -> str:
        """Get the cache key for a member's context."""
        return f'{MEMBER_CONTEXT_CACHE_PREFIX}{user_id}'

    @classmethod
    def invalidate_cache(cls, user_id: int) -> None:
        """Invalidate cached member context (call after profile/tag updates)."""
        cache.delete(cls.get_cache_key(user_id))
        logger.debug('Invalidated member context cache', extra={'user_id': user_id})

    @classmethod
    def get_context(cls, user_id: int | None) -> MemberContext | None:
        """
        Get member context synchronously.

        Uses Redis cache with 5-minute TTL.

        Args:
            user_id: The user ID to get context for.

        Returns:
            MemberContext dict or None if user not authenticated.
        """
        if not user_id:
            return None

        # Check cache first
        cache_key = cls.get_cache_key(user_id)
        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug('Member context cache hit', extra={'user_id': user_id})
            return cached

        logger.debug('Member context cache miss', extra={'user_id': user_id})

        try:
            context = cls._aggregate_context(user_id)
            cache.set(cache_key, context, timeout=MEMBER_CONTEXT_CACHE_TTL)
            return context
        except Exception as e:
            logger.error(
                'Failed to aggregate member context',
                extra={'user_id': user_id, 'error': str(e)},
                exc_info=True,
            )
            return cls._get_default_context()

    @classmethod
    async def get_context_async(cls, user_id: int | None) -> MemberContext | None:
        """
        Get member context asynchronously.

        Uses Redis cache with 5-minute TTL.
        Uses cache.add() to prevent cache stampede (only one request computes value).

        Args:
            user_id: The user ID to get context for.

        Returns:
            MemberContext dict or None if user not authenticated.
        """
        if not user_id:
            return None

        # Check cache first
        cache_key = cls.get_cache_key(user_id)
        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug('Member context cache hit')
            return cached

        # Use a lock key to prevent cache stampede
        # Only one request will compute the value, others will wait and retry
        lock_key = f'{cache_key}:lock'

        # Try to acquire lock (only one request wins)
        if cache.add(lock_key, '1', timeout=30):  # 30s lock timeout
            logger.debug('Member context cache miss - computing')
            try:
                context = await cls._aggregate_context_async(user_id)
                cache.set(cache_key, context, timeout=MEMBER_CONTEXT_CACHE_TTL)
                return context
            except Exception as e:
                logger.error(
                    'Failed to aggregate member context',
                    extra={'user_id': user_id, 'error': str(e)},
                    exc_info=True,
                )
                return cls._get_default_context()
            finally:
                cache.delete(lock_key)
        else:
            # Another request is computing - wait briefly and retry cache
            import asyncio

            for _ in range(5):  # Retry up to 5 times
                await asyncio.sleep(0.1)
                cached = cache.get(cache_key)
                if cached is not None:
                    logger.debug('Member context cache hit after wait')
                    return cached

            # Still no cache - compute anyway (lock may have expired)
            logger.debug('Member context cache miss after wait - computing')
            try:
                context = await cls._aggregate_context_async(user_id)
                cache.set(cache_key, context, timeout=MEMBER_CONTEXT_CACHE_TTL)
                return context
            except Exception as e:
                logger.error(
                    'Failed to aggregate member context',
                    extra={'user_id': user_id, 'error': str(e)},
                    exc_info=True,
                )
                return cls._get_default_context()

    @classmethod
    def _get_default_context(cls) -> MemberContext:
        """Return default context for new members or on error."""
        return {
            'skill_level': 'beginner',  # Top-level for easy access
            'learning': {
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
            'tool_preferences': [],
            'interests': [],
            'recent_queries': [],
            'taxonomy_preferences': {
                'personality': None,
                'learning_styles': [],
                'roles': [],
                'goals': [],
                'user_interests': [],
                'industries': [],
            },
            'feature_interests': {
                'excited_features': [],
                'discovery_balance': 50,
            },
            'has_projects': False,
            'project_count': 0,
            'is_new_member': True,
            # Learning Intelligence (populated at runtime)
            'detected_gaps': [],
            'current_struggle': None,
            'proactive_offer': None,
            'semantic_suggestions': [],
            # Human feedback loop
            'feedback': None,
            # Profile completion (for profile questions)
            'profile_completion': {
                'score': 0.0,
                'missing_fields': [
                    'learning.learning_style',
                    'learning.difficulty_level',
                    'learning.learning_goal',
                    'tool_preferences',
                    'interests',
                ],
            },
        }

    @classmethod
    def _aggregate_context(cls, user_id: int) -> MemberContext:
        """Aggregate member context from database (sync)."""
        from datetime import timedelta

        from django.utils import timezone

        # Get learning context
        learning_data = cls._get_learning_context(user_id)

        # Get personalization context (auto-detected from behavior)
        personalization_data = cls._get_personalization_context(user_id)

        # Get profile context
        profile_data = cls._get_profile_context(user_id)

        # Get user-configured preferences (taxonomy + feature interests)
        user_preferences = cls._get_user_preferences(user_id)

        # Get semantic intelligence from Weaviate
        semantic_data = cls._get_semantic_intelligence(user_id)

        # Get feedback context (human feedback loop)
        feedback_data = cls._get_feedback_context(user_id)

        # Check if new member (created within last 7 days)
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.only('date_joined').get(id=user_id)
            is_new = user.date_joined > timezone.now() - timedelta(days=7)
        except User.DoesNotExist:
            logger.debug(f'User not found when checking new member status: user_id={user_id}')
            is_new = True

        return {
            # Top-level skill level for easy access
            'skill_level': learning_data['learning']['difficulty_level'],
            'learning': learning_data['learning'],
            'stats': learning_data['stats'],
            'progress': learning_data['progress'],
            'suggestions': learning_data['suggestions'],
            'tool_preferences': personalization_data['tool_preferences'],
            'interests': personalization_data['interests'],
            'recent_queries': personalization_data['recent_queries'],
            'taxonomy_preferences': user_preferences['taxonomy_preferences'],
            'feature_interests': user_preferences['feature_interests'],
            'has_projects': profile_data['has_projects'],
            'project_count': profile_data['project_count'],
            'is_new_member': is_new,
            # Learning Intelligence (Weaviate-powered)
            'detected_gaps': semantic_data['detected_gaps'],
            'current_struggle': None,  # Set by agent at runtime
            'proactive_offer': None,  # Set by agent at runtime
            'semantic_suggestions': semantic_data['semantic_suggestions'],
            # Human feedback loop
            'feedback': feedback_data,
            # Profile completion (for profile questions)
            'profile_completion': cls._get_profile_completion(
                learning=learning_data['learning'],
                tool_preferences=personalization_data['tool_preferences'],
                interests=personalization_data['interests'],
                taxonomy_preferences=user_preferences['taxonomy_preferences'],
            ),
        }

    @classmethod
    async def _aggregate_context_async(cls, user_id: int) -> MemberContext:
        """Aggregate member context from database (async).

        Uses thread_sensitive=False to allow parallel execution of DB queries
        across multiple threads, avoiding event loop blocking.
        """
        from asgiref.sync import sync_to_async

        # thread_sensitive=False allows this to run in a thread pool
        # rather than blocking the main thread
        return await sync_to_async(cls._aggregate_context, thread_sensitive=False)(user_id)

    @classmethod
    def _get_learning_context(cls, user_id: int) -> dict:
        """Get learning-related context."""
        from core.learning_paths.models import LearnerProfile, UserConceptMastery, UserLearningPath

        # Get learner profile if exists (don't create on read)
        try:
            profile = LearnerProfile.objects.get(user_id=user_id)
            learning: LearningPreferences = {
                'learning_style': profile.preferred_learning_style,
                'difficulty_level': profile.current_difficulty_level,
                'session_length': profile.preferred_session_length,
                'learning_goal': profile.learning_goal or 'exploring',
            }
            stats: LearningStats = {
                'streak_days': profile.learning_streak_days,
                'total_xp': cls._calculate_total_xp(user_id),
                'quizzes_completed': profile.total_quizzes_completed,
                'concepts_mastered': UserConceptMastery.objects.filter(
                    user_id=user_id,
                    mastery_level__in=['proficient', 'expert'],
                ).count(),
            }
        except LearnerProfile.DoesNotExist:
            # Return defaults for users without a learner profile
            learning: LearningPreferences = {
                'learning_style': 'mixed',
                'difficulty_level': 'beginner',
                'session_length': 15,
                'learning_goal': 'exploring',
            }
            stats: LearningStats = {
                'streak_days': 0,
                'total_xp': 0,
                'quizzes_completed': 0,
                'concepts_mastered': 0,
            }

        # Get learning path progress (top 5 by activity)
        paths = list(
            UserLearningPath.objects.filter(user_id=user_id)
            .select_related('topic_taxonomy')
            .order_by('-last_activity_at')[:5]
        )

        progress: list[LearningProgress] = []
        for path in paths:
            topic_name = path.topic_taxonomy.name if path.topic_taxonomy else path.get_topic_display()
            topic_slug = path.topic_taxonomy.slug if path.topic_taxonomy else path.topic
            progress.append(
                {
                    'topic': topic_slug,
                    'topic_display': topic_name,
                    'skill_level': path.current_skill_level,
                    'progress_pct': path.progress_percentage,
                    'points': path.topic_points,
                }
            )

        # Generate suggestions
        suggestions = cls._generate_learning_suggestions(user_id, paths)

        return {
            'learning': learning,
            'stats': stats,
            'progress': progress,
            'suggestions': suggestions,
        }

    @classmethod
    def _get_personalization_context(cls, user_id: int) -> dict:
        """Get personalization-related context (UserTags, interests)."""
        from core.taxonomy.models import UserTag

        # Get tool preferences from UserTags
        tool_tags = (
            UserTag.objects.filter(
                user_id=user_id,
                taxonomy__taxonomy_type='tool',
            )
            .select_related('taxonomy')
            .order_by('-confidence_score')[:10]
        )

        tool_preferences: list[ToolPreference] = []
        for tag in tool_tags:
            tool_preferences.append(
                {
                    'name': tag.name,
                    'slug': tag.taxonomy.slug if tag.taxonomy else tag.name.lower().replace(' ', '-'),
                    'confidence': tag.confidence_score,
                    'source': tag.source,
                }
            )

        # Get general interests from UserTags (non-tool types)
        interest_tags = (
            UserTag.objects.filter(
                user_id=user_id,
            )
            .exclude(taxonomy__taxonomy_type='tool')
            .select_related('taxonomy')
            .order_by('-confidence_score')[:10]
        )

        interests: list[Interest] = []
        for tag in interest_tags:
            interests.append(
                {
                    'name': tag.name,
                    'slug': tag.taxonomy.slug if tag.taxonomy else tag.name.lower().replace(' ', '-'),
                    'confidence': tag.confidence_score,
                }
            )

        # Get recent topics from UserInteraction (last 7 days)
        from datetime import timedelta

        from django.utils import timezone

        from core.taxonomy.models import UserInteraction

        recent_interactions = UserInteraction.objects.filter(
            user_id=user_id,
            created_at__gte=timezone.now() - timedelta(days=7),
        ).order_by('-created_at')[:20]

        # Extract unique queries/messages from metadata
        recent_queries: list[str] = []
        seen_queries: set[str] = set()
        for interaction in recent_interactions:
            if interaction.metadata:
                # Get query/message from metadata
                text = interaction.metadata.get('query', '') or interaction.metadata.get('message', '')
                if text and text not in seen_queries:
                    seen_queries.add(text)
                    recent_queries.append(text[:50])  # Truncate long texts
                    if len(recent_queries) >= 5:
                        break

        return {
            'tool_preferences': tool_preferences,
            'interests': interests,
            'recent_queries': recent_queries,
        }

    @classmethod
    def _get_profile_context(cls, user_id: int) -> dict:
        """Get profile-related context."""
        from core.projects.models import Project

        project_count = Project.objects.filter(user_id=user_id, is_archived=False).count()

        return {
            'has_projects': project_count > 0,
            'project_count': project_count,
        }

    @classmethod
    def _get_user_preferences(cls, user_id: int) -> dict:
        """Get user-configured preferences from User and PersonalizationSettings."""
        from django.contrib.auth import get_user_model

        from core.users.models import PersonalizationSettings

        User = get_user_model()

        # Default values
        taxonomy_prefs: TaxonomyPreferences = {
            'personality': None,
            'learning_styles': [],
            'roles': [],
            'goals': [],
            'user_interests': [],
            'industries': [],
        }
        feature_interests: FeatureInterests = {
            'excited_features': [],
            'discovery_balance': 50,
        }

        try:
            # Fetch user with prefetched M2M relationships
            user = (
                User.objects.prefetch_related(
                    'personality',
                    'learning_styles',
                    'roles',
                    'goals',
                    'interests',
                    'industries',
                )
                .only('id')
                .get(id=user_id)
            )

            # Extract taxonomy preferences
            taxonomy_prefs = {
                'personality': user.personality.name if user.personality else None,
                'learning_styles': [ls.name for ls in user.learning_styles.all()],
                'roles': [r.name for r in user.roles.all()],
                'goals': [g.name for g in user.goals.all()],
                'user_interests': [i.name for i in user.interests.all()],
                'industries': [ind.name for ind in user.industries.all()],
            }
        except User.DoesNotExist:
            logger.debug(f'User not found for taxonomy preferences: user_id={user_id}')

        # Get PersonalizationSettings (feature interests, discovery balance)
        try:
            settings = PersonalizationSettings.objects.only('excited_features', 'discovery_balance').get(
                user_id=user_id
            )

            feature_interests = {
                'excited_features': settings.excited_features or [],
                'discovery_balance': settings.discovery_balance,
            }
        except PersonalizationSettings.DoesNotExist:
            logger.debug(f'PersonalizationSettings not found: user_id={user_id}')

        return {
            'taxonomy_preferences': taxonomy_prefs,
            'feature_interests': feature_interests,
        }

    @classmethod
    def _calculate_total_xp(cls, user_id: int) -> int:
        """Calculate total XP from learning paths."""
        from django.db.models import Sum

        from core.learning_paths.models import UserLearningPath

        total = UserLearningPath.objects.filter(user_id=user_id).aggregate(total=Sum('topic_points'))['total']
        return total or 0

    @classmethod
    def _generate_learning_suggestions(
        cls,
        user_id: int,
        paths: list,
    ) -> list[LearningSuggestion]:
        """Generate learning suggestions based on member state."""
        from django.utils import timezone

        from core.learning_paths.models import UserConceptMastery

        suggestions: list[LearningSuggestion] = []
        seen_topics: set[str] = set()  # Track topics to avoid duplicates

        def add_suggestion(slug: str, name: str, reason: str, reason_display: str) -> bool:
            """Add suggestion if topic not already present. Returns True if added."""
            if slug in seen_topics:
                return False
            seen_topics.add(slug)
            suggestions.append(
                {
                    'topic': slug,
                    'topic_display': name,
                    'reason': reason,
                    'reason_display': reason_display,
                }
            )
            return True

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
                add_suggestion(
                    topic_taxonomy.slug,
                    topic_taxonomy.name,
                    'knowledge_gap',
                    'Needs practice',
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
                add_suggestion(
                    topic_taxonomy.slug,
                    topic_taxonomy.name,
                    'due_review',
                    'Due for review',
                )

        # 3. Continue recent activity
        if paths and len(suggestions) < 3:
            recent_path = paths[0]
            topic_taxonomy = recent_path.topic_taxonomy
            if topic_taxonomy:
                add_suggestion(
                    topic_taxonomy.slug,
                    topic_taxonomy.name,
                    'continue',
                    'Continue learning',
                )

        # 4. Fill with trending topics if needed
        # TODO: Consider making this configurable or pulling from database
        trending = [
            {'slug': 'ai-agents', 'name': 'AI Agents'},
            {'slug': 'rag', 'name': 'RAG'},
            {'slug': 'prompt-engineering', 'name': 'Prompt Engineering'},
        ]

        for topic in trending:
            if len(suggestions) >= 5:
                break
            add_suggestion(
                topic['slug'],
                topic['name'],
                'trending',
                'Popular topic',
            )

        return suggestions[:5]

    @classmethod
    def _get_semantic_intelligence(cls, user_id: int) -> dict:
        """
        Get Weaviate-powered semantic intelligence.

        Detects knowledge gaps and generates semantic suggestions
        based on the user's learning state.

        Args:
            user_id: User ID

        Returns:
            dict with 'detected_gaps' and 'semantic_suggestions'
        """
        detected_gaps: list[DetectedGap] = []
        semantic_suggestions: list[SemanticSuggestion] = []

        try:
            from services.agents.learning.components.gap_detector import get_gap_detector

            gap_detector = get_gap_detector()

            # Detect knowledge gaps (limit to top 5)
            gaps = gap_detector.detect_gaps(user_id, limit=5)
            for gap in gaps:
                detected_gaps.append(
                    {
                        'topic': gap.get('topic', ''),
                        'topic_display': gap.get('topic_display', ''),
                        'concept': gap.get('concept'),
                        'concept_id': gap.get('concept_id'),
                        'confidence': gap.get('confidence', 0.5),
                        'reason': gap.get('reason', 'unknown'),
                        'reason_display': gap.get('reason_display', 'Unknown'),
                    }
                )

            # Generate semantic suggestions from gaps
            # Convert high-confidence gaps to suggestions
            for gap in detected_gaps[:3]:
                if gap['confidence'] >= 0.5:
                    semantic_suggestions.append(
                        {
                            'topic': gap['topic'],
                            'topic_display': gap['topic_display'],
                            'reason': 'fills_gap',
                            'content_type': None,  # Could be enhanced with content matching
                            'content_id': None,
                        }
                    )

        except Exception as e:
            logger.warning(
                f'Failed to get semantic intelligence for user {user_id}: {e}',
                extra={'user_id': user_id},
            )

        return {
            'detected_gaps': detected_gaps,
            'semantic_suggestions': semantic_suggestions,
        }

    @classmethod
    def _get_feedback_context(cls, user_id: int) -> FeedbackContext | None:
        """
        Get aggregated human feedback context.

        Uses the FeedbackAggregator to collect insights from:
        - Conversation feedback (thumbs up/down)
        - Proactive offer responses
        - Content helpfulness ratings
        - Goal check-ins

        Returns:
            FeedbackContext or None if no feedback data exists
        """
        try:
            from services.feedback.aggregator import FeedbackAggregator

            aggregator = FeedbackAggregator(user_id)
            feedback_data = aggregator.get_for_member_context()

            # Return None if no meaningful feedback yet
            if not feedback_data or not feedback_data.get('preferences'):
                return None

            preferences = feedback_data['preferences']

            return {
                'preferences': {
                    'prefers_simple_explanations': preferences.get('prefers_simple_explanations', False),
                    'prefers_examples': preferences.get('prefers_examples', True),
                    'prefers_detailed_theory': preferences.get('prefers_detailed_theory', False),
                    'prefers_proactive_help': preferences.get('prefers_proactive_help', True),
                    'difficulty_sweet_spot': preferences.get('difficulty_sweet_spot', 'just_right'),
                    'best_content_types': preferences.get('best_content_types', []),
                    'problematic_topics': preferences.get('problematic_topics', []),
                },
                'proactive_acceptance_rate': feedback_data.get('proactive_acceptance_rate', 0),
                'satisfaction_trend': feedback_data.get('satisfaction_trend'),
                'current_blockers': feedback_data.get('current_blockers', []),
                'recent_struggles': feedback_data.get('recent_struggles', []),
            }

        except Exception as e:
            logger.warning(
                f'Failed to get feedback context for user {user_id}: {e}',
                extra={'user_id': user_id},
            )
            return None

    @classmethod
    def _get_profile_completion(
        cls,
        learning: LearningPreferences,
        tool_preferences: list[ToolPreference],
        interests: list[Interest],
        taxonomy_preferences: TaxonomyPreferences,
    ) -> ProfileCompletion:
        """
        Calculate profile completion score and identify missing fields.

        Used to trigger profile-building questions when gaps exist.

        Args:
            learning: Learning preferences from LearnerProfile
            tool_preferences: Auto-detected tool preferences
            interests: Auto-detected interests
            taxonomy_preferences: User-configured preferences

        Returns:
            ProfileCompletion with score (0.0-1.0) and missing_fields
        """
        missing_fields: list[str] = []
        total_fields = 0
        filled_fields = 0

        # Check learning preferences (priority 1-2 fields)
        learning_checks = [
            ('learning.learning_style', learning.get('learning_style'), ['mixed', '', None]),
            ('learning.difficulty_level', learning.get('difficulty_level'), ['beginner', '', None]),
            ('learning.learning_goal', learning.get('learning_goal'), ['exploring', '', None]),
            ('learning.session_length', learning.get('session_length'), [15, 0, None]),
        ]

        for field, value, defaults in learning_checks:
            total_fields += 1
            if value not in defaults:
                filled_fields += 1
            else:
                missing_fields.append(field)

        # Check tool preferences (priority 3)
        total_fields += 1
        if tool_preferences and len(tool_preferences) >= 1:
            filled_fields += 1
        else:
            missing_fields.append('tool_preferences')

        # Check interests (priority 3)
        total_fields += 1
        if interests and len(interests) >= 1:
            filled_fields += 1
        else:
            missing_fields.append('interests')

        # Check taxonomy personality (priority 4 - personality questions)
        total_fields += 1
        if taxonomy_preferences.get('personality'):
            filled_fields += 1
        else:
            missing_fields.append('personality.builder_vs_explorer')

        # Check user-configured goals (priority 2)
        total_fields += 1
        if taxonomy_preferences.get('goals') and len(taxonomy_preferences.get('goals', [])) >= 1:
            filled_fields += 1
        else:
            # Only add if learning_goal is also missing
            if 'learning.learning_goal' in missing_fields:
                pass  # Don't double-count
            else:
                missing_fields.append('personality.motivation_style')

        # Calculate score
        score = filled_fields / total_fields if total_fields > 0 else 0.0

        return {
            'score': round(score, 2),
            'missing_fields': missing_fields,
        }
