"""
Unit tests for SettingsAwareScorer service.

Tests that PersonalizationSettings are correctly applied to recommendation weights.
"""

import pytest
from django.contrib.auth import get_user_model

from core.users.models import PersonalizationSettings
from services.personalization.settings_aware_scorer import SettingsAwareScorer

User = get_user_model()


@pytest.fixture
def user(db):
    """Create test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )


@pytest.fixture
def user_with_settings(user):
    """Create test user with personalization settings."""
    PersonalizationSettings.objects.create(
        user=user,
        use_topic_selections=True,
        learn_from_views=True,
        learn_from_likes=True,
        use_social_signals=True,
        discovery_balance=50,
    )
    return user


# =============================================================================
# Default Behavior Tests
# =============================================================================


@pytest.mark.django_db
class TestDefaultBehavior:
    """Test default behavior when user has no settings."""

    def test_no_settings_returns_base_weights(self, user):
        """User without settings gets base weights."""
        scorer = SettingsAwareScorer(user)
        weights = scorer.get_adjusted_weights()

        assert weights == SettingsAwareScorer.BASE_WEIGHTS

    def test_no_settings_allows_view_penalization(self, user):
        """User without settings allows view penalization."""
        scorer = SettingsAwareScorer(user)

        assert scorer.should_penalize_views() is True

    def test_no_settings_allows_like_penalization(self, user):
        """User without settings allows like penalization."""
        scorer = SettingsAwareScorer(user)

        assert scorer.should_penalize_likes() is True

    def test_no_settings_allows_social_signals(self, user):
        """User without settings allows social signals."""
        scorer = SettingsAwareScorer(user)

        assert scorer.should_use_social_signals() is True

    def test_no_settings_allows_time_tracking(self, user):
        """User without settings allows time tracking."""
        scorer = SettingsAwareScorer(user)

        assert scorer.should_track_time() is True

    def test_no_settings_allows_scroll_tracking(self, user):
        """User without settings allows scroll tracking."""
        scorer = SettingsAwareScorer(user)

        assert scorer.should_track_scroll() is True


# =============================================================================
# Weight Adjustment Tests
# =============================================================================


@pytest.mark.django_db
class TestWeightAdjustments:
    """Test weight adjustments based on settings."""

    def test_disable_topic_selections_zeroes_explicit_weight(self, user_with_settings):
        """Disabling topic selections zeroes explicit_preferences weight."""
        user_with_settings.personalization_settings.use_topic_selections = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        assert weights['explicit_preferences'] == 0.0

    def test_disable_views_and_likes_zeroes_behavioral_weight(self, user_with_settings):
        """Disabling both views and likes zeroes behavioral_signals weight."""
        settings = user_with_settings.personalization_settings
        settings.learn_from_views = False
        settings.learn_from_likes = False
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        assert weights['behavioral_signals'] == 0.0

    def test_disable_only_views_halves_behavioral_weight(self, user_with_settings):
        """Disabling only views halves behavioral_signals weight."""
        settings = user_with_settings.personalization_settings
        settings.learn_from_views = False
        settings.learn_from_likes = True
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # Should be half of base weight (0.23 / 2 = 0.115), but with redistribution
        assert weights['behavioral_signals'] < SettingsAwareScorer.BASE_WEIGHTS['behavioral_signals']
        assert weights['behavioral_signals'] > 0

    def test_disable_only_likes_halves_behavioral_weight(self, user_with_settings):
        """Disabling only likes halves behavioral_signals weight."""
        settings = user_with_settings.personalization_settings
        settings.learn_from_views = True
        settings.learn_from_likes = False
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        assert weights['behavioral_signals'] < SettingsAwareScorer.BASE_WEIGHTS['behavioral_signals']
        assert weights['behavioral_signals'] > 0

    def test_disable_social_signals_zeroes_collaborative_weight(self, user_with_settings):
        """Disabling social signals zeroes collaborative weight."""
        user_with_settings.personalization_settings.use_social_signals = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        assert weights['collaborative'] == 0.0

    def test_weights_sum_to_approximately_one(self, user_with_settings):
        """Weights should sum to approximately 1.0 after adjustments."""
        settings = user_with_settings.personalization_settings
        settings.use_social_signals = False
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        total = sum(weights.values())
        assert 0.99 <= total <= 1.01  # Allow small floating point error

    def test_disabled_weight_redistributed_to_active_weights(self, user_with_settings):
        """Disabled weight is redistributed to remaining active weights."""
        settings = user_with_settings.personalization_settings
        original_collaborative = SettingsAwareScorer.BASE_WEIGHTS['collaborative']
        settings.use_social_signals = False
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # Each remaining weight should increase
        # (5 remaining weights, so each gets original_collaborative / 5 extra)
        base_vector = SettingsAwareScorer.BASE_WEIGHTS['vector_similarity']
        # Note: discovery_balance at 50 means no shift
        assert weights['vector_similarity'] > base_vector


# =============================================================================
# Discovery Balance Tests
# =============================================================================


@pytest.mark.django_db
class TestDiscoveryBalance:
    """Test discovery_balance slider effects on weights."""

    def test_discovery_balance_0_boosts_explicit(self, user_with_settings):
        """Discovery balance at 0 (familiar) boosts explicit_preferences."""
        user_with_settings.personalization_settings.discovery_balance = 0
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # At balance=0, explicit should be boosted, vector reduced
        base_explicit = SettingsAwareScorer.BASE_WEIGHTS['explicit_preferences']
        base_vector = SettingsAwareScorer.BASE_WEIGHTS['vector_similarity']

        assert weights['explicit_preferences'] > base_explicit
        assert weights['vector_similarity'] < base_vector

    def test_discovery_balance_100_boosts_vector(self, user_with_settings):
        """Discovery balance at 100 (discovery) boosts vector_similarity."""
        user_with_settings.personalization_settings.discovery_balance = 100
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # At balance=100, vector should be boosted, explicit reduced
        base_explicit = SettingsAwareScorer.BASE_WEIGHTS['explicit_preferences']
        base_vector = SettingsAwareScorer.BASE_WEIGHTS['vector_similarity']

        assert weights['vector_similarity'] > base_vector
        assert weights['explicit_preferences'] < base_explicit

    def test_discovery_balance_50_no_shift(self, user_with_settings):
        """Discovery balance at 50 (balanced) causes no weight shift."""
        user_with_settings.personalization_settings.discovery_balance = 50
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # At balance=50, no shift should occur
        base_explicit = SettingsAwareScorer.BASE_WEIGHTS['explicit_preferences']
        base_vector = SettingsAwareScorer.BASE_WEIGHTS['vector_similarity']

        assert abs(weights['explicit_preferences'] - base_explicit) < 0.001
        assert abs(weights['vector_similarity'] - base_vector) < 0.001


# =============================================================================
# Helper Method Tests
# =============================================================================


@pytest.mark.django_db
class TestHelperMethods:
    """Test helper methods for checking individual settings."""

    def test_should_penalize_views_false_when_disabled(self, user_with_settings):
        """should_penalize_views returns False when learn_from_views is off."""
        user_with_settings.personalization_settings.learn_from_views = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)

        assert scorer.should_penalize_views() is False

    def test_should_penalize_likes_false_when_disabled(self, user_with_settings):
        """should_penalize_likes returns False when learn_from_likes is off."""
        user_with_settings.personalization_settings.learn_from_likes = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)

        assert scorer.should_penalize_likes() is False

    def test_should_use_social_signals_false_when_disabled(self, user_with_settings):
        """should_use_social_signals returns False when use_social_signals is off."""
        user_with_settings.personalization_settings.use_social_signals = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)

        assert scorer.should_use_social_signals() is False

    def test_should_track_time_false_when_disabled(self, user_with_settings):
        """should_track_time returns False when allow_time_tracking is off."""
        user_with_settings.personalization_settings.allow_time_tracking = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)

        assert scorer.should_track_time() is False

    def test_should_track_scroll_false_when_disabled(self, user_with_settings):
        """should_track_scroll returns False when allow_scroll_tracking is off."""
        user_with_settings.personalization_settings.allow_scroll_tracking = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)

        assert scorer.should_track_scroll() is False


# =============================================================================
# Edge Cases
# =============================================================================


@pytest.mark.django_db
class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_all_signals_disabled_still_has_weights(self, user_with_settings):
        """Even with all optional signals disabled, some weights remain."""
        settings = user_with_settings.personalization_settings
        settings.use_topic_selections = False
        settings.learn_from_views = False
        settings.learn_from_likes = False
        settings.use_social_signals = False
        settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        weights = scorer.get_adjusted_weights()

        # Vector, popularity, and promotion should still have weights
        assert weights['vector_similarity'] > 0
        assert weights['popularity'] > 0
        assert weights['promotion'] > 0
        assert sum(weights.values()) > 0.99

    def test_discovery_balance_edge_values(self, user_with_settings):
        """Discovery balance handles edge values correctly."""
        for balance in [0, 50, 100]:
            user_with_settings.personalization_settings.discovery_balance = balance
            user_with_settings.personalization_settings.save()

            scorer = SettingsAwareScorer(user_with_settings)
            weights = scorer.get_adjusted_weights()

            # Weights should never be negative
            for weight in weights.values():
                assert weight >= 0

    def test_settings_lazy_loading(self, user_with_settings):
        """Settings are lazy-loaded (not fetched until accessed)."""
        scorer = SettingsAwareScorer(user_with_settings)

        # Settings not loaded yet
        assert scorer._settings_loaded is False

        # Access settings
        _ = scorer.settings

        # Now loaded
        assert scorer._settings_loaded is True


# =============================================================================
# Skill Level Tests
# =============================================================================


@pytest.mark.django_db
class TestSkillLevel:
    """Test skill level matching functionality."""

    def test_should_consider_skill_level_default_true(self, user):
        """By default, skill level should be considered."""
        scorer = SettingsAwareScorer(user)
        assert scorer.should_consider_skill_level() is True

    def test_should_consider_skill_level_false_when_disabled(self, user_with_settings):
        """should_consider_skill_level returns False when disabled."""
        user_with_settings.personalization_settings.consider_skill_level = False
        user_with_settings.personalization_settings.save()

        scorer = SettingsAwareScorer(user_with_settings)
        assert scorer.should_consider_skill_level() is False

    def test_get_user_skill_level_none_when_no_profile(self, user):
        """Returns None when user has no LearnerProfile."""
        scorer = SettingsAwareScorer(user)
        assert scorer.get_user_skill_level() is None

    def test_get_user_skill_level_from_learner_profile(self, user):
        """Returns skill level from LearnerProfile when it exists."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='intermediate')

        scorer = SettingsAwareScorer(user)
        assert scorer.get_user_skill_level() == 'intermediate'

    def test_skill_match_score_exact_match(self, user):
        """Exact skill level match returns 1.0."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='beginner')
        PersonalizationSettings.objects.create(user=user, consider_skill_level=True)

        scorer = SettingsAwareScorer(user)
        assert scorer.calculate_skill_match_score('beginner') == 1.0
        assert scorer.calculate_skill_match_score('Beginner') == 1.0  # Case insensitive

    def test_skill_match_score_one_level_away(self, user):
        """One level difference returns 0.5."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='intermediate')
        PersonalizationSettings.objects.create(user=user, consider_skill_level=True)

        scorer = SettingsAwareScorer(user)
        assert scorer.calculate_skill_match_score('beginner') == 0.5
        assert scorer.calculate_skill_match_score('advanced') == 0.5

    def test_skill_match_score_two_levels_away(self, user):
        """Two level difference returns 0.0."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='beginner')
        PersonalizationSettings.objects.create(user=user, consider_skill_level=True)

        scorer = SettingsAwareScorer(user)
        assert scorer.calculate_skill_match_score('advanced') == 0.0

    def test_skill_match_score_neutral_when_disabled(self, user):
        """Returns 0.5 when skill matching is disabled."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='beginner')
        PersonalizationSettings.objects.create(user=user, consider_skill_level=False)

        scorer = SettingsAwareScorer(user)
        # Should return neutral score even for perfect match when disabled
        assert scorer.calculate_skill_match_score('beginner') == 0.5

    def test_skill_match_score_neutral_when_no_user_skill(self, user):
        """Returns 0.5 when user has no skill level set."""
        PersonalizationSettings.objects.create(user=user, consider_skill_level=True)

        scorer = SettingsAwareScorer(user)
        assert scorer.calculate_skill_match_score('beginner') == 0.5

    def test_skill_match_score_neutral_when_no_content_difficulty(self, user):
        """Returns 0.5 when content has no difficulty set."""
        from core.learning_paths.models import LearnerProfile

        LearnerProfile.objects.create(user=user, current_difficulty_level='beginner')
        PersonalizationSettings.objects.create(user=user, consider_skill_level=True)

        scorer = SettingsAwareScorer(user)
        assert scorer.calculate_skill_match_score(None) == 0.5
        assert scorer.calculate_skill_match_score('') == 0.5
