"""Achievement tracking service for monitoring and awarding user achievements."""

import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count

from core.achievements.models import Achievement, AchievementProgress, CriteriaType, UserAchievement

User = get_user_model()
logger = logging.getLogger(__name__)


class AchievementTracker:
    """Service for tracking achievement progress and awarding achievements."""

    @staticmethod
    def track_event(user, tracking_field: str, value: int = 1) -> list[Achievement]:
        """
        Track an event and update progress for all related achievements.

        Args:
            user: The user to track for
            tracking_field: The field name being tracked (e.g., 'project_count')
            value: The value to add to the tracking field (default: 1)

        Returns:
            List of newly unlocked achievements
        """
        if not user or not user.is_authenticated:
            return []

        # Get all active achievements that track this field
        achievements = Achievement.objects.filter(is_active=True, tracking_field=tracking_field)

        if not achievements.exists():
            return []

        unlocked = []

        with transaction.atomic():
            for achievement in achievements:
                # Skip if already earned
                if UserAchievement.objects.filter(user=user, achievement=achievement).exists():
                    continue

                # Check dependencies first
                if not AchievementTracker._check_dependencies(user, achievement):
                    continue

                # Get or create progress
                progress, created = AchievementProgress.objects.get_or_create(
                    user=user, achievement=achievement, defaults={'current_value': 0}
                )

                # Update progress based on criteria type
                old_value = progress.current_value

                if achievement.criteria_type == CriteriaType.COUNT:
                    progress.current_value += value
                elif achievement.criteria_type == CriteriaType.FIRST_TIME:
                    progress.current_value = 1
                elif achievement.criteria_type == CriteriaType.CUMULATIVE:
                    progress.current_value += value
                elif achievement.criteria_type == CriteriaType.THRESHOLD:
                    # For threshold, value is the current total (not increment)
                    progress.current_value = value
                elif achievement.criteria_type == CriteriaType.STREAK:
                    # For streaks, value is the current streak count
                    progress.current_value = value

                progress.save()

                # Check if achievement should be unlocked
                if progress.is_complete:
                    newly_unlocked = AchievementTracker._unlock_achievement(user, achievement, progress.current_value)
                    if newly_unlocked:
                        unlocked.append(newly_unlocked)
                        logger.info(
                            f'Achievement unlocked: {achievement.name} for user {user.username} '
                            f'(progress: {old_value} -> {progress.current_value})'
                        )

        return unlocked

    @staticmethod
    def _check_dependencies(user, achievement: Achievement) -> bool:
        """
        Check if user has earned all required achievements.

        Args:
            user: The user to check
            achievement: The achievement to check dependencies for

        Returns:
            True if all dependencies are met
        """
        required = achievement.requires_achievements.all()
        if not required.exists():
            return True

        earned_count = UserAchievement.objects.filter(user=user, achievement__in=required).count()

        return earned_count == required.count()

    @staticmethod
    def _unlock_achievement(user, achievement: Achievement, progress_value: int) -> Achievement | None:
        """
        Unlock an achievement for a user.

        Args:
            user: The user earning the achievement
            achievement: The achievement being unlocked
            progress_value: The progress value at unlock time

        Returns:
            The achievement if successfully unlocked, None otherwise
        """
        # Double-check not already earned (race condition protection)
        if UserAchievement.objects.filter(user=user, achievement=achievement).exists():
            return None

        # Award the achievement
        UserAchievement.objects.create(user=user, achievement=achievement, progress_at_unlock=progress_value)

        logger.info(f"Achievement '{achievement.name}' unlocked for user {user.username}")
        return achievement

    @staticmethod
    def check_and_unlock(user, achievement: Achievement) -> bool:
        """
        Manually check if a user should unlock an achievement and unlock if ready.

        Args:
            user: The user to check
            achievement: The achievement to check

        Returns:
            True if achievement was unlocked, False otherwise
        """
        if not user or not user.is_authenticated:
            return False

        # Check if already earned
        if UserAchievement.objects.filter(user=user, achievement=achievement).exists():
            return False

        # Check dependencies
        if not AchievementTracker._check_dependencies(user, achievement):
            return False

        # Get progress
        try:
            progress = AchievementProgress.objects.get(user=user, achievement=achievement)
        except AchievementProgress.DoesNotExist:
            return False

        # Check if ready to unlock
        if progress.is_complete:
            with transaction.atomic():
                return AchievementTracker._unlock_achievement(user, achievement, progress.current_value) is not None

        return False

    @staticmethod
    def calculate_progress(user, achievement: Achievement) -> dict:
        """
        Calculate current progress for an achievement.

        Args:
            user: The user to calculate progress for
            achievement: The achievement to check

        Returns:
            Dict with progress information
        """
        # Check if already earned
        try:
            user_achievement = UserAchievement.objects.get(user=user, achievement=achievement)
            return {
                'is_earned': True,
                'earned_at': user_achievement.earned_at,
                'current_value': user_achievement.progress_at_unlock or achievement.criteria_value,
                'target_value': achievement.criteria_value,
                'percentage': 100,
            }
        except UserAchievement.DoesNotExist:
            pass

        # Get progress
        try:
            progress = AchievementProgress.objects.get(user=user, achievement=achievement)
            return {
                'is_earned': False,
                'earned_at': None,
                'current_value': progress.current_value,
                'target_value': achievement.criteria_value,
                'percentage': progress.percentage,
            }
        except AchievementProgress.DoesNotExist:
            return {
                'is_earned': False,
                'earned_at': None,
                'current_value': 0,
                'target_value': achievement.criteria_value,
                'percentage': 0,
            }

    @staticmethod
    def award_retroactive_achievements(user) -> list[Achievement]:
        """
        Award achievements for past actions (useful for existing users).

        Args:
            user: The user to award retroactive achievements to

        Returns:
            List of newly unlocked achievements
        """
        if not user or not user.is_authenticated:
            return []

        unlocked = []

        # Import here to avoid circular imports
        from core.projects.models import Project

        # Get counts of various activities
        project_count = Project.objects.filter(user=user).count()
        published_count = Project.objects.filter(user=user, is_private=False).count()

        # Track project-related achievements (using correct tracking_field names)
        if project_count > 0:
            unlocked.extend(AchievementTracker.track_event(user, 'lifetime_projects_created', project_count))
        if published_count > 0:
            unlocked.extend(AchievementTracker.track_event(user, 'lifetime_projects_published', published_count))

        # TODO: Add more retroactive tracking for battles, quizzes, etc.

        logger.info(f'Retroactive achievements awarded to {user.username}: {len(unlocked)} achievements unlocked')

        return unlocked

    @staticmethod
    def get_user_stats(user) -> dict:
        """
        Get achievement statistics for a user.

        Args:
            user: The user to get stats for

        Returns:
            Dict with achievement statistics
        """
        if not user or not user.is_authenticated:
            return {
                'total_achievements': 0,
                'earned_count': 0,
                'total_points': 0,
                'completion_percentage': 0,
                'by_category': {},
                'by_rarity': {},
            }

        total = Achievement.objects.filter(is_active=True).count()
        earned = UserAchievement.objects.filter(user=user).count()

        # Calculate total points earned
        total_points = (
            UserAchievement.objects.filter(user=user).aggregate(total=Count('achievement__points')).get('total', 0) or 0
        )

        # Group by category
        by_category = {}
        for category in Achievement.objects.filter(is_active=True).values_list('category', flat=True).distinct():
            category_total = Achievement.objects.filter(is_active=True, category=category).count()
            category_earned = UserAchievement.objects.filter(user=user, achievement__category=category).count()
            by_category[category] = {
                'total': category_total,
                'earned': category_earned,
                'percentage': int(category_earned / category_total * 100) if category_total > 0 else 0,
            }

        # Group by rarity
        by_rarity = {}
        for rarity in Achievement.objects.filter(is_active=True).values_list('rarity', flat=True).distinct():
            rarity_total = Achievement.objects.filter(is_active=True, rarity=rarity).count()
            rarity_earned = UserAchievement.objects.filter(user=user, achievement__rarity=rarity).count()
            by_rarity[rarity] = {
                'total': rarity_total,
                'earned': rarity_earned,
            }

        return {
            'total_achievements': total,
            'earned_count': earned,
            'total_points': total_points,
            'completion_percentage': int(earned / total * 100) if total > 0 else 0,
            'by_category': by_category,
            'by_rarity': by_rarity,
        }
