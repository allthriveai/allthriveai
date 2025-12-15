"""
Unit tests for personalization settings API endpoints.

Tests the CRUD operations for user personalization preferences including:
- Feature interests (excited_features, desired_integrations)
- Recommendation controls (discovery_balance, learn_from_views, etc.)
- Privacy settings (allow_time_tracking, allow_scroll_tracking)
- Data export and deletion (GDPR compliance)
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.users.models import PersonalizationSettings

User = get_user_model()


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


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
    """Create test user with existing personalization settings."""
    PersonalizationSettings.objects.create(
        user=user,
        excited_features=['portfolio', 'battles'],
        desired_integrations=['github', 'linkedin'],
        discovery_balance=50,
    )
    return user


# =============================================================================
# Authentication Tests
# =============================================================================


@pytest.mark.django_db
class TestPersonalizationAuth:
    """Test authentication requirements."""

    def test_get_settings_requires_auth(self, api_client):
        """Unauthenticated users cannot access settings."""
        response = api_client.get('/api/v1/me/personalization/settings/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_patch_settings_requires_auth(self, api_client):
        """Unauthenticated users cannot update settings."""
        response = api_client.patch('/api/v1/me/personalization/settings/', {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reset_settings_requires_auth(self, api_client):
        """Unauthenticated users cannot reset settings."""
        response = api_client.post('/api/v1/me/personalization/settings/reset/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# GET Settings Tests
# =============================================================================


@pytest.mark.django_db
class TestGetPersonalizationSettings:
    """Test GET /api/v1/me/personalization/settings/"""

    def test_creates_default_settings_if_none_exist(self, api_client, user):
        """Settings are created with defaults for new users."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/personalization/settings/')

        assert response.status_code == status.HTTP_200_OK
        assert PersonalizationSettings.objects.filter(user=user).exists()

    def test_returns_existing_settings(self, api_client, user_with_settings):
        """Returns existing settings without modification."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.get('/api/v1/me/personalization/settings/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['excited_features'] == ['portfolio', 'battles']
        assert response.data['desired_integrations'] == ['github', 'linkedin']

    def test_returns_all_expected_fields(self, api_client, user):
        """Response includes all personalization fields."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/personalization/settings/')

        expected_fields = [
            'use_topic_selections',
            'learn_from_views',
            'learn_from_likes',
            'consider_skill_level',
            'factor_content_difficulty',
            'use_social_signals',
            'discovery_balance',
            'allow_time_tracking',
            'allow_scroll_tracking',
            'excited_features',
            'desired_integrations',
            'desired_integrations_other',
            'created_at',
            'updated_at',
        ]
        for field in expected_fields:
            assert field in response.data


# =============================================================================
# PATCH Settings Tests - Feature Interests
# =============================================================================


@pytest.mark.django_db
class TestUpdateFeatureInterests:
    """Test updating excited_features and desired_integrations."""

    def test_update_excited_features(self, api_client, user):
        """Can update excited_features array."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'excited_features': ['portfolio', 'battles', 'community']},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['excited_features'] == ['portfolio', 'battles', 'community']

    def test_update_desired_integrations(self, api_client, user):
        """Can update desired_integrations array."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'desired_integrations': ['github', 'figma', 'url']},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['desired_integrations'] == ['github', 'figma', 'url']

    def test_update_integrations_other(self, api_client, user):
        """Can update desired_integrations_other text field."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'desired_integrations_other': 'Behance, Dribbble'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['desired_integrations_other'] == 'Behance, Dribbble'

    def test_clear_excited_features(self, api_client, user_with_settings):
        """Can clear excited_features to empty array."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'excited_features': []},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['excited_features'] == []

    def test_update_multiple_fields_at_once(self, api_client, user):
        """Can update multiple fields in single request."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {
                'excited_features': ['portfolio'],
                'desired_integrations': ['github'],
                'desired_integrations_other': 'Notion',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['excited_features'] == ['portfolio']
        assert response.data['desired_integrations'] == ['github']
        assert response.data['desired_integrations_other'] == 'Notion'


# =============================================================================
# PATCH Settings Tests - Recommendation Controls
# =============================================================================


@pytest.mark.django_db
class TestUpdateRecommendationControls:
    """Test updating recommendation signal settings."""

    def test_update_discovery_balance(self, api_client, user):
        """Can update discovery_balance slider value."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'discovery_balance': 75},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['discovery_balance'] == 75

    def test_discovery_balance_validation_min(self, api_client, user):
        """Discovery balance cannot be negative."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'discovery_balance': -10},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_discovery_balance_validation_max(self, api_client, user):
        """Discovery balance cannot exceed 100."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'discovery_balance': 150},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_toggle_learn_from_views(self, api_client, user):
        """Can toggle learn_from_views boolean."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'learn_from_views': False},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['learn_from_views'] is False

    def test_toggle_all_recommendation_signals(self, api_client, user):
        """Can toggle all recommendation signal booleans."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {
                'use_topic_selections': False,
                'learn_from_views': False,
                'learn_from_likes': False,
                'consider_skill_level': False,
                'use_social_signals': False,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['use_topic_selections'] is False
        assert response.data['learn_from_views'] is False


# =============================================================================
# PATCH Settings Tests - Privacy Controls
# =============================================================================


@pytest.mark.django_db
class TestUpdatePrivacyControls:
    """Test updating privacy/tracking settings."""

    def test_disable_time_tracking(self, api_client, user):
        """Can disable time tracking."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'allow_time_tracking': False},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['allow_time_tracking'] is False

    def test_disable_scroll_tracking(self, api_client, user):
        """Can disable scroll tracking."""
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            '/api/v1/me/personalization/settings/',
            {'allow_scroll_tracking': False},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['allow_scroll_tracking'] is False


# =============================================================================
# Reset Settings Tests
# =============================================================================


@pytest.mark.django_db
class TestResetPersonalizationSettings:
    """Test POST /api/v1/me/personalization/settings/reset/"""

    def test_reset_returns_defaults(self, api_client, user_with_settings):
        """Reset returns settings with default values."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.post('/api/v1/me/personalization/settings/reset/')

        assert response.status_code == status.HTTP_200_OK
        assert 'settings' in response.data
        # Check defaults are restored
        settings = response.data['settings']
        assert settings['discovery_balance'] == 50  # Default
        assert settings['excited_features'] == []  # Cleared

    def test_reset_clears_feature_interests(self, api_client, user_with_settings):
        """Reset clears feature interest selections."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.post('/api/v1/me/personalization/settings/reset/')

        settings = response.data['settings']
        assert settings['excited_features'] == []
        assert settings['desired_integrations'] == []
        assert settings['desired_integrations_other'] == ''

    def test_reset_returns_success_message(self, api_client, user):
        """Reset returns confirmation message."""
        api_client.force_authenticate(user=user)

        response = api_client.post('/api/v1/me/personalization/settings/reset/')

        assert 'message' in response.data


# =============================================================================
# Export Data Tests (GDPR)
# =============================================================================


@pytest.mark.django_db
class TestExportPersonalizationData:
    """Test GET /api/v1/me/personalization/export/"""

    def test_export_includes_settings(self, api_client, user_with_settings):
        """Export includes personalization settings."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.get('/api/v1/me/personalization/export/')

        assert response.status_code == status.HTTP_200_OK
        assert 'personalization_settings' in response.data
        assert response.data['personalization_settings']['excited_features'] == ['portfolio', 'battles']

    def test_export_includes_user_info(self, api_client, user):
        """Export includes basic user info."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/personalization/export/')

        assert 'user' in response.data
        assert response.data['user']['username'] == user.username

    def test_export_includes_timestamp(self, api_client, user):
        """Export includes export timestamp."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/me/personalization/export/')

        assert 'exported_at' in response.data


# =============================================================================
# Delete Data Tests (GDPR)
# =============================================================================


@pytest.mark.django_db
class TestDeletePersonalizationData:
    """Test DELETE /api/v1/me/personalization/delete/"""

    def test_delete_removes_settings(self, api_client, user_with_settings):
        """Delete removes personalization settings."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.delete('/api/v1/me/personalization/delete/')

        assert response.status_code == status.HTTP_200_OK
        assert not PersonalizationSettings.objects.filter(user=user_with_settings).exists()

    def test_delete_returns_counts(self, api_client, user_with_settings):
        """Delete returns count of deleted items."""
        api_client.force_authenticate(user=user_with_settings)

        response = api_client.delete('/api/v1/me/personalization/delete/')

        assert 'deleted' in response.data
        assert 'settings' in response.data['deleted']

    def test_settings_recreated_with_defaults_after_delete(self, api_client, user_with_settings):
        """After delete, GET creates fresh default settings."""
        api_client.force_authenticate(user=user_with_settings)

        # Delete
        api_client.delete('/api/v1/me/personalization/delete/')

        # GET should create new defaults
        response = api_client.get('/api/v1/me/personalization/settings/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['excited_features'] == []  # Fresh default
