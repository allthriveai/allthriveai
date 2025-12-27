"""
Learning event tracker component.

Provides utilities for tracking learning events automatically.
Used by middleware and signal handlers to record user learning activity.
"""

import logging
from typing import Literal

logger = logging.getLogger(__name__)

EventType = Literal[
    'quiz_attempt',
    'quiz_completed',
    'micro_lesson',
    'concept_practiced',
    'concept_completed',
    'skill_level_up',
    'streak_milestone',
    'project_learned_from',
    'tool_explored',
    'content_viewed',
    'game_played',
    'learning_path_started',
]


class LearningEventTracker:
    """
    Tracks learning events for analytics and progress.

    Events are recorded automatically without Ava calling a tool.
    Uses async methods for integration with Django Channels and Celery.
    """

    @classmethod
    def track_content_view(
        cls,
        user_id: int,
        project_id: int | str | None = None,
        quiz_id: str | None = None,
        game_slug: str | None = None,
        time_spent_seconds: int = 0,
    ) -> None:
        """
        Track when a user views learning content.

        Called by middleware or signals when project/quiz/game pages are opened.
        """
        if not user_id:
            return

        event_type = 'content_viewed'
        payload = {'time_spent_seconds': time_spent_seconds}

        if project_id:
            payload['project_id'] = str(project_id)
            event_type = 'project_learned_from'
        elif quiz_id:
            payload['quiz_id'] = str(quiz_id)
            event_type = 'quiz_attempt'
        elif game_slug:
            payload['game_slug'] = game_slug
            event_type = 'game_played'

        cls._create_event(
            user_id=user_id,
            event_type=event_type,
            project_id=int(project_id) if project_id and str(project_id).isdigit() else None,
            payload=payload,
        )

    @classmethod
    def track_quiz_completion(
        cls,
        user_id: int,
        quiz_id: str,
        score: float,
        answers: list[dict] | None = None,
        time_taken_seconds: int = 0,
    ) -> None:
        """
        Track when a user completes a quiz.

        Called by quiz submission handler.
        """
        if not user_id:
            return

        xp_earned = cls._calculate_quiz_xp(score)

        cls._create_event(
            user_id=user_id,
            event_type='quiz_completed',
            was_successful=score >= 0.7,
            payload={
                'quiz_id': str(quiz_id),
                'score': score,
                'answers_count': len(answers) if answers else 0,
                'time_taken_seconds': time_taken_seconds,
            },
            xp_earned=xp_earned,
        )

        # Update learner profile stats
        cls._update_learner_stats(user_id, quiz_completed=True)

    @classmethod
    def track_game_played(
        cls,
        user_id: int,
        game_slug: str,
        score: int = 0,
        level_reached: int = 0,
    ) -> None:
        """
        Track when a user plays an educational game.

        Called by game component via API.
        """
        if not user_id:
            return

        xp_earned = cls._calculate_game_xp(score, level_reached)

        cls._create_event(
            user_id=user_id,
            event_type='game_played',
            was_successful=score > 0,
            payload={
                'game_slug': game_slug,
                'score': score,
                'level_reached': level_reached,
            },
            xp_earned=xp_earned,
        )

    @classmethod
    def track_tool_explored(
        cls,
        user_id: int,
        tool_slug: str,
    ) -> None:
        """
        Track when a user explores a tool page.

        Called by tool detail page view.
        """
        if not user_id:
            return

        cls._create_event(
            user_id=user_id,
            event_type='tool_explored',
            payload={'tool_slug': tool_slug},
            xp_earned=5,
        )

    @classmethod
    def track_learning_path_started(
        cls,
        user_id: int,
        path_id: str,
        topic: str,
    ) -> None:
        """
        Track when a user starts a learning path.

        Called by learning path page view.
        """
        if not user_id:
            return

        cls._create_event(
            user_id=user_id,
            event_type='learning_path_started',
            payload={
                'path_id': path_id,
                'topic': topic,
            },
            xp_earned=10,
        )

    @classmethod
    def track_concept_practiced(
        cls,
        user_id: int,
        concept_id: int,
        was_correct: bool,
    ) -> None:
        """
        Track when a user practices a concept.

        Called by quiz question handlers.
        """
        if not user_id:
            return

        xp_earned = 10 if was_correct else 2

        cls._create_event(
            user_id=user_id,
            event_type='concept_practiced',
            was_successful=was_correct,
            payload={'concept_id': concept_id},
            xp_earned=xp_earned,
        )

    @classmethod
    def track_skill_level_up(
        cls,
        user_id: int,
        topic: str,
        old_level: str,
        new_level: str,
    ) -> None:
        """
        Track when a user levels up in a skill.

        Called by learning path progress handlers.
        """
        if not user_id:
            return

        xp_earned = 50  # Bonus XP for leveling up

        cls._create_event(
            user_id=user_id,
            event_type='skill_level_up',
            was_successful=True,
            payload={
                'topic': topic,
                'old_level': old_level,
                'new_level': new_level,
            },
            xp_earned=xp_earned,
        )

    @classmethod
    def _create_event(
        cls,
        user_id: int,
        event_type: EventType,
        project_id: int | None = None,
        was_successful: bool | None = None,
        payload: dict | None = None,
        xp_earned: int = 0,
    ) -> None:
        """Create a learning event record."""
        try:
            from core.learning_paths.models import LearningEvent

            LearningEvent.objects.create(
                user_id=user_id,
                event_type=event_type,
                project_id=project_id,
                was_successful=was_successful,
                payload=payload or {},
                xp_earned=xp_earned,
            )

            logger.debug(
                'Learning event created',
                extra={
                    'user_id': user_id,
                    'event_type': event_type,
                    'xp_earned': xp_earned,
                },
            )

        except Exception as e:
            logger.error(
                'Failed to create learning event',
                extra={
                    'user_id': user_id,
                    'event_type': event_type,
                    'error': str(e),
                },
                exc_info=True,
            )

    @classmethod
    def _calculate_quiz_xp(cls, score: float) -> int:
        """Calculate XP earned from quiz score."""
        if score >= 0.9:
            return 50
        elif score >= 0.7:
            return 30
        elif score >= 0.5:
            return 15
        else:
            return 5

    @classmethod
    def _calculate_game_xp(cls, score: int, level_reached: int) -> int:
        """Calculate XP earned from game performance."""
        base_xp = 5
        score_xp = min(score // 100, 20)  # Max 20 XP from score
        level_xp = level_reached * 5  # 5 XP per level
        return base_xp + score_xp + level_xp

    @classmethod
    def _update_learner_stats(
        cls,
        user_id: int,
        quiz_completed: bool = False,
    ) -> None:
        """Update learner profile stats after events."""
        try:
            from django.db.models import F

            from core.learning_paths.models import LearnerProfile

            # Ensure profile exists
            profile, created = LearnerProfile.objects.get_or_create(user_id=user_id)

            if quiz_completed:
                # Use atomic F() expression to avoid race conditions
                LearnerProfile.objects.filter(user_id=user_id).update(
                    total_quizzes_completed=F('total_quizzes_completed') + 1
                )
                # Refresh and update streak (requires instance method)
                profile.refresh_from_db()
                profile.update_streak()

            # Invalidate context cache
            from .learner_context import LearnerContextService

            LearnerContextService.invalidate_cache(user_id)

        except Exception as e:
            logger.error(
                'Failed to update learner stats',
                extra={'user_id': user_id, 'error': str(e)},
                exc_info=True,
            )
