"""
Credit Pack Service

Business logic for managing credit pack subscriptions and balances.
Credit packs are optional add-ons separate from subscription tiers.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F

from core.logging_utils import StructuredLogger

from .models import CreditPack, TokenTransaction, UserCreditPackSubscription, UserTokenBalance
from .utils import get_or_create_token_balance, is_beta_mode

logger = logging.getLogger(__name__)


def is_credit_pack_enforcement_enabled():
    """Check if credit pack enforcement is enabled."""
    return getattr(settings, 'CREDIT_PACK_ENFORCEMENT_ENABLED', False)


class CreditPackService:
    """Service for managing credit pack subscriptions and balances."""

    @staticmethod
    def track_usage(user, tokens_used: int, ai_provider: str = '', ai_model: str = ''):
        """
        Track credit usage for analytics - ALWAYS called, even in beta mode.

        This logs what the user WOULD have used if enforcement was enabled.
        Does NOT deduct from the actual balance.

        Args:
            user: Django User instance
            tokens_used: Number of tokens/credits used
            ai_provider: AI provider name (e.g., 'openai', 'anthropic')
            ai_model: AI model name (e.g., 'gpt-4', 'claude-3')
        """
        try:
            balance = get_or_create_token_balance(user)

            # Log the usage (doesn't actually deduct)
            TokenTransaction.objects.create(
                user=user,
                transaction_type='credit_pack_usage_tracked',
                amount=-tokens_used,
                balance_after=balance.credit_pack_balance,  # Current balance (not deducted)
                description=f'Tracked usage: {ai_provider} {ai_model}'.strip(),
                ai_provider=ai_provider,
                ai_model=ai_model,
            )

            StructuredLogger.log_service_operation(
                service_name='CreditPackService',
                operation='track_usage',
                user=user,
                success=True,
                metadata={
                    'tokens_used': tokens_used,
                    'enforcement_enabled': is_credit_pack_enforcement_enabled(),
                    'beta_mode': is_beta_mode(),
                },
                logger_instance=logger,
            )

        except Exception as e:
            # Don't fail the main operation if tracking fails
            StructuredLogger.log_error(
                message='Failed to track credit pack usage',
                error=e,
                user=user,
                extra={'tokens_used': tokens_used},
                level='warning',
                logger_instance=logger,
            )

    @staticmethod
    def deduct_credits(user, amount: int, description: str = '', ai_provider: str = '', ai_model: str = '') -> bool:
        """
        Actually deduct credits from credit pack balance.

        Only called when enforcement is enabled (CREDIT_PACK_ENFORCEMENT_ENABLED=True
        AND BETA_MODE=False).

        Args:
            user: Django User instance
            amount: Number of credits to deduct
            description: Description of the deduction
            ai_provider: AI provider name
            ai_model: AI model name

        Returns:
            True if deduction successful, False if insufficient credits
        """
        try:
            with transaction.atomic():
                # Lock the token balance row
                try:
                    balance = UserTokenBalance.objects.select_for_update().get(user=user)
                except UserTokenBalance.DoesNotExist:
                    balance = UserTokenBalance.objects.create(user=user, balance=0, credit_pack_balance=0)
                    balance = UserTokenBalance.objects.select_for_update().get(user=user)

                if balance.credit_pack_balance < amount:
                    StructuredLogger.log_service_operation(
                        service_name='CreditPackService',
                        operation='deduct_credits',
                        user=user,
                        success=False,
                        metadata={
                            'amount_needed': amount,
                            'balance_available': balance.credit_pack_balance,
                            'reason': 'insufficient_balance',
                        },
                        logger_instance=logger,
                    )
                    return False

                # Atomically deduct credits
                UserTokenBalance.objects.filter(pk=balance.pk).update(
                    credit_pack_balance=F('credit_pack_balance') - amount
                )

                # Get updated balance for logging
                balance.refresh_from_db()

                # Log transaction
                TokenTransaction.objects.create(
                    user=user,
                    transaction_type='credit_pack_usage',
                    amount=-amount,
                    balance_after=balance.credit_pack_balance,
                    description=description or f'Credit pack usage: {amount} credits',
                    ai_provider=ai_provider,
                    ai_model=ai_model,
                )

                StructuredLogger.log_service_operation(
                    service_name='CreditPackService',
                    operation='deduct_credits',
                    user=user,
                    success=True,
                    metadata={
                        'amount': amount,
                        'balance_after': balance.credit_pack_balance,
                    },
                    logger_instance=logger,
                )
                return True

        except Exception as e:
            # Critical failure - use alerting to catch systemic issues
            StructuredLogger.log_critical_failure(
                alert_type='credit_deduction_failure',
                message='Failed to deduct credit pack credits',
                error=e,
                user=user,
                metadata={
                    'amount': amount,
                    'ai_provider': ai_provider,
                    'ai_model': ai_model,
                    'description': description,
                },
                logger_instance=logger,
            )
            return False

    @staticmethod
    def grant_monthly_credits(user, credit_pack: CreditPack):
        """
        Grant monthly credits from credit pack subscription.

        Called by webhook handler when invoice.paid for credit pack.
        Uses select_for_update to prevent race conditions with concurrent grants.

        Args:
            user: Django User instance
            credit_pack: CreditPack instance
        """
        try:
            with transaction.atomic():
                # Lock the token balance to prevent concurrent grants
                balance, created = UserTokenBalance.objects.select_for_update().get_or_create(
                    user=user,
                    defaults={'balance': 0, 'credit_pack_balance': 0},
                )

                # Add credits to credit pack balance
                UserTokenBalance.objects.filter(pk=balance.pk).update(
                    credit_pack_balance=F('credit_pack_balance') + credit_pack.credits_per_month
                )

                balance.refresh_from_db()

                # Update subscription record (also lock to prevent race conditions)
                try:
                    sub = UserCreditPackSubscription.objects.select_for_update().get(user=user)
                    sub.credits_this_period = credit_pack.credits_per_month
                    sub.save(update_fields=['credits_this_period', 'updated_at'])
                except UserCreditPackSubscription.DoesNotExist:
                    pass  # Subscription might be created after this in webhook flow

                # Log transaction
                TokenTransaction.objects.create(
                    user=user,
                    transaction_type='credit_pack_grant',
                    amount=credit_pack.credits_per_month,
                    balance_after=balance.credit_pack_balance,
                    description=f'Monthly credit pack grant: {credit_pack.name}',
                )

                StructuredLogger.log_service_operation(
                    service_name='CreditPackService',
                    operation='grant_monthly_credits',
                    user=user,
                    success=True,
                    metadata={
                        'credits_granted': credit_pack.credits_per_month,
                        'credit_pack_name': credit_pack.name,
                        'balance_after': balance.credit_pack_balance,
                    },
                    logger_instance=logger,
                )

        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to grant monthly credits',
                error=e,
                user=user,
                extra={'credit_pack_id': credit_pack.id, 'credits': credit_pack.credits_per_month},
                logger_instance=logger,
            )
            raise

    @staticmethod
    def forfeit_credits(user):
        """
        Forfeit credit pack balance when subscription is cancelled.

        Credits are forfeited (not transferred to one-time token balance).
        Uses select_for_update to prevent race conditions.

        Args:
            user: Django User instance
        """
        try:
            with transaction.atomic():
                # Lock the balance to prevent concurrent modifications
                balance, created = UserTokenBalance.objects.select_for_update().get_or_create(
                    user=user,
                    defaults={'balance': 0, 'credit_pack_balance': 0},
                )

                if balance.credit_pack_balance > 0:
                    forfeited = balance.credit_pack_balance

                    # Set credit pack balance to 0
                    UserTokenBalance.objects.filter(pk=balance.pk).update(credit_pack_balance=0)

                    # Log forfeit transaction
                    TokenTransaction.objects.create(
                        user=user,
                        transaction_type='credit_pack_forfeit',
                        amount=-forfeited,
                        balance_after=0,
                        description='Credit pack subscription cancelled - credits forfeited',
                    )

                    StructuredLogger.log_service_operation(
                        service_name='CreditPackService',
                        operation='forfeit_credits',
                        user=user,
                        success=True,
                        metadata={'credits_forfeited': forfeited},
                        logger_instance=logger,
                    )

        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to forfeit credits',
                error=e,
                user=user,
                logger_instance=logger,
            )
            raise

    @staticmethod
    def subscribe(user, credit_pack: CreditPack):
        """
        Subscribe user to a credit pack.

        Creates Stripe subscription and local subscription record.

        Args:
            user: Django User instance
            credit_pack: CreditPack to subscribe to

        Returns:
            Stripe subscription object
        """
        from .services import StripeService

        stripe_service = StripeService()
        subscription = stripe_service.create_credit_pack_subscription(user, credit_pack)

        # Create or update subscription record
        sub, _ = UserCreditPackSubscription.objects.update_or_create(
            user=user,
            defaults={
                'credit_pack': credit_pack,
                'stripe_subscription_id': subscription.id,
                'status': 'active',
            },
        )

        StructuredLogger.log_service_operation(
            service_name='CreditPackService',
            operation='subscribe',
            user=user,
            success=True,
            metadata={'credit_pack_name': credit_pack.name, 'credit_pack_id': credit_pack.id},
            logger_instance=logger,
        )
        return subscription

    @staticmethod
    def change_pack(user, new_pack: CreditPack):
        """
        Change to a different credit pack.

        Proration is handled by Stripe.

        Args:
            user: Django User instance
            new_pack: New CreditPack to change to
        """
        from .services import StripeService

        try:
            sub = UserCreditPackSubscription.objects.get(user=user, status='active')
        except UserCreditPackSubscription.DoesNotExist as e:
            raise ValueError('No active credit pack subscription to change') from e

        stripe_service = StripeService()
        stripe_service.update_credit_pack_subscription(sub.stripe_subscription_id, new_pack)

        sub.credit_pack = new_pack
        sub.save(update_fields=['credit_pack', 'updated_at'])

        StructuredLogger.log_service_operation(
            service_name='CreditPackService',
            operation='change_pack',
            user=user,
            success=True,
            metadata={'new_credit_pack_name': new_pack.name, 'new_credit_pack_id': new_pack.id},
            logger_instance=logger,
        )

    @staticmethod
    def cancel(user):
        """
        Cancel credit pack subscription and forfeit credits.

        Args:
            user: Django User instance
        """
        from .services import StripeService

        try:
            sub = UserCreditPackSubscription.objects.get(user=user)
        except UserCreditPackSubscription.DoesNotExist as e:
            raise ValueError('No credit pack subscription to cancel') from e

        if sub.stripe_subscription_id:
            stripe_service = StripeService()
            stripe_service.cancel_credit_pack_subscription(sub.stripe_subscription_id)

        # Forfeit remaining credits
        CreditPackService.forfeit_credits(user)

        # Update subscription status
        sub.status = 'canceled'
        sub.credit_pack = None
        sub.stripe_subscription_id = ''
        sub.save()

        StructuredLogger.log_service_operation(
            service_name='CreditPackService',
            operation='cancel',
            user=user,
            success=True,
            logger_instance=logger,
        )

    @staticmethod
    def get_user_credit_pack_status(user) -> dict:
        """
        Get user's credit pack subscription status.

        Args:
            user: Django User instance

        Returns:
            Dict with credit pack subscription details
        """
        balance = get_or_create_token_balance(user)

        try:
            sub = UserCreditPackSubscription.objects.select_related('credit_pack').get(user=user)
            has_subscription = sub.status == 'active' and sub.credit_pack is not None

            return {
                'has_credit_pack': has_subscription,
                'credit_pack': {
                    'id': sub.credit_pack.id,
                    'name': sub.credit_pack.name,
                    'credits_per_month': sub.credit_pack.credits_per_month,
                    'price_cents': sub.credit_pack.price_cents,
                }
                if sub.credit_pack
                else None,
                'status': sub.status,
                'credit_pack_balance': balance.credit_pack_balance,
                'current_period_start': sub.current_period_start,
                'current_period_end': sub.current_period_end,
                'credits_this_period': sub.credits_this_period,
            }

        except UserCreditPackSubscription.DoesNotExist:
            return {
                'has_credit_pack': False,
                'credit_pack': None,
                'status': 'inactive',
                'credit_pack_balance': balance.credit_pack_balance,
                'current_period_start': None,
                'current_period_end': None,
                'credits_this_period': 0,
            }

    @staticmethod
    def has_sufficient_credits(user, amount: int) -> bool:
        """
        Check if user has sufficient credit pack credits.

        Args:
            user: Django User instance
            amount: Amount of credits needed

        Returns:
            True if user has enough credits
        """
        balance = get_or_create_token_balance(user)
        return balance.credit_pack_balance >= amount
