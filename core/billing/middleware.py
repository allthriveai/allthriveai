"""
Billing Middleware

Adds subscription and billing context to all requests.
"""

import logging

from django.utils.deprecation import MiddlewareMixin

from .utils import get_or_create_token_balance, get_user_subscription

logger = logging.getLogger(__name__)


class BillingContextMiddleware(MiddlewareMixin):
    """
    Middleware that adds billing context to the request object.

    Adds:
    - request.subscription - User's subscription object
    - request.token_balance - User's token balance object
    - request.billing - Dictionary with billing info

    This makes it easy to check billing status in any view:
        if request.subscription.tier.has_marketplace_access:
            # Show marketplace
    """

    def process_request(self, request):
        """Add billing context to authenticated requests."""

        # Initialize billing attributes
        request.subscription = None
        request.token_balance = None
        request.billing = {
            'is_authenticated': False,
            'has_active_subscription': False,
            'tier_name': None,
            'tier_slug': None,
            'features': {},
        }

        # Only process for authenticated users
        if not request.user or not request.user.is_authenticated:
            return None

        try:
            # Get user's subscription
            subscription = get_user_subscription(request.user)
            if subscription:
                request.subscription = subscription

                # Get token balance
                token_balance = get_or_create_token_balance(request.user)
                request.token_balance = token_balance

                # Build billing context
                request.billing = {
                    'is_authenticated': True,
                    'has_active_subscription': subscription.is_active,
                    'is_trial': subscription.is_trial,
                    'tier_name': subscription.tier.name,
                    'tier_slug': subscription.tier.slug,
                    'tier_type': subscription.tier.tier_type,
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
                    'ai_requests': {
                        'limit': subscription.tier.monthly_ai_requests,
                        'used': subscription.ai_requests_used_this_month,
                        'remaining': (subscription.tier.monthly_ai_requests - subscription.ai_requests_used_this_month)
                        if subscription.tier.monthly_ai_requests > 0
                        else None,
                    },
                    'tokens': {
                        'balance': token_balance.balance if token_balance else 0,
                    },
                    'subscription_status': subscription.status,
                    'current_period_end': subscription.current_period_end,
                }

        except Exception as e:
            logger.error(f'Error adding billing context to request: {e}', exc_info=True)

        return None


class AIRequestThrottleMiddleware(MiddlewareMixin):
    """
    Middleware to track AI request usage across the application.

    This middleware should be placed AFTER BillingContextMiddleware.

    It adds a helper method to the request object:
        request.check_ai_quota() - Returns (can_proceed, message)
    """

    def process_request(self, request):
        """Add AI quota checking helper to request."""

        def check_ai_quota():
            """Check if user can make an AI request."""
            if not request.user or not request.user.is_authenticated:
                return False, 'Authentication required'

            if not hasattr(request, 'subscription') or not request.subscription:
                return False, 'No subscription found'

            # Check subscription limit
            if request.subscription.can_make_ai_request():
                return True, 'Within subscription limit'

            # Check token balance
            if hasattr(request, 'token_balance') and request.token_balance:
                if request.token_balance.balance > 0:
                    return True, 'Using token balance'

            return False, 'AI request limit exceeded and no tokens available'

        # Attach helper method to request
        request.check_ai_quota = check_ai_quota

        return None
