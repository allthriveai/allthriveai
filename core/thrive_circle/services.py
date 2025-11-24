"""
Thrive Circle Service Layer
Handles XP calculation logic and business rules
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class XPConfig:
    """XP award amounts and formulas"""

    # Quiz XP
    QUIZ_BASE = getattr(settings, 'THRIVE_CIRCLE_QUIZ_BASE_XP', 10)
    QUIZ_BONUS_MULTIPLIER = getattr(settings, 'THRIVE_CIRCLE_QUIZ_BONUS_MULTIPLIER', 0.4)
    QUIZ_PERFECT_BONUS = getattr(settings, 'THRIVE_CIRCLE_QUIZ_PERFECT_BONUS', 10)

    # Project XP
    PROJECT_CREATE = getattr(settings, 'THRIVE_CIRCLE_PROJECT_CREATE_XP', 15)
    PROJECT_UPDATE = getattr(settings, 'THRIVE_CIRCLE_PROJECT_UPDATE_XP', 5)

    # Engagement XP
    COMMENT = getattr(settings, 'THRIVE_CIRCLE_COMMENT_XP', 3)
    REACTION = getattr(settings, 'THRIVE_CIRCLE_REACTION_XP', 1)

    # Daily/Streak XP
    DAILY_LOGIN = getattr(settings, 'THRIVE_CIRCLE_DAILY_LOGIN_XP', 5)
    STREAK_BONUS_PER_DAY = getattr(settings, 'THRIVE_CIRCLE_STREAK_BONUS_XP', 2)

    # Tier Thresholds
    TIER_THRESHOLDS = {
        'ember': 0,
        'spark': 500,
        'blaze': 2000,
        'beacon': 5000,
        'phoenix': 10000,
    }

    # Validation
    MAX_SINGLE_AWARD = getattr(settings, 'THRIVE_CIRCLE_MAX_SINGLE_AWARD', 1000)


class XPService:
    """Service for XP calculations and awards"""

    @staticmethod
    def calculate_quiz_xp(percentage_score: int) -> int:
        """
        Calculate XP for quiz completion based on score.

        Args:
            percentage_score: Score as percentage (0-100)

        Returns:
            Total XP to award (base + bonus)
        """
        if not 0 <= percentage_score <= 100:
            raise ValueError(f'Percentage score must be 0-100, got {percentage_score}')

        base_xp = XPConfig.QUIZ_BASE
        bonus_xp = int(percentage_score * XPConfig.QUIZ_BONUS_MULTIPLIER)

        # Perfect score bonus
        if percentage_score == 100:
            bonus_xp += XPConfig.QUIZ_PERFECT_BONUS

        total = base_xp + bonus_xp
        return min(total, XPConfig.MAX_SINGLE_AWARD)

    @staticmethod
    def calculate_streak_bonus_xp(streak_days: int) -> int:
        """
        Calculate bonus XP for daily login streak.

        Args:
            streak_days: Number of consecutive days

        Returns:
            Bonus XP for streak
        """
        if streak_days <= 1:
            return 0

        # Bonus increases with streak, but caps at reasonable amount
        bonus = (streak_days - 1) * XPConfig.STREAK_BONUS_PER_DAY
        return min(bonus, 50)  # Cap at 50 XP bonus

    @staticmethod
    def get_tier_for_xp(total_xp: int) -> str:
        """
        Determine tier based on total XP.

        Args:
            total_xp: User's total accumulated XP

        Returns:
            Tier name (ember/spark/blaze/beacon/phoenix)
        """
        if total_xp >= XPConfig.TIER_THRESHOLDS['phoenix']:
            return 'phoenix'
        elif total_xp >= XPConfig.TIER_THRESHOLDS['beacon']:
            return 'beacon'
        elif total_xp >= XPConfig.TIER_THRESHOLDS['blaze']:
            return 'blaze'
        elif total_xp >= XPConfig.TIER_THRESHOLDS['spark']:
            return 'spark'
        else:
            return 'ember'

    @staticmethod
    def get_xp_to_next_tier(current_xp: int) -> tuple[str, int]:
        """
        Get next tier and XP needed to reach it.

        Args:
            current_xp: User's current total XP

        Returns:
            Tuple of (next_tier_name, xp_needed)
        """
        current_tier = XPService.get_tier_for_xp(current_xp)

        tier_order = ['ember', 'spark', 'blaze', 'beacon', 'phoenix']
        current_index = tier_order.index(current_tier)

        if current_index >= len(tier_order) - 1:
            # Already at max tier
            return ('phoenix', 0)

        next_tier = tier_order[current_index + 1]
        next_threshold = XPConfig.TIER_THRESHOLDS[next_tier]
        xp_needed = next_threshold - current_xp

        return (next_tier, xp_needed)

    @staticmethod
    def validate_xp_award(amount: int, activity_type: str) -> None:
        """
        Validate XP award before processing.

        Args:
            amount: XP amount to award
            activity_type: Type of activity

        Raises:
            ValueError: If award is invalid
        """
        if amount <= 0:
            raise ValueError(f'XP amount must be positive, got {amount}')

        if amount > XPConfig.MAX_SINGLE_AWARD:
            raise ValueError(f'Single XP award cannot exceed {XPConfig.MAX_SINGLE_AWARD}, got {amount}')

        # Additional validation for specific activity types
        if activity_type == 'quiz_complete' and amount > 100:
            logger.warning(
                f'Unusually high quiz XP: {amount}', extra={'activity_type': activity_type, 'amount': amount}
            )
