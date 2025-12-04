"""Tests for billing utility functions."""

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.billing.models import (
    SubscriptionTier,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
)
from core.billing.utils import (
    can_access_feature,
    can_make_ai_request,
    check_and_reserve_ai_request,
    deduct_tokens,
    get_available_tiers,
    get_or_create_token_balance,
    get_subscription_status,
    get_user_subscription,
    process_ai_request,
)
from core.users.models import User


class GetUserSubscriptionTestCase(TestCase):
    """Test get_user_subscription function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='get_sub_user', email='get_sub@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

    def test_get_existing_subscription(self):
        """Test getting an existing subscription."""
        result = get_user_subscription(self.user)

        self.assertEqual(result, self.subscription)

    def test_subscription_includes_tier(self):
        """Test that returned subscription has tier pre-fetched."""
        result = get_user_subscription(self.user)

        # Should not cause additional query
        self.assertIsNotNone(result.tier.name)


class GetOrCreateTokenBalanceTestCase(TestCase):
    """Test get_or_create_token_balance function."""

    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(
            username='token_balance_test_user', email='token_balance_test@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

    def test_get_existing_balance(self):
        """Test getting an existing token balance."""
        self.token_balance.balance = 500
        self.token_balance.save()

        result = get_or_create_token_balance(self.user)

        self.assertEqual(result.id, self.token_balance.id)
        self.assertEqual(result.balance, 500)


class CanAccessFeatureTestCase(TestCase):
    """Test can_access_feature function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='can_access_user', email='can_access@example.com', password='testpass123'
        )
        # Signal auto-creates subscription with free tier
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.free_tier = self.subscription.tier

        # Update the free tier features for testing
        self.free_tier.has_marketplace_access = True
        self.free_tier.has_ai_mentor = True
        self.free_tier.has_go1_courses = False
        self.free_tier.has_analytics = False
        self.free_tier.save()

        # Get or create pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'has_marketplace_access': True,
                'has_ai_mentor': True,
                'has_go1_courses': True,
                'has_analytics': True,
            },
        )

    def test_access_allowed_feature(self):
        """Test accessing an allowed feature."""
        self.assertTrue(can_access_feature(self.user, 'marketplace'))
        self.assertTrue(can_access_feature(self.user, 'ai_mentor'))

    def test_access_disallowed_feature(self):
        """Test accessing a disallowed feature."""
        self.assertFalse(can_access_feature(self.user, 'go1_courses'))
        self.assertFalse(can_access_feature(self.user, 'analytics'))

    def test_access_with_pro_tier(self):
        """Test accessing features with pro tier."""
        self.subscription.tier = self.pro_tier
        self.subscription.save()

        self.assertTrue(can_access_feature(self.user, 'go1_courses'))
        self.assertTrue(can_access_feature(self.user, 'analytics'))

    def test_access_unknown_feature(self):
        """Test accessing an unknown feature."""
        self.assertFalse(can_access_feature(self.user, 'unknown_feature'))


class CanMakeAiRequestTestCase(TestCase):
    """Test can_make_ai_request function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username='can_ai_user', email='can_ai@example.com', password='testpass123')
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Set tier limit for testing
        self.tier.monthly_ai_requests = 20
        self.tier.save()

    def test_can_make_request_within_limit(self):
        """Test user within subscription limit can make request."""
        self.subscription.ai_requests_used_this_month = 10
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        can_request, reason = can_make_ai_request(self.user)

        self.assertTrue(can_request)
        self.assertEqual(reason, 'Within subscription limit')

    def test_cannot_make_request_at_limit(self):
        """Test user at limit cannot make request without tokens."""
        self.subscription.ai_requests_used_this_month = 20
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        # Signal creates token balance with 0 balance
        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 0
        token_balance.save()

        can_request, reason = can_make_ai_request(self.user)

        self.assertFalse(can_request)
        self.assertIn('exceeded', reason.lower())

    def test_can_make_request_with_tokens_fallback(self):
        """Test user at limit can make request with token fallback."""
        self.subscription.ai_requests_used_this_month = 20
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 1000
        token_balance.save()

        can_request, reason = can_make_ai_request(self.user)

        self.assertTrue(can_request)
        self.assertEqual(reason, 'Using token balance')


class CheckAndReserveAiRequestTestCase(TestCase):
    """Test check_and_reserve_ai_request function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='reserve_ai_user', email='reserve_ai@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Set tier limit for testing
        self.tier.monthly_ai_requests = 20
        self.tier.save()

    def test_reserve_increments_counter(self):
        """Test that reserving increments the counter."""
        self.subscription.ai_requests_used_this_month = 0
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        success, message = check_and_reserve_ai_request(self.user)

        self.assertTrue(success)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 1)

    def test_reserve_fails_at_limit(self):
        """Test that reserve fails when at limit without tokens."""
        self.subscription.ai_requests_used_this_month = 20
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        # Ensure no tokens
        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 0
        token_balance.save()

        success, message = check_and_reserve_ai_request(self.user)

        self.assertFalse(success)
        self.assertIn('exceeded', message.lower())

    def test_reserve_succeeds_with_tokens(self):
        """Test that reserve succeeds at limit with tokens."""
        self.subscription.ai_requests_used_this_month = 20
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 1000
        token_balance.save()

        success, message = check_and_reserve_ai_request(self.user)

        self.assertTrue(success)
        self.assertIn('token', message.lower())


class DeductTokensTestCase(TestCase):
    """Test deduct_tokens function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='deduct_tokens_user', email='deduct_tokens@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

    def test_deduct_tokens_success(self):
        """Test successful token deduction."""
        self.token_balance.balance = 1000
        self.token_balance.save()

        result = deduct_tokens(self.user, 500, description='AI chat', ai_provider='openai', ai_model='gpt-4')

        self.assertTrue(result)

        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.balance, 500)
        self.assertEqual(self.token_balance.total_used, 500)

        # Verify transaction was logged
        transaction = TokenTransaction.objects.get(user=self.user, transaction_type='usage')
        self.assertEqual(transaction.amount, -500)
        self.assertEqual(transaction.ai_provider, 'openai')
        self.assertEqual(transaction.ai_model, 'gpt-4')

    def test_deduct_tokens_insufficient_balance(self):
        """Test token deduction with insufficient balance."""
        self.token_balance.balance = 100
        self.token_balance.save()

        result = deduct_tokens(self.user, 500)

        self.assertFalse(result)

        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.balance, 100)


class ProcessAiRequestTestCase(TestCase):
    """Test process_ai_request function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='process_ai_user', email='process_ai@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Set tier limit for testing
        self.tier.monthly_ai_requests = 20
        self.tier.save()

    def test_process_using_subscription(self):
        """Test processing request using subscription allowance."""
        self.subscription.ai_requests_used_this_month = 0
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        success, message = process_ai_request(self.user, tokens_used=100, ai_provider='openai', ai_model='gpt-4')

        self.assertTrue(success)
        self.assertIn('subscription', message.lower())

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 1)

    def test_process_using_tokens(self):
        """Test processing request using token balance."""
        self.subscription.ai_requests_used_this_month = 20  # At limit
        self.subscription.ai_requests_reset_date = timezone.now().date()
        self.subscription.save()

        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 1000
        token_balance.save()

        success, message = process_ai_request(self.user, tokens_used=100, ai_provider='openai', ai_model='gpt-4')

        self.assertTrue(success)
        self.assertIn('100 tokens', message)

        token_balance.refresh_from_db()
        self.assertEqual(token_balance.balance, 900)


class GetSubscriptionStatusTestCase(TestCase):
    """Test get_subscription_status function."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='get_status_user', email='get_status@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Update tier for testing
        self.tier.monthly_ai_requests = 20
        self.tier.has_marketplace_access = True
        self.tier.has_ai_mentor = True
        self.tier.save()

    def test_get_status_with_subscription(self):
        """Test getting status for user with subscription."""
        self.subscription.ai_requests_used_this_month = 5
        self.subscription.save()

        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 1000
        token_balance.save()

        status = get_subscription_status(self.user)

        self.assertTrue(status['has_subscription'])
        self.assertEqual(status['status'], 'active')
        self.assertTrue(status['is_active'])
        self.assertEqual(status['ai_requests']['used'], 5)
        self.assertEqual(status['ai_requests']['remaining'], 15)
        self.assertEqual(status['tokens']['balance'], 1000)
        self.assertTrue(status['features']['marketplace'])
        self.assertTrue(status['features']['ai_mentor'])


class GetAvailableTiersTestCase(TestCase):
    """Test get_available_tiers function."""

    def test_get_active_tiers(self):
        """Test getting only active tiers."""
        # Get or create tiers using unique tier_types
        free_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='free',
            defaults={
                'slug': 'free',
                'name': 'Free',
                'price_monthly': Decimal('0.00'),
                'price_annual': Decimal('0.00'),
                'is_active': True,
                'display_order': 1,
            },
        )
        free_tier.is_active = True
        free_tier.display_order = 1
        free_tier.save()

        pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'is_active': True,
                'display_order': 2,
            },
        )
        pro_tier.is_active = True
        pro_tier.display_order = 2
        pro_tier.save()

        # Create a hidden tier
        hidden_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='pro_learn',
            defaults={
                'slug': 'hidden',
                'name': 'Hidden',
                'price_monthly': Decimal('40.00'),
                'price_annual': Decimal('400.00'),
                'is_active': False,
                'display_order': 3,
            },
        )
        hidden_tier.is_active = False
        hidden_tier.save()

        tiers = get_available_tiers()

        # Should include at least 2 active tiers
        tier_slugs = [t['slug'] for t in tiers]
        self.assertIn(free_tier.slug, tier_slugs)
        self.assertIn(pro_tier.slug, tier_slugs)
        # Hidden tier should not be included
        self.assertNotIn(hidden_tier.slug, tier_slugs)

    def test_tier_includes_features(self):
        """Test that tier data includes features."""
        pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'has_marketplace_access': True,
                'has_analytics': True,
                'is_active': True,
            },
        )
        pro_tier.has_marketplace_access = True
        pro_tier.has_analytics = True
        pro_tier.is_active = True
        pro_tier.save()

        tiers = get_available_tiers()

        # Find the pro tier in results
        pro_tier_data = next((t for t in tiers if t['slug'] == pro_tier.slug), None)
        self.assertIsNotNone(pro_tier_data)
        self.assertTrue(pro_tier_data['features']['marketplace'])
        self.assertTrue(pro_tier_data['features']['analytics'])
