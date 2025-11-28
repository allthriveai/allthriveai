"""
Achievement tracking integration layer.

This module provides a clean API for other parts of the application to report
user activities, which are then checked against achievement criteria.

Usage:
    from services.achievement_tracker import AchievementTracker

    # Track when user creates a project
    unlocked = AchievementTracker.track_project_created(user)

    # Track when user completes a quiz
    unlocked = AchievementTracker.track_quiz_completed(user)

    # Track battle participation
    unlocked = AchievementTracker.track_battle_completed(user, battle_type='won')
"""

import logging

from django.db.models import F

from core.users.models import User
from services.achievement_service import AchievementService

logger = logging.getLogger(__name__)


class AchievementTracker:
    """
    Entry point for tracking user activities and achievements.

    Provides high-level methods for various user activities that should be
    checked against achievement criteria.
    """

    @staticmethod
    def track_project_created(user: User) -> list:
        """
        Track when a user creates a project.

        Updates lifetime_projects_created counter and checks achievements.

        Args:
            user (User): The user who created the project

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Increment user's project counter
        User.objects.filter(pk=user.pk).update(lifetime_projects_created=F('lifetime_projects_created') + 1)
        user.refresh_from_db()

        # Update achievement progress
        AchievementTracker._update_achievement_progress(
            user=user, tracking_field='lifetime_projects_created', activity_type='project_create'
        )

        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='project_create')

        logger.info(
            f'Project created tracked for {user.username}. Total: {user.lifetime_projects_created}',
            extra={'user_id': user.id, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_quiz_completed(user: User) -> list:
        """
        Track when a user completes a quiz.

        Updates lifetime_quizzes_completed counter and checks achievements.

        Args:
            user (User): The user who completed the quiz

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Increment user's quiz counter
        User.objects.filter(pk=user.pk).update(lifetime_quizzes_completed=F('lifetime_quizzes_completed') + 1)
        user.refresh_from_db()

        # Update achievement progress
        AchievementTracker._update_achievement_progress(
            user=user, tracking_field='lifetime_quizzes_completed', activity_type='quiz_complete'
        )

        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='quiz_complete')

        logger.info(
            f'Quiz completed tracked for {user.username}. Total: {user.lifetime_quizzes_completed}',
            extra={'user_id': user.id, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_side_quest_completed(user: User) -> list:
        """
        Track when a user completes a side quest.

        Updates lifetime_side_quests_completed counter and checks achievements.

        Args:
            user (User): The user who completed the side quest

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Increment user's side quest counter
        User.objects.filter(pk=user.pk).update(lifetime_side_quests_completed=F('lifetime_side_quests_completed') + 1)
        user.refresh_from_db()

        # Update achievement progress
        AchievementTracker._update_achievement_progress(
            user=user, tracking_field='lifetime_side_quests_completed', activity_type='side_quest_complete'
        )

        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='side_quest_complete')

        logger.info(
            f'Side quest completed tracked for {user.username}. Total: {user.lifetime_side_quests_completed}',
            extra={'user_id': user.id, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_comment_posted(user: User) -> list:
        """
        Track when a user posts a comment.

        Updates lifetime_comments_posted counter and checks achievements.

        Args:
            user (User): The user who posted the comment

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Increment user's comment counter
        User.objects.filter(pk=user.pk).update(lifetime_comments_posted=F('lifetime_comments_posted') + 1)
        user.refresh_from_db()

        # Update achievement progress
        AchievementTracker._update_achievement_progress(
            user=user, tracking_field='lifetime_comments_posted', activity_type='comment_post'
        )

        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='comment_post')

        logger.info(
            f'Comment posted tracked for {user.username}. Total: {user.lifetime_comments_posted}',
            extra={'user_id': user.id, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_battle_completed(user: User, battle_type: str = 'participated') -> list:
        """
        Track when a user participates in or wins a battle.

        Args:
            user (User): The user who completed the battle
            battle_type (str): Type of completion - 'participated' or 'won'

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Note: Battle-specific fields would need to be added to User model if we track
        # separate battle participation vs wins. For now, this is extensible.

        activity_type = f'battle_{battle_type}'

        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type=activity_type)

        logger.info(
            f'Battle {battle_type} tracked for {user.username}',
            extra={'user_id': user.id, 'battle_type': battle_type, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_streak_milestone(user: User) -> list:
        """
        Track when a user reaches a streak milestone.

        Called when user's streak reaches certain thresholds (7, 14, 30 days, etc.).

        Args:
            user (User): The user who reached the milestone

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='streak_milestone')

        logger.info(
            f'Streak milestone tracked for {user.username}. Streak: {user.current_streak_days} days',
            extra={'user_id': user.id, 'streak_days': user.current_streak_days, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_points_milestone(user: User) -> list:
        """
        Track when a user reaches a points milestone.

        Called when user reaches significant point thresholds (100, 500, 1000, etc.).

        Args:
            user (User): The user who reached the milestone

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='points_milestone')

        logger.info(
            f'Points milestone tracked for {user.username}. Total points: {user.total_points}',
            extra={'user_id': user.id, 'total_points': user.total_points, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_level_up(user: User) -> list:
        """
        Track when a user levels up.

        Called when user's level increases.

        Args:
            user (User): The user who leveled up

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='level_up')

        logger.info(
            f'Level up tracked for {user.username}. New level: {user.level}',
            extra={'user_id': user.id, 'new_level': user.level, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def track_tier_up(user: User) -> list:
        """
        Track when a user tiers up.

        Called when user's tier increases.

        Args:
            user (User): The user who tiered up

        Returns:
            list: List of newly unlocked Achievement objects
        """
        # Check for newly unlocked achievements
        unlocked = AchievementService.check_and_unlock_achievements(user, trigger_type='tier_up')

        logger.info(
            f'Tier up tracked for {user.username}. New tier: {user.tier}',
            extra={'user_id': user.id, 'new_tier': user.tier, 'achievements_unlocked': len(unlocked)},
        )

        return unlocked

    @staticmethod
    def _update_achievement_progress(user: User, tracking_field: str, activity_type: str) -> None:
        """
        Update progress for all achievements tracking a specific field.

        This should be called whenever a user's stat changes.

        Args:
            user (User): The user
            tracking_field (str): The field name being updated
            activity_type (str): The type of activity for logging
        """
        from core.achievements.models import Achievement

        # Find all active achievements that track this field
        achievements = Achievement.objects.filter(is_active=True, tracking_field=tracking_field)

        new_value = getattr(user, tracking_field, 0)

        for achievement in achievements:
            AchievementService.update_progress(user, achievement, new_value)

        logger.debug(
            f'Updated achievement progress for {tracking_field} = {new_value}',
            extra={'user_id': user.id, 'activity_type': activity_type},
        )
