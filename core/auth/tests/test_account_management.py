"""
Tests for account management endpoints (deactivation and deletion).

These are critical security tests for user account lifecycle management.
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core.billing.models import SubscriptionTier, UserSubscription
from core.users.models import User


# Skip ratelimit by patching the is_ratelimited function
@pytest.fixture(autouse=True)
def bypass_ratelimit():
    """Bypass ratelimit for all tests."""
    with patch('django_ratelimit.decorators.is_ratelimited', return_value=False):
        yield


@pytest.fixture
def api_client():
    """Create an API client with CSRF enforcement disabled."""
    return APIClient(enforce_csrf_checks=False)


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )


@pytest.fixture
def user_with_subscription(user, db):
    """Create a user with an active subscription."""
    # Delete any existing subscription (may be created by signals)
    UserSubscription.objects.filter(user=user).delete()

    tier, _ = SubscriptionTier.objects.get_or_create(
        slug='pro-test',
        defaults={
            'name': 'Pro Test',
            'tier_type': 'community_pro',
            'price_monthly': '9.99',
            'price_annual': '99.99',
        },
    )
    UserSubscription.objects.create(
        user=user,
        tier=tier,
        stripe_customer_id='cus_test123',
        stripe_subscription_id='sub_test123',
        status='active',
    )
    return user


@pytest.mark.django_db
class TestDeactivateAccount:
    """Tests for the deactivate_account endpoint."""

    def test_deactivate_account_requires_authentication(self, api_client):
        """Unauthenticated users should not be able to deactivate accounts."""
        response = api_client.post('/api/v1/me/account/deactivate/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_deactivate_account_success(self, api_client, user):
        """Successfully deactivate an active account."""
        api_client.force_authenticate(user=user)

        response = api_client.post('/api/v1/me/account/deactivate/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'deactivated' in response.data['message'].lower()

        # Verify user is now inactive
        user.refresh_from_db()
        assert user.is_active is False

    def test_deactivate_already_inactive_account(self, api_client, user):
        """Cannot deactivate an already inactive account."""
        user.is_active = False
        user.save()
        api_client.force_authenticate(user=user)

        response = api_client.post('/api/v1/me/account/deactivate/')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already deactivated' in response.data['error'].lower()

    @patch('stripe.Subscription.modify')
    def test_deactivate_cancels_subscription_at_period_end(
        self, mock_stripe_modify, api_client, user_with_subscription
    ):
        """Deactivating account should cancel subscription at period end."""
        mock_stripe_modify.return_value = MagicMock()
        api_client.force_authenticate(user=user_with_subscription)

        response = api_client.post('/api/v1/me/account/deactivate/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['subscription_canceled'] is True

        # Verify Stripe was called to cancel at period end
        mock_stripe_modify.assert_called_once()
        call_args = mock_stripe_modify.call_args
        assert call_args[1]['cancel_at_period_end'] is True

    @patch('stripe.Subscription.modify')
    def test_deactivate_continues_if_stripe_fails(self, mock_stripe_modify, api_client, user_with_subscription):
        """Account deactivation should continue even if Stripe fails."""
        import stripe

        mock_stripe_modify.side_effect = stripe.error.StripeError('Test error')
        api_client.force_authenticate(user=user_with_subscription)

        response = api_client.post('/api/v1/me/account/deactivate/')

        # Should still succeed - deactivation continues even if Stripe fails
        assert response.status_code == status.HTTP_200_OK
        user_with_subscription.refresh_from_db()
        assert user_with_subscription.is_active is False

    def test_deactivate_preserves_user_data(self, api_client, user):
        """Deactivation should preserve all user data for potential reactivation."""
        from core.projects.models import Project

        # Create some user data
        Project.objects.create(
            user=user,
            title='Test Project',
            slug='test-project',
        )

        api_client.force_authenticate(user=user)
        response = api_client.post('/api/v1/me/account/deactivate/')

        assert response.status_code == status.HTTP_200_OK

        # Verify project still exists
        assert Project.objects.filter(user=user).count() == 1


@pytest.mark.django_db
class TestDeleteAccount:
    """Tests for the delete_account endpoint."""

    def test_delete_account_requires_authentication(self, api_client):
        """Unauthenticated users should not be able to delete accounts."""
        response = api_client.post('/api/v1/me/account/delete/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_account_requires_confirmation(self, api_client, user):
        """Delete requires exact confirmation text."""
        api_client.force_authenticate(user=user)

        # No confirmation
        response = api_client.post('/api/v1/me/account/delete/')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'confirmation' in response.data['error'].lower()

    def test_delete_account_wrong_confirmation(self, api_client, user):
        """Wrong confirmation text should fail."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'delete my account'},  # Wrong case
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'confirmation' in response.data['error'].lower()

    @patch('stripe.Subscription.delete')
    @patch('stripe.Customer.delete')
    def test_delete_account_success(self, mock_customer_delete, mock_sub_delete, api_client, user):
        """Successfully delete an account with correct confirmation."""
        api_client.force_authenticate(user=user)
        user_id = user.id

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True

        # Verify user is deleted
        assert not User.objects.filter(id=user_id).exists()

    @patch('stripe.Subscription.delete')
    @patch('stripe.Customer.delete')
    def test_delete_account_cancels_subscription_immediately(
        self, mock_customer_delete, mock_sub_delete, api_client, user_with_subscription
    ):
        """Deleting account should cancel subscription immediately."""
        api_client.force_authenticate(user=user_with_subscription)

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify Stripe subscription was canceled immediately
        mock_sub_delete.assert_called_once_with('sub_test123')

    @patch('stripe.Subscription.delete')
    @patch('stripe.Customer.delete')
    def test_delete_account_deletes_stripe_customer(
        self, mock_customer_delete, mock_sub_delete, api_client, user_with_subscription
    ):
        """Deleting account should delete Stripe customer."""
        api_client.force_authenticate(user=user_with_subscription)

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify Stripe customer was deleted
        mock_customer_delete.assert_called_once_with('cus_test123')

    def test_delete_account_blocked_with_past_due_payments(self, api_client, user_with_subscription):
        """Cannot delete account with past due payments."""
        # Set subscription to past_due
        subscription = UserSubscription.objects.get(user=user_with_subscription)
        subscription.status = 'past_due'
        subscription.save()

        api_client.force_authenticate(user=user_with_subscription)

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'billing' in response.data['error'].lower() or 'payment' in response.data['error'].lower()

    @patch('stripe.Subscription.delete')
    @patch('stripe.Customer.delete')
    def test_delete_account_cascades_projects(self, mock_customer_delete, mock_sub_delete, api_client, user):
        """Deleting account should cascade delete user's projects."""
        from core.projects.models import Project

        # Create a project
        project = Project.objects.create(
            user=user,
            title='Test Project',
            slug='test-project',
        )
        project_id = project.id

        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify project is deleted
        assert not Project.objects.filter(id=project_id).exists()

    @patch('stripe.Subscription.delete')
    @patch('stripe.Customer.delete')
    def test_delete_account_continues_if_stripe_fails(
        self, mock_customer_delete, mock_sub_delete, api_client, user_with_subscription
    ):
        """Account deletion should continue even if Stripe calls fail."""
        import stripe

        mock_sub_delete.side_effect = stripe.error.StripeError('Test error')
        mock_customer_delete.side_effect = stripe.error.StripeError('Test error')

        api_client.force_authenticate(user=user_with_subscription)
        user_id = user_with_subscription.id

        response = api_client.post(
            '/api/v1/me/account/delete/',
            {'confirm': 'DELETE MY ACCOUNT'},
            format='json',
        )

        # Should still succeed - user should be deleted
        assert response.status_code == status.HTTP_200_OK
        assert not User.objects.filter(id=user_id).exists()


@pytest.mark.django_db
class TestAccountManagementRateLimiting:
    """Tests for rate limiting on account management endpoints.

    Note: These tests use django-ratelimit which uses Django's cache.
    Rate limiting behavior may not work correctly with --reuse-db flag.
    """

    @pytest.mark.skip(reason='Rate limiting tests require cache clear between runs')
    def test_deactivate_rate_limited(self, api_client, user):
        """Deactivate endpoint should be rate limited."""
        api_client.force_authenticate(user=user)

        # Make multiple requests - the 4th should be rate limited (limit is 3/hour)
        for i in range(4):
            # Reactivate user for each attempt
            user.is_active = True
            user.save()

            response = api_client.post('/api/v1/me/account/deactivate/')

            if i < 3:
                # First 3 should succeed
                assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST]
            else:
                # 4th should be rate limited
                assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    @pytest.mark.skip(reason='Rate limiting tests require cache clear between runs')
    def test_delete_rate_limited(self, api_client, db):
        """Delete endpoint should be rate limited."""
        # Create multiple users since we're deleting them
        users = [
            User.objects.create_user(
                username=f'testuser{i}',
                email=f'test{i}@example.com',
                password='testpass123',
            )
            for i in range(3)
        ]

        # Make multiple requests - the 3rd should be rate limited (limit is 2/hour)
        for i, user in enumerate(users):
            api_client.force_authenticate(user=user)

            response = api_client.post(
                '/api/v1/me/account/delete/',
                {'confirm': 'DELETE MY ACCOUNT'},
                format='json',
            )

            if i < 2:
                # First 2 should succeed
                assert response.status_code == status.HTTP_200_OK
            else:
                # 3rd should be rate limited
                assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
