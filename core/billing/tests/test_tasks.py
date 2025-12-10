"""Tests for billing Celery tasks."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from core.billing.models import (
    SubscriptionTier,
    UserSubscription,
    UserTokenBalance,
)
from core.billing.tasks import (
    CRITICAL_BALANCE_THRESHOLD,
    LOW_BALANCE_THRESHOLD,
    ZERO_BALANCE_THRESHOLD,
    check_low_token_balances_task,
    check_subscription_quotas_task,
    reset_monthly_ai_requests_task,
    send_token_usage_notification_task,
)
from core.users.models import User


class CheckLowTokenBalancesTaskTestCase(TestCase):
    """Test check_low_token_balances_task."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='low_balance_user', email='low_balance@example.com', password='testpass123'
        )
        # Signal auto-creates token balance
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

    def test_identifies_users_below_low_threshold(self):
        """Test that users with low balances are identified."""
        self.token_balance.balance = LOW_BALANCE_THRESHOLD - 1  # Just below threshold
        self.token_balance.total_purchased = 10000  # User has purchased tokens
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = check_low_token_balances_task()

            mock_notify.assert_called_once()
            self.assertEqual(result['notifications_sent'], 1)

    def test_ignores_users_above_threshold(self):
        """Test that users above threshold are not notified."""
        self.token_balance.balance = LOW_BALANCE_THRESHOLD + 1000  # Above threshold
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = check_low_token_balances_task()

            mock_notify.assert_not_called()
            self.assertEqual(result['notifications_sent'], 0)

    def test_critical_alert_level_for_very_low_balance(self):
        """Test that critical alert is sent for very low balance."""
        self.token_balance.balance = ZERO_BALANCE_THRESHOLD - 50  # Almost depleted
        self.token_balance.total_purchased = 10000  # User has purchased tokens
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            check_low_token_balances_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertEqual(call_kwargs['alert_level'], 'critical')

    def test_zero_balance_users_notified(self):
        """Test that users with zero balance are notified (only if they purchased tokens)."""
        self.token_balance.balance = 0
        self.token_balance.total_purchased = 10000  # User has purchased tokens
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = check_low_token_balances_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertEqual(call_kwargs['alert_level'], 'depleted')

    def test_free_users_not_notified(self):
        """Test that free users who never purchased tokens are NOT notified."""
        # User has zero balance but never purchased tokens (default state for free users)
        self.token_balance.balance = 0
        self.token_balance.total_purchased = 0  # Never purchased
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = check_low_token_balances_task()

            mock_notify.assert_not_called()
            self.assertEqual(result['notifications_sent'], 0)

    def test_curation_bots_not_notified(self):
        """Test that curation bots (tier='curation') are NOT notified."""
        # Set user as a curation bot
        self.user.tier = 'curation'
        self.user.save()

        # Even if they somehow have purchased tokens, they shouldn't be notified
        self.token_balance.balance = 0
        self.token_balance.total_purchased = 10000
        self.token_balance.save()

        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = check_low_token_balances_task()

            mock_notify.assert_not_called()
            self.assertEqual(result['notifications_sent'], 0)


class ResetMonthlyAiRequestsTaskTestCase(TestCase):
    """Test reset_monthly_ai_requests_task."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='reset_ai_user', email='reset_ai@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

    def test_resets_counters_for_active_subscriptions(self):
        """Test that active subscription counters are reset."""
        yesterday = timezone.now().date() - timezone.timedelta(days=1)
        self.subscription.ai_requests_used_this_month = 15
        self.subscription.ai_requests_reset_date = yesterday
        self.subscription.status = 'active'
        self.subscription.save()

        result = reset_monthly_ai_requests_task()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 0)
        self.assertEqual(self.subscription.ai_requests_reset_date, timezone.now().date())
        self.assertEqual(result['subscriptions_reset'], 1)

    def test_resets_subscriptions_with_null_reset_date(self):
        """Test that subscriptions without reset date are reset."""
        self.subscription.ai_requests_used_this_month = 10
        self.subscription.ai_requests_reset_date = None
        self.subscription.status = 'active'
        self.subscription.save()

        result = reset_monthly_ai_requests_task()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 0)
        self.assertIsNotNone(self.subscription.ai_requests_reset_date)

    def test_skips_canceled_subscriptions(self):
        """Test that canceled subscriptions are skipped."""
        yesterday = timezone.now().date() - timezone.timedelta(days=1)
        self.subscription.ai_requests_used_this_month = 5
        self.subscription.ai_requests_reset_date = yesterday
        self.subscription.status = 'canceled'
        self.subscription.save()

        result = reset_monthly_ai_requests_task()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 5)  # Unchanged

    def test_includes_trialing_subscriptions(self):
        """Test that trialing subscriptions are reset."""
        yesterday = timezone.now().date() - timezone.timedelta(days=1)
        self.subscription.ai_requests_used_this_month = 8
        self.subscription.ai_requests_reset_date = yesterday
        self.subscription.status = 'trialing'
        self.subscription.save()

        result = reset_monthly_ai_requests_task()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.ai_requests_used_this_month, 0)


class SendTokenUsageNotificationTaskTestCase(TestCase):
    """Test send_token_usage_notification_task."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='token_notify_user', email='token_notify@example.com', password='testpass123'
        )

    def test_sends_notification_for_critical_balance(self):
        """Test notification is sent for critical balance."""
        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = send_token_usage_notification_task(
                self.user.id,
                tokens_used=100,
                balance_after=CRITICAL_BALANCE_THRESHOLD - 100,
            )

            mock_notify.assert_called_once()
            self.assertTrue(result['notified'])
            self.assertEqual(result['alert_level'], 'warning')

    def test_sends_notification_for_almost_depleted(self):
        """Test notification is sent for almost depleted balance."""
        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = send_token_usage_notification_task(
                self.user.id,
                tokens_used=50,
                balance_after=ZERO_BALANCE_THRESHOLD - 50,
            )

            mock_notify.assert_called_once()
            self.assertTrue(result['notified'])
            self.assertEqual(result['alert_level'], 'critical')

    def test_no_notification_for_healthy_balance(self):
        """Test no notification for healthy balance."""
        with patch('core.billing.tasks.send_low_balance_notification') as mock_notify:
            result = send_token_usage_notification_task(
                self.user.id,
                tokens_used=100,
                balance_after=LOW_BALANCE_THRESHOLD + 1000,
            )

            mock_notify.assert_not_called()
            self.assertFalse(result['notified'])

    def test_handles_nonexistent_user(self):
        """Test handling of nonexistent user ID."""
        result = send_token_usage_notification_task(
            user_id=99999,  # Nonexistent
            tokens_used=100,
            balance_after=100,
        )

        self.assertFalse(result['notified'])
        self.assertEqual(result['error'], 'user_not_found')


class CheckSubscriptionQuotasTaskTestCase(TestCase):
    """Test check_subscription_quotas_task."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='quota_check_user', email='quota_check@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier

        # Ensure tier has a reasonable limit for testing
        self.tier.monthly_ai_requests = 20
        self.tier.save()

    def test_notifies_users_at_80_percent(self):
        """Test notification for users at 80% quota."""
        self.subscription.ai_requests_used_this_month = 16  # 80%
        self.subscription.status = 'active'
        self.subscription.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            result = check_subscription_quotas_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertEqual(call_kwargs['alert_level'], 'warning')

    def test_notifies_users_at_90_percent(self):
        """Test notification for users at 90% quota."""
        self.subscription.ai_requests_used_this_month = 18  # 90%
        self.subscription.status = 'active'
        self.subscription.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            result = check_subscription_quotas_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertEqual(call_kwargs['alert_level'], 'critical')

    def test_notifies_users_at_limit(self):
        """Test notification for users at 100% quota."""
        self.subscription.ai_requests_used_this_month = 20  # 100%
        self.subscription.status = 'active'
        self.subscription.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            result = check_subscription_quotas_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertEqual(call_kwargs['alert_level'], 'exceeded')

    def test_skips_users_under_80_percent(self):
        """Test no notification for users under 80% quota."""
        self.subscription.ai_requests_used_this_month = 10  # 50%
        self.subscription.status = 'active'
        self.subscription.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            result = check_subscription_quotas_task()

            mock_notify.assert_not_called()

    def test_skips_unlimited_tiers(self):
        """Test that unlimited tiers (0 limit) are skipped."""
        # Get or create unlimited tier
        unlimited_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='enterprise',
            defaults={
                'slug': 'unlimited',
                'name': 'Unlimited',
                'price_monthly': Decimal('50.00'),
                'price_annual': Decimal('500.00'),
                'monthly_ai_requests': 0,  # Unlimited
            },
        )
        self.subscription.tier = unlimited_tier
        self.subscription.ai_requests_used_this_month = 1000
        self.subscription.status = 'active'
        self.subscription.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            result = check_subscription_quotas_task()

            mock_notify.assert_not_called()

    def test_includes_token_balance_info(self):
        """Test that token balance info is passed to notification."""
        self.subscription.ai_requests_used_this_month = 20  # At limit
        self.subscription.status = 'active'
        self.subscription.save()

        # Get the signal-created token balance and set it
        token_balance = UserTokenBalance.objects.get(user=self.user)
        token_balance.balance = 5000
        token_balance.save()

        with patch('core.billing.tasks.send_quota_notification') as mock_notify:
            check_subscription_quotas_task()

            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args[1]
            self.assertTrue(call_kwargs['has_tokens'])
