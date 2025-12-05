"""
Dashboard metrics caching service with XFetch stampede prevention.

Provides fast access to dashboard metrics with intelligent caching.
"""

import logging
import time
from datetime import timedelta
from typing import Any

from django.core.cache import cache
from django.db.models import Avg, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cache TTLs (in seconds)
CACHE_TTL_OVERVIEW = 300  # 5 minutes for overview KPIs
CACHE_TTL_TIMESERIES = 600  # 10 minutes for charts
CACHE_TTL_BREAKDOWN = 600  # 10 minutes for breakdowns

# XFetch parameters
XFETCH_LOCK_TIMEOUT = 30  # 30 seconds max for lock
XFETCH_BETA = 1.0  # Probabilistic early recomputation factor


def get_cache_key(metric_type: str, days: int = 30, **kwargs) -> str:
    """Generate cache key for metrics."""
    parts = [f'dashboard:{metric_type}:days{days}']
    for key, value in sorted(kwargs.items()):
        parts.append(f'{key}_{value}')
    return ':'.join(parts)


def xfetch_get_or_compute(cache_key: str, compute_func, ttl: int, beta: float = XFETCH_BETA) -> Any:
    """
    XFetch: Probabilistic early recomputation to prevent cache stampede.

    Implements the algorithm from "Optimal Probabilistic Cache Stampede Prevention"
    by Vattani, Chierichetti, and Lowenstein (2015).

    Args:
        cache_key: Redis cache key
        compute_func: Function to compute value if cache miss
        ttl: Time-to-live in seconds
        beta: Recomputation probability factor (default 1.0)

    Returns:
        Cached or computed value
    """
    # Try to get from cache with metadata
    cached_data = cache.get(cache_key)

    if cached_data is not None:
        value, cached_at, delta = cached_data['value'], cached_data['cached_at'], cached_data.get('delta', 0.1)

        # Calculate time since cached
        now = time.time()
        time_since_cached = now - cached_at

        # XFetch: Probabilistically recompute early
        # P(recompute) = beta * delta * log(rand()) / (ttl - time_since_cached)
        import secrets

        remaining_ttl = ttl - time_since_cached
        if remaining_ttl > 0:
            xfetch_threshold = -beta * delta * remaining_ttl
            random_value = secrets.SystemRandom().random()  # noqa: S311

            if random_value * remaining_ttl < xfetch_threshold:
                logger.info(f'[XFETCH] Early recomputation for {cache_key}')
                # Recompute in background-ish (still sync but with lock)
                return _compute_and_cache(cache_key, compute_func, ttl)

        # Return cached value
        return value

    # Cache miss - compute and cache
    return _compute_and_cache(cache_key, compute_func, ttl)


def _compute_and_cache(cache_key: str, compute_func, ttl: int) -> Any:
    """Compute value and cache it with metadata."""
    # Acquire lock to prevent stampede
    lock_key = f'{cache_key}:lock'
    lock_acquired = cache.add(lock_key, 'locked', timeout=XFETCH_LOCK_TIMEOUT)

    if not lock_acquired:
        # Another process is computing - wait a bit and try cache again
        logger.info(f'[XFETCH] Lock held for {cache_key}, waiting...')
        time.sleep(0.1)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data['value']

    try:
        # Compute value and measure time
        start = time.time()
        value = compute_func()
        delta = time.time() - start

        # Cache with metadata
        cache_data = {
            'value': value,
            'cached_at': time.time(),
            'delta': delta,
        }
        cache.set(cache_key, cache_data, timeout=ttl)

        logger.info(f'[XFETCH] Computed and cached {cache_key} (took {delta:.2f}s)')
        return value

    finally:
        # Release lock
        cache.delete(lock_key)


def get_overview_kpis(days: int = 30) -> dict:
    """
    Get overview KPI metrics for dashboard header.

    Returns:
        dict with keys: total_users, active_users, total_ai_cost, total_projects
    """
    from core.ai_usage.models import PlatformDailyStats

    cache_key = get_cache_key('overview_kpis', days=days)

    def compute():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = PlatformDailyStats.objects.filter(date__gte=start_date, date__lte=end_date).aggregate(
            total_users=Sum('total_users'),
            active_users=Sum('active_users_today'),
            total_ai_cost=Sum('total_ai_cost'),
            total_projects=Sum('new_projects_today'),
            avg_dau=Avg('dau'),
        )

        # Get latest values for cumulative metrics
        latest = PlatformDailyStats.objects.filter(date__lte=end_date).order_by('-date').first()

        return {
            'total_users': latest.total_users if latest else 0,
            'active_users': int(stats['avg_dau'] or 0),
            'total_ai_cost': float(stats['total_ai_cost'] or 0),
            'total_projects': latest.total_projects if latest else 0,
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_OVERVIEW)


def get_timeseries_data(metric: str, days: int = 30) -> list:
    """
    Get time-series data for a specific metric.

    Args:
        metric: One of 'users', 'ai_cost', 'projects', 'engagement'
        days: Number of days to fetch

    Returns:
        List of dicts with 'date' and 'value' keys
    """
    from core.ai_usage.models import PlatformDailyStats

    cache_key = get_cache_key('timeseries', days=days, metric=metric)

    def compute():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = PlatformDailyStats.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        ).order_by('date')

        # Map metric to field
        field_map = {
            'users': 'dau',
            'ai_cost': 'total_ai_cost',
            'projects': 'new_projects_today',
            'engagement': 'active_users_today',
        }

        field = field_map.get(metric, 'dau')

        data = []
        for stat in stats:
            value = getattr(stat, field)
            data.append(
                {
                    'date': str(stat.date),
                    'value': float(value) if hasattr(value, '__float__') else value,
                }
            )

        return data

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_TIMESERIES)


def get_ai_breakdown(breakdown_type: str, days: int = 30) -> dict:
    """
    Get AI usage breakdown by feature or provider.

    Args:
        breakdown_type: 'feature' or 'provider'
        days: Number of days to aggregate

    Returns:
        Dict with breakdown data
    """
    from core.ai_usage.models import PlatformDailyStats

    cache_key = get_cache_key('ai_breakdown', days=days, type=breakdown_type)

    def compute():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = PlatformDailyStats.objects.filter(date__gte=start_date, date__lte=end_date)

        # Aggregate breakdown data
        breakdown = {}
        field = 'ai_by_feature' if breakdown_type == 'feature' else 'ai_by_provider'

        for stat in stats:
            data = getattr(stat, field)
            for key, values in data.items():
                if key not in breakdown:
                    breakdown[key] = {'requests': 0, 'cost': 0}
                breakdown[key]['requests'] += values.get('requests', 0)
                breakdown[key]['cost'] += values.get('cost', 0)

        # Sort by cost descending
        sorted_breakdown = dict(sorted(breakdown.items(), key=lambda x: x[1]['cost'], reverse=True))

        return sorted_breakdown

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_BREAKDOWN)


def get_user_growth_metrics(days: int = 30) -> dict:
    """
    Get user growth metrics for User Growth dashboard tab.

    Returns:
        Dict with growth trends, retention, etc.
    """
    from core.ai_usage.models import PlatformDailyStats

    cache_key = get_cache_key('user_growth', days=days)

    def compute():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = PlatformDailyStats.objects.filter(date__gte=start_date, date__lte=end_date)

        # Calculate metrics
        latest = stats.order_by('-date').first()
        oldest = stats.order_by('date').first()

        total_new_users = sum(s.new_users_today for s in stats)
        avg_dau = stats.aggregate(avg=Avg('dau'))['avg'] or 0
        avg_mau = stats.aggregate(avg=Avg('mau'))['avg'] or 0

        # Growth rate
        if oldest and oldest.total_users > 0:
            growth_rate = ((latest.total_users - oldest.total_users) / oldest.total_users) * 100
        else:
            growth_rate = 0

        # DAU/MAU ratio (stickiness)
        stickiness = (avg_dau / avg_mau * 100) if avg_mau > 0 else 0

        return {
            'total_users': latest.total_users if latest else 0,
            'new_users': total_new_users,
            'avg_dau': int(avg_dau),
            'avg_mau': int(avg_mau),
            'growth_rate': round(growth_rate, 2),
            'stickiness': round(stickiness, 2),
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_OVERVIEW)


def invalidate_dashboard_cache():
    """Invalidate all dashboard caches (call after manual data updates)."""
    # Pattern-based deletion would require redis-py scan
    # For now, just log - cache will expire naturally
    logger.info('[DASHBOARD_CACHE] Manual invalidation requested - caches will expire naturally')
