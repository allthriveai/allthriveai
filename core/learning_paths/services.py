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
    LearnerProfile,
    LearningEvent,
    MicroLesson,
    ProjectLearningMetadata,
    UserConceptMastery,
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

    @classmethod
    async def get_profile(cls, user_id: int) -> dict:
        """
        Get learner profile from cache or database.

        Returns dict with:
        - profile: LearnerProfile fields
        - recent_masteries: Recent concept masteries
        - streak_days: Current streak
        """
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
            .select_related('concept')
            .order_by('-updated_at')[:10]
            .values(
                'concept__name',
                'concept__slug',
                'concept__topic',
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
        topic_masteries = [m for m in masteries if m.get('concept__topic') == topic]

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
        """Get human-readable topic name."""
        from .models import UserLearningPath

        return UserLearningPath.get_topic_display_name(topic_slug)

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
