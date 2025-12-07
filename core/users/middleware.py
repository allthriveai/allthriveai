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

    Performance optimizations:
    - Uses cache.add() for atomic check-and-set (single cache operation)
    - Checks throttle BEFORE processing to minimize unnecessary work
    - Defers DB update using update() to avoid loading full user object
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
        # Check exclusions and auth BEFORE processing response
        # This allows us to skip activity tracking work entirely for most requests
        should_track = self._should_track_activity(request)

        # Process the request
        response = self.get_response(request)

        # Only attempt activity update if pre-checks passed
        if should_track:
            try:
                self._update_last_seen(request.user)
            except Exception as e:
                # Never block requests due to activity tracking errors
                logger.warning(f'Failed to update user activity: {e}')

        return response

    def _should_track_activity(self, request):
        """Pre-check whether we should track activity for this request.

        Returns False early to avoid unnecessary work.
        """
        # Skip excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDE_PATHS):
            return False

        # Only track authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return False

        # Skip bot/agent users
        from core.users.models import UserRole

        if request.user.role == UserRole.AGENT:
            return False

        return True

    def _update_last_seen(self, user):
        """Update user's last_seen_at with atomic cache-based throttling.

        Uses cache.add() for atomic check-and-set operation:
        - Returns True if key was set (we should update DB)
        - Returns False if key exists (skip DB update)

        This is more efficient than get() + set() as it's a single operation
        and avoids race conditions under high concurrency.
        """
        cache_key = f'user_activity:{user.id}'

        # Atomic check-and-set: only proceeds if key doesn't exist
        # This is a single cache operation vs get() then set()
        if not cache.add(cache_key, True, self.THROTTLE_SECONDS):
            # Key already exists - another request recently updated
            return

        # Update the database (only runs once per THROTTLE_SECONDS per user)
        from core.users.models import User

        User.objects.filter(id=user.id).update(last_seen_at=timezone.now())

        logger.debug(f'Updated last_seen_at for user {user.id}')
