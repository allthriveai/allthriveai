"""Tests for CreditPackService."""

from unittest.mock import MagicMock, patch

from django.test import TestCase

from core.billing.credit_pack_service import CreditPackService
from core.billing.models import (
    CreditPack,
    TokenTransaction,
    UserCreditPackSubscription,
    UserTokenBalance,
)
from core.users.models import User


class CreditPackServiceTestCase(TestCase):
    """Base test case for CreditPackService tests."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='credit_pack_test_user',
            email='credit_pack_test@example.com',
            password='testpass123',
        )
        # Signal auto-creates token balance
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

        # Create a credit pack for testing
        self.credit_pack = CreditPack.objects.create(
            name='1,250 credits',
            credits_per_month=1250,
            price_cents=4000,
            sort_order=2,
            is_active=True,
        )


class TrackUsageTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.track_usage method."""

    def test_track_usage_creates_transaction(self):
        """Test that track_usage creates a transaction record."""
        CreditPackService.track_usage(self.user, tokens_used=100, ai_provider='openai', ai_model='gpt-4')

        transaction = TokenTransaction.objects.filter(
            user=self.user, transaction_type='credit_pack_usage_tracked'
        ).first()

        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, -100)
        self.assertEqual(transaction.ai_provider, 'openai')
        self.assertEqual(transaction.ai_model, 'gpt-4')

    def test_track_usage_does_not_deduct_balance(self):
        """Test that track_usage does NOT deduct from balance."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        CreditPackService.track_usage(self.user, tokens_used=100)

        self.token_balance.refresh_from_db()
        # Balance should remain unchanged
        self.assertEqual(self.token_balance.credit_pack_balance, 500)


class DeductCreditsTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.deduct_credits method."""

    def test_deduct_credits_success(self):
        """Test successful credit deduction."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        result = CreditPackService.deduct_credits(self.user, amount=100, description='Test deduction')

        self.assertTrue(result)
        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.credit_pack_balance, 400)

    def test_deduct_credits_insufficient_balance(self):
        """Test deduction fails with insufficient balance."""
        self.token_balance.credit_pack_balance = 50
        self.token_balance.save()

        result = CreditPackService.deduct_credits(self.user, amount=100)

        self.assertFalse(result)
        self.token_balance.refresh_from_db()
        # Balance should remain unchanged
        self.assertEqual(self.token_balance.credit_pack_balance, 50)

    def test_deduct_credits_creates_transaction(self):
        """Test that deduct_credits creates a transaction record."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        CreditPackService.deduct_credits(self.user, amount=100, ai_provider='anthropic', ai_model='claude-3')

        transaction = TokenTransaction.objects.filter(user=self.user, transaction_type='credit_pack_usage').first()

        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, -100)
        self.assertEqual(transaction.ai_provider, 'anthropic')
        self.assertEqual(transaction.ai_model, 'claude-3')


class GrantMonthlyCreditsTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.grant_monthly_credits method."""

    def test_grant_monthly_credits_adds_to_balance(self):
        """Test that grant_monthly_credits adds credits to balance."""
        self.token_balance.credit_pack_balance = 100
        self.token_balance.save()

        CreditPackService.grant_monthly_credits(self.user, self.credit_pack)

        self.token_balance.refresh_from_db()
        # Should add 1250 credits to existing 100
        self.assertEqual(self.token_balance.credit_pack_balance, 1350)

    def test_grant_monthly_credits_creates_transaction(self):
        """Test that grant_monthly_credits creates a transaction record."""
        CreditPackService.grant_monthly_credits(self.user, self.credit_pack)

        transaction = TokenTransaction.objects.filter(user=self.user, transaction_type='credit_pack_grant').first()

        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, 1250)


class ForfeitCreditsTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.forfeit_credits method."""

    def test_forfeit_credits_clears_balance(self):
        """Test that forfeit_credits clears the credit pack balance."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        CreditPackService.forfeit_credits(self.user)

        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.credit_pack_balance, 0)

    def test_forfeit_credits_creates_transaction(self):
        """Test that forfeit_credits creates a transaction record."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        CreditPackService.forfeit_credits(self.user)

        transaction = TokenTransaction.objects.filter(user=self.user, transaction_type='credit_pack_forfeit').first()

        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, -500)
        self.assertEqual(transaction.balance_after, 0)

    def test_forfeit_credits_no_transaction_when_zero_balance(self):
        """Test that no transaction is created when balance is already zero."""
        self.token_balance.credit_pack_balance = 0
        self.token_balance.save()

        CreditPackService.forfeit_credits(self.user)

        # No forfeit transaction should be created
        transaction = TokenTransaction.objects.filter(user=self.user, transaction_type='credit_pack_forfeit').first()

        self.assertIsNone(transaction)


class GetUserCreditPackStatusTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.get_user_credit_pack_status method."""

    def test_status_without_subscription(self):
        """Test status when user has no credit pack subscription."""
        status = CreditPackService.get_user_credit_pack_status(self.user)

        self.assertFalse(status['has_credit_pack'])
        self.assertIsNone(status['credit_pack'])
        self.assertEqual(status['status'], 'inactive')
        self.assertEqual(status['credit_pack_balance'], 0)

    def test_status_with_active_subscription(self):
        """Test status when user has an active credit pack subscription."""
        self.token_balance.credit_pack_balance = 850
        self.token_balance.save()

        # Create subscription
        UserCreditPackSubscription.objects.create(
            user=self.user,
            credit_pack=self.credit_pack,
            status='active',
            stripe_subscription_id='sub_test123',
            credits_this_period=1250,
        )

        status = CreditPackService.get_user_credit_pack_status(self.user)

        self.assertTrue(status['has_credit_pack'])
        self.assertEqual(status['credit_pack']['id'], self.credit_pack.id)
        self.assertEqual(status['credit_pack']['name'], '1,250 credits')
        self.assertEqual(status['status'], 'active')
        self.assertEqual(status['credit_pack_balance'], 850)
        self.assertEqual(status['credits_this_period'], 1250)


class HasSufficientCreditsTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.has_sufficient_credits method."""

    def test_has_sufficient_credits_true(self):
        """Test returns True when balance is sufficient."""
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        result = CreditPackService.has_sufficient_credits(self.user, 100)

        self.assertTrue(result)

    def test_has_sufficient_credits_false(self):
        """Test returns False when balance is insufficient."""
        self.token_balance.credit_pack_balance = 50
        self.token_balance.save()

        result = CreditPackService.has_sufficient_credits(self.user, 100)

        self.assertFalse(result)

    def test_has_sufficient_credits_exact_amount(self):
        """Test returns True when balance equals exactly the amount needed."""
        self.token_balance.credit_pack_balance = 100
        self.token_balance.save()

        result = CreditPackService.has_sufficient_credits(self.user, 100)

        self.assertTrue(result)


class SubscribeTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.subscribe method."""

    @patch('core.billing.services.StripeService')
    def test_subscribe_creates_subscription(self, mock_stripe_class):
        """Test that subscribe creates a subscription record."""
        # Mock Stripe service
        mock_stripe = MagicMock()
        mock_stripe.create_credit_pack_subscription.return_value = MagicMock(id='sub_test123')
        mock_stripe_class.return_value = mock_stripe

        CreditPackService.subscribe(self.user, self.credit_pack)

        # Verify subscription was created
        sub = UserCreditPackSubscription.objects.get(user=self.user)
        self.assertEqual(sub.credit_pack, self.credit_pack)
        self.assertEqual(sub.status, 'active')
        self.assertEqual(sub.stripe_subscription_id, 'sub_test123')


class ChangePackTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.change_pack method."""

    @patch('core.billing.services.StripeService')
    def test_change_pack_updates_subscription(self, mock_stripe_class):
        """Test that change_pack updates the subscription to new pack."""
        # Create initial subscription
        UserCreditPackSubscription.objects.create(
            user=self.user,
            credit_pack=self.credit_pack,
            status='active',
            stripe_subscription_id='sub_test123',
        )

        # Create a new larger pack
        new_pack = CreditPack.objects.create(
            name='2,500 credits',
            credits_per_month=2500,
            price_cents=8000,
            sort_order=3,
            is_active=True,
        )

        # Mock Stripe service
        mock_stripe = MagicMock()
        mock_stripe_class.return_value = mock_stripe

        CreditPackService.change_pack(self.user, new_pack)

        # Verify subscription was updated
        sub = UserCreditPackSubscription.objects.get(user=self.user)
        self.assertEqual(sub.credit_pack, new_pack)

    def test_change_pack_raises_error_without_subscription(self):
        """Test that change_pack raises error when no subscription exists."""
        new_pack = CreditPack.objects.create(
            name='2,500 credits',
            credits_per_month=2500,
            price_cents=8000,
            sort_order=3,
            is_active=True,
        )

        with self.assertRaises(ValueError) as context:
            CreditPackService.change_pack(self.user, new_pack)

        self.assertIn('No active credit pack subscription', str(context.exception))


class CancelTestCase(CreditPackServiceTestCase):
    """Test CreditPackService.cancel method."""

    @patch('core.billing.services.StripeService')
    def test_cancel_forfeits_credits(self, mock_stripe_class):
        """Test that cancel forfeits remaining credits."""
        # Create subscription and set balance
        UserCreditPackSubscription.objects.create(
            user=self.user,
            credit_pack=self.credit_pack,
            status='active',
            stripe_subscription_id='sub_test123',
        )
        self.token_balance.credit_pack_balance = 500
        self.token_balance.save()

        # Mock Stripe service
        mock_stripe = MagicMock()
        mock_stripe_class.return_value = mock_stripe

        CreditPackService.cancel(self.user)

        # Verify credits were forfeited
        self.token_balance.refresh_from_db()
        self.assertEqual(self.token_balance.credit_pack_balance, 0)

        # Verify subscription was canceled
        sub = UserCreditPackSubscription.objects.get(user=self.user)
        self.assertEqual(sub.status, 'canceled')
        self.assertIsNone(sub.credit_pack)

    def test_cancel_raises_error_without_subscription(self):
        """Test that cancel raises error when no subscription exists."""
        with self.assertRaises(ValueError) as context:
            CreditPackService.cancel(self.user)

        self.assertIn('No credit pack subscription', str(context.exception))
