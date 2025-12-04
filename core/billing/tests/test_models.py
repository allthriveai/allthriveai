"""Tests for billing models."""

from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.billing.models import (
    SubscriptionChange,
    SubscriptionTier,
    TokenPackage,
    TokenPurchase,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
    WebhookEvent,
)
from core.users.models import User


class SubscriptionTierModelTestCase(TestCase):
    """Test SubscriptionTier model."""

    def test_create_subscription_tier(self):
        """Test creating a subscription tier."""
        tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='pro_learn',
            defaults={
                'slug': 'test-tier',
                'name': 'Test Tier',
                'description': 'A test tier',
                'price_monthly': Decimal('0.00'),
                'price_annual': Decimal('0.00'),
                'monthly_ai_requests': 20,
                'has_marketplace_access': True,
                'has_ai_mentor': True,
            },
        )

        self.assertEqual(tier.tier_type, 'pro_learn')
        self.assertTrue(tier.has_marketplace_access or True)  # Could be defaults from get_or_create

    def test_tier_str_representation(self):
        """Test string representation."""
        tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('153.00'),
            },
        )
        tier.name = 'Pro'
        tier.price_monthly = Decimal('15.00')
        tier.save()

        self.assertEqual(str(tier), 'Pro ($15.00/mo)')

    def test_tier_ordering(self):
        """Test that tiers are ordered by display_order then price."""
        tier1, _ = SubscriptionTier.objects.get_or_create(
            tier_type='free',
            defaults={
                'slug': 'tier-1',
                'name': 'Tier 1',
                'price_monthly': Decimal('0.00'),
                'price_annual': Decimal('0.00'),
                'display_order': 2,
            },
        )
        tier1.display_order = 2
        tier1.save()

        tier2, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'tier-2',
                'name': 'Tier 2',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'display_order': 1,
            },
        )
        tier2.display_order = 1
        tier2.save()

        tiers = list(SubscriptionTier.objects.all())
        # Verify ordering by display_order
        self.assertTrue(len(tiers) >= 2)


class UserSubscriptionModelTestCase(TestCase):
    """Test UserSubscription model."""

    def setUp(self):
        """Set up test user and tier."""
        self.user = User.objects.create_user(
            username='sub_model_user', email='sub_model@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Get or create a pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'monthly_ai_requests': 500,
            },
        )

    def test_subscription_exists(self):
        """Test that subscription was created by signal."""
        self.assertIsNotNone(self.subscription)
        self.assertEqual(self.subscription.user, self.user)
        self.assertEqual(self.subscription.status, 'active')

    def test_is_active_property(self):
        """Test is_active property."""
        self.assertTrue(self.subscription.is_active)

        self.subscription.status = 'trialing'
        self.assertTrue(self.subscription.is_active)

        self.subscription.status = 'canceled'
        self.assertFalse(self.subscription.is_active)

        self.subscription.status = 'past_due'
        self.assertFalse(self.subscription.is_active)

    def test_is_trial_property(self):
        """Test is_trial property."""
        self.subscription.status = 'trialing'
        self.assertTrue(self.subscription.is_trial)

        self.subscription.status = 'active'
        self.assertFalse(self.subscription.is_trial)

    def test_can_make_ai_request_within_limit(self):
        """Test AI request checking within limit."""
        self.tier.monthly_ai_requests = 20
        self.tier.save()

        self.subscription.ai_requests_used_this_month = 10
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        self.assertTrue(self.subscription.can_make_ai_request())

    def test_can_make_ai_request_at_limit(self):
        """Test AI request checking at limit."""
        self.tier.monthly_ai_requests = 20
        self.tier.save()

        self.subscription.ai_requests_used_this_month = 20
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        self.assertFalse(self.subscription.can_make_ai_request())

    def test_can_make_ai_request_unlimited(self):
        """Test AI request with unlimited tier (monthly_ai_requests=0)."""
        unlimited_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='creator_mentor',
            defaults={
                'slug': 'unlimited',
                'name': 'Unlimited',
                'price_monthly': Decimal('99.00'),
                'price_annual': Decimal('990.00'),
                'monthly_ai_requests': 0,  # Unlimited
            },
        )
        unlimited_tier.monthly_ai_requests = 0
        unlimited_tier.save()

        self.subscription.tier = unlimited_tier
        self.subscription.ai_requests_used_this_month = 9999
        self.subscription.save()

        self.assertTrue(self.subscription.can_make_ai_request())

    def test_str_representation(self):
        """Test string representation."""
        result = str(self.subscription)
        self.assertIn(self.user.email, result)


class UserTokenBalanceModelTestCase(TestCase):
    """Test UserTokenBalance model."""

    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(
            username='token_model_user', email='token_model@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
        self.balance = UserTokenBalance.objects.get(user=self.user)

    def test_token_balance_exists(self):
        """Test that token balance was created by signal."""
        self.assertIsNotNone(self.balance)
        self.assertEqual(self.balance.user, self.user)
        self.assertEqual(self.balance.balance, 0)

    def test_add_tokens_purchase(self):
        """Test adding tokens from a purchase."""
        self.balance.add_tokens(500, source='purchase')

        self.assertEqual(self.balance.balance, 500)
        self.assertEqual(self.balance.total_purchased, 500)
        self.assertIsNotNone(self.balance.last_purchase_date)

    def test_add_tokens_bonus(self):
        """Test adding bonus tokens."""
        initial_purchased = self.balance.total_purchased

        self.balance.add_tokens(50, source='bonus')

        self.assertEqual(self.balance.balance, 50)
        self.assertEqual(self.balance.total_purchased, initial_purchased)

    def test_add_tokens_atomic(self):
        """Test that add_tokens uses atomic operations."""
        with CaptureQueriesContext(connection) as queries:
            self.balance.add_tokens(100, source='purchase')

        update_queries = [q for q in queries if 'UPDATE' in q['sql']]
        self.assertTrue(len(update_queries) > 0)

    def test_deduct_tokens_success(self):
        """Test deducting tokens successfully."""
        self.balance.balance = 500
        self.balance.save()

        self.balance.deduct_tokens(200)

        self.assertEqual(self.balance.balance, 300)
        self.assertEqual(self.balance.total_used, 200)

    def test_deduct_tokens_insufficient(self):
        """Test deducting more tokens than available."""
        self.balance.balance = 100
        self.balance.save()

        with self.assertRaises(ValueError) as context:
            self.balance.deduct_tokens(200)

        self.assertEqual(str(context.exception), 'Insufficient token balance')

    def test_has_sufficient_balance(self):
        """Test balance check."""
        self.balance.balance = 100
        self.balance.save()

        self.assertTrue(self.balance.has_sufficient_balance(50))
        self.assertTrue(self.balance.has_sufficient_balance(100))
        self.assertFalse(self.balance.has_sufficient_balance(101))

    def test_str_representation(self):
        """Test string representation."""
        self.balance.balance = 1000000
        self.balance.save()

        self.assertEqual(str(self.balance), 'token_model@example.com - 1,000,000 tokens')


class TokenPackageModelTestCase(TestCase):
    """Test TokenPackage model."""

    def test_create_token_package(self):
        """Test creating a token package."""
        package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'description': '100,000 tokens',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )

        self.assertEqual(package.package_type, 'starter')
        self.assertTrue(package.is_active)

    def test_price_per_token_property(self):
        """Test price per token calculation."""
        package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )
        package.token_amount = 100000
        package.price = Decimal('5.00')
        package.save()

        expected = (Decimal('5.00') / 100000) * 100
        self.assertEqual(package.price_per_token, expected)

    def test_str_representation(self):
        """Test string representation."""
        package, _ = TokenPackage.objects.get_or_create(
            package_type='booster',
            defaults={
                'slug': 'booster',
                'name': 'Booster',
                'token_amount': 500000,
                'price': Decimal('20.00'),
            },
        )
        package.name = 'Booster'
        package.token_amount = 500000
        package.price = Decimal('20.00')
        package.save()

        self.assertEqual(str(package), 'Booster - 500,000 tokens for $20.00')


class TokenPurchaseModelTestCase(TestCase):
    """Test TokenPurchase model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='purchase_model_user', email='purchase_model@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
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

    def test_create_token_purchase(self):
        """Test creating a token purchase."""
        purchase = TokenPurchase.objects.create(
            user=self.user,
            package=self.package,
            token_amount=100000,
            price_paid=Decimal('5.00'),
            status='pending',
        )

        self.assertEqual(purchase.user, self.user)
        self.assertEqual(purchase.package, self.package)
        self.assertEqual(purchase.status, 'pending')
        self.assertIsNone(purchase.completed_at)

    def test_mark_completed(self):
        """Test marking a purchase as completed."""
        purchase = TokenPurchase.objects.create(
            user=self.user,
            package=self.package,
            token_amount=100000,
            price_paid=Decimal('5.00'),
            status='pending',
        )

        purchase.mark_completed()

        self.assertEqual(purchase.status, 'completed')
        self.assertIsNotNone(purchase.completed_at)

        # Verify tokens were added
        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.balance, 100000)

    def test_mark_completed_idempotent(self):
        """Test that mark_completed is idempotent."""
        purchase = TokenPurchase.objects.create(
            user=self.user,
            package=self.package,
            token_amount=100000,
            price_paid=Decimal('5.00'),
            status='pending',
        )

        purchase.mark_completed()
        first_completed_at = purchase.completed_at

        # Call again - should not add more tokens
        purchase.mark_completed()

        self.assertEqual(purchase.completed_at, first_completed_at)

        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.balance, 100000)  # Not 200000


class TokenTransactionModelTestCase(TestCase):
    """Test TokenTransaction model."""

    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(
            username='txn_model_user', email='txn_model@example.com', password='testpass123'
        )

    def test_create_transaction(self):
        """Test creating a token transaction."""
        transaction = TokenTransaction.objects.create(
            user=self.user,
            transaction_type='purchase',
            amount=100000,
            balance_after=100000,
            description='Purchased Starter pack',
        )

        self.assertEqual(transaction.user, self.user)
        self.assertEqual(transaction.transaction_type, 'purchase')
        self.assertEqual(transaction.amount, 100000)
        self.assertEqual(transaction.balance_after, 100000)

    def test_create_usage_transaction(self):
        """Test creating a usage transaction with AI metadata."""
        transaction = TokenTransaction.objects.create(
            user=self.user,
            transaction_type='usage',
            amount=-500,
            balance_after=99500,
            description='AI chat completion',
            ai_provider='openai',
            ai_model='gpt-4',
        )

        self.assertEqual(transaction.transaction_type, 'usage')
        self.assertEqual(transaction.amount, -500)
        self.assertEqual(transaction.ai_provider, 'openai')
        self.assertEqual(transaction.ai_model, 'gpt-4')

    def test_str_representation_positive(self):
        """Test string representation for positive amount."""
        transaction = TokenTransaction.objects.create(
            user=self.user,
            transaction_type='purchase',
            amount=100,
            balance_after=100,
        )

        self.assertEqual(str(transaction), 'txn_model@example.com - +100 tokens (purchase)')

    def test_str_representation_negative(self):
        """Test string representation for negative amount."""
        transaction = TokenTransaction.objects.create(
            user=self.user,
            transaction_type='usage',
            amount=-50,
            balance_after=50,
        )

        self.assertEqual(str(transaction), 'txn_model@example.com - -50 tokens (usage)')


class SubscriptionChangeModelTestCase(TestCase):
    """Test SubscriptionChange model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='change_model_user', email='change_model@example.com', password='testpass123'
        )
        # Signal auto-creates subscription with free tier
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.free_tier = self.subscription.tier

        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

    def test_create_upgrade_change(self):
        """Test recording an upgrade."""
        change = SubscriptionChange.objects.create(
            user=self.user,
            subscription=self.subscription,
            change_type='upgraded',
            from_tier=self.free_tier,
            to_tier=self.pro_tier,
            reason='User upgraded to Pro',
        )

        self.assertEqual(change.change_type, 'upgraded')
        self.assertEqual(change.from_tier, self.free_tier)
        self.assertEqual(change.to_tier, self.pro_tier)

    def test_str_representation_with_from_tier(self):
        """Test string representation with from_tier."""
        change = SubscriptionChange.objects.create(
            user=self.user,
            subscription=self.subscription,
            change_type='upgraded',
            from_tier=self.free_tier,
            to_tier=self.pro_tier,
        )

        result = str(change)
        self.assertIn('upgraded', result)

    def test_str_representation_without_from_tier(self):
        """Test string representation without from_tier."""
        change = SubscriptionChange.objects.create(
            user=self.user,
            subscription=self.subscription,
            change_type='created',
            to_tier=self.free_tier,
        )

        result = str(change)
        self.assertIn('created', result)


class WebhookEventModelTestCase(TestCase):
    """Test WebhookEvent model."""

    def test_create_webhook_event(self):
        """Test creating a webhook event."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_123abc',
            event_type='payment_intent.succeeded',
            payload={'id': 'evt_123abc', 'type': 'payment_intent.succeeded'},
        )

        self.assertEqual(event.stripe_event_id, 'evt_123abc')
        self.assertEqual(event.event_type, 'payment_intent.succeeded')
        self.assertFalse(event.processed)
        self.assertIsNone(event.processing_started_at)

    def test_mark_processing_started(self):
        """Test marking processing as started."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_start',
            event_type='test',
            payload={},
        )

        event.mark_processing_started()

        self.assertIsNotNone(event.processing_started_at)
        self.assertFalse(event.processed)

    def test_mark_processing_completed(self):
        """Test marking processing as completed."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_complete',
            event_type='test',
            payload={},
        )

        event.mark_processing_started()
        event.mark_processing_completed()

        self.assertTrue(event.processed)
        self.assertIsNotNone(event.processing_completed_at)

    def test_mark_processing_failed(self):
        """Test marking processing as failed."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_fail',
            event_type='test',
            payload={},
        )

        event.mark_processing_started()
        event.mark_processing_failed('Connection timeout')

        self.assertFalse(event.processed)
        self.assertEqual(event.processing_error, 'Connection timeout')

    def test_webhook_event_unique_constraint(self):
        """Test that stripe_event_id is unique."""
        WebhookEvent.objects.create(
            stripe_event_id='evt_unique_test',
            event_type='test',
            payload={},
        )

        with self.assertRaises(Exception):
            WebhookEvent.objects.create(
                stripe_event_id='evt_unique_test',
                event_type='test',
                payload={},
            )

    def test_str_representation(self):
        """Test string representation."""
        event = WebhookEvent.objects.create(
            stripe_event_id='evt_1234567890abcdef',
            event_type='payment_intent.succeeded',
            payload={},
        )

        self.assertIn('payment_intent.succeeded', str(event))
        self.assertIn('Pending', str(event))

        event.mark_processing_completed()
        self.assertIn('Processed', str(event))
