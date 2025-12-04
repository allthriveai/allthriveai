"""
Stripe Service Layer

Handles all Stripe API interactions for subscriptions and payments.
"""

import logging
from datetime import UTC
from typing import Any

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import (
    SubscriptionChange,
    SubscriptionTier,
    TokenPackage,
    TokenPurchase,
    UserSubscription,
)

logger = logging.getLogger(__name__)

# Initialize Stripe API key
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeServiceError(Exception):
    """Base exception for Stripe service errors."""

    pass


class StripeService:
    """
    Service class for all Stripe operations.

    Handles:
    - Customer creation and management
    - Subscription creation, updates, and cancellation
    - Token package purchases (one-time payments)
    - Product and price syncing
    - Webhook event processing
    """

    # ===== Customer Management =====

    @staticmethod
    def get_or_create_customer(user) -> str:
        """
        Get or create a Stripe customer for a user.

        Args:
            user: Django User instance

        Returns:
            Stripe customer ID

        Raises:
            StripeServiceError: If customer creation fails
        """
        try:
            # Check if user already has a subscription with Stripe customer
            subscription = UserSubscription.objects.filter(user=user).first()
            if subscription and subscription.stripe_customer_id:
                return subscription.stripe_customer_id

            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user.email,
                name=user.get_full_name() or user.username,
                metadata={
                    'user_id': user.id,
                    'username': user.username,
                },
            )

            # Save customer ID to subscription
            if subscription:
                subscription.stripe_customer_id = customer.id
                subscription.save()

            logger.info(f'Created Stripe customer {customer.id} for user {user.id}')
            return customer.id

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create Stripe customer for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to create customer: {str(e)}') from e

    @staticmethod
    def get_customer(customer_id: str) -> stripe.Customer | None:
        """
        Retrieve a Stripe customer.

        Args:
            customer_id: Stripe customer ID

        Returns:
            Stripe Customer object or None
        """
        try:
            return stripe.Customer.retrieve(customer_id)
        except stripe.error.StripeError as e:
            logger.error(f'Failed to retrieve Stripe customer {customer_id}: {e}')
            return None

    # ===== Subscription Management =====

    @staticmethod
    @transaction.atomic
    def create_subscription(user, tier: SubscriptionTier, billing_interval: str) -> dict[str, Any]:
        """
        Create a new subscription for a user.

        Args:
            user: Django User instance
            tier: SubscriptionTier instance
            billing_interval: 'monthly' or 'annual' (required)

        Returns:
            Dict with subscription details and client_secret for payment

        Raises:
            StripeServiceError: If subscription creation fails
        """
        try:
            # Validate billing interval
            if billing_interval not in ['monthly', 'annual']:
                raise StripeServiceError(f'Invalid billing interval: {billing_interval}')

            # Get the appropriate Stripe price ID
            stripe_price_id = (
                tier.stripe_price_id_annual if billing_interval == 'annual' else tier.stripe_price_id_monthly
            )

            # Validate tier has Stripe price
            if not stripe_price_id:
                raise StripeServiceError(
                    f"Tier {tier.name} doesn't have a Stripe price configured for {billing_interval} billing. "
                    'Run: python manage.py seed_billing --with-stripe'
                )

            # Get or create Stripe customer
            customer_id = StripeService.get_or_create_customer(user)

            # Get or create user's subscription record with database lock to prevent race conditions
            # We need to handle the case where UserSubscription doesn't exist yet
            try:
                user_subscription = UserSubscription.objects.select_for_update().get(user=user)
            except UserSubscription.DoesNotExist:
                # Create a new UserSubscription for this user
                # Note: Can't use select_for_update() with create, but that's okay since we just created it
                user_subscription = UserSubscription.objects.create(
                    user=user,
                    tier=SubscriptionTier.objects.get(tier_type='free'),  # Start with free tier
                    status='active',
                )

            # Check if user already has an active paid subscription
            # Only block if subscription is active AND has completed payment (has period dates)
            # Incomplete subscriptions (no period dates) are allowed to retry
            if (
                user_subscription.stripe_subscription_id
                and user_subscription.status == 'active'
                and user_subscription.current_period_end is not None
            ):
                raise StripeServiceError(
                    'You already have an active subscription. Please cancel your current subscription first, '
                    'or use the update subscription endpoint to change tiers.'
                )

            old_tier = user_subscription.tier

            # Create subscription in Stripe
            subscription_params = {
                'customer': customer_id,
                'items': [{'price': stripe_price_id}],
                'payment_behavior': 'default_incomplete',
                'payment_settings': {'save_default_payment_method': 'on_subscription'},
                'expand': ['latest_invoice.payment_intent'],
                'metadata': {
                    'user_id': user.id,
                    'tier_slug': tier.slug,
                },
            }

            # Add trial period if applicable
            if tier.trial_period_days > 0:
                subscription_params['trial_period_days'] = tier.trial_period_days

            stripe_subscription = stripe.Subscription.create(**subscription_params)

            # Update user subscription record
            user_subscription.tier = tier
            user_subscription.stripe_subscription_id = stripe_subscription.id
            user_subscription.stripe_customer_id = customer_id
            user_subscription.status = stripe_subscription.status

            # Period dates may not exist for incomplete subscriptions (payment_behavior='default_incomplete')
            # They will be set by webhook when payment succeeds
            if hasattr(stripe_subscription, 'current_period_start') and stripe_subscription.current_period_start:
                user_subscription.current_period_start = timezone.datetime.fromtimestamp(
                    stripe_subscription.current_period_start, tz=UTC
                )
            if hasattr(stripe_subscription, 'current_period_end') and stripe_subscription.current_period_end:
                user_subscription.current_period_end = timezone.datetime.fromtimestamp(
                    stripe_subscription.current_period_end, tz=UTC
                )

            # Set trial dates if in trial
            if hasattr(stripe_subscription, 'trial_start') and stripe_subscription.trial_start:
                user_subscription.trial_start = timezone.datetime.fromtimestamp(stripe_subscription.trial_start, tz=UTC)
            if hasattr(stripe_subscription, 'trial_end') and stripe_subscription.trial_end:
                user_subscription.trial_end = timezone.datetime.fromtimestamp(stripe_subscription.trial_end, tz=UTC)

            user_subscription.save()

            # Log subscription change
            SubscriptionChange.objects.create(
                user=user,
                subscription=user_subscription,
                change_type='upgraded' if tier.price_monthly > old_tier.price_monthly else 'created',
                from_tier=old_tier if old_tier.tier_type != 'free' else None,
                to_tier=tier,
                reason=f'User subscribed to {tier.name}',
            )

            # Get client secret for payment
            client_secret = None
            if stripe_subscription.latest_invoice:
                invoice = stripe_subscription.latest_invoice
                if hasattr(invoice, 'payment_intent') and invoice.payment_intent:
                    client_secret = invoice.payment_intent.client_secret

            logger.info(f'Created subscription {stripe_subscription.id} for user {user.id} on tier {tier.slug}')

            return {
                'subscription_id': stripe_subscription.id,
                'status': stripe_subscription.status,
                'client_secret': client_secret,
                'trial_end': user_subscription.trial_end,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create subscription for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to create subscription: {str(e)}') from e

    @staticmethod
    @transaction.atomic
    def cancel_subscription(user, immediate: bool = False) -> dict[str, Any]:
        """
        Cancel a user's subscription.

        Args:
            user: Django User instance
            immediate: If True, cancel immediately. If False, cancel at period end.

        Returns:
            Dict with cancellation details

        Raises:
            StripeServiceError: If cancellation fails
        """
        try:
            user_subscription = UserSubscription.objects.get(user=user)

            if not user_subscription.stripe_subscription_id:
                raise StripeServiceError('No active Stripe subscription found')

            # Cancel in Stripe
            if immediate:
                stripe.Subscription.delete(user_subscription.stripe_subscription_id)
            else:
                stripe.Subscription.modify(user_subscription.stripe_subscription_id, cancel_at_period_end=True)

            # Update local subscription
            old_tier = user_subscription.tier
            user_subscription.status = 'canceled'
            user_subscription.canceled_at = timezone.now()
            user_subscription.cancel_at_period_end = not immediate

            if immediate:
                # Downgrade to free tier immediately
                free_tier = SubscriptionTier.objects.get(tier_type='free')
                user_subscription.tier = free_tier

            user_subscription.save()

            # Log subscription change
            SubscriptionChange.objects.create(
                user=user,
                subscription=user_subscription,
                change_type='canceled',
                from_tier=old_tier,
                to_tier=user_subscription.tier,
                reason=f'User canceled subscription ({"immediate" if immediate else "at period end"})',
            )

            logger.info(f'Canceled subscription {user_subscription.stripe_subscription_id} for user {user.id}')

            return {
                'subscription_id': user_subscription.stripe_subscription_id,
                'status': user_subscription.status,
                'cancel_at_period_end': not immediate,
                'period_end': user_subscription.current_period_end,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to cancel subscription for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to cancel subscription: {str(e)}') from e

    @staticmethod
    @transaction.atomic
    def update_subscription(user, new_tier: SubscriptionTier, billing_interval: str = None) -> dict[str, Any]:
        """
        Update a user's subscription to a different tier.

        Args:
            user: Django User instance
            new_tier: SubscriptionTier instance to switch to
            billing_interval: Optional 'monthly' or 'annual'. If None, keeps current interval.

        Returns:
            Dict with update details

        Raises:
            StripeServiceError: If update fails
        """
        try:
            # Lock the subscription record to prevent concurrent updates
            user_subscription = UserSubscription.objects.select_for_update().get(user=user)
            old_tier = user_subscription.tier

            if not user_subscription.stripe_subscription_id:
                raise StripeServiceError('No active Stripe subscription found')

            # Retrieve current subscription to determine billing interval
            stripe_subscription = stripe.Subscription.retrieve(user_subscription.stripe_subscription_id)
            current_price_id = stripe_subscription['items']['data'][0]['price']['id']

            # Determine billing interval (use current if not specified)
            if billing_interval is None:
                # Detect current interval from price ID
                if current_price_id == old_tier.stripe_price_id_annual:
                    billing_interval = 'annual'
                else:
                    billing_interval = 'monthly'

            # Get the appropriate Stripe price ID for new tier
            stripe_price_id = (
                new_tier.stripe_price_id_annual if billing_interval == 'annual' else new_tier.stripe_price_id_monthly
            )

            if not stripe_price_id:
                raise StripeServiceError(
                    f"Tier {new_tier.name} doesn't have a Stripe price configured for {billing_interval} billing"
                )

            # Update the subscription item
            stripe.Subscription.modify(
                user_subscription.stripe_subscription_id,
                items=[
                    {
                        'id': stripe_subscription['items']['data'][0].id,
                        'price': stripe_price_id,
                    }
                ],
                proration_behavior='create_prorations',  # Pro-rate the difference
                metadata={
                    'tier_slug': new_tier.slug,
                },
            )

            # Update local subscription
            user_subscription.tier = new_tier
            user_subscription.save()

            # Determine change type
            if new_tier.price_monthly > old_tier.price_monthly:
                change_type = 'upgraded'
            elif new_tier.price_monthly < old_tier.price_monthly:
                change_type = 'downgraded'
            else:
                change_type = 'reactivated'

            # Log subscription change
            SubscriptionChange.objects.create(
                user=user,
                subscription=user_subscription,
                change_type=change_type,
                from_tier=old_tier,
                to_tier=new_tier,
                reason=f'User changed from {old_tier.name} to {new_tier.name}',
            )

            logger.info(
                f'Updated subscription {user_subscription.stripe_subscription_id} '
                f'from {old_tier.slug} to {new_tier.slug}'
            )

            return {
                'subscription_id': user_subscription.stripe_subscription_id,
                'from_tier': old_tier.name,
                'to_tier': new_tier.name,
                'change_type': change_type,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to update subscription for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to update subscription: {str(e)}') from e

    # ===== Token Purchase (One-time Payments) =====

    @staticmethod
    @transaction.atomic
    def create_token_purchase(user, package: TokenPackage) -> dict[str, Any]:
        """
        Create a payment intent for token package purchase.

        Args:
            user: Django User instance
            package: TokenPackage instance

        Returns:
            Dict with payment intent details and client_secret

        Raises:
            StripeServiceError: If payment intent creation fails
        """
        try:
            # Get or create Stripe customer
            customer_id = StripeService.get_or_create_customer(user)

            # Generate idempotency key to prevent duplicate charges on retry
            # Format: token_purchase_{user_id}_{package_id}_{date}
            idempotency_key = f'token_purchase_{user.id}_{package.id}_{timezone.now().strftime("%Y%m%d")}'

            # Create payment intent (use Decimal for accurate currency conversion)
            from decimal import Decimal

            amount_cents = int((package.price * Decimal('100')).quantize(Decimal('1')))

            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='usd',
                customer=customer_id,
                metadata={
                    'user_id': user.id,
                    'package_slug': package.slug,
                    'token_amount': package.token_amount,
                },
                description=f'{package.name} - {package.token_amount:,} tokens',
                idempotency_key=idempotency_key,  # Prevents duplicate charges
            )

            # Create TokenPurchase record
            purchase = TokenPurchase.objects.create(
                user=user,
                package=package,
                token_amount=package.token_amount,
                price_paid=package.price,
                status='pending',
                stripe_payment_intent_id=payment_intent.id,
            )

            logger.info(f'Created payment intent {payment_intent.id} for user {user.id} to purchase {package.name}')

            return {
                'payment_intent_id': payment_intent.id,
                'client_secret': payment_intent.client_secret,
                'amount': package.price,
                'token_amount': package.token_amount,
                'purchase_id': purchase.id,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create payment intent for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to create payment intent: {str(e)}') from e

    # ===== Product & Price Syncing =====

    @staticmethod
    def sync_subscription_tier_to_stripe(tier: SubscriptionTier) -> SubscriptionTier:
        """
        Create or update a Stripe product and price for a subscription tier.

        Args:
            tier: SubscriptionTier instance

        Returns:
            Updated SubscriptionTier instance

        Raises:
            StripeServiceError: If sync fails
        """
        try:
            # Skip free tier
            if tier.price_monthly == 0 and tier.price_annual == 0:
                logger.info(f'Skipping Stripe sync for free tier: {tier.name}')
                return tier

            # Create or update product
            if tier.stripe_product_id:
                # Update existing product
                product = stripe.Product.modify(
                    tier.stripe_product_id,
                    name=tier.name,
                    description=tier.description,
                    metadata={'tier_type': tier.tier_type},
                )
            else:
                # Create new product
                product = stripe.Product.create(
                    name=tier.name, description=tier.description, metadata={'tier_type': tier.tier_type}
                )
                tier.stripe_product_id = product.id

            # Create monthly price (prices are immutable, so always create new)
            if tier.price_monthly > 0:
                monthly_price = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(tier.price_monthly * 100),  # Convert to cents
                    currency='usd',
                    recurring={'interval': 'month'},
                    metadata={'tier_type': tier.tier_type, 'billing_period': 'monthly'},
                )
                tier.stripe_price_id_monthly = monthly_price.id

            # Create annual price (prices are immutable, so always create new)
            if tier.price_annual > 0:
                annual_price = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(tier.price_annual * 100),  # Convert to cents
                    currency='usd',
                    recurring={'interval': 'year'},
                    metadata={'tier_type': tier.tier_type, 'billing_period': 'annual'},
                )
                tier.stripe_price_id_annual = annual_price.id

            tier.save()

            logger.info(
                f'Synced tier {tier.name} to Stripe: product={product.id}, '
                f'monthly_price={tier.stripe_price_id_monthly}, annual_price={tier.stripe_price_id_annual}'
            )

            return tier

        except stripe.error.StripeError as e:
            logger.error(f'Failed to sync tier {tier.slug} to Stripe: {e}')
            raise StripeServiceError(f'Failed to sync tier to Stripe: {str(e)}') from e

    @staticmethod
    def sync_token_package_to_stripe(package: TokenPackage) -> TokenPackage:
        """
        Create or update a Stripe product and price for a token package.

        Args:
            package: TokenPackage instance

        Returns:
            Updated TokenPackage instance

        Raises:
            StripeServiceError: If sync fails
        """
        try:
            # Create or update product
            if package.stripe_product_id:
                # Update existing product
                product = stripe.Product.modify(
                    package.stripe_product_id,
                    name=f'{package.name} Token Package',
                    description=package.description,
                    metadata={'package_type': package.package_type},
                )
            else:
                # Create new product
                product = stripe.Product.create(
                    name=f'{package.name} Token Package',
                    description=package.description,
                    metadata={'package_type': package.package_type},
                )
                package.stripe_product_id = product.id

            # Create price (one-time payment)
            price = stripe.Price.create(
                product=product.id,
                unit_amount=int(package.price * 100),  # Convert to cents
                currency='usd',
                metadata={'package_type': package.package_type},
            )
            package.stripe_price_id = price.id

            package.save()

            logger.info(f'Synced package {package.name} to Stripe: product={product.id}, price={price.id}')

            return package

        except stripe.error.StripeError as e:
            logger.error(f'Failed to sync package {package.slug} to Stripe: {e}')
            raise StripeServiceError(f'Failed to sync package to Stripe: {str(e)}') from e

    # ===== Customer Portal & Invoices =====

    @staticmethod
    def create_customer_portal_session(user, return_url: str = None) -> dict[str, Any]:
        """
        Create a Stripe Customer Portal session for managing billing.

        The Customer Portal allows users to update payment methods,
        view invoices, and manage their subscription.

        Args:
            user: Django User instance
            return_url: URL to redirect to after portal session (optional)

        Returns:
            Dict with portal session URL

        Raises:
            StripeServiceError: If portal session creation fails
        """
        try:
            subscription = UserSubscription.objects.filter(user=user).first()
            if not subscription or not subscription.stripe_customer_id:
                raise StripeServiceError('No Stripe customer found')

            if not return_url:
                return_url = f'{settings.FRONTEND_URL}/account/settings/billing'

            session = stripe.billing_portal.Session.create(
                customer=subscription.stripe_customer_id,
                return_url=return_url,
            )

            logger.info(f'Created portal session for user {user.id}')
            return {'url': session.url}

        except stripe.error.StripeError as e:
            logger.error(f'Failed to create portal session for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to create portal session: {str(e)}') from e

    @staticmethod
    def list_invoices(user, limit: int = 10) -> dict[str, Any]:
        """
        List invoices from Stripe for a user.

        Args:
            user: Django User instance
            limit: Maximum number of invoices to return (1-100)

        Returns:
            Dict with list of invoices and has_more flag

        Raises:
            StripeServiceError: If invoice retrieval fails
        """
        try:
            subscription = UserSubscription.objects.filter(user=user).first()
            if not subscription or not subscription.stripe_customer_id:
                return {'invoices': [], 'has_more': False}

            invoices = stripe.Invoice.list(
                customer=subscription.stripe_customer_id,
                limit=min(100, max(1, limit)),
            )

            logger.info(f'Retrieved {len(invoices.data)} invoices for user {user.id}')

            return {
                'invoices': [
                    {
                        'id': inv.id,
                        'number': inv.number,
                        'amount_paid': inv.amount_paid,
                        'currency': inv.currency,
                        'status': inv.status,
                        'created': inv.created,
                        'invoice_pdf': inv.invoice_pdf,
                        'hosted_invoice_url': inv.hosted_invoice_url,
                    }
                    for inv in invoices.data
                ],
                'has_more': invoices.has_more,
            }

        except stripe.error.StripeError as e:
            logger.error(f'Failed to list invoices for user {user.id}: {e}')
            raise StripeServiceError(f'Failed to list invoices: {str(e)}') from e

    # ===== Webhook Handling =====

    @staticmethod
    def verify_webhook_signature(payload: bytes, sig_header: str) -> stripe.Event:
        """
        Verify Stripe webhook signature and construct event.

        Args:
            payload: Raw request body
            sig_header: Stripe-Signature header

        Returns:
            Verified Stripe Event

        Raises:
            StripeServiceError: If signature verification fails
        """
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
            return event
        except ValueError as e:
            logger.error(f'Invalid webhook payload: {e}')
            raise StripeServiceError('Invalid payload') from e
        except stripe.error.SignatureVerificationError as e:
            logger.error(f'Invalid webhook signature: {e}')
            raise StripeServiceError('Invalid signature') from e

    @staticmethod
    @transaction.atomic
    def handle_subscription_updated(event_data: dict[str, Any]) -> None:
        """
        Handle subscription.updated webhook event.

        Updates local subscription status to match Stripe.
        """
        stripe_subscription = event_data['object']
        subscription_id = stripe_subscription['id']

        try:
            user_subscription = UserSubscription.objects.get(stripe_subscription_id=subscription_id)

            # Update status
            user_subscription.status = stripe_subscription['status']
            user_subscription.current_period_start = timezone.datetime.fromtimestamp(
                stripe_subscription['current_period_start'], tz=UTC
            )
            user_subscription.current_period_end = timezone.datetime.fromtimestamp(
                stripe_subscription['current_period_end'], tz=UTC
            )

            # Sync cancel_at_period_end from Stripe
            user_subscription.cancel_at_period_end = stripe_subscription.get('cancel_at_period_end', False)

            user_subscription.save()

            logger.info(f'Updated subscription {subscription_id} from webhook')

        except UserSubscription.DoesNotExist:
            logger.warning(f'Received webhook for unknown subscription: {subscription_id}')

    @staticmethod
    @transaction.atomic
    def handle_payment_intent_succeeded(event_data: dict[str, Any]) -> None:
        """
        Handle payment_intent.succeeded webhook event.

        Completes token purchase and adds tokens to user balance.
        """
        payment_intent = event_data['object']
        payment_intent_id = payment_intent['id']

        try:
            purchase = TokenPurchase.objects.get(stripe_payment_intent_id=payment_intent_id)

            # Mark purchase as completed (this adds tokens via signal)
            purchase.stripe_charge_id = payment_intent.get('latest_charge')
            purchase.mark_completed()

            logger.info(f'Completed token purchase {purchase.id} for user {purchase.user.id}')

        except TokenPurchase.DoesNotExist:
            logger.warning(f'Received webhook for unknown payment intent: {payment_intent_id}')

    @staticmethod
    @transaction.atomic
    def handle_subscription_deleted(event_data: dict[str, Any]) -> None:
        """
        Handle subscription.deleted webhook event.

        Downgrades user to free tier.
        """
        stripe_subscription = event_data['object']
        subscription_id = stripe_subscription['id']

        try:
            user_subscription = UserSubscription.objects.get(stripe_subscription_id=subscription_id)

            # Downgrade to free tier
            free_tier = SubscriptionTier.objects.get(tier_type='free')
            old_tier = user_subscription.tier

            user_subscription.tier = free_tier
            user_subscription.status = 'canceled'
            user_subscription.save()

            # Log change
            SubscriptionChange.objects.create(
                user=user_subscription.user,
                subscription=user_subscription,
                change_type='canceled',
                from_tier=old_tier,
                to_tier=free_tier,
                reason='Subscription canceled via Stripe',
            )

            logger.info(f'Downgraded user {user_subscription.user.id} to free tier due to subscription deletion')

        except UserSubscription.DoesNotExist:
            logger.warning(f'Received webhook for unknown subscription: {subscription_id}')
