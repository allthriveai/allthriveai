"""
Fake Stripe Service for Testing

Provides a test double that implements the same interface as StripeService
without making real Stripe API calls.
"""

import uuid
from datetime import UTC, datetime
from typing import Any, Protocol
from unittest.mock import MagicMock


class StripeServiceProtocol(Protocol):
    """Protocol defining the Stripe service interface."""

    @staticmethod
    def get_or_create_customer(user) -> str:
        """Get or create a Stripe customer for a user."""
        ...

    @staticmethod
    def create_subscription(user, tier, billing_interval: str) -> dict[str, Any]:
        """Create a new subscription for a user."""
        ...

    @staticmethod
    def cancel_subscription(user, immediate: bool = False) -> dict[str, Any]:
        """Cancel a user's subscription."""
        ...

    @staticmethod
    def create_checkout_session(
        user, tier, billing_interval: str, success_url: str, cancel_url: str, credit_pack=None
    ) -> dict[str, Any]:
        """Create a Stripe Checkout Session."""
        ...


class FakeStripeService:
    """
    Fake Stripe service for testing.

    Simulates Stripe API responses without making real API calls.
    Tracks all operations for verification in tests.

    Usage:
        fake = FakeStripeService()

        # Configure behavior
        fake.set_customer_id('cus_fake123')
        fake.set_subscription_status('active')

        # Use in tests - returns fake data
        customer_id = fake.get_or_create_customer(user)
        assert customer_id == 'cus_fake123'

        # Verify operations
        fake.assert_customer_created_for(user)

        # Simulate errors
        fake.set_error('create_subscription', StripeServiceError('Card declined'))
    """

    def __init__(self):
        """Initialize with default successful responses."""
        # Customer data
        self._customer_ids: dict[int, str] = {}  # user_id -> customer_id
        self._next_customer_id = 'cus_fake_' + uuid.uuid4().hex[:8]

        # Subscription data
        self._subscription_status = 'active'
        self._subscription_id = 'sub_fake_' + uuid.uuid4().hex[:8]
        self._client_secret = 'pi_' + uuid.uuid4().hex[:16] + '_secret_' + uuid.uuid4().hex[:16]

        # Checkout session data
        self._checkout_url = 'https://checkout.stripe.com/test/pay/fake_session_123'
        self._checkout_session_id = 'cs_test_' + uuid.uuid4().hex[:24]

        # Portal data
        self._portal_url = 'https://billing.stripe.com/session/test_session'

        # Invoice data
        self._invoices: list[dict] = []

        # Error simulation
        self._errors: dict[str, Exception] = {}

        # Call tracking
        self.calls: list[tuple[str, tuple, dict]] = []

        # Created objects tracking
        self.created_customers: list[dict] = []
        self.created_subscriptions: list[dict] = []
        self.created_checkout_sessions: list[dict] = []
        self.canceled_subscriptions: list[dict] = []
        self.updated_subscriptions: list[dict] = []

    # ===== Configuration Methods =====

    def set_customer_id(self, customer_id: str) -> 'FakeStripeService':
        """Set the customer ID to return for next get_or_create_customer call."""
        self._next_customer_id = customer_id
        return self

    def set_subscription_status(self, status: str) -> 'FakeStripeService':
        """Set the subscription status (active, incomplete, canceled, etc)."""
        self._subscription_status = status
        return self

    def set_subscription_id(self, subscription_id: str) -> 'FakeStripeService':
        """Set the subscription ID to return."""
        self._subscription_id = subscription_id
        return self

    def set_client_secret(self, secret: str) -> 'FakeStripeService':
        """Set the client secret for payment intents."""
        self._client_secret = secret
        return self

    def set_checkout_url(self, url: str) -> 'FakeStripeService':
        """Set the checkout session URL."""
        self._checkout_url = url
        return self

    def add_invoice(self, invoice: dict) -> 'FakeStripeService':
        """Add an invoice to the list."""
        self._invoices.append(invoice)
        return self

    def set_error(self, method: str, error: Exception) -> 'FakeStripeService':
        """Set an error to raise for a specific method."""
        self._errors[method] = error
        return self

    def clear_error(self, method: str) -> 'FakeStripeService':
        """Clear any error set for a method."""
        self._errors.pop(method, None)
        return self

    # ===== Preset Configurations =====

    def with_active_subscription(self) -> 'FakeStripeService':
        """Configure as user with active subscription."""
        self._subscription_status = 'active'
        return self

    def with_trial_subscription(self, trial_end: datetime | None = None) -> 'FakeStripeService':
        """Configure as user in trial period."""
        self._subscription_status = 'trialing'
        return self

    def with_payment_required(self) -> 'FakeStripeService':
        """Configure as subscription requiring payment."""
        self._subscription_status = 'incomplete'
        return self

    def with_canceled_subscription(self) -> 'FakeStripeService':
        """Configure as canceled subscription."""
        self._subscription_status = 'canceled'
        return self

    # ===== Internal Helpers =====

    def _track_call(self, method: str, args: tuple = (), kwargs: dict = None) -> None:
        """Track method calls for verification."""
        self.calls.append((method, args, kwargs or {}))

    def _check_error(self, method: str) -> None:
        """Raise any configured error for this method."""
        if method in self._errors:
            raise self._errors[method]

    def _generate_period_dates(self) -> tuple[datetime, datetime]:
        """Generate fake period start/end dates."""
        now = datetime.now(UTC)
        from datetime import timedelta

        return now, now + timedelta(days=30)

    # ===== Customer Management =====

    def get_or_create_customer(self, user) -> str:
        """Get or create a fake Stripe customer."""
        self._track_call('get_or_create_customer', (user,))
        self._check_error('get_or_create_customer')

        user_id = user.id if hasattr(user, 'id') else id(user)

        if user_id not in self._customer_ids:
            customer_id = self._next_customer_id
            self._customer_ids[user_id] = customer_id
            self.created_customers.append(
                {
                    'user_id': user_id,
                    'customer_id': customer_id,
                    'email': getattr(user, 'email', 'test@example.com'),
                }
            )
            # Generate new ID for next customer
            self._next_customer_id = 'cus_fake_' + uuid.uuid4().hex[:8]

        return self._customer_ids[user_id]

    def get_customer(self, customer_id: str):
        """Return a fake Stripe customer object."""
        self._track_call('get_customer', (customer_id,))
        self._check_error('get_customer')

        # Return a MagicMock that behaves like a Stripe Customer
        customer = MagicMock()
        customer.id = customer_id
        customer.email = 'customer@example.com'
        return customer

    # ===== Subscription Management =====

    def create_subscription(self, user, tier, billing_interval: str) -> dict[str, Any]:
        """Create a fake subscription."""
        self._track_call('create_subscription', (user, tier, billing_interval))
        self._check_error('create_subscription')

        period_start, period_end = self._generate_period_dates()

        subscription_data = {
            'subscription_id': self._subscription_id,
            'status': self._subscription_status,
            'client_secret': self._client_secret,
            'trial_end': None,
        }

        self.created_subscriptions.append(
            {
                'user_id': user.id if hasattr(user, 'id') else id(user),
                'tier_slug': getattr(tier, 'slug', str(tier)),
                'billing_interval': billing_interval,
                'subscription_id': self._subscription_id,
            }
        )

        # Generate new ID for next subscription
        self._subscription_id = 'sub_fake_' + uuid.uuid4().hex[:8]

        return subscription_data

    def cancel_subscription(self, user, immediate: bool = False) -> dict[str, Any]:
        """Cancel a fake subscription."""
        self._track_call('cancel_subscription', (user, immediate))
        self._check_error('cancel_subscription')

        user_id = user.id if hasattr(user, 'id') else id(user)
        period_end = datetime.now(UTC)

        self.canceled_subscriptions.append(
            {
                'user_id': user_id,
                'immediate': immediate,
            }
        )

        return {
            'subscription_id': 'sub_canceled_' + uuid.uuid4().hex[:8],
            'status': 'canceled',
            'cancel_at_period_end': not immediate,
            'period_end': period_end,
        }

    def update_subscription(self, user, new_tier, billing_interval: str = None) -> dict[str, Any]:
        """Update a fake subscription."""
        self._track_call('update_subscription', (user, new_tier, billing_interval))
        self._check_error('update_subscription')

        self.updated_subscriptions.append(
            {
                'user_id': user.id if hasattr(user, 'id') else id(user),
                'new_tier_slug': getattr(new_tier, 'slug', str(new_tier)),
                'billing_interval': billing_interval,
            }
        )

        return {
            'subscription_id': 'sub_updated_' + uuid.uuid4().hex[:8],
            'from_tier': 'basic',
            'to_tier': getattr(new_tier, 'slug', str(new_tier)),
            'change_type': 'upgraded',
        }

    # ===== Checkout Sessions =====

    def create_checkout_session(
        self, user, tier, billing_interval: str, success_url: str, cancel_url: str, credit_pack=None
    ) -> dict[str, Any]:
        """Create a fake checkout session."""
        self._track_call(
            'create_checkout_session', (user, tier, billing_interval, success_url, cancel_url, credit_pack)
        )
        self._check_error('create_checkout_session')

        session_data = {
            'session_id': self._checkout_session_id,
            'url': self._checkout_url,
        }

        self.created_checkout_sessions.append(
            {
                'user_id': user.id if hasattr(user, 'id') else id(user),
                'tier_slug': getattr(tier, 'slug', str(tier)),
                'billing_interval': billing_interval,
                'success_url': success_url,
                'cancel_url': cancel_url,
                'credit_pack': getattr(credit_pack, 'id', None) if credit_pack else None,
            }
        )

        # Generate new ID for next session
        self._checkout_session_id = 'cs_test_' + uuid.uuid4().hex[:24]

        return session_data

    # ===== Token Purchases =====

    def create_token_purchase(self, user, package) -> dict[str, Any]:
        """Create a fake token purchase payment intent."""
        self._track_call('create_token_purchase', (user, package))
        self._check_error('create_token_purchase')

        return {
            'payment_intent_id': 'pi_' + uuid.uuid4().hex[:24],
            'client_secret': self._client_secret,
            'amount': getattr(package, 'price', 9.99),
            'token_amount': getattr(package, 'token_amount', 1000),
            'purchase_id': uuid.uuid4().int % 10000,
        }

    # ===== Customer Portal =====

    def create_customer_portal_session(self, user, return_url: str = None) -> dict[str, Any]:
        """Create a fake customer portal session."""
        self._track_call('create_customer_portal_session', (user, return_url))
        self._check_error('create_customer_portal_session')

        return {'url': self._portal_url}

    # ===== Invoices =====

    def list_invoices(self, user, limit: int = 10) -> dict[str, Any]:
        """List fake invoices."""
        self._track_call('list_invoices', (user, limit))
        self._check_error('list_invoices')

        invoices = self._invoices[:limit] if self._invoices else []
        return {
            'invoices': invoices,
            'has_more': len(self._invoices) > limit,
        }

    # ===== Webhook Handling =====

    @staticmethod
    def verify_webhook_signature(payload: bytes, sig_header: str):
        """Verify webhook signature (always succeeds in fake)."""
        # Return a fake event object
        event = MagicMock()
        event.type = 'test.event'
        event.data = {'object': {}}
        return event

    # ===== Sync Methods =====

    @staticmethod
    def sync_subscription_tier_to_stripe(tier):
        """Fake tier sync (returns tier unchanged)."""
        return tier

    @staticmethod
    def sync_token_package_to_stripe(package):
        """Fake package sync (returns package unchanged)."""
        return package

    @staticmethod
    def sync_credit_pack_to_stripe(credit_pack):
        """Fake credit pack sync (no-op)."""
        pass

    # ===== Test Assertions =====

    def assert_customer_created_for(self, user) -> None:
        """Assert a customer was created for the user."""
        user_id = user.id if hasattr(user, 'id') else id(user)
        matching = [c for c in self.created_customers if c['user_id'] == user_id]
        assert len(matching) > 0, f'No customer created for user {user_id}'

    def assert_subscription_created(self, tier_slug: str = None) -> None:
        """Assert a subscription was created, optionally for a specific tier."""
        assert len(self.created_subscriptions) > 0, 'No subscriptions were created'
        if tier_slug:
            matching = [s for s in self.created_subscriptions if s['tier_slug'] == tier_slug]
            assert len(matching) > 0, f'No subscription created for tier {tier_slug}'

    def assert_subscription_canceled(self, immediate: bool = None) -> None:
        """Assert a subscription was canceled."""
        assert len(self.canceled_subscriptions) > 0, 'No subscriptions were canceled'
        if immediate is not None:
            matching = [s for s in self.canceled_subscriptions if s['immediate'] == immediate]
            assert len(matching) > 0, f'No subscription canceled with immediate={immediate}'

    def assert_checkout_session_created(self) -> None:
        """Assert a checkout session was created."""
        assert len(self.created_checkout_sessions) > 0, 'No checkout sessions were created'

    def get_call_count(self, method: str) -> int:
        """Get the number of times a method was called."""
        return len([c for c in self.calls if c[0] == method])

    def reset(self) -> None:
        """Reset all tracking and state."""
        self.calls.clear()
        self.created_customers.clear()
        self.created_subscriptions.clear()
        self.created_checkout_sessions.clear()
        self.canceled_subscriptions.clear()
        self.updated_subscriptions.clear()
        self._customer_ids.clear()
        self._invoices.clear()
        self._errors.clear()
