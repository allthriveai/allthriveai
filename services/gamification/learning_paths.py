"""
Learning Path Service.

Generates and tracks personalized learning paths based on user activity.
"""

import logging

from django.db import transaction
from django.db.models import Q

from core.learning_paths.models import UserLearningPath
from core.quizzes.models import Quiz, QuizAttempt
from core.thrive_circle.models import SideQuest, UserSideQuest

logger = logging.getLogger(__name__)


# Map quiz topics to learning path topics
# Quiz topics may use different naming conventions
QUIZ_TOPIC_TO_PATH_TOPIC = {
    # Direct mappings
    'chatbots': 'chatbots-conversation',
    'conversation': 'chatbots-conversation',
    'chatbots-conversation': 'chatbots-conversation',
    'websites': 'websites-apps',
    'apps': 'websites-apps',
    'websites-apps': 'websites-apps',
    'images': 'images-video',
    'video': 'images-video',
    'images-video': 'images-video',
    'design': 'design-ui',
    'ui': 'design-ui',
    'mockups': 'design-ui',
    'design-ui': 'design-ui',
    'creative-media': 'video-creative-media',
    'video-creative-media': 'video-creative-media',
    'podcasts': 'podcasts-education',
    'education': 'podcasts-education',
    'podcasts-education': 'podcasts-education',
    'games': 'games-interactive',
    'interactive': 'games-interactive',
    'games-interactive': 'games-interactive',
    'workflows': 'workflows-automation',
    'automation': 'workflows-automation',
    'workflows-automation': 'workflows-automation',
    'productivity': 'productivity',
    'developer': 'developer-coding',
    'coding': 'developer-coding',
    'developer-coding': 'developer-coding',
    'prompts': 'prompts-templates',
    'templates': 'prompts-templates',
    'prompts-templates': 'prompts-templates',
    'thought-experiments': 'thought-experiments',
    'wellness': 'wellness-growth',
    'personal-growth': 'wellness-growth',
    'wellness-growth': 'wellness-growth',
    'ai-agents': 'ai-agents-multitool',
    'agents': 'ai-agents-multitool',
    'ai-agents-multitool': 'ai-agents-multitool',
    'ai-models': 'ai-models-research',
    'research': 'ai-models-research',
    'ai-models-research': 'ai-models-research',
    'data': 'data-analytics',
    'analytics': 'data-analytics',
    'data-analytics': 'data-analytics',
}

# Points awarded for different activities
POINTS_CONFIG = {
    'quiz_completed': 20,
    'quiz_perfect_score': 30,
    'sidequest_easy': 15,
    'sidequest_medium': 25,
    'sidequest_hard': 40,
    'sidequest_epic': 60,
}


class LearningPathService:
    """Service for managing user learning paths."""

    def map_quiz_topic_to_path_topic(self, quiz_topic: str) -> str | None:
        """Map a quiz topic to a learning path topic."""
        if not quiz_topic:
            return None
        # Normalize to lowercase and try direct lookup
        normalized = quiz_topic.lower().strip()
        return QUIZ_TOPIC_TO_PATH_TOPIC.get(normalized)

    def get_or_create_path(self, user, topic: str) -> UserLearningPath:
        """Get or create a learning path for a user and topic."""
        path, created = UserLearningPath.objects.get_or_create(
            user=user,
            topic=topic,
            defaults={
                'quizzes_total': self._count_quizzes_for_topic(topic),
                'side_quests_total': self._count_sidequests_for_topic(topic),
            },
        )
        if created:
            logger.info(f'Created new learning path for {user.username} in {topic}')
        return path

    def _count_quizzes_for_topic(self, topic: str) -> int:
        """Count available quizzes for a topic."""
        # Check both topic field and topics array
        return (
            Quiz.objects.filter(is_published=True).filter(Q(topic__iexact=topic) | Q(topics__contains=[topic])).count()
        )

    def _count_sidequests_for_topic(self, topic: str) -> int:
        """Count available side quests for a topic."""
        return SideQuest.objects.filter(topic=topic, is_active=True).count()

    @transaction.atomic
    def update_path_on_quiz_completion(self, user, topic: str, quiz_attempt: QuizAttempt) -> UserLearningPath:
        """Update learning path after a quiz is completed."""
        path = self.get_or_create_path(user, topic)

        # Calculate points for this quiz
        points = POINTS_CONFIG['quiz_completed']
        if quiz_attempt.score == quiz_attempt.total_questions:
            points += POINTS_CONFIG['quiz_perfect_score']

        # Update path
        path.quizzes_completed = (
            QuizAttempt.objects.filter(
                user=user,
                completed_at__isnull=False,
            )
            .filter(Q(quiz__topic__iexact=topic) | Q(quiz__topics__contains=[topic]))
            .values('quiz')
            .distinct()
            .count()
        )

        path.topic_points += points
        path.quizzes_total = self._count_quizzes_for_topic(topic)

        # Recalculate skill level
        old_level = path.current_skill_level
        path.current_skill_level = path.calculate_skill_level()

        path.save()

        if old_level != path.current_skill_level:
            logger.info(f'User {user.username} leveled up in {topic}: {old_level} -> {path.current_skill_level}')

        return path

    @transaction.atomic
    def update_path_on_sidequest_completion(self, user, topic: str, user_sidequest: UserSideQuest) -> UserLearningPath:
        """Update learning path after a side quest is completed."""
        path = self.get_or_create_path(user, topic)

        # Calculate points based on difficulty
        difficulty = user_sidequest.side_quest.difficulty
        points_key = f'sidequest_{difficulty}'
        points = POINTS_CONFIG.get(points_key, POINTS_CONFIG['sidequest_medium'])

        # Update path
        path.side_quests_completed = UserSideQuest.objects.filter(
            user=user, is_completed=True, side_quest__topic=topic
        ).count()

        path.topic_points += points
        path.side_quests_total = self._count_sidequests_for_topic(topic)

        # Recalculate skill level
        old_level = path.current_skill_level
        path.current_skill_level = path.calculate_skill_level()

        path.save()

        if old_level != path.current_skill_level:
            logger.info(f'User {user.username} leveled up in {topic}: {old_level} -> {path.current_skill_level}')

        return path

    def get_user_paths(self, user, include_empty: bool = False) -> list:
        """
        Get all learning paths for a user.

        Args:
            user: The user to get paths for
            include_empty: If True, include paths with no progress

        Returns:
            List of UserLearningPath objects
        """
        queryset = UserLearningPath.objects.filter(user=user)
        if not include_empty:
            queryset = queryset.filter(Q(quizzes_completed__gt=0) | Q(side_quests_completed__gt=0))
        return list(queryset.order_by('-last_activity_at'))

    def get_path_detail(self, user, topic: str) -> dict:
        """
        Get detailed progress for a specific topic path.

        Returns a dict with:
        - path: UserLearningPath object
        - completed_quizzes: list of completed quiz attempts
        - available_quizzes: list of quizzes not yet taken
        - completed_sidequests: list of completed side quests
        - active_sidequests: list of in-progress side quests
        - recommended_next: suggested next activity
        """
        path = self.get_or_create_path(user, topic)

        # Get completed quiz attempts for this topic
        completed_attempts = (
            QuizAttempt.objects.filter(
                user=user,
                completed_at__isnull=False,
            )
            .filter(Q(quiz__topic__iexact=topic) | Q(quiz__topics__contains=[topic]))
            .select_related('quiz')
            .order_by('-completed_at')
        )

        completed_quiz_ids = completed_attempts.values_list('quiz_id', flat=True)

        # Get available quizzes (not yet taken)
        available_quizzes = (
            Quiz.objects.filter(is_published=True)
            .filter(Q(topic__iexact=topic) | Q(topics__contains=[topic]))
            .exclude(id__in=completed_quiz_ids)
            .order_by('difficulty', 'title')
        )

        # Get completed side quests
        completed_sidequests = (
            UserSideQuest.objects.filter(user=user, is_completed=True, side_quest__topic=topic)
            .select_related('side_quest')
            .order_by('-completed_at')
        )

        # Get active (in-progress) side quests
        active_sidequests = (
            UserSideQuest.objects.filter(user=user, is_completed=False, side_quest__topic=topic)
            .select_related('side_quest')
            .order_by('-updated_at')
        )

        # Determine recommended next activity
        recommended_next = self._get_recommended_next(
            path=path, available_quizzes=available_quizzes, active_sidequests=active_sidequests, topic=topic
        )

        return {
            'path': path,
            'completed_quizzes': list(completed_attempts),
            'available_quizzes': list(available_quizzes),
            'completed_sidequests': list(completed_sidequests),
            'active_sidequests': list(active_sidequests),
            'recommended_next': recommended_next,
        }

    def _get_recommended_next(
        self, path: UserLearningPath, available_quizzes, active_sidequests, topic: str
    ) -> dict | None:
        """Determine the recommended next activity for a user."""
        # Priority 1: Continue active side quests
        if active_sidequests.exists():
            sq = active_sidequests.first()
            return {
                'type': 'sidequest',
                'id': str(sq.side_quest.id),
                'title': sq.side_quest.title,
                'progress': sq.progress_percentage,
            }

        # Priority 2: Take a quiz at current skill level
        skill_to_difficulty = {
            'beginner': 'beginner',
            'intermediate': 'intermediate',
            'advanced': 'advanced',
            'master': 'advanced',
        }
        target_difficulty = skill_to_difficulty.get(path.current_skill_level, 'beginner')

        matching_quiz = available_quizzes.filter(difficulty=target_difficulty).first()
        if matching_quiz:
            return {
                'type': 'quiz',
                'id': str(matching_quiz.id),
                'title': matching_quiz.title,
                'difficulty': matching_quiz.difficulty,
            }

        # Priority 3: Any available quiz
        any_quiz = available_quizzes.first()
        if any_quiz:
            return {
                'type': 'quiz',
                'id': str(any_quiz.id),
                'title': any_quiz.title,
                'difficulty': any_quiz.difficulty,
            }

        # Priority 4: Suggest a new side quest
        available_sidequest = (
            SideQuest.objects.filter(topic=topic, is_active=True)
            .exclude(id__in=UserSideQuest.objects.filter(user=path.user).values('side_quest_id'))
            .first()
        )

        if available_sidequest:
            return {
                'type': 'sidequest',
                'id': str(available_sidequest.id),
                'title': available_sidequest.title,
                'is_new': True,
            }

        return None

    def get_recommended_topics(self, user, limit: int = 5) -> list:
        """
        Get recommended topics for a user to explore.

        Based on:
        1. UserTags with high confidence
        2. Topics they haven't started yet
        3. Available content in each topic
        """
        # Get existing path topics
        existing_topics = set(UserLearningPath.objects.filter(user=user).values_list('topic', flat=True))

        # Get all valid topics
        all_topics = [choice[0] for choice in UserLearningPath.TOPIC_CHOICES]

        # Score topics by available content
        recommendations = []
        for topic in all_topics:
            if topic in existing_topics:
                continue

            quiz_count = self._count_quizzes_for_topic(topic)
            sidequest_count = self._count_sidequests_for_topic(topic)

            # Only recommend topics with content
            if quiz_count == 0 and sidequest_count == 0:
                continue

            # Calculate score (more content = higher score)
            score = quiz_count * 2 + sidequest_count

            recommendations.append(
                {
                    'topic': topic,
                    'topic_display': UserLearningPath.get_topic_display_name(topic),
                    'quiz_count': quiz_count,
                    'sidequest_count': sidequest_count,
                    'score': score,
                }
            )

        # Sort by score and return top N
        recommendations.sort(key=lambda x: -x['score'])
        return recommendations[:limit]

    def refresh_path_totals(self, user, topic: str) -> UserLearningPath:
        """Refresh the total counts for a learning path."""
        path = self.get_or_create_path(user, topic)
        path.quizzes_total = self._count_quizzes_for_topic(topic)
        path.side_quests_total = self._count_sidequests_for_topic(topic)
        path.save(update_fields=['quizzes_total', 'side_quests_total'])
        return path
