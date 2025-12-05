"""
Account Management Service

Handles account-level operations like deactivation and deletion,
including proper cleanup of billing subscriptions and user data.
"""

import logging
from typing import Any

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from core.billing.models import UserSubscription

logger = logging.getLogger(__name__)
User = get_user_model()

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class AccountManagementError(Exception):
    """Base exception for account management errors."""

    pass


class AccountManagementService:
    """Service for managing user account lifecycle."""

    @staticmethod
    @transaction.atomic
    def deactivate_account(user) -> dict[str, Any]:
        """
        Deactivate a user account (soft delete).

        - Marks user as inactive
        - Cancels active subscription (at period end)
        - Keeps all data for potential reactivation

        Args:
            user: Django User instance

        Returns:
            Dict with deactivation details

        Raises:
            AccountManagementError: If deactivation fails
        """
        try:
            # Check if user is already inactive
            if not user.is_active:
                raise AccountManagementError('Account is already deactivated')

            # Cancel subscription at period end (if exists)
            subscription = UserSubscription.objects.filter(user=user).first()
            if subscription and subscription.stripe_subscription_id and subscription.is_active:
                try:
                    stripe.Subscription.modify(subscription.stripe_subscription_id, cancel_at_period_end=True)
                    subscription.cancel_at_period_end = True
                    subscription.save()
                    logger.info(f'Scheduled subscription cancellation for user {user.id}')
                except stripe.error.StripeError as e:
                    logger.warning(f'Failed to cancel subscription for user {user.id}: {e}')
                    # Continue with deactivation even if subscription cancel fails

            # Deactivate user account
            user.is_active = False
            user.save()

            logger.info(f'Deactivated account for user {user.id} ({user.email})')

            return {
                'success': True,
                'message': 'Account deactivated successfully',
                'subscription_canceled': subscription.cancel_at_period_end if subscription else False,
            }

        except Exception as e:
            logger.error(f'Failed to deactivate account for user {user.id}: {e}')
            raise AccountManagementError(f'Failed to deactivate account: {str(e)}') from e

    @staticmethod
    @transaction.atomic
    def delete_account(user) -> dict[str, Any]:
        """
        Permanently delete a user account.

        - Cancels active subscription immediately
        - Deletes Stripe customer
        - Permanently deletes user and all related data

        WARNING: This is irreversible. All user data will be permanently deleted.

        Args:
            user: Django User instance

        Returns:
            Dict with deletion details

        Raises:
            AccountManagementError: If deletion fails
        """
        try:
            user_id = user.id
            user_email = user.email

            # 1. Cancel Stripe subscription immediately (if exists)
            subscription = UserSubscription.objects.filter(user=user).first()
            stripe_customer_id = None

            if subscription:
                stripe_customer_id = subscription.stripe_customer_id

                # Cancel subscription immediately
                if subscription.stripe_subscription_id:
                    try:
                        stripe.Subscription.delete(subscription.stripe_subscription_id)
                        logger.info(f'Canceled Stripe subscription for user {user_id}')
                    except stripe.error.StripeError as e:
                        logger.warning(f'Failed to cancel Stripe subscription for user {user_id}: {e}')
                        # Continue with deletion even if subscription cancel fails

            # 2. Delete Stripe customer (if exists)
            if stripe_customer_id:
                try:
                    stripe.Customer.delete(stripe_customer_id)
                    logger.info(f'Deleted Stripe customer {stripe_customer_id} for user {user_id}')
                except stripe.error.StripeError as e:
                    logger.warning(f'Failed to delete Stripe customer for user {user_id}: {e}')
                    # Continue with deletion

            # 3. Delete user account
            # Django will CASCADE delete all related records based on model relationships:
            # - Projects, comments, likes (if CASCADE)
            # - Achievements, notifications
            # - Thrive Circle memberships
            # - etc.
            user.delete()

            logger.info(f'Permanently deleted account for user {user_id} ({user_email})')

            return {
                'success': True,
                'message': 'Account deleted permanently',
                'user_id': user_id,
                'email': user_email,
            }

        except Exception as e:
            logger.error(f'Failed to delete account for user {user.id}: {e}')
            raise AccountManagementError(f'Failed to delete account: {str(e)}') from e

    @staticmethod
    def can_delete_account(user) -> tuple[bool, str]:
        """
        Check if account can be deleted.

        Add any business logic checks here (e.g., pending payments, active projects, etc.)

        Args:
            user: Django User instance

        Returns:
            Tuple of (can_delete, reason_if_not)
        """
        # Check for pending payments or other blockers
        subscription = UserSubscription.objects.filter(user=user).first()

        if subscription and subscription.status == 'past_due':
            return False, 'Account has past due payments. Please resolve billing issues first.'

        # Add other checks as needed
        # For example: active team memberships, pending payouts, etc.

        return True, ''
