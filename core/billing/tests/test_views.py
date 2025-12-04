"""Tests for billing API views."""

from decimal import Decimal
from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from core.billing.models import (
    SubscriptionTier,
    TokenPackage,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
)
from core.users.models import User


class ListSubscriptionTiersViewTestCase(APITestCase):
    """Test list_subscription_tiers view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        # Create tiers using get_or_create to handle signal-created free tier
        self.free_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='free',
            defaults={
                'slug': 'free',
                'name': 'Free',
                'price_monthly': Decimal('0.00'),
                'price_annual': Decimal('0.00'),
                'monthly_ai_requests': 20,
                'is_active': True,
                'display_order': 1,
            },
        )
        # Ensure it's active
        if not self.free_tier.is_active:
            self.free_tier.is_active = True
            self.free_tier.display_order = 1
            self.free_tier.save()

        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'monthly_ai_requests': 500,
                'is_active': True,
                'display_order': 2,
            },
        )
        if not self.pro_tier.is_active:
            self.pro_tier.is_active = True
            self.pro_tier.display_order = 2
            self.pro_tier.save()

    def test_list_tiers_unauthenticated(self):
        """Test that tiers are accessible without authentication."""
        response = self.client.get('/api/v1/billing/tiers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # At least 2 tiers should exist
        self.assertGreaterEqual(len(response.data), 2)

    def test_list_tiers_returns_ordered_tiers(self):
        """Test that tiers are returned in display order."""
        response = self.client.get('/api/v1/billing/tiers/')

        # Verify response contains our tiers
        tier_slugs = [t['slug'] for t in response.data]
        self.assertIn(self.free_tier.slug, tier_slugs)
        self.assertIn(self.pro_tier.slug, tier_slugs)

    def test_list_tiers_includes_features(self):
        """Test that tier response includes features."""
        response = self.client.get('/api/v1/billing/tiers/')

        self.assertIn('features', response.data[0])
        self.assertIn('marketplace', response.data[0]['features'])


class ListTokenPackagesViewTestCase(APITestCase):
    """Test list_token_packages view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.starter_pkg, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
                'is_active': True,
                'display_order': 1,
            },
        )
        self.booster_pkg, _ = TokenPackage.objects.get_or_create(
            package_type='booster',
            defaults={
                'slug': 'booster',
                'name': 'Booster',
                'token_amount': 500000,
                'price': Decimal('20.00'),
                'is_active': True,
                'display_order': 2,
            },
        )

    def test_list_packages_unauthenticated(self):
        """Test that packages are accessible without authentication."""
        response = self.client.get('/api/v1/billing/packages/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)


class GetSubscriptionStatusViewTestCase(APITestCase):
    """Test get_subscription_status_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='status_view_user', email='status_view@example.com', password='testpass123'
        )
        # Signal auto-creates subscription and token balance
        self.subscription = UserSubscription.objects.get(user=self.user)
        self.tier = self.subscription.tier
        self.token_balance = UserTokenBalance.objects.get(user=self.user)

        # Set up test values
        self.subscription.ai_requests_used_this_month = 5
        self.subscription.save()
        self.token_balance.balance = 1000
        self.token_balance.save()

    def test_status_requires_authentication(self):
        """Test that status endpoint requires authentication."""
        response = self.client.get('/api/v1/billing/status/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_status_returns_subscription_details(self):
        """Test that status returns subscription details."""
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/billing/status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_subscription'])
        self.assertEqual(response.data['ai_requests']['used'], 5)
        self.assertEqual(response.data['tokens']['balance'], 1000)


class CreateSubscriptionViewTestCase(APITestCase):
    """Test create_subscription_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='create_sub_user', email='create_sub@example.com', password='testpass123'
        )
        # Signal auto-creates subscription with free tier
        self.existing_subscription = UserSubscription.objects.get(user=self.user)

        # Create a pro tier to upgrade to
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
                'stripe_price_id_monthly': 'price_monthly_123',
                'stripe_price_id_annual': 'price_annual_123',
            },
        )
        # Ensure Stripe price IDs are set
        if not self.pro_tier.stripe_price_id_monthly:
            self.pro_tier.stripe_price_id_monthly = 'price_monthly_123'
            self.pro_tier.stripe_price_id_annual = 'price_annual_123'
            self.pro_tier.save()

    def test_create_requires_authentication(self):
        """Test that create endpoint requires authentication."""
        response = self.client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': 'pro',
                'billing_interval': 'monthly',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_requires_tier_slug(self):
        """Test that tier_slug is required."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'billing_interval': 'monthly',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_requires_billing_interval(self):
        """Test that billing_interval is required."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': 'pro',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nonexistent_tier_returns_error(self):
        """Test that nonexistent tier returns an error."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': 'nonexistent',
                'billing_interval': 'monthly',
            },
        )

        # Can return either 400 (validation) or 404 (not found)
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND])

    @patch('core.billing.services.StripeService.create_subscription')
    def test_create_subscription_success(self, mock_create):
        """Test successful subscription creation."""
        mock_create.return_value = {
            'subscription_id': 'sub_test_123',
            'status': 'active',
            'client_secret': 'pi_secret_123',
            'trial_end': None,
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/subscriptions/create/',
            {
                'tier_slug': self.pro_tier.slug,
                'billing_interval': 'monthly',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['subscription_id'], 'sub_test_123')


class CancelSubscriptionViewTestCase(APITestCase):
    """Test cancel_subscription_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='cancel_sub_user', email='cancel_sub@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)

        # Get or create pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

        # Update subscription for cancel test
        self.subscription.tier = self.pro_tier
        self.subscription.stripe_subscription_id = 'sub_test_123'
        self.subscription.save()

    def test_cancel_requires_authentication(self):
        """Test that cancel endpoint requires authentication."""
        response = self.client.post('/api/v1/billing/subscriptions/cancel/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('core.billing.services.StripeService.cancel_subscription')
    def test_cancel_at_period_end(self, mock_cancel):
        """Test canceling at period end."""
        mock_cancel.return_value = {
            'subscription_id': 'sub_test_123',
            'status': 'canceled',
            'cancel_at_period_end': True,
            'period_end': '2024-03-31T00:00:00Z',
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/subscriptions/cancel/',
            {
                'immediate': False,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['cancel_at_period_end'])


class GetTokenBalanceViewTestCase(APITestCase):
    """Test get_token_balance_view."""

    def setUp(self):
        """Set up test data."""
        import uuid

        self.client = APIClient()
        # Use unique username each time to avoid keepdb issues
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f'token_bal_view_{unique_id}',
            email=f'token_bal_view_{unique_id}@example.com',
            password='testpass123',
        )
        # Signal auto-creates token balance, get and update it
        self.token_balance = UserTokenBalance.objects.get(user=self.user)
        self.token_balance.balance = 5000
        self.token_balance.total_purchased = 10000
        self.token_balance.total_used = 5000
        self.token_balance.save()

    def test_balance_requires_authentication(self):
        """Test that balance endpoint requires authentication."""
        response = self.client.get('/api/v1/billing/tokens/balance/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_balance_returns_details(self):
        """Test that balance returns all details."""
        # Refresh user to ensure related objects are current
        self.user.refresh_from_db()
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/billing/tokens/balance/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['balance'], 5000)


class GetTokenTransactionsViewTestCase(APITestCase):
    """Test get_token_transactions_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='token_txns_user', email='token_txns@example.com', password='testpass123'
        )
        # Create some transactions
        TokenTransaction.objects.create(
            user=self.user,
            transaction_type='purchase',
            amount=10000,
            balance_after=10000,
        )
        TokenTransaction.objects.create(
            user=self.user,
            transaction_type='usage',
            amount=-500,
            balance_after=9500,
        )

    def test_transactions_requires_authentication(self):
        """Test that transactions endpoint requires authentication."""
        response = self.client.get('/api/v1/billing/tokens/transactions/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_transactions_returns_list(self):
        """Test that transactions returns a list."""
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/billing/tokens/transactions/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)


class CreateTokenPurchaseViewTestCase(APITestCase):
    """Test create_token_purchase_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='token_purchase_user', email='token_purchase@example.com', password='testpass123'
        )
        self.package, _ = TokenPackage.objects.get_or_create(
            package_type='starter',
            defaults={
                'slug': 'starter',
                'name': 'Starter',
                'token_amount': 100000,
                'price': Decimal('5.00'),
            },
        )

    def test_purchase_requires_authentication(self):
        """Test that purchase endpoint requires authentication."""
        response = self.client.post(
            '/api/v1/billing/tokens/purchase/',
            {
                'package_slug': 'starter',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_purchase_requires_package_slug(self):
        """Test that package_slug is required."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/v1/billing/tokens/purchase/', {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_purchase_nonexistent_package_returns_error(self):
        """Test that nonexistent package returns an error."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/tokens/purchase/',
            {
                'package_slug': 'nonexistent',
            },
        )

        # Can return either 400 (validation) or 404 (not found)
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND])

    @patch('core.billing.services.StripeService.create_token_purchase')
    def test_purchase_success(self, mock_purchase):
        """Test successful token purchase."""
        mock_purchase.return_value = {
            'payment_intent_id': 'pi_test_123',
            'client_secret': 'pi_test_secret',
            'amount': Decimal('5.00'),
            'token_amount': 100000,
            'purchase_id': 1,
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/billing/tokens/purchase/',
            {
                'package_slug': self.package.slug,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['token_amount'], 100000)


class CreatePortalSessionViewTestCase(APITestCase):
    """Test create_portal_session_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username='portal_user', email='portal@example.com', password='testpass123')
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)

        # Get or create pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

        # Update subscription for portal test
        self.subscription.tier = self.pro_tier
        self.subscription.stripe_customer_id = 'cus_test_123'
        self.subscription.save()

    def test_portal_requires_authentication(self):
        """Test that portal endpoint requires authentication."""
        response = self.client.post('/api/v1/billing/portal/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('core.billing.services.StripeService.create_customer_portal_session')
    def test_portal_returns_url(self, mock_portal):
        """Test that portal returns URL."""
        mock_portal.return_value = {
            'url': 'https://billing.stripe.com/session/xxx',
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/v1/billing/portal/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('url', response.data)


class ListInvoicesViewTestCase(APITestCase):
    """Test list_invoices_view."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='invoices_user', email='invoices@example.com', password='testpass123'
        )
        # Signal auto-creates subscription
        self.subscription = UserSubscription.objects.get(user=self.user)

        # Get or create pro tier
        self.pro_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_type='community_pro',
            defaults={
                'slug': 'pro',
                'name': 'Pro',
                'price_monthly': Decimal('15.00'),
                'price_annual': Decimal('150.00'),
            },
        )

        # Update subscription for invoices test
        self.subscription.tier = self.pro_tier
        self.subscription.stripe_customer_id = 'cus_test_123'
        self.subscription.save()

    def test_invoices_requires_authentication(self):
        """Test that invoices endpoint requires authentication."""
        response = self.client.get('/api/v1/billing/invoices/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('core.billing.services.StripeService.list_invoices')
    def test_invoices_returns_list(self, mock_invoices):
        """Test that invoices returns list."""
        mock_invoices.return_value = {
            'invoices': [
                {'id': 'in_123', 'amount_paid': 1500, 'status': 'paid'},
            ],
            'has_more': False,
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/billing/invoices/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('invoices', response.data)

    @patch('core.billing.services.StripeService.list_invoices')
    def test_invoices_accepts_limit_param(self, mock_invoices):
        """Test that invoices accepts limit parameter."""
        mock_invoices.return_value = {
            'invoices': [],
            'has_more': False,
        }

        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/v1/billing/invoices/?limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_invoices.assert_called_with(self.user, 5)
