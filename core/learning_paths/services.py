"""
Learning Paths Services.

Provides:
- LearnerMemory: Two-tier memory (Redis hot cache + PostgreSQL)
- AdaptiveDifficultyService: Real-time difficulty adjustment
- MicroLessonService: 3-tier lesson hierarchy (curated → projects → AI)
- ProjectLearningService: Projects as learning content

See: /docs/AGENTIC_LEARNING_PATHS_PLAN.md
"""

import json
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.db import models
from django.db.models import F
from django.utils import timezone

from .models import (
    Concept,
    ContentGap,
    LearnerProfile,
    LearningEvent,
    MicroLesson,
    ProjectLearningMetadata,
    UserConceptMastery,
    UserLearningPath,
)

logger = logging.getLogger(__name__)


# ============================================================================
# LEARNER MEMORY - Two-tier caching
# ============================================================================


class LearnerMemory:
    """
    Two-tier memory: Redis hot cache + PostgreSQL persistence.

    Provides fast access to learner profiles for real-time learning interactions.
    """

    CACHE_PREFIX = 'learner:'
    CACHE_TTL = 3600  # 1 hour

    @classmethod
    def _cache_key(cls, user_id: int) -> str:
        return f'{cls.CACHE_PREFIX}{user_id}'

    # Default profile for anonymous/missing users
    DEFAULT_PROFILE = {
        'profile': {
            'preferred_learning_style': 'mixed',
            'current_difficulty_level': 'beginner',
            'preferred_session_length': 5,
            'learning_streak_days': 0,
            'total_lessons_completed': 0,
            'total_concepts_completed': 0,
            'allow_proactive_suggestions': True,
        },
        'recent_masteries': [],
        'streak_days': 0,
    }

    @classmethod
    async def get_profile(cls, user_id: int | None) -> dict:
        """
        Get learner profile from cache or database.

        Returns dict with:
        - profile: LearnerProfile fields
        - recent_masteries: Recent concept masteries
        - streak_days: Current streak

        If user_id is None or invalid, returns a default anonymous profile.
        """
        # Handle None or invalid user_id
        if not user_id:
            logger.debug('get_profile called with no user_id, returning default profile')
            return cls.DEFAULT_PROFILE.copy()

        try:
            cache_key = cls._cache_key(user_id)

            # Try cache first
            cached = cache.get(cache_key)
            if cached:
                return json.loads(cached)

            # Fall back to database
            profile_data = await cls._load_from_db(user_id)

            # Cache for future requests
            cache.set(cache_key, json.dumps(profile_data), cls.CACHE_TTL)

            return profile_data
        except Exception as e:
            logger.warning(f'Error fetching learner profile for user {user_id}: {e}')
            return cls.DEFAULT_PROFILE.copy()

    @classmethod
    @sync_to_async
    def _load_from_db(cls, user_id: int) -> dict:
        """Load profile data from database."""
        # Get or create profile
        profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)

        # Get recent masteries
        recent_masteries = list(
            UserConceptMastery.objects.filter(user_id=user_id)
            .exclude(mastery_level='unknown')
            .select_related('concept', 'concept__topic')
            .order_by('-updated_at')[:10]
            .values(
                'concept__name',
                'concept__slug',
                'concept__topic__slug',
                'concept__topic__name',
                'mastery_level',
                'mastery_score',
            )
        )

        return {
            'profile': {
                'preferred_learning_style': profile.preferred_learning_style,
                'current_difficulty_level': profile.current_difficulty_level,
                'preferred_session_length': profile.preferred_session_length,
                'learning_streak_days': profile.learning_streak_days,
                'total_lessons_completed': profile.total_lessons_completed,
                'total_concepts_completed': profile.total_concepts_completed,
                'allow_proactive_suggestions': profile.allow_proactive_suggestions,
            },
            'recent_masteries': recent_masteries,
            'streak_days': profile.learning_streak_days,
        }

    @classmethod
    async def invalidate(cls, user_id: int):
        """Invalidate cached profile."""
        cache.delete(cls._cache_key(user_id))

    @classmethod
    async def update_after_learning_event(cls, user_id: int, event: LearningEvent):
        """Update profile after a learning event."""
        # Invalidate cache so next read gets fresh data
        await cls.invalidate(user_id)

        # Update profile in database
        await cls._update_profile_stats(user_id, event)

    @classmethod
    @sync_to_async
    def _update_profile_stats(cls, user_id: int, event: LearningEvent):
        """Update profile statistics based on event."""
        profile, _ = LearnerProfile.objects.get_or_create(user_id=user_id)

        if event.event_type == 'micro_lesson':
            profile.total_lessons_completed = F('total_lessons_completed') + 1
        elif event.event_type == 'concept_completed':
            profile.total_concepts_completed = F('total_concepts_completed') + 1
        elif event.event_type == 'quiz_completed':
            profile.total_quizzes_completed = F('total_quizzes_completed') + 1

        profile.update_streak()

    @classmethod
    async def check_proactive_cooldown(cls, user_id: int) -> bool:
        """Check if user can receive a proactive nudge."""
        profile_data = await cls.get_profile(user_id)
        return profile_data['profile'].get('allow_proactive_suggestions', True)


# ============================================================================
# ADAPTIVE DIFFICULTY SERVICE
# ============================================================================


class AdaptiveDifficultyService:
    """Real-time difficulty adjustment based on user performance."""

    # Thresholds for difficulty adjustment
    INCREASE_THRESHOLD = 3  # Consecutive correct to increase difficulty
    DECREASE_THRESHOLD = 2  # Consecutive incorrect to decrease difficulty

    DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced']

    @classmethod
    def calculate_next_difficulty(
        cls,
        current: str,
        consecutive_correct: int,
        consecutive_incorrect: int,
    ) -> str:
        """Calculate next difficulty level based on performance."""
        current_idx = cls.DIFFICULTY_ORDER.index(current)

        if consecutive_correct >= cls.INCREASE_THRESHOLD:
            # Increase difficulty
            new_idx = min(current_idx + 1, len(cls.DIFFICULTY_ORDER) - 1)
            return cls.DIFFICULTY_ORDER[new_idx]
        elif consecutive_incorrect >= cls.DECREASE_THRESHOLD:
            # Decrease difficulty
            new_idx = max(current_idx - 1, 0)
            return cls.DIFFICULTY_ORDER[new_idx]

        return current

    @classmethod
    async def get_recommended_difficulty(cls, user_id: int, topic: str | None = None) -> str:
        """Get recommended difficulty for a user, optionally for a specific topic."""
        profile_data = await LearnerMemory.get_profile(user_id)
        base_difficulty = profile_data['profile']['current_difficulty_level']

        if not topic:
            return base_difficulty

        # Check topic-specific mastery
        masteries = profile_data.get('recent_masteries', [])
        topic_masteries = [m for m in masteries if m.get('concept__topic__slug') == topic]

        if not topic_masteries:
            return base_difficulty

        # Calculate average mastery for topic
        avg_score = sum(m.get('mastery_score', 0) for m in topic_masteries) / len(topic_masteries)

        if avg_score >= 0.8:
            return 'advanced'
        elif avg_score >= 0.5:
            return 'intermediate'
        return 'beginner'


# ============================================================================
# MICRO LESSON SERVICE - 3-tier hierarchy
# ============================================================================


class MicroLessonService:
    """
    Generates lessons using 3-tier hybrid approach:
    1. Curated (official) content - always preferred
    2. Highly-rated user projects demonstrating the concept
    3. AI-generated on-the-fly
    """

    @classmethod
    async def get_best_lesson(cls, concept: Concept, user_profile: dict) -> dict:
        """
        Get best available lesson using 3-tier hierarchy.

        Returns dict with:
        - source: 'curated' | 'project' | 'ai_generated'
        - lesson or project data
        """
        # Tier 1: Check for curated content
        curated = await cls._get_curated_lesson(concept, user_profile)
        if curated:
            return {'source': 'curated', 'lesson': curated}

        # Tier 2: Check for highly-rated projects demonstrating this concept
        project = await cls._get_project_lesson(concept)
        if project:
            return {'source': 'project', 'project': project}

        # Tier 3: Generate with AI
        generated = await cls._generate_ai_lesson(concept, user_profile)
        return {'source': 'ai_generated', 'lesson': generated}

    @classmethod
    @sync_to_async
    def _get_curated_lesson(cls, concept: Concept, user_profile: dict) -> dict | None:
        """Get curated lesson matching user's difficulty level."""
        difficulty = user_profile.get('current_difficulty_level', 'beginner')

        lesson = (
            MicroLesson.objects.filter(
                concept=concept,
                is_ai_generated=False,
                is_active=True,
                difficulty=difficulty,
            )
            .order_by('-positive_feedback_count')
            .first()
        )

        if not lesson:
            # Fall back to any difficulty
            lesson = (
                MicroLesson.objects.filter(
                    concept=concept,
                    is_ai_generated=False,
                    is_active=True,
                )
                .order_by('-positive_feedback_count')
                .first()
            )

        if lesson:
            return {
                'id': lesson.id,
                'title': lesson.title,
                'content': lesson.content_template,
                'lesson_type': lesson.lesson_type,
                'difficulty': lesson.difficulty,
                'estimated_minutes': lesson.estimated_minutes,
                'follow_up_prompts': lesson.follow_up_prompts,
            }
        return None

    @classmethod
    @sync_to_async
    def _get_project_lesson(cls, concept: Concept) -> dict | None:
        """Get highly-rated project demonstrating this concept."""
        metadata = (
            ProjectLearningMetadata.objects.filter(
                concepts=concept,
                is_learning_eligible=True,
            )
            .select_related('project', 'project__user')
            .order_by('-learning_quality_score')
            .first()
        )

        if metadata:
            project = metadata.project
            return {
                'id': project.id,
                'title': project.title,
                'slug': project.slug,
                'description': project.description[:500] if project.description else '',
                'author': {
                    'username': project.user.username,
                    'avatar_url': getattr(project.user, 'avatar_url', ''),
                },
                'key_techniques': metadata.key_techniques,
                'complexity_level': metadata.complexity_level,
                'learning_summary': metadata.learning_summary,
            }
        return None

    @classmethod
    async def _generate_ai_lesson(cls, concept: Concept, user_profile: dict) -> dict:
        """
        Generate AI lesson for concept.

        This returns a template that Ember will personalize in conversation.
        """
        difficulty = user_profile.get('current_difficulty_level', 'beginner')

        return {
            'title': f'Learn about {concept.name}',
            'content': cls._get_lesson_template(concept, difficulty),
            'lesson_type': 'explanation',
            'difficulty': difficulty,
            'estimated_minutes': concept.estimated_minutes,
            'is_ai_generated': True,
            'follow_up_prompts': [
                f'Can you give me an example of {concept.name}?',
                f'What are common mistakes when using {concept.name}?',
                f'How does {concept.name} compare to alternatives?',
            ],
        }

    @classmethod
    def _get_lesson_template(cls, concept: Concept, difficulty: str) -> str:
        """Generate a lesson template for AI to personalize."""
        difficulty_context = {
            'beginner': 'simple terms, avoiding jargon',
            'intermediate': 'moderate technical detail',
            'advanced': 'in-depth technical analysis',
        }

        return f"""Teach the user about **{concept.name}**.

**Topic context:** {concept.topic}
**Description:** {concept.description}
**Difficulty:** Explain in {difficulty_context.get(difficulty, 'simple terms')}

Use the Socratic method - guide discovery through questions.
Break complex concepts into digestible pieces.
Use analogies and real-world examples.
Always offer a "next step" without being pushy.
"""


# ============================================================================
# PROJECT LEARNING SERVICE
# ============================================================================


class ProjectLearningService:
    """Manages projects as learning content."""

    # Minimum thresholds for learning eligibility
    MIN_DESCRIPTION_LENGTH = 100
    MIN_VIEW_COUNT = 10

    @classmethod
    @sync_to_async
    def sync_learning_eligibility(cls, project_ids: list[int] | None = None):
        """
        Recalculate learning eligibility for projects.

        Can be run as Celery task for all eligible projects,
        or for specific projects after updates.
        """
        from core.projects.models import Project

        if project_ids:
            projects = Project.objects.filter(id__in=project_ids)
        else:
            # Get all potentially eligible projects
            projects = Project.objects.filter(
                is_private=False,
                is_archived=False,
                view_count__gte=cls.MIN_VIEW_COUNT,
            )

        updated_count = 0
        for project in projects:
            metadata, created = ProjectLearningMetadata.objects.get_or_create(project=project)
            metadata.calculate_eligibility()
            metadata.save()
            updated_count += 1

        logger.info(f'Updated learning eligibility for {updated_count} projects')
        return updated_count

    @classmethod
    @sync_to_async
    def get_projects_for_concept(cls, concept: Concept, limit: int = 5) -> list[dict]:
        """Get top projects demonstrating a concept."""
        metadatas = (
            ProjectLearningMetadata.objects.filter(
                concepts=concept,
                is_learning_eligible=True,
            )
            .select_related('project', 'project__user')
            .order_by('-learning_quality_score')[:limit]
        )

        return [
            {
                'project_id': m.project.id,
                'title': m.project.title,
                'slug': m.project.slug,
                'description': m.project.description[:200] if m.project.description else '',
                'author_username': m.project.user.username,
                'key_techniques': m.key_techniques,
                'complexity_level': m.complexity_level,
                'quality_score': m.learning_quality_score,
            }
            for m in metadatas
        ]

    @classmethod
    @sync_to_async
    def record_learning_usage(cls, project_id: int, user_id: int) -> bool:
        """
        Record when a project is used for learning.

        Awards XP to project creator if learning from someone else's project.
        Returns True if recorded successfully.
        """
        try:
            metadata = ProjectLearningMetadata.objects.get(project_id=project_id)
            metadata.times_used_for_learning = F('times_used_for_learning') + 1
            metadata.last_used_for_learning = timezone.now()
            metadata.save(update_fields=['times_used_for_learning', 'last_used_for_learning'])

            # Create learning event
            LearningEvent.objects.create(
                user_id=user_id,
                event_type='project_learned_from',
                project_id=project_id,
                payload={'project_title': metadata.project.title},
                xp_earned=5,
            )

            # Award XP to creator if different user
            if metadata.project.user_id != user_id:
                # TODO: Implement XP award to creator
                logger.info(f'Project {project_id} used for learning by user {user_id}')

            return True
        except ProjectLearningMetadata.DoesNotExist:
            return False

    @classmethod
    @sync_to_async
    def tag_project_concepts(cls, project_id: int, concept_slugs: list[str]) -> bool:
        """Tag a project with concepts it demonstrates."""
        try:
            metadata, _ = ProjectLearningMetadata.objects.get_or_create(project_id=project_id)
            concepts = Concept.objects.filter(slug__in=concept_slugs, is_active=True)
            metadata.concepts.set(concepts)
            metadata.calculate_eligibility()
            metadata.save()
            return True
        except Exception as e:
            logger.error(f'Error tagging project {project_id} with concepts: {e}')
            return False


# ============================================================================
# LEARNING EVENT SERVICE
# ============================================================================


class LearningEventService:
    """Service for creating and querying learning events."""

    @classmethod
    @sync_to_async
    def create_event(
        cls,
        user_id: int,
        event_type: str,
        concept_id: int | None = None,
        lesson_id: int | None = None,
        project_id: int | None = None,
        was_successful: bool | None = None,
        payload: dict | None = None,
        xp_earned: int = 0,
    ) -> LearningEvent:
        """Create a learning event."""
        event = LearningEvent.objects.create(
            user_id=user_id,
            event_type=event_type,
            concept_id=concept_id,
            lesson_id=lesson_id,
            project_id=project_id,
            was_successful=was_successful,
            payload=payload or {},
            xp_earned=xp_earned,
        )
        return event

    @classmethod
    @sync_to_async
    def get_recent_events(cls, user_id: int, limit: int = 20) -> list[dict]:
        """Get recent learning events for a user."""
        events = (
            LearningEvent.objects.filter(user_id=user_id)
            .select_related('concept', 'lesson')
            .order_by('-created_at')[:limit]
        )

        return [
            {
                'id': e.id,
                'event_type': e.event_type,
                'concept_name': e.concept.name if e.concept else None,
                'was_successful': e.was_successful,
                'xp_earned': e.xp_earned,
                'created_at': e.created_at.isoformat(),
                'payload': e.payload,
            }
            for e in events
        ]

    @classmethod
    @sync_to_async
    def get_learning_stats(cls, user_id: int, days: int = 30) -> dict:
        """Get learning statistics for a user over a time period."""
        from django.db.models import Count, Sum

        since = timezone.now() - timedelta(days=days)

        events = LearningEvent.objects.filter(
            user_id=user_id,
            created_at__gte=since,
        )

        stats = events.aggregate(
            total_events=Count('id'),
            total_xp=Sum('xp_earned'),
        )

        # Count by type
        by_type = events.values('event_type').annotate(count=Count('id')).order_by('-count')

        return {
            'total_events': stats['total_events'] or 0,
            'total_xp': stats['total_xp'] or 0,
            'events_by_type': {item['event_type']: item['count'] for item in by_type},
            'period_days': days,
        }


# ============================================================================
# STRUCTURED LEARNING PATH GENERATOR
# ============================================================================


class StructuredLearningPathGenerator:
    """
    Generates personalized structured learning paths based on user goals and behavior.

    Paths are generated based on:
    1. User-stated learning goal (from cold-start)
    2. Inferred interests from quiz/tool engagement
    3. Topic-based organization with concept ordering
    """

    # Map learning goals to starting topics
    GOAL_TO_START_TOPIC = {
        'build_projects': 'ai-agents-multitool',
        'understand_concepts': 'ai-models-research',
        'career': 'productivity',
        'exploring': 'chatbots-conversation',
    }

    # Default topic order for path generation
    DEFAULT_TOPIC_ORDER = [
        'chatbots-conversation',
        'prompts-templates',
        'images-video',
        'productivity',
        'developer-coding',
        'ai-agents-multitool',
        'ai-models-research',
        'data-analytics',
    ]

    @classmethod
    def generate_path(cls, user_id: int, goal: str | None = None) -> dict:
        """
        Generate a personalized learning path structure.

        Returns dict with:
        - topics: Ordered list of topics with concepts
        - current_focus_topic: Starting topic
        - overall_progress: 0.0 for new path
        """
        # Determine starting topic
        start_topic = cls.GOAL_TO_START_TOPIC.get(goal) if goal else None

        if not start_topic:
            # Infer from behavior
            start_topic = cls._infer_start_topic_from_behavior(user_id)

        if not start_topic:
            # Default
            start_topic = 'chatbots-conversation'

        # Get ordered topics starting from the goal-appropriate one
        ordered_topics = cls._get_ordered_topics(start_topic)

        # Build path structure with concepts
        topics_data = []
        for topic_slug in ordered_topics:
            concepts = list(
                Concept.objects.filter(topic=topic_slug, is_active=True)
                .order_by('base_difficulty', 'name')
                .values('id', 'name', 'slug', 'description', 'base_difficulty', 'estimated_minutes')
            )

            if concepts:
                topics_data.append(
                    {
                        'slug': topic_slug,
                        'name': cls._get_topic_display(topic_slug),
                        'concepts': concepts,
                        'progress': 0.0,
                    }
                )

        return {
            'topics': topics_data,
            'current_focus_topic': start_topic,
            'overall_progress': 0.0,
            'generated_at': timezone.now().isoformat(),
        }

    @classmethod
    def _infer_start_topic_from_behavior(cls, user_id: int) -> str | None:
        """Infer best starting topic from user behavior."""
        from core.quizzes.models import QuizAttempt

        # Check quiz completions
        quiz_topics = (
            QuizAttempt.objects.filter(user_id=user_id, completed_at__isnull=False)
            .values('quiz__topic')
            .annotate(count=models.Count('id'))
            .order_by('-count')
            .first()
        )

        if quiz_topics:
            return quiz_topics.get('quiz__topic')

        # Check concept masteries
        mastered_topics = (
            UserConceptMastery.objects.filter(user_id=user_id)
            .exclude(mastery_level='unknown')
            .values('concept__topic')
            .annotate(count=models.Count('id'))
            .order_by('-count')
            .first()
        )

        if mastered_topics:
            return mastered_topics.get('concept__topic')

        return None

    @classmethod
    def _get_ordered_topics(cls, start_topic: str) -> list[str]:
        """Get topics ordered starting from the given topic."""
        if start_topic in cls.DEFAULT_TOPIC_ORDER:
            start_idx = cls.DEFAULT_TOPIC_ORDER.index(start_topic)
            return cls.DEFAULT_TOPIC_ORDER[start_idx:] + cls.DEFAULT_TOPIC_ORDER[:start_idx]
        return cls.DEFAULT_TOPIC_ORDER

    @classmethod
    def _get_topic_display(cls, topic_slug: str) -> str:
        """Get human-readable topic name from Taxonomy."""
        from core.taxonomy.models import Taxonomy

        taxonomy = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic', is_active=True).first()
        if taxonomy:
            return taxonomy.name
        return topic_slug.replace('-', ' ').title()

    @classmethod
    def get_user_path(cls, user_id: int) -> dict:
        """
        Get user's current structured path with progress calculated.

        Returns the path structure enriched with:
        - Progress per topic
        - Concept mastery status
        - Current focus
        - Overall progress
        """
        # Get or create profile
        profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)

        # If no generated path, generate one
        if not profile.generated_path:
            path_data = cls.generate_path(user_id, profile.learning_goal or None)
            profile.generated_path = path_data
            profile.path_generated_at = timezone.now()
            profile.current_focus_topic = path_data.get('current_focus_topic', '')
            profile.save()

        # Enrich path with current progress
        path = profile.generated_path.copy()

        # Get all user masteries
        masteries = {
            m.concept_id: m for m in UserConceptMastery.objects.filter(user_id=user_id).select_related('concept')
        }

        total_concepts = 0
        completed_concepts = 0

        for topic in path.get('topics', []):
            topic_completed = 0
            topic_total = len(topic.get('concepts', []))
            total_concepts += topic_total

            enriched_concepts = []
            for concept_data in topic.get('concepts', []):
                concept_id = concept_data.get('id')
                mastery = masteries.get(concept_id)

                status = 'locked'
                mastery_score = 0.0

                if mastery:
                    mastery_score = mastery.mastery_score
                    if mastery.mastery_level in ('proficient', 'expert'):
                        status = 'completed'
                        topic_completed += 1
                        completed_concepts += 1
                    elif mastery.mastery_level in ('learning', 'practicing'):
                        status = 'in_progress'
                    else:
                        status = 'available'
                else:
                    # First concept in topic or after completed one is available
                    if len(enriched_concepts) == 0 or (
                        enriched_concepts and enriched_concepts[-1].get('status') == 'completed'
                    ):
                        status = 'available'

                enriched_concepts.append(
                    {
                        **concept_data,
                        'status': status,
                        'mastery_score': mastery_score,
                        'has_quiz': True,  # Assume all concepts have quizzes for now
                    }
                )

            topic['concepts'] = enriched_concepts
            topic['progress'] = (topic_completed / topic_total) if topic_total > 0 else 0.0

        path['overall_progress'] = (completed_concepts / total_concepts) if total_concepts > 0 else 0.0
        path['current_focus_topic'] = profile.current_focus_topic
        path['has_completed_path_setup'] = profile.has_completed_path_setup
        path['learning_goal'] = profile.learning_goal

        return path

    @classmethod
    def complete_learning_setup(cls, user_id: int, learning_goal: str) -> dict:
        """
        Complete the cold-start learning setup.

        Generates a personalized path based on the goal and marks setup as complete.
        """
        profile, _ = LearnerProfile.objects.get_or_create(user_id=user_id)

        # Generate path based on goal
        path_data = cls.generate_path(user_id, learning_goal)

        # Update profile
        profile.learning_goal = learning_goal
        profile.generated_path = path_data
        profile.path_generated_at = timezone.now()
        profile.current_focus_topic = path_data.get('current_focus_topic', '')
        profile.has_completed_path_setup = True
        profile.save()

        # Return the enriched path
        return cls.get_user_path(user_id)


# ============================================================================
# CONTENT GAP SERVICE - Track unmet content requests
# ============================================================================


class ContentGapService:
    """
    Track and manage content gaps for prioritizing content creation.

    When users request topic+modality combinations that return insufficient content,
    we log it here to inform content strategy.
    """

    GAP_THRESHOLD = 3  # Log gap if < 3 results returned

    @classmethod
    @sync_to_async
    def record_gap(
        cls,
        topic: str,
        modality: str,
        results_count: int,
        user_id: int | None = None,
        gap_type: str = 'missing_topic',
        context: dict | None = None,
    ) -> ContentGap | None:
        """
        Record a content gap request.

        Only records if results_count is below threshold.
        Increments count if gap already exists.
        """
        from django.utils.text import slugify

        from core.taxonomy.models import Taxonomy

        if results_count >= cls.GAP_THRESHOLD:
            return None

        normalized = slugify(topic.lower().strip())[:200]

        try:
            # Try to find a matching taxonomy for the topic
            topic_taxonomy = Taxonomy.objects.filter(slug=normalized, taxonomy_type='topic', is_active=True).first()

            gap, created = ContentGap.objects.get_or_create(
                topic=topic_taxonomy,
                modality=modality,
                defaults={
                    'gap_type': gap_type,
                    'results_returned': results_count,
                    'first_requested_by_id': user_id,
                    'context': context or {},
                },
            )

            if not created:
                # Increment request count
                ContentGap.objects.filter(id=gap.id).update(
                    request_count=F('request_count') + 1,
                    last_requested_at=timezone.now(),
                )
                gap.refresh_from_db()

            topic_name = topic_taxonomy.name if topic_taxonomy else topic
            logger.info(f'Recorded content gap: {topic_name}/{modality} (count: {gap.request_count})')
            return gap

        except Exception as e:
            logger.warning(f'Failed to record content gap: {e}')
            return None

    @classmethod
    @sync_to_async
    def get_priority_gaps(cls, limit: int = 20) -> list[dict]:
        """Get top priority gaps for content creation."""
        gaps = (
            ContentGap.objects.filter(status='pending')
            .select_related('topic')
            .order_by('-unique_user_count', '-request_count')[:limit]
        )

        return [
            {
                'id': g.id,
                'topic': g.topic.name if g.topic else None,
                'topic_slug': g.topic.slug if g.topic else None,
                'modality': g.modality,
                'gap_type': g.gap_type,
                'request_count': g.request_count,
                'unique_user_count': g.unique_user_count,
                'first_requested_at': g.first_requested_at.isoformat(),
                'last_requested_at': g.last_requested_at.isoformat(),
            }
            for g in gaps
        ]

    @classmethod
    @sync_to_async
    def resolve_gap(cls, gap_id: int, resolution_notes: str = '') -> bool:
        """Mark a content gap as resolved."""
        try:
            ContentGap.objects.filter(id=gap_id).update(
                status='resolved',
                resolved_at=timezone.now(),
                resolution_notes=resolution_notes,
            )
            return True
        except Exception as e:
            logger.error(f'Failed to resolve content gap {gap_id}: {e}')
            return False


# ============================================================================
# LEARNING CONTENT SERVICE - Unified content discovery
# ============================================================================


class LearningContentService:
    """
    Unified content discovery service with modality-aware routing.

    Provides:
    - Topic suggestions based on user activity, goals, and gaps
    - Available modalities for a topic (only those with content)
    - Content matching topic + modality with AI fallback
    """

    # Modality definitions
    MODALITY_CHOICES = [
        ('video', 'Watch a Video', 'Video tutorials and demos'),
        ('long-reads', 'Read an Article', 'In-depth articles and docs'),
        ('microlearning', 'Quick Lesson', 'Short 5-10 min lessons'),
        ('quiz-challenges', 'Take a Quiz', 'Test your knowledge'),
        ('games', 'Play a Game', 'Interactive learning games'),
        ('projects', 'Study a Project', 'Learn from examples'),
    ]

    # Map modalities to content sources
    MODALITY_CONTENT_MAP = {
        'video': ['youtube', 'video_projects'],
        'long-reads': ['rss_articles', 'micro_lessons'],
        'microlearning': ['micro_lessons'],
        'quiz-challenges': ['quizzes', 'side_quests'],
        'games': ['games'],
        'projects': ['projects'],
    }

    @classmethod
    async def get_topic_suggestions(cls, user_id: int, limit: int = 5) -> list[dict]:
        """
        Get balanced topic suggestions from multiple signals.

        Sources (balanced mix):
        - 40% from knowledge gaps (low mastery concepts)
        - 40% from active learning paths
        - 20% from due reviews (spaced repetition)
        """
        suggestions = []

        # Get gap suggestions (concepts with low mastery)
        gap_suggestions = await cls._get_gap_suggestions(user_id, limit=2)
        suggestions.extend(gap_suggestions)

        # Get path suggestions (active learning paths)
        path_suggestions = await cls._get_path_suggestions(user_id, limit=2)
        suggestions.extend(path_suggestions)

        # Get review suggestions (due for spaced repetition)
        review_suggestions = await cls._get_review_suggestions(user_id, limit=1)
        suggestions.extend(review_suggestions)

        # Deduplicate and limit
        seen_topics = set()
        unique_suggestions = []
        for s in suggestions:
            topic_key = s.get('topic_slug') or s.get('topic')
            if topic_key and topic_key not in seen_topics:
                seen_topics.add(topic_key)
                unique_suggestions.append(s)

        return unique_suggestions[:limit]

    @classmethod
    @sync_to_async
    def _get_gap_suggestions(cls, user_id: int, limit: int = 2) -> list[dict]:
        """Get suggestions based on knowledge gaps."""
        # Find concepts where user has low mastery
        low_mastery = (
            UserConceptMastery.objects.filter(user_id=user_id, mastery_level__in=['unknown', 'aware', 'learning'])
            .select_related('concept')
            .order_by('mastery_score')[:limit]
        )

        suggestions = []
        for m in low_mastery:
            suggestions.append(
                {
                    'topic': m.concept.name,
                    'topic_slug': m.concept.slug,
                    'topic_display': m.concept.name,
                    'reason': 'knowledge_gap',
                    'reason_display': 'You could use more practice here',
                    'mastery_level': m.mastery_level,
                }
            )

        return suggestions

    @classmethod
    @sync_to_async
    def _get_path_suggestions(cls, user_id: int, limit: int = 2) -> list[dict]:
        """Get suggestions based on active learning paths."""
        # Get user's active learning paths
        paths = (
            UserLearningPath.objects.filter(user_id=user_id)
            .select_related('topic')
            .order_by('-last_activity_at')[:limit]
        )

        suggestions = []
        for path in paths:
            # Topic is now always a FK to Taxonomy
            if path.topic:
                topic_slug = path.topic.slug
                topic_display = path.topic.name
            else:
                topic_slug = ''
                topic_display = ''

            suggestions.append(
                {
                    'topic': topic_slug,
                    'topic_slug': topic_slug,
                    'topic_display': topic_display,
                    'reason': 'active_path',
                    'reason_display': 'Continue your journey',
                    'skill_level': path.current_skill_level,
                    'progress': path.progress_percentage,
                }
            )

        return suggestions

    @classmethod
    @sync_to_async
    def _get_review_suggestions(cls, user_id: int, limit: int = 1) -> list[dict]:
        """Get suggestions for concepts due for review."""
        now = timezone.now()
        due_reviews = (
            UserConceptMastery.objects.filter(user_id=user_id, next_review_at__lte=now)
            .select_related('concept', 'concept__topic')
            .order_by('next_review_at')[:limit]
        )

        suggestions = []
        for m in due_reviews:
            # Topic is now always a FK to Taxonomy
            if m.concept.topic:
                topic_display = m.concept.topic.name
            else:
                topic_display = m.concept.name

            suggestions.append(
                {
                    'topic': m.concept.name,
                    'topic_slug': m.concept.slug,
                    'topic_display': topic_display,
                    'reason': 'due_review',
                    'reason_display': 'Time for a quick review!',
                    'mastery_level': m.mastery_level,
                }
            )

        return suggestions

    @classmethod
    async def get_available_modalities(cls, topic: str, user_id: int) -> list[dict]:
        """
        Get modalities that have content for this topic.

        Only returns modalities with actual content (hides empty ones).
        """
        topic_slug = cls._normalize_topic(topic)
        available = []

        for modality, display, description in cls.MODALITY_CHOICES:
            count = await cls._count_content(topic_slug, modality)
            if count > 0:
                available.append(
                    {
                        'modality': modality,
                        'display': display,
                        'description': description,
                        'available_count': count,
                    }
                )

        return available

    @classmethod
    def _normalize_topic(cls, topic: str) -> str:
        """Normalize topic string to slug format."""
        from django.utils.text import slugify

        return slugify(topic.lower().strip())

    @classmethod
    @sync_to_async
    def _count_content(cls, topic: str, modality: str) -> int:
        """Count available content for topic+modality."""
        count = 0

        try:
            if modality == 'video':
                # Count YouTube videos and video projects
                from core.integrations.youtube_feed_models import YouTubeFeedVideo

                count += YouTubeFeedVideo.objects.filter(
                    models.Q(tags__icontains=topic)
                    | models.Q(project__title__icontains=topic)
                    | models.Q(project__topics__name__icontains=topic)
                ).count()

            elif modality == 'quiz-challenges':
                # Count quizzes
                from core.quizzes.models import Quiz

                count += (
                    Quiz.objects.filter(
                        is_published=True,
                    )
                    .filter(models.Q(topic__icontains=topic) | models.Q(topics__name__icontains=topic))
                    .count()
                )

            elif modality in ('microlearning', 'long-reads'):
                # Count micro lessons
                count += (
                    MicroLesson.objects.filter(
                        is_active=True,
                    )
                    .filter(
                        models.Q(concept__slug__icontains=topic)
                        | models.Q(concept__name__icontains=topic)
                        | models.Q(concept__topic__icontains=topic)
                    )
                    .count()
                )

            elif modality == 'projects':
                # Count learning-eligible projects
                count += (
                    ProjectLearningMetadata.objects.filter(
                        is_learning_eligible=True,
                    )
                    .filter(
                        models.Q(key_techniques__icontains=topic)
                        | models.Q(project__title__icontains=topic)
                        | models.Q(project__topics__name__icontains=topic)
                    )
                    .count()
                )

            elif modality == 'games':
                # Count game-related content
                # Inline games are always available for certain topics
                if topic in ['ai', 'quiz', 'trivia', 'knowledge', 'focus', 'break', 'fun', 'casual']:
                    count += 1  # At least one inline game available
                # Count game projects
                count += (
                    ProjectLearningMetadata.objects.filter(
                        is_learning_eligible=True,
                        project__topics__name__icontains='games',
                    )
                    .filter(models.Q(key_techniques__icontains=topic) | models.Q(project__title__icontains=topic))
                    .count()
                )

        except Exception as e:
            logger.warning(f'Error counting content for {topic}/{modality}: {e}')

        return count

    @classmethod
    async def get_content(cls, topic: str, modality: str, user_id: int) -> dict:
        """
        Get content matching topic + modality.

        Returns content if available, or AI context for fallback generation.
        Logs content gap if insufficient content.
        """
        from core.taxonomy.models import Taxonomy

        topic_slug = cls._normalize_topic(topic)
        topic_display = topic.replace('-', ' ').title()

        # Get topic display name from Taxonomy
        taxonomy = Taxonomy.objects.filter(slug=topic_slug, taxonomy_type='topic', is_active=True).first()
        if taxonomy:
            topic_display = taxonomy.name

        # Route to appropriate handler
        handlers = {
            'video': cls._get_video_content,
            'quiz-challenges': cls._get_quiz_content,
            'microlearning': cls._get_micro_lesson_content,
            'long-reads': cls._get_micro_lesson_content,
            'games': cls._get_games_content,
            'projects': cls._get_project_content,
        }

        handler = handlers.get(modality, cls._get_micro_lesson_content)
        result = await handler(topic_slug, user_id)

        items = result.get('items', [])

        # Log content gap if insufficient
        if len(items) < ContentGapService.GAP_THRESHOLD:
            await ContentGapService.record_gap(
                topic=topic,
                modality=modality,
                results_count=len(items),
                user_id=user_id,
                gap_type='modality_gap' if len(items) > 0 else 'missing_topic',
            )

        # Build response
        if items:
            return {
                'has_content': True,
                'source_type': result.get('source_type', 'curated'),
                'content_type': modality,
                'items': items,
                'topic': topic_slug,
                'topic_display': topic_display,
                'content_gap_logged': len(items) < ContentGapService.GAP_THRESHOLD,
                'follow_up_prompts': [
                    'Want me to summarize the key points?',
                    'Ready to test your knowledge with a quiz?',
                    'Would you like to explore a related topic?',
                ],
            }
        else:
            # AI fallback
            profile_data = await LearnerMemory.get_profile(user_id)
            difficulty = profile_data['profile']['current_difficulty_level']
            learning_style = profile_data['profile']['preferred_learning_style']

            guidance = {
                'beginner': 'Use simple terms, analogies, and real-world examples. Avoid jargon.',
                'intermediate': 'Include technical terms but explain them. Focus on practical application.',
                'advanced': 'Be technical. Cover edge cases and advanced patterns.',
            }.get(difficulty, 'Explain clearly and engagingly.')

            modality_guidance = {
                'video': 'Since they wanted video, make your explanation visual with step-by-step descriptions.',
                'long-reads': 'Structure this like an article with clear sections and depth.',
                'quiz-challenges': 'Since no quiz exists, offer to ask them some questions to test their knowledge.',
                'projects': 'Guide them through a practical exercise they can try.',
            }.get(modality, '')

            return {
                'has_content': False,
                'source_type': 'ai_generated',
                'content_type': modality,
                'topic': topic_slug,
                'topic_display': topic_display,
                'content_gap_logged': True,
                'ai_context': {
                    'topic': topic_slug,
                    'topic_display': topic_display,
                    'modality': modality,
                    'difficulty': difficulty,
                    'learning_style': learning_style,
                    'guidance': f'{guidance} {modality_guidance}'.strip(),
                },
                'message': (
                    f"I don't have a specific {modality} on {topic_display} yet, " 'but let me help you learn about it!'
                ),
                'alternative_modalities': await cls.get_available_modalities(topic, user_id),
                'follow_up_prompts': [
                    'Would you like me to explain it another way?',
                    'Want to try a different format instead?',
                    'Should we explore a related topic?',
                ],
            }

    @classmethod
    @sync_to_async
    def _get_video_content(cls, topic: str, user_id: int) -> dict:
        """Query YouTube videos matching topic."""
        try:
            from core.integrations.youtube_feed_models import YouTubeFeedVideo

            videos = list(
                YouTubeFeedVideo.objects.filter(
                    models.Q(project__topics__name__icontains=topic)
                    | models.Q(tags__icontains=topic)
                    | models.Q(project__title__icontains=topic)
                )
                .exclude(project__is_private=True)
                .select_related('project', 'project__user')
                .order_by('-view_count', '-published_at')[:5]
            )

            if videos:
                return {
                    'source_type': 'external',
                    'items': [
                        {
                            'id': str(v.video_id),
                            'title': v.project.title if v.project else v.title,
                            'url': v.youtube_url,
                            'thumbnail': v.thumbnail_url,
                            'featured_image_url': v.thumbnail_url,
                            'duration_seconds': v.duration_seconds if hasattr(v, 'duration_seconds') else None,
                            'view_count': v.view_count,
                            'source_name': v.channel_name if hasattr(v, 'channel_name') else 'YouTube',
                            'author_username': v.project.user.username if v.project else None,
                            'author_avatar_url': v.project.user.avatar_url if v.project else None,
                            'published_at': v.published_at.isoformat() if v.published_at else None,
                        }
                        for v in videos
                    ],
                }
        except Exception as e:
            logger.warning(f'Error querying video content for {topic}: {e}')

        return {'source_type': 'external', 'items': []}

    @classmethod
    @sync_to_async
    def _get_quiz_content(cls, topic: str, user_id: int) -> dict:
        """Query quizzes matching topic."""
        try:
            from core.quizzes.models import Quiz

            quizzes = list(
                Quiz.objects.filter(is_published=True)
                .filter(
                    models.Q(topic__icontains=topic)
                    | models.Q(topics__name__icontains=topic)
                    | models.Q(title__icontains=topic)
                )
                .order_by('difficulty', '-created_at')[:5]
            )

            if quizzes:
                return {
                    'source_type': 'curated',
                    'items': [
                        {
                            'id': str(q.id),
                            'title': q.title,
                            'slug': q.slug,
                            'description': q.description[:200] if q.description else '',
                            'difficulty': q.difficulty,
                            'question_count': q.question_count if hasattr(q, 'question_count') else 0,
                            'estimated_time': q.estimated_time,
                            'url': f'/quizzes/{q.slug}' if q.slug else f'/quizzes/{q.id}',
                        }
                        for q in quizzes
                    ],
                }
        except Exception as e:
            logger.warning(f'Error querying quiz content for {topic}: {e}')

        return {'source_type': 'curated', 'items': []}

    @classmethod
    @sync_to_async
    def _get_micro_lesson_content(cls, topic: str, user_id: int) -> dict:
        """Query micro lessons matching topic."""
        lessons = list(
            MicroLesson.objects.filter(is_active=True)
            .filter(
                models.Q(concept__slug__icontains=topic)
                | models.Q(concept__name__icontains=topic)
                | models.Q(concept__topic__icontains=topic)
                | models.Q(title__icontains=topic)
            )
            .select_related('concept')
            .order_by('-positive_feedback_count', 'difficulty')[:5]
        )

        if lessons:
            return {
                'source_type': 'curated',
                'items': [
                    {
                        'id': lesson.id,
                        'title': lesson.title,
                        'slug': lesson.slug,
                        'concept_name': lesson.concept.name if lesson.concept else '',
                        'lesson_type': lesson.lesson_type,
                        'difficulty': lesson.difficulty,
                        'estimated_minutes': lesson.estimated_minutes,
                        'content_preview': lesson.content_template[:200] if lesson.content_template else '',
                    }
                    for lesson in lessons
                ],
            }

        return {'source_type': 'curated', 'items': []}

    @classmethod
    @sync_to_async
    def _get_project_content(cls, topic: str, user_id: int) -> dict:
        """Query learning-eligible projects matching topic."""
        metadatas = list(
            ProjectLearningMetadata.objects.filter(is_learning_eligible=True)
            .filter(
                models.Q(key_techniques__icontains=topic)
                | models.Q(project__title__icontains=topic)
                | models.Q(project__topics__name__icontains=topic)
            )
            .select_related('project', 'project__user')
            .order_by('-learning_quality_score')[:5]
        )

        if metadatas:
            return {
                'source_type': 'project',
                'items': [
                    {
                        'id': str(m.project.id),
                        'title': m.project.title,
                        'slug': m.project.slug,
                        'description': m.project.description[:200] if m.project.description else '',
                        'featured_image_url': m.project.featured_image_url or '',
                        'author_username': m.project.user.username,
                        'author_avatar_url': m.project.user.avatar_url or '',
                        'key_techniques': m.key_techniques,
                        'complexity_level': m.complexity_level,
                        'quality_score': m.learning_quality_score,
                        'url': f'/{m.project.user.username}/{m.project.slug}',
                    }
                    for m in metadatas
                ],
            }

        return {'source_type': 'project', 'items': []}

    @classmethod
    @sync_to_async
    def _get_games_content(cls, topic: str, user_id: int) -> dict:
        """
        Query interactive games/experiences matching topic.

        Returns games from projects with 'games-interactive' topic
        or inline games if they match the learning topic.
        """
        # First check for inline games that might be relevant
        inline_games = []
        if topic in ['ai', 'quiz', 'trivia', 'knowledge']:
            inline_games = [
                {
                    'id': 'quiz',
                    'title': 'AI Knowledge Quiz',
                    'type': 'inline_game',
                    'description': 'Test your AI knowledge with fun trivia!',
                    'game_id': 'quiz',
                    'url': None,  # Inline games don't have URLs
                }
            ]
        if topic in ['focus', 'break', 'fun', 'casual']:
            inline_games.append(
                {
                    'id': 'snake',
                    'title': 'Snake Game',
                    'type': 'inline_game',
                    'description': 'Take a fun break with classic Snake!',
                    'game_id': 'snake',
                    'url': None,
                }
            )

        # Check for game projects in the database
        try:
            game_projects = list(
                ProjectLearningMetadata.objects.filter(
                    is_learning_eligible=True,
                    project__topics__name__icontains='games',
                )
                .filter(
                    models.Q(key_techniques__icontains=topic)
                    | models.Q(project__title__icontains=topic)
                    | models.Q(project__description__icontains=topic)
                )
                .select_related('project', 'project__user')
                .order_by('-learning_quality_score')[:5]
            )

            project_items = [
                {
                    'id': str(m.project.id),
                    'title': m.project.title,
                    'slug': m.project.slug,
                    'type': 'project_game',
                    'description': m.project.description[:200] if m.project.description else '',
                    'author_username': m.project.user.username,
                    'url': f'/projects/{m.project.slug}',
                }
                for m in game_projects
            ]
        except Exception as e:
            logger.warning(f'Error querying game projects for {topic}: {e}')
            project_items = []

        all_items = inline_games + project_items

        if all_items:
            return {
                'source_type': 'games',
                'items': all_items,
            }

        return {'source_type': 'games', 'items': []}
