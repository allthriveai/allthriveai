"""
Billing Permission Classes and Decorators

Provides permission checking for subscription-based feature access.
"""

import logging
from functools import wraps

from django.http import JsonResponse
from rest_framework import permissions

from .utils import can_access_feature, can_make_ai_request, get_user_subscription

logger = logging.getLogger(__name__)


# ===== Django Rest Framework Permission Classes =====


class HasActiveSubscription(permissions.BasePermission):
    """
    Permission class to check if user has an active subscription.

    Usage:
        class MyView(APIView):
            permission_classes = [IsAuthenticated, HasActiveSubscription]
    """

    message = 'An active subscription is required to access this feature.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        subscription = get_user_subscription(request.user)
        if not subscription or not subscription.is_active:
            return False

        return True


class RequiresFeature(permissions.BasePermission):
    """
    Base permission class to check if user's tier has access to a feature.

    Subclass this and set the `feature_name` attribute.

    Usage:
        class RequiresMarketplace(RequiresFeature):
            feature_name = 'marketplace'

        class MyView(APIView):
            permission_classes = [IsAuthenticated, RequiresMarketplace]
    """

    feature_name = None  # Override in subclass
    message = 'Your subscription tier does not include access to this feature.'

    def has_permission(self, request, view):
        if not self.feature_name:
            logger.error('RequiresFeature used without feature_name set')
            return False

        if not request.user or not request.user.is_authenticated:
            return False

        has_access = can_access_feature(request.user, self.feature_name)

        if not has_access:
            # Customize message based on feature
            feature_names = {
                'marketplace': 'Marketplace',
                'go1_courses': 'Go1 Courses',
                'ai_mentor': 'AI Mentor',
                'quests': 'Quests',
                'circles': 'Circles',
                'projects': 'Projects',
                'creator_tools': 'Creator Tools',
                'analytics': 'Analytics',
            }
            feature_display = feature_names.get(self.feature_name, self.feature_name)
            self.message = (
                f'{feature_display} is not available in your current subscription tier. Upgrade to access this feature.'
            )

        return has_access


# Specific permission classes for each feature
class RequiresMarketplace(RequiresFeature):
    """Requires marketplace access (Community Pro+)"""

    feature_name = 'marketplace'


class RequiresGo1Courses(RequiresFeature):
    """Requires Go1 courses access (Pro Learn+)"""

    feature_name = 'go1_courses'


class RequiresAIMentor(RequiresFeature):
    """Requires AI mentor access (All tiers)"""

    feature_name = 'ai_mentor'


class RequiresQuests(RequiresFeature):
    """Requires quests access (All tiers)"""

    feature_name = 'quests'


class RequiresCircles(RequiresFeature):
    """Requires circles access (Community Pro+)"""

    feature_name = 'circles'


class RequiresProjects(RequiresFeature):
    """Requires projects access (All tiers)"""

    feature_name = 'projects'


class RequiresCreatorTools(RequiresFeature):
    """Requires creator tools access (Creator/Mentor tier)"""

    feature_name = 'creator_tools'


class RequiresAnalytics(RequiresFeature):
    """Requires analytics access (Pro Learn+)"""

    feature_name = 'analytics'


class CanMakeAIRequest(permissions.BasePermission):
    """
    Permission class to check if user can make an AI request.

    Checks both subscription limits and token balance.
    """

    message = 'AI request limit exceeded. Purchase tokens to continue.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        can_request, reason = can_make_ai_request(request.user)

        if not can_request:
            self.message = (
                f'AI request limit exceeded. {reason}. Purchase tokens or upgrade your subscription to continue.'
            )

        return can_request


# ===== Function Decorators for Django Views =====


def require_feature(feature_name):
    """
    Decorator to require a specific feature for a view.

    Usage:
        @require_feature('marketplace')
        def my_view(request):
            ...
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'error': 'Authentication required'}, status=401)

            if not can_access_feature(request.user, feature_name):
                feature_names = {
                    'marketplace': 'Marketplace',
                    'go1_courses': 'Go1 Courses',
                    'ai_mentor': 'AI Mentor',
                    'quests': 'Quests',
                    'circles': 'Circles',
                    'projects': 'Projects',
                    'creator_tools': 'Creator Tools',
                    'analytics': 'Analytics',
                }
                feature_display = feature_names.get(feature_name, feature_name)

                return JsonResponse(
                    {
                        'error': f'{feature_display} not available',
                        'message': f'{feature_display} is not included in your current subscription tier.',
                        'feature': feature_name,
                        'upgrade_required': True,
                    },
                    status=403,
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def require_ai_quota(view_func):
    """
    Decorator to check if user can make an AI request.

    Usage:
        @require_ai_quota
        def ai_chat_view(request):
            ...
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)

        can_request, reason = can_make_ai_request(request.user)

        if not can_request:
            return JsonResponse(
                {
                    'error': 'AI request limit exceeded',
                    'message': f'{reason}. Purchase tokens or upgrade your subscription.',
                    'can_purchase_tokens': True,
                },
                status=429,  # Too Many Requests
            )

        return view_func(request, *args, **kwargs)

    return wrapper


def require_active_subscription(view_func):
    """
    Decorator to require an active subscription (any tier).

    Usage:
        @require_active_subscription
        def premium_view(request):
            ...
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)

        subscription = get_user_subscription(request.user)

        if not subscription or not subscription.is_active:
            return JsonResponse(
                {
                    'error': 'Active subscription required',
                    'message': 'This feature requires an active subscription.',
                    'has_subscription': False,
                },
                status=403,
            )

        return view_func(request, *args, **kwargs)

    return wrapper


# ===== Convenience Decorators for Specific Features =====

require_marketplace = require_feature('marketplace')
require_go1_courses = require_feature('go1_courses')
require_ai_mentor = require_feature('ai_mentor')
require_quests = require_feature('quests')
require_circles = require_feature('circles')
require_projects = require_feature('projects')
require_creator_tools = require_feature('creator_tools')
require_analytics = require_feature('analytics')
