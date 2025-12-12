"""
User middleware for activity tracking and username redirects.

- UserActivityMiddleware: Updates User.last_seen_at on authenticated API requests
- UsernameRedirectMiddleware: Redirects old usernames to new ones after username changes
"""

import logging
import re

from django.core.cache import cache
from django.http import HttpResponsePermanentRedirect
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


class UsernameRedirectMiddleware:
    """
    Redirect old usernames to new usernames after username changes.

    When a user changes their username, old URLs like /{old_username} or
    /{old_username}/{project-slug} should 301 redirect to the new username.

    This preserves:
    - SEO value (link equity passes through 301 redirects)
    - External links and bookmarks
    - Shared URLs on social media

    Performance optimizations:
    - Uses Redis cache to avoid repeated DB lookups for same old username
    - Only checks paths that look like usernames (not /api/, /admin/, etc.)
    - Negative caching: remembers when a username is NOT in history
    """

    # Cache TTL for username lookups (1 hour)
    CACHE_TTL = 3600

    # Paths to exclude from username redirect checking
    # These are known routes that are NOT usernames
    EXCLUDE_PREFIXES = (
        # API and system paths
        '/api/',
        '/admin/',
        '/accounts/',
        '/auth/',
        '/static/',
        '/media/',
        '/health',
        '/metrics',
        '/_/',  # Internal paths
        '/ws/',  # WebSocket
        # Known frontend routes (not usernames)
        '/explore',
        '/marketplace',
        '/about',
        '/pricing',
        '/privacy',
        '/terms',
        '/pitch',
        '/perks',
        '/battle',
        '/battles',
        '/tools',
        '/topics',
        '/events',
        '/leaderboard',
        '/settings',
        '/onboarding',
        '/quizzes',
        '/styleguide',
        '/learning',
    )

    # Regex to match potential username paths: /{username} or /{username}/{anything}
    # Username: 3-30 chars, alphanumeric, underscore, hyphen
    USERNAME_PATH_PATTERN = re.compile(r'^/([a-zA-Z0-9_-]{3,30})(?:/(.*))?$')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Quick exclusion check first
        if any(request.path.startswith(prefix) for prefix in self.EXCLUDE_PREFIXES):
            return self.get_response(request)

        # Check if path looks like a username path
        match = self.USERNAME_PATH_PATTERN.match(request.path)
        if not match:
            return self.get_response(request)

        potential_username = match.group(1).lower()
        rest_of_path = match.group(2) or ''

        # Check cache first
        cache_key = f'username_redirect:{potential_username}'
        cached_result = cache.get(cache_key)

        if cached_result is not None:
            if cached_result == '':
                # Negative cache hit - this is not an old username
                return self.get_response(request)
            else:
                # Positive cache hit - redirect to new username
                return self._build_redirect(cached_result, rest_of_path, request)

        # Check database for username history
        from core.users.models import UsernameHistory

        new_username = UsernameHistory.get_current_username(potential_username)

        if new_username:
            # Found! Cache the mapping and redirect
            cache.set(cache_key, new_username, self.CACHE_TTL)
            logger.info(
                f'Username redirect: {potential_username} -> {new_username}',
                extra={'old_username': potential_username, 'new_username': new_username, 'path': request.path},
            )
            return self._build_redirect(new_username, rest_of_path, request)
        else:
            # Not found - negative cache to avoid repeated DB lookups
            cache.set(cache_key, '', self.CACHE_TTL)
            return self.get_response(request)

    def _build_redirect(self, new_username, rest_of_path, request):
        """Build the redirect URL preserving the rest of the path and query string."""
        if rest_of_path:
            new_path = f'/{new_username}/{rest_of_path}'
        else:
            new_path = f'/{new_username}'

        # Preserve query string if present
        if request.META.get('QUERY_STRING'):
            new_path = f'{new_path}?{request.META["QUERY_STRING"]}'

        return HttpResponsePermanentRedirect(new_path)
