"""Signals for tracking achievement progress."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.battles.models import BattleSubmission
from core.projects.models import Project, ProjectComment, ProjectLike
from core.quizzes.models import QuizAttempt
from core.thrive_circle.models import UserSideQuest
from services.gamification.achievements import AchievementTracker

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Project)
def track_project_created(sender, instance, created, **kwargs):
    """
    Track when a user creates a project.

    Awards progress toward project count achievements.
    """
    if created:
        try:
            # Track project creation
            unlocked = AchievementTracker.track_event(user=instance.user, tracking_field='project_count', value=1)

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) '
                    f'for creating project: {instance.title}'
                )
        except Exception as e:
            logger.error(f'Error tracking project creation achievement: {e}')


@receiver(post_save, sender=Project)
def track_project_published(sender, instance, created, **kwargs):
    """
    Track when a user publishes a project.

    Awards progress toward published project achievements.
    """
    # Only track if project is published and wasn't just created
    # (to avoid double-counting on initial publish)
    if not created and not instance.is_private:
        try:
            # Check if this is the first time being published
            # by looking at the previous state (would need field tracking for this)
            # For now, we'll increment on any save where is_private=False

            unlocked = AchievementTracker.track_event(
                user=instance.user, tracking_field='published_project_count', value=1
            )

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) '
                    f'for publishing project: {instance.title}'
                )
        except Exception as e:
            logger.error(f'Error tracking project publish achievement: {e}')


@receiver(post_save, sender=QuizAttempt)
def track_quiz_completed(sender, instance, created, **kwargs):
    """
    Track when a user completes a quiz.

    Awards progress toward quiz completion achievements.
    """
    if created and instance.completed:
        try:
            # Track quiz completion
            unlocked = AchievementTracker.track_event(
                user=instance.user, tracking_field='lifetime_quizzes_completed', value=1
            )

            # Track perfect scores
            if instance.score == instance.total_questions:
                AchievementTracker.track_event(user=instance.user, tracking_field='perfect_quiz_scores', value=1)

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) '
                    f'for completing quiz: {instance.quiz.title}'
                )
        except Exception as e:
            logger.error(f'Error tracking quiz completion achievement: {e}')


@receiver(post_save, sender=BattleSubmission)
def track_battle_submission(sender, instance, created, **kwargs):
    """
    Track when a user submits to a battle.

    Awards progress toward battle participation achievements.
    """
    if created:
        try:
            # Track battle participation
            unlocked = AchievementTracker.track_event(user=instance.user, tracking_field='battle_count', value=1)

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) ' f'for battle submission'
                )
        except Exception as e:
            logger.error(f'Error tracking battle submission achievement: {e}')


@receiver(post_save, sender=UserSideQuest)
def track_side_quest_completed(sender, instance, created, **kwargs):
    """
    Track when a user completes a side quest.

    Awards progress toward side quest achievements.
    """
    # Track completion (not just creation)
    if not created and instance.completed and not getattr(instance, '_achievement_tracked', False):
        try:
            # Mark as tracked to prevent duplicate signals
            instance._achievement_tracked = True

            # Track side quest completion
            unlocked = AchievementTracker.track_event(
                user=instance.user, tracking_field='lifetime_side_quests_completed', value=1
            )

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) '
                    f'for completing side quest: {instance.quest.title}'
                )
        except Exception as e:
            logger.error(f'Error tracking side quest completion achievement: {e}')


@receiver(post_save, sender=ProjectComment)
def track_comment_posted(sender, instance, created, **kwargs):
    """
    Track when a user posts a comment.

    Awards progress toward community engagement achievements.
    """
    if created:
        try:
            # Track comment posting
            unlocked = AchievementTracker.track_event(
                user=instance.user, tracking_field='lifetime_comments_posted', value=1
            )

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) ' f'for posting comment'
                )
        except Exception as e:
            logger.error(f'Error tracking comment posting achievement: {e}')


@receiver(post_save, sender=ProjectLike)
def track_project_liked(sender, instance, created, **kwargs):
    """
    Track when a user likes a project.

    Awards progress toward engagement achievements.
    """
    if created:
        try:
            # Track project likes given
            unlocked = AchievementTracker.track_event(user=instance.user, tracking_field='likes_given', value=1)

            if unlocked:
                logger.info(
                    f'User {instance.user.username} unlocked {len(unlocked)} achievement(s) ' f'for liking a project'
                )
        except Exception as e:
            logger.error(f'Error tracking project like achievement: {e}')
