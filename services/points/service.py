"""Service for managing user points and levels."""

import bisect
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F

from core.points.models import ActivityType, PointsHistory

logger = logging.getLogger(__name__)

# Get point values from settings
POINT_VALUES = {
    ActivityType.QUIZ_COMPLETED: settings.POINTS_CONFIG.get('QUIZ_COMPLETED', 20),
    ActivityType.QUIZ_PERFECT_SCORE: settings.POINTS_CONFIG.get('QUIZ_PERFECT_SCORE', 30),
    ActivityType.QUIZ_STREAK: settings.POINTS_CONFIG.get('QUIZ_STREAK', 10),
    ActivityType.PROJECT_CREATED: settings.POINTS_CONFIG.get('PROJECT_CREATED', 10),
    ActivityType.PROJECT_PUBLISHED: settings.POINTS_CONFIG.get('PROJECT_PUBLISHED', 15),
    ActivityType.PROJECT_MILESTONE: settings.POINTS_CONFIG.get('PROJECT_MILESTONE', 50),
    ActivityType.DAILY_LOGIN: settings.POINTS_CONFIG.get('DAILY_LOGIN', 5),
    ActivityType.WEEK_STREAK: settings.POINTS_CONFIG.get('WEEK_STREAK', 25),
    ActivityType.MONTH_STREAK: settings.POINTS_CONFIG.get('MONTH_STREAK', 100),
    ActivityType.BATTLE_PARTICIPATED: settings.POINTS_CONFIG.get('BATTLE_PARTICIPATED', 25),
    ActivityType.BATTLE_WON: settings.POINTS_CONFIG.get('BATTLE_WON', 20),
    ActivityType.BATTLE_COMPLETED: settings.POINTS_CONFIG.get('BATTLE_COMPLETED', 10),
    ActivityType.PROFILE_COMPLETED: settings.POINTS_CONFIG.get('PROFILE_COMPLETED', 25),
    ActivityType.REFERRAL: settings.POINTS_CONFIG.get('REFERRAL', 50),
    ActivityType.ACHIEVEMENT_EARNED: 0,  # Varies by achievement, pass as metadata
}

# Pre-sorted thresholds for binary search optimization
THRESHOLDS_LIST = [
    0,
    100,
    250,
    500,
    1000,
    1750,
    2750,
    4000,
    5500,
    7500,
    10000,
    13000,
    16500,
    20500,
    25000,
    30000,
    36000,
    43000,
    51000,
    60000,
]
LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]


class PointsService:
    """Service for managing points and levels."""

    @staticmethod
    def calculate_level(points: int) -> int:
        """Calculate user level from total points using binary search.

        Optimized version using pre-sorted thresholds for O(log n) complexity.
        Based on formula from POINTS_SYSTEM_PLAN.md.
        """
        # For levels above 20, add 10,000 points per level
        if points >= 60000:
            additional_levels = (points - 60000) // 10000
            return 20 + additional_levels

        # Binary search for level 1-20
        # bisect_right returns the insertion point, subtract 1 to get the level
        index = bisect.bisect_right(THRESHOLDS_LIST, points) - 1
        return LEVELS[index] if index >= 0 else 1

    @staticmethod
    def get_next_level_threshold(current_level: int) -> int:
        """Get points needed for next level."""
        thresholds = {
            1: 100,
            2: 250,
            3: 500,
            4: 1000,
            5: 1750,
            6: 2750,
            7: 4000,
            8: 5500,
            9: 7500,
            10: 10000,
            11: 13000,
            12: 16500,
            13: 20500,
            14: 25000,
            15: 30000,
            16: 36000,
            17: 43000,
            18: 51000,
            19: 60000,
        }

        if current_level in thresholds:
            return thresholds[current_level]

        # For levels >= 20
        return 60000 + ((current_level - 19) * 10000)

    @staticmethod
    @transaction.atomic
    def award_points(
        user,
        activity_type: ActivityType,
        description: str | None = None,
        metadata: dict | None = None,
        custom_points: int | None = None,
    ) -> PointsHistory | None:
        """Award points to a user for an activity.

        Thread-safe implementation using F() expressions to prevent race conditions.

        Args:
            user: User instance
            activity_type: Type of activity (from ActivityType enum)
            description: Human-readable description (auto-generated if None)
            metadata: Additional context data
            custom_points: Override default points for this activity

        Returns:
            PointsHistory record or None if award failed

        Raises:
            ValueError: If custom_points is outside allowed range
        """
        try:
            # Determine points to award
            if custom_points is not None:
                points = custom_points
                # Validate custom points
                max_points = settings.POINTS_CONFIG.get('MAX_POINTS_PER_AWARD', 10000)
                min_points = settings.POINTS_CONFIG.get('MIN_POINTS_PER_AWARD', -1000)
                if points < min_points or points > max_points:
                    raise ValueError(f'Custom points must be between {min_points} and {max_points}')
            elif activity_type in POINT_VALUES:
                points = POINT_VALUES[activity_type]
            else:
                # Check metadata for achievement points
                points = metadata.get('points', 0) if metadata else 0

            # Generate description if not provided
            if not description:
                activity_display = dict(ActivityType.choices).get(activity_type, activity_type)
                description = f'Earned {points} points for: {activity_display}'

            # Create points history record
            history = PointsHistory.objects.create(
                user=user,
                activity_type=activity_type,
                points_awarded=points,
                description=description,
                metadata=metadata or {},
            )

            # CRITICAL: Use F() expression to prevent race conditions
            # This performs atomic update at database level
            old_level = user.level
            user.total_points = F('total_points') + points
            user.save(update_fields=['total_points'])

            # Refresh to get the actual total_points value
            user.refresh_from_db()

            # Recalculate level based on new points
            new_level = PointsService.calculate_level(user.total_points)
            if new_level != old_level:
                user.level = new_level
                user.save(update_fields=['level'])

                # Log level up
                logger.info(
                    f'User {user.username} leveled up from {old_level} to {new_level} '
                    f'(total points: {user.total_points})'
                )

            # Log points award
            logger.info(
                f'Awarded {points} points to {user.username} for {activity_type} '
                f'(total: {user.total_points}, level: {user.level})'
            )

            return history

        except Exception as e:
            logger.error(
                f'Failed to award points to {user.username}: {e}',
                exc_info=True,
                extra={
                    'user_id': user.id,
                    'activity_type': activity_type,
                    'points': custom_points or POINT_VALUES.get(activity_type, 0),
                },
            )
            raise

    @staticmethod
    def get_level_progress(user) -> dict:
        """Get user's progress towards next level.

        Returns:
            dict with current_level, current_points, next_level_threshold, progress_percentage
        """
        current_level = user.level
        current_points = user.total_points
        next_threshold = PointsService.get_next_level_threshold(current_level)

        # Calculate points needed within current level range
        if current_level == 1:
            current_level_start = 0
        elif current_level <= 20:
            level_starts = {
                2: 100,
                3: 250,
                4: 500,
                5: 1000,
                6: 1750,
                7: 2750,
                8: 4000,
                9: 5500,
                10: 7500,
                11: 10000,
                12: 13000,
                13: 16500,
                14: 20500,
                15: 25000,
                16: 30000,
                17: 36000,
                18: 43000,
                19: 51000,
                20: 60000,
            }
            current_level_start = level_starts.get(current_level, 0)
        else:
            current_level_start = 60000 + ((current_level - 20) * 10000)

        points_into_level = current_points - current_level_start
        points_needed_for_level = next_threshold - current_level_start
        progress_percentage = (points_into_level / points_needed_for_level * 100) if points_needed_for_level > 0 else 0

        return {
            'current_level': current_level,
            'current_points': current_points,
            'next_level_threshold': next_threshold,
            'points_to_next_level': next_threshold - current_points,
            'progress_percentage': round(progress_percentage, 1),
        }
