"""
Thrive Circle Service Layer
Handles points calculation logic and business rules
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class PointsConfig:
    """Points award amounts and formulas"""

    # Quiz Points
    QUIZ_BASE = getattr(settings, 'THRIVE_CIRCLE_QUIZ_BASE_POINTS', 10)
    QUIZ_BONUS_MULTIPLIER = getattr(settings, 'THRIVE_CIRCLE_QUIZ_BONUS_MULTIPLIER', 0.4)
    QUIZ_PERFECT_BONUS = getattr(settings, 'THRIVE_CIRCLE_QUIZ_PERFECT_BONUS', 10)

    # Project Points
    PROJECT_CREATE = getattr(settings, 'THRIVE_CIRCLE_PROJECT_CREATE_POINTS', 15)
    PROJECT_UPDATE = getattr(settings, 'THRIVE_CIRCLE_PROJECT_UPDATE_POINTS', 5)

    # Engagement Points
    COMMENT = getattr(settings, 'THRIVE_CIRCLE_COMMENT_POINTS', 3)
    REACTION = getattr(settings, 'THRIVE_CIRCLE_REACTION_POINTS', 1)

    # Daily/Streak Points
    DAILY_LOGIN = getattr(settings, 'THRIVE_CIRCLE_DAILY_LOGIN_POINTS', 5)
    STREAK_BONUS_PER_DAY = getattr(settings, 'THRIVE_CIRCLE_STREAK_BONUS_POINTS', 2)

    # Tier Thresholds
    TIER_THRESHOLDS = {
        'seedling': 0,
        'sprout': 1000,
        'blossom': 2500,
        'bloom': 5000,
        'evergreen': 10000,
    }

    # Validation
    MAX_SINGLE_AWARD = getattr(settings, 'THRIVE_CIRCLE_MAX_SINGLE_AWARD', 1000)


class PointsService:
    """Service for points calculations and awards"""

    @staticmethod
    def calculate_quiz_points(percentage_score: int) -> int:
        """
        Calculate points for quiz completion based on score.

        Args:
            percentage_score: Score as percentage (0-100)

        Returns:
            Total points to award (base + bonus)
        """
        if not 0 <= percentage_score <= 100:
            raise ValueError(f'Percentage score must be 0-100, got {percentage_score}')

        base_points = PointsConfig.QUIZ_BASE
        bonus_points = int(percentage_score * PointsConfig.QUIZ_BONUS_MULTIPLIER)

        # Perfect score bonus
        if percentage_score == 100:
            bonus_points += PointsConfig.QUIZ_PERFECT_BONUS

        total = base_points + bonus_points
        return min(total, PointsConfig.MAX_SINGLE_AWARD)

    @staticmethod
    def calculate_streak_bonus_points(streak_days: int) -> int:
        """
        Calculate bonus points for daily login streak.

        Args:
            streak_days: Number of consecutive days

        Returns:
            Bonus points for streak
        """
        if streak_days <= 1:
            return 0

        # Bonus increases with streak, but caps at reasonable amount
        bonus = (streak_days - 1) * PointsConfig.STREAK_BONUS_PER_DAY
        return min(bonus, 50)  # Cap at 50 points bonus

    @staticmethod
    def get_tier_for_points(total_points: int) -> str:
        """
        Determine tier based on total points.

        Args:
            total_points: User's total accumulated points

        Returns:
            Tier name (seedling/sprout/blossom/bloom/evergreen)
        """
        if total_points >= PointsConfig.TIER_THRESHOLDS['evergreen']:
            return 'evergreen'
        elif total_points >= PointsConfig.TIER_THRESHOLDS['bloom']:
            return 'bloom'
        elif total_points >= PointsConfig.TIER_THRESHOLDS['blossom']:
            return 'blossom'
        elif total_points >= PointsConfig.TIER_THRESHOLDS['sprout']:
            return 'sprout'
        else:
            return 'seedling'

    @staticmethod
    def get_points_to_next_tier(current_points: int) -> tuple[str, int]:
        """
        Get next tier and points needed to reach it.

        Args:
            current_points: User's current total points

        Returns:
            Tuple of (next_tier_name, points_needed)
        """
        current_tier = PointsService.get_tier_for_points(current_points)

        tier_order = ['seedling', 'sprout', 'blossom', 'bloom', 'evergreen']
        current_index = tier_order.index(current_tier)

        if current_index >= len(tier_order) - 1:
            # Already at max tier
            return ('evergreen', 0)

        next_tier = tier_order[current_index + 1]
        next_threshold = PointsConfig.TIER_THRESHOLDS[next_tier]
        points_needed = next_threshold - current_points

        return (next_tier, points_needed)

    @staticmethod
    def validate_points_award(amount: int, activity_type: str) -> None:
        """
        Validate points award before processing.

        Args:
            amount: Points amount to award
            activity_type: Type of activity

        Raises:
            ValueError: If award is invalid
        """
        if amount <= 0:
            raise ValueError(f'Points amount must be positive, got {amount}')

        if amount > PointsConfig.MAX_SINGLE_AWARD:
            raise ValueError(f'Single points award cannot exceed {PointsConfig.MAX_SINGLE_AWARD}, got {amount}')

        # Additional validation for specific activity types
        if activity_type == 'quiz_complete' and amount > 100:
            logger.warning(
                f'Unusually high quiz points: {amount}', extra={'activity_type': activity_type, 'amount': amount}
            )
