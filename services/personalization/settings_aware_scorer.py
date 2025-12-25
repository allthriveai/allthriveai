"""
Settings-aware scoring that honors PersonalizationSettings toggles.

This module bridges user's PersonalizationSettings with the scoring algorithm,
allowing users to control which signals influence their recommendations.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()

logger = logging.getLogger(__name__)


class SettingsAwareScorer:
    """
    Bridge between PersonalizationSettings and the scoring algorithm.

    Adjusts scoring weights based on user's personalization settings:
    - use_topic_selections -> affects explicit_preferences weight
    - learn_from_views -> affects behavioral_signals (view component)
    - learn_from_likes -> affects behavioral_signals (like component)
    - use_social_signals -> affects collaborative weight
    - discovery_balance -> shifts weight between vector_similarity and explicit_preferences

    Usage:
        scorer = SettingsAwareScorer(user)
        weights = scorer.get_adjusted_weights()
        # Use weights instead of PersonalizationEngine.WEIGHTS
    """

    # Base weights (when all settings enabled)
    # These match PersonalizationEngine.WEIGHTS
    BASE_WEIGHTS = {
        'vector_similarity': 0.27,
        'explicit_preferences': 0.23,
        'behavioral_signals': 0.23,
        'collaborative': 0.14,
        'popularity': 0.05,
        'promotion': 0.08,
    }

    def __init__(self, user: 'User'):
        """
        Initialize with a user.

        Args:
            user: The user whose settings should be applied
        """
        self.user = user
        self._settings = None
        self._settings_loaded = False

    @property
    def settings(self):
        """Lazy-load user's PersonalizationSettings."""
        if not self._settings_loaded:
            self._settings = self._get_settings()
            self._settings_loaded = True
        return self._settings

    def _get_settings(self):
        """Get user's PersonalizationSettings or return None for defaults."""
        try:
            return self.user.personalization_settings
        except Exception:
            # User doesn't have settings yet, use defaults
            return None

    def get_adjusted_weights(self) -> dict:
        """
        Calculate weights based on user's PersonalizationSettings.

        When a signal is disabled, its weight is redistributed proportionally
        to remaining enabled signals.

        Returns:
            Dict of weight names to float values, summing to approximately 1.0
        """
        if not self.settings:
            return self.BASE_WEIGHTS.copy()

        weights = self.BASE_WEIGHTS.copy()
        total_reduction = 0.0

        # Disable explicit preferences if topic selections off
        if not self.settings.use_topic_selections:
            total_reduction += weights['explicit_preferences']
            weights['explicit_preferences'] = 0.0
            logger.debug(f'Disabled explicit_preferences for user_id={self.user.id}')

        # Reduce behavioral if views/likes learning disabled
        if not self.settings.learn_from_views and not self.settings.learn_from_likes:
            # Both off - fully disable behavioral signals
            total_reduction += weights['behavioral_signals']
            weights['behavioral_signals'] = 0.0
            logger.debug(f'Disabled behavioral_signals for user_id={self.user.id}')
        elif not self.settings.learn_from_views or not self.settings.learn_from_likes:
            # Only one off - halve the weight
            halved = weights['behavioral_signals'] * 0.5
            total_reduction += halved
            weights['behavioral_signals'] = halved
            logger.debug(
                f'Halved behavioral_signals for user_id={self.user.id} '
                f'(learn_from_views={self.settings.learn_from_views}, '
                f'learn_from_likes={self.settings.learn_from_likes})'
            )

        # Disable collaborative if social signals off
        if not self.settings.use_social_signals:
            total_reduction += weights['collaborative']
            weights['collaborative'] = 0.0
            logger.debug(f'Disabled collaborative for user_id={self.user.id}')

        # Redistribute disabled weight proportionally to remaining signals
        if total_reduction > 0:
            active_weights = {k: v for k, v in weights.items() if v > 0}
            if active_weights:
                redistribution_per_signal = total_reduction / len(active_weights)
                for key in active_weights:
                    weights[key] += redistribution_per_signal
                logger.debug(
                    f'Redistributed {total_reduction:.3f} weight across '
                    f'{len(active_weights)} active signals for user_id={self.user.id}'
                )

        # Apply discovery_balance (0=familiar, 100=discovery)
        # High discovery -> boost vector_similarity (explore new content)
        # Low discovery -> boost explicit_preferences (stick to known interests)
        weights = self._apply_discovery_balance(weights)

        return weights

    def _apply_discovery_balance(self, weights: dict) -> dict:
        """
        Apply discovery_balance to shift weight between exploration and exploitation.

        At discovery_balance=0: Boost explicit_preferences, reduce vector_similarity
        At discovery_balance=50: No change (balanced)
        At discovery_balance=100: Boost vector_similarity, reduce explicit_preferences

        Args:
            weights: Current weights dict

        Returns:
            Adjusted weights dict
        """
        if not self.settings:
            return weights

        discovery_balance = self.settings.discovery_balance
        # Normalize to -0.5 to +0.5 range (centered at 50)
        balance_factor = (discovery_balance - 50) / 100.0

        # Maximum shift of 10% in either direction
        max_shift = 0.10
        shift = balance_factor * max_shift * 2  # -0.10 to +0.10

        # Only shift if both weights are active
        if weights['vector_similarity'] > 0 and weights['explicit_preferences'] > 0:
            # Positive shift (discovery): vector gets more, explicit gets less
            # Negative shift (familiar): explicit gets more, vector gets less
            weights['vector_similarity'] += shift
            weights['explicit_preferences'] -= shift

            # Clamp to prevent negative weights
            weights['vector_similarity'] = max(0.0, weights['vector_similarity'])
            weights['explicit_preferences'] = max(0.0, weights['explicit_preferences'])

            if shift != 0:
                logger.debug(
                    f'Applied discovery_balance={discovery_balance} shift={shift:.3f} ' f'for user_id={self.user.id}'
                )

        return weights

    def should_penalize_views(self) -> bool:
        """
        Check if viewed projects should be penalized in scoring.

        Returns False if user has disabled learn_from_views.
        """
        if not self.settings:
            return True
        return self.settings.learn_from_views

    def should_penalize_likes(self) -> bool:
        """
        Check if liked projects should be penalized in scoring.

        Returns False if user has disabled learn_from_likes.
        """
        if not self.settings:
            return True
        return self.settings.learn_from_likes

    def should_use_social_signals(self) -> bool:
        """
        Check if social signals (following/followers) should be used.

        Returns False if user has disabled use_social_signals.
        """
        if not self.settings:
            return True
        return self.settings.use_social_signals

    def should_track_time(self) -> bool:
        """
        Check if time tracking is allowed for this user.

        Returns False if user has disabled allow_time_tracking.
        """
        if not self.settings:
            return True
        return self.settings.allow_time_tracking

    def should_track_scroll(self) -> bool:
        """
        Check if scroll tracking is allowed for this user.

        Returns False if user has disabled allow_scroll_tracking.
        """
        if not self.settings:
            return True
        return self.settings.allow_scroll_tracking

    def should_consider_skill_level(self) -> bool:
        """
        Check if skill level should be considered for recommendations.

        Returns False if user has disabled consider_skill_level.
        """
        if not self.settings:
            return True
        return self.settings.consider_skill_level

    def get_user_skill_level(self) -> str | None:
        """
        Get the user's skill level from their LearnerProfile.

        Returns:
            'beginner', 'intermediate', 'advanced', or None if not set
        """
        try:
            learner_profile = self.user.learner_profile
            return learner_profile.current_difficulty_level
        except Exception:
            return None

    def calculate_skill_match_score(self, content_difficulty: str | None) -> float:
        """
        Calculate a score based on how well content difficulty matches user skill level.

        This score is used as a multiplier in the engine (0.8 to 1.2 range):
        - Exact match: 1.0 -> 1.2x multiplier (20% boost)
        - One level away: 0.5 -> 1.0x multiplier (neutral)
        - Two levels away: 0.0 -> 0.8x multiplier (20% penalty)
        - No difficulty set: 0.5 -> 1.0x multiplier (neutral)

        The penalty for mismatches helps avoid showing beginners advanced content
        they can't understand, or experts basic content they already know.

        Args:
            content_difficulty: The difficulty level of the content ('beginner', 'intermediate', 'advanced')

        Returns:
            Score from 0.0 to 1.0
        """
        if not self.should_consider_skill_level():
            return 0.5  # Neutral score when disabled

        user_skill = self.get_user_skill_level()
        if not user_skill:
            return 0.5  # Neutral if user hasn't set skill level

        if not content_difficulty:
            return 0.5  # Neutral if content has no difficulty set

        # Normalize to lowercase
        user_skill = user_skill.lower()
        content_difficulty = content_difficulty.lower()

        # Map skill levels to numeric values for distance calculation
        skill_map = {'beginner': 0, 'intermediate': 1, 'advanced': 2}

        user_level = skill_map.get(user_skill)
        content_level = skill_map.get(content_difficulty)

        if user_level is None or content_level is None:
            return 0.5  # Neutral for unknown levels

        distance = abs(user_level - content_level)

        if distance == 0:
            score = 1.0  # Perfect match
        elif distance == 1:
            score = 0.5  # Close match
        else:
            score = 0.0  # Too far apart

        logger.debug(
            f'Skill match: user={user_skill}, content={content_difficulty}, '
            f'distance={distance}, score={score} for user_id={self.user.id}'
        )
        return score
