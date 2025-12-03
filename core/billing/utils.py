"""
Billing Utility Functions

Helper functions for billing operations, permissions, and token management.
"""

import logging

from .models import (
    SubscriptionTier,
    TokenTransaction,
    UserSubscription,
    UserTokenBalance,
)

logger = logging.getLogger(__name__)


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
        logger.warning(f'Unknown feature check: {feature}')
        return False

    return getattr(subscription.tier, feature_map[feature], False)


def can_make_ai_request(user) -> tuple[bool, str]:
    """
    Check if a user can make an AI request.

    Checks both subscription limits and token balance.

    Args:
        user: Django User instance

    Returns:
        Tuple of (can_make_request: bool, reason: str)
    """
    subscription = get_user_subscription(user)
    if not subscription:
        return False, 'No subscription found'

    # Check subscription AI request limit
    if subscription.can_make_ai_request():
        return True, 'Within subscription limit'

    # Check token balance as fallback
    token_balance = get_or_create_token_balance(user)
    if token_balance.balance > 0:
        return True, 'Using token balance'

    return False, 'AI request limit exceeded and no tokens available'


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
    from django.db.models import F

    try:
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
        logger.error(f'No subscription found for user {user.id}')
        return False


def deduct_tokens(user, amount: int, description: str = '', ai_provider: str = '', ai_model: str = '') -> bool:
    """
    Deduct tokens from user's balance.

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
        token_balance = get_or_create_token_balance(user)

        # Check if sufficient balance
        if not token_balance.has_sufficient_balance(amount):
            logger.warning(
                f'Insufficient token balance for user {user.id}: ' f'needed {amount}, has {token_balance.balance}'
            )
            return False

        # Deduct tokens
        token_balance.deduct_tokens(amount)

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

        logger.info(f'Deducted {amount} tokens from user {user.id} ' f'(balance: {token_balance.balance})')

        return True

    except Exception as e:
        logger.error(f'Failed to deduct tokens for user {user.id}: {e}')
        return False


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

    return {
        'has_subscription': True,
        'tier': {
            'name': subscription.tier.name,
            'slug': subscription.tier.slug,
            'price_monthly': float(subscription.tier.price_monthly),
            'price_annual': float(subscription.tier.price_annual),
        },
        'status': subscription.status,
        'is_active': subscription.is_active,
        'is_trial': subscription.is_trial,
        'current_period_end': subscription.current_period_end,
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
