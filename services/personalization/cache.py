"""
Redis caching strategy for personalization feeds.

Cache TTLs:
- for_you_feed:{user_id}:{page}: 60s (user-specific)
- user_profile_vector:{user_id}: 300s (5 min)
- trending_feed:{page}: 120s (global)
- engagement_velocities: 3600s (1 hour, Celery updated)
- semantic_search:{query_hash}: 180s (3 min)

Cache Stampede Prevention:
- Probabilistic early expiration (XFetch algorithm)
- Lock-based regeneration for hot keys
- Rate-limited invalidation for viral content
"""

import hashlib
import logging
import math
import random
import time
from collections.abc import Callable
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache TTLs in seconds
CACHE_TTLS = {
    'for_you_feed': 60,  # 1 min (user-specific, changes frequently)
    'user_profile_vector': 300,  # 5 min
    'trending_feed': 120,  # 2 min (global)
    'engagement_velocities': 3600,  # 1 hour (batch updated)
    'semantic_search': 180,  # 3 min
    'popular_feed': 300,  # 5 min
    'onboarding_status': 60,  # 1 min
}

# Rate limiting for invalidations (prevent stampede from viral content)
INVALIDATION_RATE_LIMITS = {
    'trending_feed': 5,  # Max 5 invalidations per minute
    'popular_feed': 5,  # Max 5 invalidations per minute
}


class StampedePreventionMixin:
    """
    Mixin providing cache stampede prevention utilities.

    Implements:
    1. XFetch (probabilistic early expiration) - prevents synchronized expiry
    2. Lock-based regeneration - only one process regenerates cache
    3. Rate-limited invalidation - prevents excessive invalidation from viral content
    """

    LOCK_TIMEOUT = 10  # Seconds to hold regeneration lock
    XFETCH_BETA = 1.0  # Controls early expiration probability

    @classmethod
    def _get_with_xfetch(
        cls,
        key: str,
        regenerate_fn: Callable[[], Any],
        ttl: int,
        beta: float = 1.0,
    ) -> Any:
        """
        Get cached value with probabilistic early expiration (XFetch algorithm).

        As TTL approaches 0, probability of early regeneration increases.
        This staggers cache regeneration across requests, preventing stampede.

        Args:
            key: Cache key
            regenerate_fn: Function to regenerate cache value
            ttl: Time-to-live in seconds
            beta: Controls early expiration aggressiveness (higher = more aggressive)

        Returns:
            Cached or regenerated value
        """
        # Get value and remaining TTL
        value = cache.get(key)

        if value is None:
            # Cache miss - regenerate with lock
            return cls._regenerate_with_lock(key, regenerate_fn, ttl)

        # Get remaining TTL (approximate using stored timestamp)
        meta_key = f'{key}:meta'
        meta = cache.get(meta_key)

        if meta:
            created_at = meta.get('created_at', 0)
            original_ttl = meta.get('ttl', ttl)
            elapsed = time.time() - created_at
            remaining_ttl = max(0, original_ttl - elapsed)

            # XFetch probability calculation
            # P(early_refresh) = exp(-remaining_ttl / (beta * original_ttl))
            if remaining_ttl < original_ttl:
                probability = math.exp(-remaining_ttl * beta / max(original_ttl * 0.1, 1))
                if random.random() < probability:  # noqa: S311
                    logger.debug(f'XFetch early refresh triggered for {key}')
                    # Try to regenerate in background (non-blocking)
                    cls._try_background_regenerate(key, regenerate_fn, ttl)

        return value

    @classmethod
    def _regenerate_with_lock(
        cls,
        key: str,
        regenerate_fn: Callable[[], Any],
        ttl: int,
    ) -> Any:
        """
        Regenerate cache value with distributed lock.

        Only one process regenerates; others wait and use stale value.

        Args:
            key: Cache key
            regenerate_fn: Function to regenerate value
            ttl: Time-to-live in seconds

        Returns:
            Regenerated value
        """
        lock_key = f'{key}:lock'

        # Try to acquire lock
        acquired = cache.add(lock_key, '1', cls.LOCK_TIMEOUT)

        if acquired:
            try:
                # We have the lock - regenerate
                value = regenerate_fn()

                # Store value with metadata
                cache.set(key, value, ttl)
                cache.set(
                    f'{key}:meta',
                    {
                        'created_at': time.time(),
                        'ttl': ttl,
                    },
                    ttl + 60,
                )  # Meta lives slightly longer

                logger.debug(f'Regenerated cache for {key}')
                return value

            finally:
                # Release lock
                cache.delete(lock_key)
        else:
            # Another process is regenerating - wait briefly and retry
            time.sleep(0.1)
            value = cache.get(key)

            if value is not None:
                return value

            # Still no value - regenerate anyway (lock may have expired)
            logger.warning(f'Lock wait timeout for {key}, regenerating anyway')
            return regenerate_fn()

    @classmethod
    def _try_background_regenerate(
        cls,
        key: str,
        regenerate_fn: Callable[[], Any],
        ttl: int,
    ) -> None:
        """
        Try to regenerate cache in background (non-blocking).

        If lock is already held, returns immediately without regenerating.
        """
        lock_key = f'{key}:lock'
        acquired = cache.add(lock_key, '1', cls.LOCK_TIMEOUT)

        if acquired:
            try:
                value = regenerate_fn()
                cache.set(key, value, ttl)
                cache.set(
                    f'{key}:meta',
                    {
                        'created_at': time.time(),
                        'ttl': ttl,
                    },
                    ttl + 60,
                )
            except Exception as e:
                logger.error(f'Background regenerate failed for {key}: {e}')
            finally:
                cache.delete(lock_key)

    @classmethod
    def _rate_limited_invalidate(
        cls,
        key: str,
        rate_limit_key: str,
        max_per_minute: int,
    ) -> bool:
        """
        Invalidate cache with rate limiting.

        Prevents cache stampede from rapid invalidations (e.g., viral content).

        Args:
            key: Cache key to invalidate
            rate_limit_key: Key for rate limit counter
            max_per_minute: Maximum invalidations per minute

        Returns:
            True if invalidation was performed, False if rate limited
        """
        counter_key = f'ratelimit:invalidate:{rate_limit_key}'

        # Increment counter
        try:
            count = cache.incr(counter_key)
        except ValueError:
            # Key doesn't exist - create it
            cache.set(counter_key, 1, 60)  # 1 minute window
            count = 1

        if count > max_per_minute:
            logger.warning(f'Rate limited invalidation for {rate_limit_key} ' f'({count}/{max_per_minute} per minute)')
            return False

        cache.delete(key)
        return True


class PersonalizationCache(StampedePreventionMixin):
    """
    Cache manager for personalization feeds.

    Provides caching layer for:
    - For You feeds (per-user)
    - Trending feeds (global)
    - User profile vectors
    - Semantic search results
    """

    PREFIX = 'personalization'

    @classmethod
    def _make_key(cls, *parts: str) -> str:
        """Build cache key from parts."""
        return f'{cls.PREFIX}:{":".join(str(p) for p in parts)}'

    @classmethod
    def _hash_query(cls, query: str) -> str:
        """Hash a search query for cache key."""
        return hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]  # noqa: S324

    # For You Feed Caching

    @classmethod
    def get_for_you_feed(cls, user_id: int, page: int) -> dict | None:
        """Get cached For You feed."""
        key = cls._make_key('for_you_feed', user_id, page)
        return cache.get(key)

    @classmethod
    def set_for_you_feed(cls, user_id: int, page: int, data: dict) -> None:
        """Cache For You feed results."""
        key = cls._make_key('for_you_feed', user_id, page)
        cache.set(key, data, CACHE_TTLS['for_you_feed'])

    @classmethod
    def invalidate_for_you_feed(cls, user_id: int) -> None:
        """Invalidate all For You feed cache for a user."""
        # Delete first 10 pages (most common)
        for page in range(1, 11):
            key = cls._make_key('for_you_feed', user_id, page)
            cache.delete(key)

    # Trending Feed Caching

    @classmethod
    def get_trending_feed(cls, page: int) -> dict | None:
        """Get cached trending feed."""
        key = cls._make_key('trending_feed', page)
        return cache.get(key)

    @classmethod
    def set_trending_feed(cls, page: int, data: dict) -> None:
        """Cache trending feed results."""
        key = cls._make_key('trending_feed', page)
        cache.set(key, data, CACHE_TTLS['trending_feed'])

    @classmethod
    def invalidate_trending_feed(cls, rate_limited: bool = True) -> bool:
        """
        Invalidate all trending feed cache.

        Args:
            rate_limited: If True, apply rate limiting to prevent stampede

        Returns:
            True if invalidation was performed, False if rate limited
        """
        if rate_limited:
            # Rate limit to prevent stampede from viral content
            max_per_minute = INVALIDATION_RATE_LIMITS.get('trending_feed', 5)
            counter_key = 'ratelimit:invalidate:trending_feed'

            try:
                count = cache.incr(counter_key)
            except ValueError:
                cache.set(counter_key, 1, 60)
                count = 1

            if count > max_per_minute:
                logger.info(f'Rate limited trending feed invalidation ' f'({count}/{max_per_minute} per minute)')
                return False

        for page in range(1, 11):
            key = cls._make_key('trending_feed', page)
            cache.delete(key)
        return True

    # User Profile Vector Caching

    @classmethod
    def get_user_vector(cls, user_id: int) -> list[float] | None:
        """Get cached user preference vector."""
        key = cls._make_key('user_profile_vector', user_id)
        return cache.get(key)

    @classmethod
    def set_user_vector(cls, user_id: int, vector: list[float]) -> None:
        """Cache user preference vector."""
        key = cls._make_key('user_profile_vector', user_id)
        cache.set(key, vector, CACHE_TTLS['user_profile_vector'])

    @classmethod
    def invalidate_user_vector(cls, user_id: int) -> None:
        """Invalidate user vector cache."""
        key = cls._make_key('user_profile_vector', user_id)
        cache.delete(key)

    # Engagement Velocities Caching

    @classmethod
    def get_engagement_velocities(cls) -> dict[int, float] | None:
        """Get cached engagement velocities for all projects."""
        key = cls._make_key('engagement_velocities')
        return cache.get(key)

    @classmethod
    def set_engagement_velocities(cls, velocities: dict[int, float]) -> None:
        """Cache engagement velocities."""
        key = cls._make_key('engagement_velocities')
        cache.set(key, velocities, CACHE_TTLS['engagement_velocities'])

    # Semantic Search Caching

    @classmethod
    def get_semantic_search(cls, query: str, alpha: float = 0.7) -> dict | None:
        """Get cached semantic search results."""
        query_hash = cls._hash_query(query)
        key = cls._make_key('semantic_search', query_hash, f'a{int(alpha*10)}')
        return cache.get(key)

    @classmethod
    def set_semantic_search(cls, query: str, alpha: float, data: dict) -> None:
        """Cache semantic search results."""
        query_hash = cls._hash_query(query)
        key = cls._make_key('semantic_search', query_hash, f'a{int(alpha*10)}')
        cache.set(key, data, CACHE_TTLS['semantic_search'])

    # Popular Feed Caching (for cold start)

    @classmethod
    def get_popular_feed(cls, page: int) -> dict | None:
        """Get cached popular feed."""
        key = cls._make_key('popular_feed', page)
        return cache.get(key)

    @classmethod
    def set_popular_feed(cls, page: int, data: dict) -> None:
        """Cache popular feed results."""
        key = cls._make_key('popular_feed', page)
        cache.set(key, data, CACHE_TTLS['popular_feed'])

    # Onboarding Status Caching

    @classmethod
    def get_onboarding_status(cls, user_id: int) -> dict | None:
        """Get cached onboarding status."""
        key = cls._make_key('onboarding_status', user_id)
        return cache.get(key)

    @classmethod
    def set_onboarding_status(cls, user_id: int, data: dict) -> None:
        """Cache onboarding status."""
        key = cls._make_key('onboarding_status', user_id)
        cache.set(key, data, CACHE_TTLS['onboarding_status'])

    @classmethod
    def invalidate_onboarding_status(cls, user_id: int) -> None:
        """Invalidate onboarding status cache."""
        key = cls._make_key('onboarding_status', user_id)
        cache.delete(key)

    # Bulk Invalidation

    @classmethod
    def invalidate_user_caches(cls, user_id: int) -> None:
        """Invalidate all caches for a user."""
        cls.invalidate_for_you_feed(user_id)
        cls.invalidate_user_vector(user_id)
        cls.invalidate_onboarding_status(user_id)

    @classmethod
    def invalidate_project_caches(cls) -> None:
        """Invalidate caches when projects change."""
        cls.invalidate_trending_feed()
        # Note: For You feeds are user-specific and will naturally expire

    @classmethod
    def on_project_like(cls, project_id: int, user_id: int) -> None:
        """Handle cache invalidation when a project is liked."""
        # Invalidate trending (likes affect velocity)
        cls.invalidate_trending_feed()
        # Invalidate user's caches (their preferences changed)
        cls.invalidate_user_caches(user_id)


# Convenience functions for common operations


def cached_for_you_feed(func):
    """Decorator to cache For You feed results."""

    def wrapper(self, user, page=1, page_size=20, *args, **kwargs):
        # Try cache first
        cached = PersonalizationCache.get_for_you_feed(user.id, page)
        if cached is not None:
            logger.debug(f'Cache hit for For You feed user={user.id} page={page}')
            return cached

        # Call actual function
        result = func(self, user, page, page_size, *args, **kwargs)

        # Cache result
        PersonalizationCache.set_for_you_feed(user.id, page, result)
        logger.debug(f'Cached For You feed user={user.id} page={page}')

        return result

    return wrapper


def cached_trending_feed(func):
    """Decorator to cache trending feed results."""

    def wrapper(self, user=None, page=1, page_size=20, *args, **kwargs):
        # Try cache first (trending is global)
        cached = PersonalizationCache.get_trending_feed(page)
        if cached is not None:
            logger.debug(f'Cache hit for trending feed page={page}')
            return cached

        # Call actual function
        result = func(self, user, page, page_size, *args, **kwargs)

        # Cache result
        PersonalizationCache.set_trending_feed(page, result)
        logger.debug(f'Cached trending feed page={page}')

        return result

    return wrapper
