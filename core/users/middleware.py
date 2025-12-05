"""
User activity tracking middleware.

Updates User.last_seen_at on authenticated API requests to enable
real-time features like battle matchmaking with active users.
"""

import logging

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


class UserActivityMiddleware:
    """
    Update user's last_seen_at on authenticated requests.

    Uses Redis cache to throttle database updates (once per minute max)
    to avoid excessive writes while maintaining reasonable accuracy.
    """

    # Only update last_seen_at once per minute to reduce DB writes
    THROTTLE_SECONDS = 60

    # Paths to exclude from activity tracking (health checks, static, etc.)
    EXCLUDE_PATHS = (
        '/health',
        '/metrics',
        '/static/',
        '/media/',
        '/admin/jsi18n/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Process the request first
        response = self.get_response(request)

        # Skip activity tracking for excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDE_PATHS):
            return response

        # Only track authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return response

        # Skip bot/agent users
        from core.users.models import UserRole

        if request.user.role == UserRole.AGENT:
            return response

        try:
            self._update_last_seen(request.user)
        except Exception as e:
            # Never block requests due to activity tracking errors
            logger.warning(f'Failed to update user activity: {e}')

        return response

    def _update_last_seen(self, user):
        """Update user's last_seen_at with throttling via Redis cache."""
        cache_key = f'user_activity:{user.id}'

        # Check if we've recently updated this user
        if cache.get(cache_key):
            return

        # Update the database
        from core.users.models import User

        User.objects.filter(id=user.id).update(last_seen_at=timezone.now())

        # Set cache to prevent updates for THROTTLE_SECONDS
        cache.set(cache_key, True, self.THROTTLE_SECONDS)

        logger.debug(f'Updated last_seen_at for user {user.id}')
