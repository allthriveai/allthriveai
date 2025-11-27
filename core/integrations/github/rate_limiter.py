"""Rate limiter for GitHub API calls."""

import logging
import time
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

logger = logging.getLogger(__name__)


class GitHubRateLimiter:
    """Rate limiter for GitHub API calls using Django cache."""

    def __init__(self, user_id: int = None):
        """
        Initialize rate limiter.

        Args:
            user_id: Optional user ID for user-specific rate limiting
        """
        self.user_id = user_id
        self.config = settings.GITHUB_RATE_LIMIT

    def _get_cache_key(self, action: str, window: str) -> str:
        """Generate cache key for rate limit tracking."""
        if self.user_id:
            return f'github_ratelimit:user:{self.user_id}:{action}:{window}'
        return f'github_ratelimit:global:{action}:{window}'

    def _get_expiry_cache_key(self, action: str, window: str) -> str:
        """Generate cache key for storing expiry timestamp."""
        return f'{self._get_cache_key(action, window)}:expiry'

    def check_rate_limit(self, action: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """
        Check if request is within rate limit.

        Args:
            action: Action being rate limited (e.g., 'repo_fetch', 'import')
            max_requests: Maximum number of requests allowed in window
            window_seconds: Time window in seconds

        Returns:
            Tuple of (allowed: bool, requests_remaining: int)
        """
        import time

        cache_key = self._get_cache_key(action, f'{window_seconds}s')
        expiry_key = self._get_expiry_cache_key(action, f'{window_seconds}s')

        # Get current count and expiry timestamp
        current_count = cache.get(cache_key, 0)
        expiry_timestamp = cache.get(expiry_key)

        if current_count >= max_requests:
            # Calculate retry_after from expiry timestamp
            if expiry_timestamp:
                retry_after = max(0, int(expiry_timestamp - time.time()))
            else:
                retry_after = window_seconds

            logger.warning(
                f'Rate limit exceeded for {action}: '
                f'user_id={self.user_id}, '
                f'count={current_count}/{max_requests}, '
                f'retry_after={retry_after}s'
            )
            return False, 0

        # Set expiry timestamp on first request in window
        if current_count == 0:
            expiry_timestamp = time.time() + window_seconds
            cache.set(expiry_key, expiry_timestamp, window_seconds)

        # Increment counter
        cache.set(cache_key, current_count + 1, window_seconds)

        requests_remaining = max_requests - (current_count + 1)
        logger.debug(
            f'Rate limit check passed for {action}: '
            f'user_id={self.user_id}, '
            f'count={current_count + 1}/{max_requests}, '
            f'remaining={requests_remaining}'
        )

        return True, requests_remaining

    def check_user_repo_fetch_limit(self) -> tuple[bool, int]:
        """Check user-specific repo fetch rate limit (per hour)."""
        if not self.user_id:
            return True, 999  # No user-specific limit if no user

        max_requests = self.config['USER_MAX_REPO_FETCHES_PER_HOUR']
        return self.check_rate_limit('repo_fetch', max_requests, 3600)

    def check_user_import_limit(self) -> tuple[bool, int]:
        """Check user-specific import rate limit (per hour)."""
        if not self.user_id:
            return True, 999

        max_requests = self.config['USER_MAX_IMPORTS_PER_HOUR']
        return self.check_rate_limit('import', max_requests, 3600)

    def check_global_minute_limit(self) -> tuple[bool, int]:
        """Check global per-minute rate limit."""
        max_requests = self.config['MAX_REQUESTS_PER_MINUTE']
        return self.check_rate_limit('global', max_requests, 60)

    def check_global_hour_limit(self) -> tuple[bool, int]:
        """Check global per-hour rate limit."""
        max_requests = self.config['MAX_REQUESTS_PER_HOUR']
        return self.check_rate_limit('global', max_requests, 3600)

    def get_retry_after(self, action: str, window_seconds: int) -> int:
        """Get seconds until rate limit resets."""
        import time

        expiry_key = self._get_expiry_cache_key(action, f'{window_seconds}s')
        expiry_timestamp = cache.get(expiry_key)

        if expiry_timestamp:
            retry_after = max(0, int(expiry_timestamp - time.time()))
            return retry_after
        return 0

    def reset_limits(self, action: str = None):
        """
        Reset rate limits (for testing or admin override).

        Args:
            action: Specific action to reset, or None to reset all
        """
        if action:
            for window in ['60s', '3600s']:
                cache_key = self._get_cache_key(action, window)
                cache.delete(cache_key)
            logger.info(f'Rate limits reset for action: {action}, user_id={self.user_id}')
        else:
            # Reset all actions
            for action in ['repo_fetch', 'import', 'global']:
                self.reset_limits(action)


def github_rate_limit(action: str = 'general'):
    """
    Decorator for rate limiting GitHub API calls.

    Usage:
        @github_rate_limit(action='repo_fetch')
        def fetch_repos(request):
            ...
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Try to extract user from args
            user_id = None
            for arg in args:
                if hasattr(arg, 'user') and hasattr(arg.user, 'id'):
                    user_id = arg.user.id
                    break

            # Check rate limits
            limiter = GitHubRateLimiter(user_id=user_id)

            # Check global limits first
            allowed, _ = limiter.check_global_minute_limit()
            if not allowed:
                retry_after = limiter.get_retry_after('global', 60)
                logger.error(f'Global minute rate limit exceeded, retry after {retry_after}s')
                raise Throttled(detail=f'Rate limit exceeded. Try again in {retry_after} seconds.', wait=retry_after)

            # Check user-specific limits
            if action == 'repo_fetch':
                allowed, remaining = limiter.check_user_repo_fetch_limit()
                if not allowed:
                    retry_after = limiter.get_retry_after('repo_fetch', 3600)
                    raise Throttled(
                        detail=f'Too many repository fetches. Try again in {retry_after // 60} minutes.',
                        wait=retry_after,
                    )
            elif action == 'import':
                allowed, remaining = limiter.check_user_import_limit()
                if not allowed:
                    retry_after = limiter.get_retry_after('import', 3600)
                    raise Throttled(
                        detail=f'Too many imports. Try again in {retry_after // 60} minutes.',
                        wait=retry_after,
                    )

            # Execute function
            return func(*args, **kwargs)

        return wrapper

    return decorator


def github_api_call_with_retry(max_retries: int = None, backoff: int = None):
    """
    Decorator for retrying GitHub API calls with exponential backoff.

    Usage:
        @github_api_call_with_retry(max_retries=3, backoff=2)
        def call_github_api():
            ...
    """
    if max_retries is None:
        max_retries = settings.GITHUB_RATE_LIMIT['MAX_RETRIES']
    if backoff is None:
        backoff = settings.GITHUB_RATE_LIMIT['RETRY_BACKOFF']

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    # Check if it's a rate limit error from GitHub
                    if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
                        if e.response.status_code == 403:
                            # GitHub rate limit hit
                            retry_after = e.response.headers.get('X-RateLimit-Reset', 60)
                            logger.warning(
                                f'GitHub API rate limit hit on attempt {attempt + 1}/{max_retries}. '
                                f'Retry after: {retry_after}s'
                            )
                            if attempt < max_retries - 1:
                                time.sleep(min(backoff**attempt, 60))
                                continue
                        elif e.response.status_code >= 500:
                            # GitHub server error
                            logger.warning(f'GitHub API server error on attempt {attempt + 1}/{max_retries}: {e}')
                            if attempt < max_retries - 1:
                                time.sleep(backoff**attempt)
                                continue

                    # For other errors, don't retry
                    logger.error(f'GitHub API call failed: {e}')
                    raise

            # All retries exhausted
            logger.error(f'GitHub API call failed after {max_retries} attempts: {last_exception}')
            raise last_exception

        return wrapper

    return decorator
