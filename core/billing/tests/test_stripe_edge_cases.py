"""
Tests for Stripe billing edge cases and error handling.

Covers webhook signature verification, failed payments, subscription
changes, and other edge cases in the billing system.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from django.test import RequestFactory
from rest_framework import status
from rest_framework.test import APIClient

from core.billing.models import SubscriptionTier, TokenPackage, UserSubscription, WebhookEvent
from core.billing.views import stripe_webhook
from core.users.models import User


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def request_factory():
    """Create a request factory."""
    return RequestFactory()


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )


@pytest.fixture
def subscription_tier(db):
    """Create a subscription tier."""
    tier, _ = SubscriptionTier.objects.get_or_create(
        slug='pro-subscription',
        defaults={
            'name': 'Pro Subscription',
            'tier_type': 'community_pro',
            'price_monthly': '9.99',
            'price_annual': '99.99',
            'stripe_price_id_monthly': 'price_monthly_test',
            'stripe_price_id_annual': 'price_annual_test',
        },
    )
    return tier


@pytest.fixture
def pro_tier(db):
    """Create Pro tier."""
    tier, _ = SubscriptionTier.objects.get_or_create(
        slug='pro-tier',
        defaults={
            'name': 'Pro Tier',
            'tier_type': 'community_pro',
            'price_monthly': '9.99',
            'price_annual': '99.99',
            'stripe_price_id_monthly': 'price_pro_monthly',
            'stripe_price_id_annual': 'price_pro_annual',
        },
    )
    return tier


@pytest.fixture
def enterprise_tier(db):
    """Create Enterprise tier."""
    tier, _ = SubscriptionTier.objects.get_or_create(
        slug='enterprise-tier',
        defaults={
            'name': 'Enterprise',
            'tier_type': 'pro_learn',
            'price_monthly': '49.99',
            'price_annual': '499.99',
            'stripe_price_id_monthly': 'price_enterprise_monthly',
            'stripe_price_id_annual': 'price_enterprise_annual',
        },
    )
    return tier


@pytest.fixture
def user_subscription(user, subscription_tier, db):
    """Create a user subscription."""
    # Delete any existing subscription (may be created by signals)
    UserSubscription.objects.filter(user=user).delete()
    return UserSubscription.objects.create(
        user=user,
        tier=subscription_tier,
        stripe_customer_id='cus_test123',
        stripe_subscription_id='sub_test123',
        status='active',
    )


@pytest.fixture
def token_package(db):
    """Create a token package."""
    pkg, _ = TokenPackage.objects.get_or_create(
        slug='starter-test',
        defaults={
            'name': 'Starter Pack Test',
            'package_type': 'starter',
            'token_amount': 100000,
            'price': '9.99',
            'display_order': 1,
        },
    )
    return pkg


@pytest.mark.django_db
class TestWebhookSignatureVerification:
    """Tests for Stripe webhook signature verification."""

    def test_webhook_missing_signature_header(self, request_factory):
        """Webhook without signature header should fail."""
        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        # Don't set stripe-signature header

        response = stripe_webhook(request)

        assert response.status_code == 400
        assert b'Missing signature' in response.content

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    def test_webhook_invalid_signature(self, mock_verify, request_factory):
        """Webhook with invalid signature should fail."""
        from core.billing.services import StripeServiceError

        mock_verify.side_effect = StripeServiceError('Invalid signature')

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'invalid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 400
        assert b'Invalid signature' in response.content

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    def test_webhook_valid_signature_processed(self, mock_verify, request_factory):
        """Webhook with valid signature should be processed."""
        mock_verify.return_value = {
            'id': 'evt_test123',
            'type': 'customer.subscription.created',
            'data': {'object': {'id': 'sub_test'}},
        }

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        with patch('core.billing.services.StripeService.handle_subscription_updated'):
            response = stripe_webhook(request)

        assert response.status_code == 200


@pytest.mark.django_db
class TestWebhookIdempotency:
    """Tests for webhook idempotency handling."""

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    @patch('core.billing.services.StripeService.handle_subscription_updated')
    def test_duplicate_webhook_not_reprocessed(self, mock_handler, mock_verify, request_factory):
        """Duplicate webhook events should not be reprocessed."""
        event_id = 'evt_duplicate123'
        mock_verify.return_value = {
            'id': event_id,
            'type': 'customer.subscription.updated',
            'data': {'object': {'id': 'sub_test'}},
        }

        # Create a completed webhook event
        WebhookEvent.objects.create(
            stripe_event_id=event_id,
            event_type='customer.subscription.updated',
            payload={'id': event_id},
            processed=True,
        )

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 200
        assert b'already processed' in response.content
        # Handler should NOT be called for duplicate
        mock_handler.assert_not_called()

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    @patch('core.billing.services.StripeService.handle_subscription_updated')
    def test_incomplete_webhook_reprocessed(self, mock_handler, mock_verify, request_factory):
        """Incomplete webhook events should be reprocessed."""
        event_id = 'evt_incomplete123'
        mock_verify.return_value = {
            'id': event_id,
            'type': 'customer.subscription.updated',
            'data': {'object': {'id': 'sub_test'}},
        }

        # Create an incomplete webhook event (processed=False)
        WebhookEvent.objects.create(
            stripe_event_id=event_id,
            event_type='customer.subscription.updated',
            payload={'id': event_id},
            processed=False,
        )

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 200
        # Handler SHOULD be called for incomplete event
        mock_handler.assert_called_once()

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    def test_webhook_creates_event_record(self, mock_verify, request_factory):
        """New webhook should create an event record."""
        event_id = 'evt_new123'
        mock_verify.return_value = {
            'id': event_id,
            'type': 'invoice.payment_succeeded',
            'data': {'object': {'id': 'in_test'}},
        }

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 200
        assert WebhookEvent.objects.filter(stripe_event_id=event_id).exists()


@pytest.mark.django_db
class TestSubscriptionUpgradeDowngrade:
    """Tests for subscription tier changes."""

    @patch('stripe.Subscription.retrieve')
    @patch('stripe.Subscription.modify')
    def test_upgrade_subscription(
        self, mock_stripe_modify, mock_stripe_retrieve, api_client, user, user_subscription, enterprise_tier
    ):
        """User can upgrade their subscription."""
        mock_stripe_retrieve.return_value = MagicMock(
            id='sub_test123',
            items=MagicMock(data=[MagicMock(id='si_test123', price=MagicMock(id='price_monthly_test'))]),
        )
        mock_stripe_modify.return_value = MagicMock(id='sub_test123')
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/update/',
            {'tier_slug': enterprise_tier.slug},  # Use actual fixture slug
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        # Should indicate upgrade
        if 'change_type' in response.data:
            assert response.data['change_type'] == 'upgraded'

    @patch('stripe.Subscription.retrieve')
    @patch('stripe.Subscription.modify')
    def test_downgrade_subscription(
        self, mock_stripe_modify, mock_stripe_retrieve, api_client, user, enterprise_tier, pro_tier
    ):
        """User can downgrade their subscription."""
        # Delete any existing subscription before creating
        UserSubscription.objects.filter(user=user).delete()
        # Create subscription at enterprise level
        UserSubscription.objects.create(
            user=user,
            tier=enterprise_tier,
            stripe_customer_id='cus_test123',
            stripe_subscription_id='sub_test123',
            status='active',
        )
        mock_stripe_retrieve.return_value = MagicMock(
            id='sub_test123',
            items=MagicMock(data=[MagicMock(id='si_test123', price=MagicMock(id='price_enterprise_monthly'))]),
        )
        mock_stripe_modify.return_value = MagicMock(id='sub_test123')
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/update/',
            {'tier_slug': pro_tier.slug},  # Use actual fixture slug
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

    def test_update_to_nonexistent_tier(self, api_client, user, user_subscription):
        """Updating to non-existent tier should fail."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/update/',
            {'tier_slug': 'nonexistent-tier-xyz'},
            format='json',
        )

        # Returns 400 for validation error, not 404
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]


@pytest.mark.django_db
class TestFailedPaymentHandling:
    """Tests for handling failed payments."""

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    def test_payment_failed_webhook_logged(self, mock_verify, request_factory):
        """Payment failed webhook should be logged."""
        mock_verify.return_value = {
            'id': 'evt_payment_failed',
            'type': 'payment_intent.payment_failed',
            'data': {'object': {'id': 'pi_test123'}},
        }

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 200
        # Event should be recorded
        assert WebhookEvent.objects.filter(
            stripe_event_id='evt_payment_failed',
            event_type='payment_intent.payment_failed',
        ).exists()

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    def test_invoice_payment_failed_webhook(self, mock_verify, request_factory):
        """Invoice payment failed webhook should be handled."""
        mock_verify.return_value = {
            'id': 'evt_invoice_failed',
            'type': 'invoice.payment_failed',
            'data': {'object': {'id': 'in_test123'}},
        }

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 200


@pytest.mark.django_db
class TestSubscriptionCancellation:
    """Tests for subscription cancellation."""

    @patch('stripe.Subscription.modify')
    def test_cancel_at_period_end(self, mock_stripe_modify, api_client, user, user_subscription):
        """Cancel at period end should schedule cancellation."""
        mock_stripe_modify.return_value = MagicMock(
            id='sub_test123',
            cancel_at_period_end=True,
            current_period_end=1735689600,
        )
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/cancel/',
            {'immediate': False},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data.get('cancel_at_period_end') is True

    @patch('stripe.Subscription.delete')
    def test_cancel_immediately(self, mock_stripe_delete, api_client, user, user_subscription):
        """Immediate cancellation should cancel now."""
        mock_stripe_delete.return_value = MagicMock(
            id='sub_test123',
            status='canceled',
        )
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/cancel/',
            {'immediate': True},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

    def test_cancel_requires_authentication(self, api_client):
        """Cancellation requires authentication."""
        response = api_client.post(
            '/api/v1/billing/subscriptions/cancel/',
            {'immediate': False},
            format='json',
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTokenPurchaseErrors:
    """Tests for token purchase error handling."""

    def test_purchase_nonexistent_package(self, api_client, user):
        """Purchasing non-existent package should fail."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/tokens/purchase/',
            {'package_slug': 'nonexistent-package'},
            format='json',
        )

        # Returns 404 for package not found
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST]

    @patch('stripe.PaymentIntent.create')
    def test_stripe_error_on_purchase(self, mock_create, api_client, user, token_package):
        """Stripe error during purchase should be handled."""
        import stripe

        mock_create.side_effect = stripe.error.CardError(
            message='Card declined',
            param='card',
            code='card_declined',
        )
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/tokens/purchase/',
            {'package_slug': 'starter'},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestWebhookProcessingErrors:
    """Tests for webhook processing error handling."""

    @patch('core.billing.services.StripeService.verify_webhook_signature')
    @patch('core.billing.services.StripeService.handle_subscription_updated')
    def test_processing_error_marks_webhook_failed(self, mock_handler, mock_verify, request_factory):
        """Processing error should mark webhook as failed."""
        event_id = 'evt_processing_error'
        mock_verify.return_value = {
            'id': event_id,
            'type': 'customer.subscription.updated',
            'data': {'object': {'id': 'sub_test'}},
        }
        mock_handler.side_effect = Exception('Processing failed')

        request = request_factory.post(
            '/api/v1/billing/webhook/',
            data=json.dumps({'type': 'test.event'}),
            content_type='application/json',
        )
        request.headers = {'stripe-signature': 'valid_sig'}

        response = stripe_webhook(request)

        assert response.status_code == 500

        # Webhook should be marked as failed
        webhook = WebhookEvent.objects.get(stripe_event_id=event_id)
        assert webhook.processed is False
        assert webhook.processing_error is not None


@pytest.mark.django_db
class TestSubscriptionCreation:
    """Tests for subscription creation."""

    @patch('stripe.Customer.create')
    @patch('stripe.Subscription.create')
    def test_create_subscription_success(self, mock_sub_create, mock_cust_create, api_client, user, subscription_tier):
        """Successfully create a new subscription."""
        # Delete any existing subscription for this user
        UserSubscription.objects.filter(user=user).delete()

        mock_cust_create.return_value = MagicMock(id='cus_new123')
        mock_sub_create.return_value = MagicMock(
            id='sub_new123',
            status='active',
            latest_invoice=MagicMock(payment_intent=MagicMock(client_secret='pi_secret_123')),
        )
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': subscription_tier.slug,  # Use actual fixture slug
                'billing_interval': 'monthly',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert 'subscription_id' in response.data or 'client_secret' in response.data

    def test_create_subscription_invalid_tier(self, api_client, user):
        """Creating subscription with invalid tier should fail."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': 'invalid-tier',
                'billing_interval': 'monthly',
            },
            format='json',
        )

        # Can return 404 or 400 depending on serializer validation
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST]

    def test_create_subscription_missing_interval(self, api_client, user, subscription_tier):
        """Creating subscription without billing interval should fail."""
        api_client.force_authenticate(user=user)

        response = api_client.post(
            '/api/v1/billing/subscriptions/create/',
            {'tier_slug': subscription_tier.slug},  # Use actual fixture slug
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBillingStatusEndpoint:
    """Tests for billing status endpoint."""

    def test_get_status_requires_auth(self, api_client):
        """Billing status requires authentication."""
        response = api_client.get('/api/v1/billing/status/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_status_success(self, api_client, user, user_subscription):
        """Authenticated user can get billing status."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/billing/status/')

        assert response.status_code == status.HTTP_200_OK
        # Should include tier info
        assert 'tier' in response.data or 'subscription' in response.data

    def test_get_status_user_without_subscription(self, api_client, user):
        """User without subscription gets default/free status."""
        api_client.force_authenticate(user=user)

        response = api_client.get('/api/v1/billing/status/')

        assert response.status_code == status.HTTP_200_OK
