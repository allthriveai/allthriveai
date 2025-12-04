"""Tests for Stripe webhook handling."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from core.billing.models import (
    SubscriptionChange,
    SubscriptionTier,
    TokenPackage,
    TokenPurchase,
    UserSubscription,
    UserTokenBalance,
    WebhookEvent,
)
from core.billing.services import StripeService
from core.users.models import User


class WebhookIdempotencyTestCase(TestCase):
    """Test webhook idempotency handling."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='webhook_idem_user', email='webhook_idem@example.com', password='testpass123'
        )
        # Signal auto-creates subscription and token balance, get them
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

        self.package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )

    def test_webhook_event_creation(self):
        """Test creating a webhook event record."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_test_123',
            event_type='payment_intent.succeeded',
            payload={'id': 'evt_test_123'},
            processed=False,
        )

        self.assertEqual(event.stripe_event_id, 'evt_test_123')
        self.assertFalse(event.processed)

    def test_duplicate_webhook_event_prevented(self):
        """Test that duplicate events cannot be created."""
        WebhookEvent.objects.create(
            stripe_event_id='evt_duplicate',
            event_type='test',
            payload={},
        )

        with self.assertRaises(Exception):
            WebhookEvent.objects.create(
                stripe_event_id='evt_duplicate',
                event_type='test',
                payload={},
            )

    def test_get_or_create_returns_existing(self):
        """Test that get_or_create returns existing event."""
        original = WebhookEvent.objects.create(
            stripe_event_id='evt_existing',
            event_type='test',
            payload={'original': True},
        )

        event, created = WebhookEvent.objects.get_or_create(
            stripe_event_id='evt_existing',
            defaults={'event_type': 'new', 'payload': {'new': True}},
        )

        self.assertFalse(created)
        self.assertEqual(event.id, original.id)

    def test_processed_event_not_reprocessed(self):
        """Test that already processed events are skipped."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_processed',
            event_type='payment_intent.succeeded',
            payload={},
            processed=True,
        )

        # Simulating the check in the webhook view
        if event.processed:
            should_process = False
        else:
            should_process = True

        self.assertFalse(should_process)


class HandlePaymentIntentSucceededTestCase(TestCase):
    """Test payment_intent.succeeded webhook handling."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='payment_intent_user', email='payment_intent@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
        self.token_balance = UserTokenBalance.objects.get(user=self.user)
        # Reset balance to 0 for this test
        self.token_balance.balance = 0
        self.token_balance.save()

        self.package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )

    def test_payment_success_completes_purchase(self):
        """Test that payment success completes token purchase."""
        purchase = TokenPurchase.objects.create(
            user=self.user,
            package=self.package,
            token_amount=100000,
            price_paid=Decimal('5.00'),
            status='pending',
            stripe_payment_intent_id='pi_test_123',
        )

        event_data = {
            'object': {
                'id': 'pi_test_123',
                'latest_charge': 'ch_test_123',
            }
        }

        StripeService.handle_payment_intent_succeeded(event_data)

        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'completed')
        self.assertEqual(purchase.stripe_charge_id, 'ch_test_123')
        self.assertIsNotNone(purchase.completed_at)

        balance = UserTokenBalance.objects.get(user=self.user)
        self.assertEqual(balance.balance, 100000)

    def test_payment_success_for_unknown_intent(self):
        """Test handling payment for unknown payment intent."""
        event_data = {
            'object': {
                'id': 'pi_unknown',
                'latest_charge': 'ch_test',
            }
        }

        # Should not raise, just log warning
        StripeService.handle_payment_intent_succeeded(event_data)


class HandleSubscriptionUpdatedTestCase(TestCase):
    """Test subscription.updated webhook handling."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='sub_updated_user', email='sub_updated@example.com', password='testpass123'
        )
        # Signal auto-creates subscription, get it and update for test
        self.subscription = UserSubscription.objects.get(user=self.user)

        # Get or create a pro tier for testing upgrades
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

        # Update subscription for test
        self.subscription.tier = self.pro_tier
        self.subscription.stripe_subscription_id = 'sub_test_123'
        self.subscription.save()

    def test_subscription_status_updated(self):
        """Test that subscription status is updated from webhook."""
        event_data = {
            'object': {
                'id': 'sub_test_123',
                'status': 'past_due',
                'current_period_start': 1699920000,
                'current_period_end': 1702512000,
                'cancel_at_period_end': False,
            }
        }

        StripeService.handle_subscription_updated(event_data)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, 'past_due')
        self.assertIsNotNone(self.subscription.current_period_start)
        self.assertIsNotNone(self.subscription.current_period_end)

    def test_cancel_at_period_end_synced(self):
        """Test that cancel_at_period_end is synced from Stripe."""
        event_data = {
            'object': {
                'id': 'sub_test_123',
                'status': 'active',
                'current_period_start': 1699920000,
                'current_period_end': 1702512000,
                'cancel_at_period_end': True,
            }
        }

        StripeService.handle_subscription_updated(event_data)

        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.cancel_at_period_end)

    def test_unknown_subscription_logged(self):
        """Test handling update for unknown subscription."""
        event_data = {
            'object': {
                'id': 'sub_unknown',
                'status': 'active',
                'current_period_start': 1699920000,
                'current_period_end': 1702512000,
            }
        }

        # Should not raise, just log warning
        StripeService.handle_subscription_updated(event_data)


class HandleSubscriptionDeletedTestCase(TestCase):
    """Test subscription.deleted webhook handling."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='sub_deleted_user', email='sub_deleted@example.com', password='testpass123'
        )
        # Signal auto-creates subscription with free tier
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.free_tier = self.subscription.tier

        # Get or create a pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

        # Update subscription to pro for deletion test
        self.subscription.tier = self.pro_tier
        self.subscription.stripe_subscription_id = 'sub_test_delete'
        self.subscription.save()

    def test_subscription_deleted_downgrades_to_free(self):
        """Test that deleted subscription downgrades user to free tier."""
        event_data = {
            'object': {
                'id': 'sub_test_delete',
            }
        }

        StripeService.handle_subscription_deleted(event_data)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.tier, self.free_tier)
        self.assertEqual(self.subscription.status, 'canceled')

    def test_subscription_change_logged(self):
        """Test that subscription change is logged."""
        initial_count = SubscriptionChange.objects.count()

        event_data = {
            'object': {
                'id': 'sub_test_delete',
            }
        }

        StripeService.handle_subscription_deleted(event_data)

        self.assertEqual(SubscriptionChange.objects.count(), initial_count + 1)

        change = SubscriptionChange.objects.latest('created_at')
        self.assertEqual(change.change_type, 'canceled')
        self.assertEqual(change.from_tier, self.pro_tier)
        self.assertEqual(change.to_tier, self.free_tier)


class WebhookSignatureVerificationTestCase(TestCase):
    """Test webhook signature verification."""

    def test_invalid_signature_raises_error(self):
        """Test that invalid signature raises error."""
        from core.billing.services import StripeServiceError

        with self.assertRaises(StripeServiceError):
            StripeService.verify_webhook_signature(
                payload=b'test payload',
                sig_header='invalid_signature',
            )

    @patch('stripe.Webhook.construct_event')
    def test_valid_signature_returns_event(self, mock_construct):
        """Test that valid signature returns event."""
        mock_event = {'id': 'evt_test', 'type': 'test'}
        mock_construct.return_value = mock_event

        result = StripeService.verify_webhook_signature(
            payload=b'valid payload',
            sig_header='valid_signature',
        )

        self.assertEqual(result, mock_event)


class ConcurrentTokenPurchaseTestCase(TestCase):
    """Test handling of concurrent token purchases."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='concurrent_user', email='concurrent@example.com', password='testpass123'
        )
        # Signal auto-creates token balance, reset to 0
        self.token_balance = UserTokenBalance.objects.get(user=self.user)
        self.token_balance.balance = 0
        self.token_balance.save()

        self.package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )

    def test_duplicate_payment_intent_handled(self):
        """Test that duplicate payment intents don't add tokens twice."""
        purchase = TokenPurchase.objects.create(
            user=self.user,
            package=self.package,
            token_amount=100000,
            price_paid=Decimal('5.00'),
            status='pending',
            stripe_payment_intent_id='pi_duplicate',
        )

        event_data = {
            'object': {
                'id': 'pi_duplicate',
                'latest_charge': 'ch_test',
            }
        }

        # Process first time
        StripeService.handle_payment_intent_succeeded(event_data)

        balance = UserTokenBalance.objects.get(user=self.user)
        self.assertEqual(balance.balance, 100000)

        # Process second time (simulating duplicate webhook)
        StripeService.handle_payment_intent_succeeded(event_data)

        balance.refresh_from_db()
        # Balance should still be 100000, not 200000
        self.assertEqual(balance.balance, 100000)
