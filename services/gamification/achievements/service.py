"""
Achievement service for handling achievement unlocking and progress tracking.

This service implements the business logic for:
- Checking achievement criteria and auto-unlocking achievements
- Tracking progress toward achievements
- Handling tier upgrades and level progression
- Triggering notifications on achievement unlock
"""

import logging

from django.db import transaction
from django.utils import timezone

from core.achievements.models import Achievement, AchievementProgress, UserAchievement
from core.users.models import User

logger = logging.getLogger(__name__)


class AchievementService:
    """Service for managing user achievements and progress."""

    @staticmethod
    @transaction.atomic
    def check_and_unlock_achievements(user: User, trigger_type: str = None) -> list:
        """
        Check if user has met criteria for any locked achievements and auto-unlock them.

        Args:
            user (User): The user to check achievements for
            trigger_type (str): Optional event type that triggered the check
                               (e.g., 'project_create', 'quiz_complete')

        Returns:
            list: List of newly unlocked Achievement objects

        Example:
            unlocked = AchievementService.check_and_unlock_achievements(
                user=request.user,
                trigger_type='project_create'
            )
            if unlocked:
                notify_user_achievements(request.user, unlocked)
        """
        newly_unlocked = []

        # Get all active achievements user hasn't earned yet
        earned_achievement_ids = UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True)

        achievements_to_check = Achievement.objects.filter(is_active=True).exclude(id__in=earned_achievement_ids)

        for achievement in achievements_to_check:
            # Check if user meets criteria for this achievement
            if AchievementService._check_criteria(user, achievement):
                # Unlock the achievement
                unlocked = AchievementService.unlock_achievement(user, achievement)
                if unlocked:
                    newly_unlocked.append(achievement)
                    logger.info(
                        f'Achievement unlocked: {achievement.key} for user {user.username}',
                        extra={'user_id': user.id, 'achievement_id': achievement.id},
                    )

        return newly_unlocked

    @staticmethod
    def _check_criteria(user: User, achievement: Achievement) -> bool:
        """
        Check if user meets criteria for a specific achievement.

        Args:
            user (User): The user to check
            achievement (Achievement): The achievement to check criteria for

        Returns:
            bool: True if user meets criteria, False otherwise
        """
        from core.achievements.models import CriteriaType

        if achievement.criteria_type == CriteriaType.COUNT:
            # Check count-based criteria (e.g., "Create 10 projects")
            return AchievementService._get_user_stat(user, achievement.tracking_field) >= achievement.criteria_value

        elif achievement.criteria_type == CriteriaType.THRESHOLD:
            # Check threshold-based criteria (e.g., "Get 100 stars")
            return AchievementService._get_user_stat(user, achievement.tracking_field) >= achievement.criteria_value

        elif achievement.criteria_type == CriteriaType.STREAK:
            # Check streak-based criteria (e.g., "7 day streak")
            return user.current_streak_days >= achievement.criteria_value

        elif achievement.criteria_type == CriteriaType.FIRST_TIME:
            # First time achievements unlock immediately on activity
            return True

        elif achievement.criteria_type == CriteriaType.CUMULATIVE:
            # Check cumulative criteria (e.g., "1000 total points")
            return user.total_points >= achievement.criteria_value

        return False

    @staticmethod
    def _get_user_stat(user: User, tracking_field: str) -> int:
        """
        Get a user stat value by field name.

        Args:
            user (User): The user to get stats for
            tracking_field (str): The field name to retrieve (e.g., 'lifetime_projects_created')

        Returns:
            int: The stat value, or 0 if field doesn't exist
        """
        try:
            return getattr(user, tracking_field, 0)
        except AttributeError:
            logger.warning(
                f'Unknown tracking field: {tracking_field}',
                extra={'user_id': user.id},
            )
            return 0

    @staticmethod
    @transaction.atomic
    def unlock_achievement(user: User, achievement: Achievement) -> bool:
        """
        Unlock an achievement for a user.

        Args:
            user (User): The user to unlock achievement for
            achievement (Achievement): The achievement to unlock

        Returns:
            bool: True if successfully unlocked, False if already owned or error
        """
        # Check if already earned
        if UserAchievement.objects.filter(user=user, achievement=achievement).exists():
            return False

        try:
            # Get current progress value for tracking
            progress_value = AchievementService._get_user_stat(user, achievement.tracking_field)

            # Create UserAchievement record
            UserAchievement.objects.create(user=user, achievement=achievement, progress_at_unlock=progress_value)

            # Update user's achievement count
            user.total_achievements_unlocked += 1
            user.last_achievement_earned_at = timezone.now()
            user.save(update_fields=['total_achievements_unlocked', 'last_achievement_earned_at'])

            # Award points
            user.add_points(
                amount=achievement.points,
                activity_type='achievement_unlock',
                description=f'Unlocked achievement: {achievement.name}',
            )

            logger.info(
                f'Achievement {achievement.key} unlocked for {user.username}, awarded {achievement.points} points',
                extra={'user_id': user.id, 'achievement_id': achievement.id, 'points': achievement.points},
            )

            return True

        except Exception as e:
            logger.error(
                f'Error unlocking achievement {achievement.key} for {user.username}: {str(e)}',
                extra={'user_id': user.id, 'achievement_id': achievement.id},
                exc_info=True,
            )
            return False

    @staticmethod
    def update_progress(user: User, achievement: Achievement, new_value: int) -> AchievementProgress:
        """
        Update or create progress record for an achievement.

        Args:
            user (User): The user
            achievement (Achievement): The achievement to track progress for
            new_value (int): The new progress value

        Returns:
            AchievementProgress: The progress record
        """
        progress, created = AchievementProgress.objects.update_or_create(
            user=user, achievement=achievement, defaults={'current_value': new_value}
        )

        logger.debug(
            f'Updated progress for {achievement.key}: {new_value}/{achievement.criteria_value}',
            extra={'user_id': user.id, 'achievement_id': achievement.id},
        )

        return progress

    @staticmethod
    def get_user_achievements(user: User, include_progress: bool = True) -> dict:
        """
        Get all achievements data for a user.

        Args:
            user (User): The user
            include_progress (bool): Whether to include progress data

        Returns:
            dict: Dictionary with 'earned', 'in_progress', and optionally 'locked' achievements
        """
        earned = UserAchievement.objects.filter(user=user).select_related('achievement').order_by('-earned_at')

        earned_ids = earned.values_list('achievement_id', flat=True)
        in_progress = (
            AchievementProgress.objects.filter(user=user)
            .exclude(achievement_id__in=earned_ids)
            .select_related('achievement')
        )

        data = {
            'earned': list(earned),
            'in_progress': list(in_progress) if include_progress else [],
        }

        return data

    @staticmethod
    @transaction.atomic
    def reset_user_achievements(user: User) -> int:
        """
        Reset all achievements for a user (admin only).

        This operation is atomic - either all deletions succeed or none do.

        Args:
            user (User): The user

        Returns:
            int: Number of achievements removed

        Raises:
            Exception: If database operations fail (transaction will be rolled back)
        """
        # Delete achievements and progress in single transaction
        count, _ = UserAchievement.objects.filter(user=user).delete()
        AchievementProgress.objects.filter(user=user).delete()

        # Update user stats
        user.total_achievements_unlocked = 0
        user.last_achievement_earned_at = None
        user.save(update_fields=['total_achievements_unlocked', 'last_achievement_earned_at'])

        logger.warning(
            f'Reset achievements for user {user.username}',
            extra={
                'user_id': user.id,
                'achievement_count': count,
                'operation': 'reset_achievements',
            },
        )

        return count
