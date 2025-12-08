"""
Billing Utility Functions

Helper functions for billing operations, permissions, and token management.
"""

import logging

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from core.logging_utils import StructuredLogger

from .models import (
    SubscriptionTier,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
)

logger = logging.getLogger(__name__)


# Transient errors that should be retried
TRANSIENT_ERRORS = (ConnectionError, TimeoutError)


def get_user_subscription(user) -> UserSubscription | None:
    """
    Get a user's subscription.

    Args:
        user: Django User instance

    Returns:
        UserSubscription or None
    """
    try:
        return UserSubscription.objects.select_related('tier').get(user=user)
    except UserSubscription.DoesNotExist:
        return None


def get_or_create_token_balance(user) -> UserTokenBalance:
    """
    Get or create a user's token balance.

    Args:
        user: Django User instance

    Returns:
        UserTokenBalance instance
    """
    balance, created = UserTokenBalance.objects.get_or_create(user=user, defaults={'balance': 0})
    if created:
        logger.info(f'Created token balance for user {user.id}')
    return balance


def can_access_feature(user, feature: str) -> bool:
    """
    Check if a user's subscription tier allows access to a feature.

    Args:
        user: Django User instance
        feature: Feature name (e.g., 'marketplace', 'go1_courses', 'ai_mentor')

    Returns:
        True if user has access, False otherwise
    """
    subscription = get_user_subscription(user)
    if not subscription or not subscription.is_active:
        # Use free tier limits if no active subscription
        try:
            subscription = UserSubscription.objects.get(user=user)
        except UserSubscription.DoesNotExist:
            return False

    feature_map = {
        'marketplace': 'has_marketplace_access',
        'go1_courses': 'has_go1_courses',
        'ai_mentor': 'has_ai_mentor',
        'quests': 'has_quests',
        'circles': 'has_circles',
        'projects': 'has_projects',
        'creator_tools': 'has_creator_tools',
        'analytics': 'has_analytics',
    }

    if feature not in feature_map:
        StructuredLogger.log_validation_error(
            message='Unknown feature check requested',
            user=user,
            errors={'feature': f'Unknown feature: {feature}'},
            logger_instance=logger,
        )
        return False

    return getattr(subscription.tier, feature_map[feature], False)


def can_make_ai_request(user) -> tuple[bool, str]:
    """
    Check if a user can make an AI request (read-only check).

    Checks both subscription limits and token balance.
    NOTE: This is a non-atomic read. For actual deduction, use
    check_and_reserve_ai_request() which is atomic.

    Args:
        user: Django User instance

    Returns:
        Tuple of (can_make_request: bool, reason: str)
    """
    subscription = get_user_subscription(user)
    if not subscription:
        return False, 'No subscription found'

    # Check if we need to reset the monthly counter (don't mutate here, just check)
    can_use_subscription = _check_subscription_quota(subscription)
    if can_use_subscription:
        return True, 'Within subscription limit'

    # Check token balance as fallback
    token_balance = get_or_create_token_balance(user)
    if token_balance.balance > 0:
        return True, 'Using token balance'

    return False, 'AI request limit exceeded and no tokens available'


def _check_subscription_quota(subscription: UserSubscription) -> bool:
    """
    Check if subscription has remaining AI requests (read-only).

    Does NOT reset the counter - that should be done by a scheduled task.
    """
    # 0 means unlimited
    if subscription.tier.monthly_ai_requests == 0:
        return True

    return subscription.ai_requests_used_this_month < subscription.tier.monthly_ai_requests


def check_and_reserve_ai_request(user) -> tuple[bool, str]:
    """
    Atomically check AND reserve an AI request slot.

    This prevents TOCTOU race conditions by combining the check and
    deduction into a single atomic database operation.

    Args:
        user: Django User instance

    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        with transaction.atomic():
            # Lock the subscription row to prevent concurrent modifications
            try:
                subscription = UserSubscription.objects.select_for_update().get(user=user)
            except UserSubscription.DoesNotExist:
                return False, 'No subscription found'

            # Check and reset monthly counter if needed
            today = timezone.now().date()
            if subscription.ai_requests_reset_date and subscription.ai_requests_reset_date < today:
                # Reset the counter atomically
                subscription.ai_requests_used_this_month = 0
                subscription.ai_requests_reset_date = today
                subscription.save(update_fields=['ai_requests_used_this_month', 'ai_requests_reset_date'])

            # Check if within subscription limit (0 = unlimited)
            if subscription.tier.monthly_ai_requests == 0:
                # Unlimited - still increment for tracking purposes
                UserSubscription.objects.filter(pk=subscription.pk).update(
                    ai_requests_used_this_month=F('ai_requests_used_this_month') + 1
                )
                return True, 'Reserved from subscription (unlimited)'

            if subscription.ai_requests_used_this_month < subscription.tier.monthly_ai_requests:
                # Has remaining quota - atomically increment
                UserSubscription.objects.filter(pk=subscription.pk).update(
                    ai_requests_used_this_month=F('ai_requests_used_this_month') + 1
                )
                return True, 'Reserved from subscription quota'

            # Subscription quota exhausted - try token balance
            try:
                token_balance = UserTokenBalance.objects.select_for_update().get(user=user)
            except UserTokenBalance.DoesNotExist:
                return False, 'AI request limit exceeded and no tokens available'

            if token_balance.balance > 0:
                # Has tokens - we'll deduct actual amount after processing
                return True, 'Will use token balance'

            return False, 'AI request limit exceeded and no tokens available'

    except Exception as e:
        StructuredLogger.log_error(
            message='Error in check_and_reserve_ai_request',
            error=e,
            user=user,
            logger_instance=logger,
        )
        return False, f'Error checking quota: {str(e)}'


def deduct_ai_request_from_subscription(user) -> bool:
    """
    Deduct one AI request from user's monthly allowance using atomic increment.

    Uses Django F() expressions to prevent race conditions when multiple
    concurrent requests try to increment the counter simultaneously.

    Args:
        user: Django User instance

    Returns:
        True if deducted successfully, False otherwise
    """
    try:
        with transaction.atomic():
            subscription = UserSubscription.objects.select_for_update().get(user=user)

            # Check if can make request
            if not subscription.can_make_ai_request():
                return False

            # Atomically increment counter using F() expression
            # This prevents race conditions from concurrent requests
            UserSubscription.objects.filter(pk=subscription.pk).update(
                ai_requests_used_this_month=F('ai_requests_used_this_month') + 1
            )

            # Refresh from database to get updated value for logging
            subscription.refresh_from_db()

            logger.debug(
                f'Deducted AI request from user {user.id} subscription '
                f'({subscription.ai_requests_used_this_month}/{subscription.tier.monthly_ai_requests})'
            )

            return True

    except UserSubscription.DoesNotExist:
        StructuredLogger.log_validation_error(
            message='No subscription found for AI request deduction',
            user=user,
            errors={'subscription': 'User has no subscription'},
            logger_instance=logger,
        )
        return False


def deduct_tokens(user, amount: int, description: str = '', ai_provider: str = '', ai_model: str = '') -> bool:
    """
    Deduct tokens from user's balance atomically.

    Uses select_for_update to prevent race conditions where multiple
    concurrent requests could overdraw the balance.

    Args:
        user: Django User instance
        amount: Number of tokens to deduct
        description: Description of what tokens were used for
        ai_provider: AI provider name (e.g., 'openai', 'anthropic')
        ai_model: AI model name (e.g., 'gpt-4', 'claude-3')

    Returns:
        True if deducted successfully, False otherwise
    """
    try:
        with transaction.atomic():
            # Lock the token balance row to prevent concurrent modifications
            try:
                token_balance = UserTokenBalance.objects.select_for_update().get(user=user)
            except UserTokenBalance.DoesNotExist:
                # Create balance if doesn't exist (unlikely but handle it)
                token_balance, _ = UserTokenBalance.objects.get_or_create(user=user, defaults={'balance': 0})
                token_balance = UserTokenBalance.objects.select_for_update().get(user=user)

            # Check if sufficient balance (while holding lock)
            if token_balance.balance < amount:
                StructuredLogger.log_service_operation(
                    service_name='TokenBalance',
                    operation='deduct_tokens',
                    user=user,
                    success=False,
                    metadata={'needed': amount, 'balance': token_balance.balance},
                    logger_instance=logger,
                )
                return False

            # Atomically deduct tokens using F() expression
            UserTokenBalance.objects.filter(pk=token_balance.pk).update(
                balance=F('balance') - amount,
                total_used=F('total_used') + amount,
            )

            # Get updated balance for logging
            token_balance.refresh_from_db()

            # Log transaction
            TokenTransaction.objects.create(
                user=user,
                transaction_type='usage',
                amount=-amount,  # Negative for deduction
                balance_after=token_balance.balance,
                description=description or f'Used {amount} tokens',
                ai_provider=ai_provider,
                ai_model=ai_model,
            )

            logger.info(f'Deducted {amount} tokens from user {user.id} (balance: {token_balance.balance})')

            # Trigger low balance notification if needed (async via Celery)
            _check_and_notify_low_balance(user.id, amount, token_balance.balance)

            return True

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to deduct tokens',
            error=e,
            user=user,
            extra={'amount': amount},
            logger_instance=logger,
        )
        return False


# Token balance thresholds for alerts (imported from tasks to keep consistent)
LOW_BALANCE_THRESHOLD = 5000
CRITICAL_BALANCE_THRESHOLD = 1000
ZERO_BALANCE_THRESHOLD = 100


def _check_and_notify_low_balance(user_id: int, tokens_used: int, balance_after: int):
    """
    Check if balance has dropped below threshold and trigger notification.

    This is called after each token deduction to provide real-time alerts.

    Args:
        user_id: User ID
        tokens_used: Number of tokens just used
        balance_after: Token balance after deduction
    """
    # Only notify if balance dropped below a threshold
    if balance_after >= LOW_BALANCE_THRESHOLD:
        return

    try:
        # Import here to avoid circular imports
        from core.billing.tasks import send_token_usage_notification_task

        # Queue async notification task
        send_token_usage_notification_task.delay(user_id, tokens_used, balance_after)
        logger.debug(f'Queued low balance notification for user {user_id} (balance: {balance_after})')
    except Exception as e:
        # Don't fail the main operation if notification fails
        StructuredLogger.log_error(
            message='Failed to queue low balance notification',
            error=e,
            extra={'user_id': user_id, 'balance_after': balance_after},
            level='warning',
            logger_instance=logger,
        )


def process_ai_request(user, tokens_used: int, ai_provider: str = '', ai_model: str = '') -> tuple[bool, str]:
    """
    Process an AI request, handling both subscription limits and token usage.

    This is the main function to call when a user makes an AI request.

    Args:
        user: Django User instance
        tokens_used: Number of tokens consumed by the request
        ai_provider: AI provider name
        ai_model: AI model name

    Returns:
        Tuple of (success: bool, message: str)
    """
    subscription = get_user_subscription(user)
    if not subscription:
        return False, 'No subscription found'

    # First, try to use subscription allowance
    if subscription.can_make_ai_request():
        if deduct_ai_request_from_subscription(user):
            logger.info(f'AI request processed for user {user.id} using subscription allowance')
            return True, 'Request processed using subscription'

    # If subscription limit reached, try to use tokens
    token_balance = get_or_create_token_balance(user)
    if token_balance.has_sufficient_balance(tokens_used):
        if deduct_tokens(
            user,
            tokens_used,
            description=f'AI request via {ai_provider} {ai_model}',
            ai_provider=ai_provider,
            ai_model=ai_model,
        ):
            logger.info(f'AI request processed for user {user.id} using {tokens_used} tokens')
            return True, f'Request processed using {tokens_used} tokens'

    return False, 'AI request limit exceeded and insufficient tokens'


def get_subscription_status(user) -> dict:
    """
    Get detailed subscription status for a user.

    Args:
        user: Django User instance

    Returns:
        Dict with subscription details
    """
    subscription = get_user_subscription(user)
    token_balance = get_or_create_token_balance(user)

    if not subscription:
        return {
            'has_subscription': False,
            'tier': 'none',
            'status': 'none',
        }

    # Calculate AI requests remaining
    ai_requests_remaining = 0
    if subscription.tier.monthly_ai_requests > 0:
        ai_requests_remaining = max(0, subscription.tier.monthly_ai_requests - subscription.ai_requests_used_this_month)

    # Check if user has a Stripe customer for billing management
    has_stripe_customer = bool(subscription.stripe_customer_id)

    return {
        'has_subscription': True,
        'has_stripe_customer': has_stripe_customer,
        'tier': {
            'name': subscription.tier.name,
            'slug': subscription.tier.slug,
            'price_monthly': float(subscription.tier.price_monthly),
            'price_annual': float(subscription.tier.price_annual),
        },
        'status': subscription.status,
        'is_active': subscription.is_active,
        'is_trial': subscription.is_trial,
        'current_period_start': subscription.current_period_start,
        'current_period_end': subscription.current_period_end,
        'cancel_at_period_end': subscription.cancel_at_period_end,
        'trial_end': subscription.trial_end,
        'ai_requests': {
            'limit': subscription.tier.monthly_ai_requests,
            'used': subscription.ai_requests_used_this_month,
            'remaining': ai_requests_remaining,
            'reset_date': subscription.ai_requests_reset_date,
        },
        'tokens': {
            'balance': token_balance.balance,
            'total_purchased': token_balance.total_purchased,
            'total_used': token_balance.total_used,
        },
        'features': {
            'marketplace': subscription.tier.has_marketplace_access,
            'go1_courses': subscription.tier.has_go1_courses,
            'ai_mentor': subscription.tier.has_ai_mentor,
            'quests': subscription.tier.has_quests,
            'circles': subscription.tier.has_circles,
            'projects': subscription.tier.has_projects,
            'creator_tools': subscription.tier.has_creator_tools,
            'analytics': subscription.tier.has_analytics,
        },
    }


def get_available_tiers() -> list:
    """
    Get all active subscription tiers.

    Returns:
        List of tier dicts with details
    """
    tiers = SubscriptionTier.objects.filter(is_active=True).order_by('display_order')

    return [
        {
            'slug': tier.slug,
            'name': tier.name,
            'description': tier.description,
            'tier_type': tier.tier_type,
            'price_monthly': float(tier.price_monthly),
            'price_annual': float(tier.price_annual),
            'trial_period_days': tier.trial_period_days,
            'monthly_ai_requests': tier.monthly_ai_requests,
            'features': {
                'marketplace': tier.has_marketplace_access,
                'go1_courses': tier.has_go1_courses,
                'ai_mentor': tier.has_ai_mentor,
                'quests': tier.has_quests,
                'circles': tier.has_circles,
                'projects': tier.has_projects,
                'creator_tools': tier.has_creator_tools,
                'analytics': tier.has_analytics,
            },
        }
        for tier in tiers
    ]
