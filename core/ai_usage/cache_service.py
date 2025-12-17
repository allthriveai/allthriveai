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
            'totalUsers': latest.total_users if latest else 0,
            'activeUsers': int(stats['avg_dau'] or 0),
            'totalAiCost': float(stats['total_ai_cost'] or 0),
            'totalProjects': latest.total_projects if latest else 0,
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
            data = getattr(stat, field) or {}
            for key, value in data.items():
                if key not in breakdown:
                    breakdown[key] = {'requests': 0, 'cost': 0}
                # Handle both old format (just cost float) and new format (dict with requests/cost)
                if isinstance(value, dict):
                    breakdown[key]['requests'] += value.get('requests', 0)
                    breakdown[key]['cost'] += value.get('cost', 0)
                else:
                    # Old format: value is just the cost
                    breakdown[key]['cost'] += float(value or 0)

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
            'totalUsers': latest.total_users if latest else 0,
            'newUsers': total_new_users,
            'avgDau': int(avg_dau),
            'avgMau': int(avg_mau),
            'growthRate': round(growth_rate, 2),
            'stickiness': round(stickiness, 2),
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_OVERVIEW)


def invalidate_dashboard_cache():
    """Invalidate all dashboard caches (call after manual data updates)."""
    # Pattern-based deletion would require redis-py scan
    # For now, just log - cache will expire naturally
    logger.info('[DASHBOARD_CACHE] Manual invalidation requested - caches will expire naturally')


# =============================================================================
# ENGAGEMENT DASHBOARD CACHE FUNCTIONS
# =============================================================================

CACHE_TTL_ENGAGEMENT = 600  # 10 minutes


def get_engagement_overview(days: int = 30) -> dict:
    """
    Get engagement overview KPIs aggregated from daily stats.

    Returns:
        dict with keys: totalActions, uniqueActiveUsers, peakHour, d7RetentionRate
    """
    from core.ai_usage.models import EngagementDailyStats

    cache_key = get_cache_key('engagement_overview', days=days)

    def compute():
        end_date = timezone.now().date() - timedelta(days=1)  # Yesterday (latest complete)
        start_date = end_date - timedelta(days=days - 1)

        stats = list(EngagementDailyStats.objects.filter(date__gte=start_date, date__lte=end_date))

        if not stats:
            return {
                'totalActions': 0,
                'uniqueActiveUsers': 0,
                'peakHour': 0,
                'd7RetentionRate': 0,
            }

        total_actions = sum(s.total_actions for s in stats)
        total_users = sum(s.unique_active_users for s in stats)

        # Find overall peak hour
        peak_counts = {}
        for s in stats:
            for hour, count in s.hourly_activity.items():
                peak_counts[hour] = peak_counts.get(hour, 0) + count
        peak_hour = int(max(peak_counts.items(), key=lambda x: x[1], default=('0', 0))[0])

        # D7 retention rate
        d7_cohort = sum(s.d7_cohort_size for s in stats)
        d7_retained = sum(s.d7_retained for s in stats)
        d7_rate = (d7_retained / d7_cohort * 100) if d7_cohort > 0 else 0

        return {
            'totalActions': total_actions,
            'uniqueActiveUsers': total_users,
            'peakHour': peak_hour,
            'd7RetentionRate': round(d7_rate, 1),
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_ENGAGEMENT)


def get_engagement_heatmap(days: int = 30) -> dict:
    """
    Build activity heatmap from daily stats.

    Returns:
        dict with keys: heatmap, dailyActions, peakHour, peakDay, totalActions
    """
    from core.ai_usage.models import EngagementDailyStats

    cache_key = get_cache_key('engagement_heatmap', days=days)

    def compute():
        end_date = timezone.now().date() - timedelta(days=1)
        start_date = end_date - timedelta(days=days - 1)

        stats = list(EngagementDailyStats.objects.filter(date__gte=start_date, date__lte=end_date).order_by('date'))

        # Build 7x24 matrix (row=day of week, col=hour)
        # Note: day_of_week is 0=Monday in Python, convert to 0=Sunday for frontend
        heatmap = [[0] * 24 for _ in range(7)]
        for s in stats:
            # Convert Python weekday (0=Mon) to Sunday-first (0=Sun)
            dow_adjusted = (s.day_of_week + 1) % 7
            for hour, count in s.hourly_activity.items():
                heatmap[dow_adjusted][int(hour)] += count

        # Daily actions timeseries
        daily_actions = [{'date': str(s.date), 'count': s.total_actions} for s in stats]

        # Peak time calculation
        max_val = 0
        peak_hour, peak_day = 0, 0
        for d, row in enumerate(heatmap):
            for h, val in enumerate(row):
                if val > max_val:
                    max_val, peak_hour, peak_day = val, h, d

        day_names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        return {
            'heatmap': heatmap,
            'dailyActions': daily_actions,
            'peakHour': peak_hour,
            'peakDay': day_names[peak_day],
            'totalActions': sum(s.total_actions for s in stats),
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_ENGAGEMENT)


def get_engagement_features(days: int = 30) -> dict:
    """
    Aggregate feature adoption metrics.

    Returns:
        dict with keys: features, topFeature, totalUniqueUsers
    """
    from core.ai_usage.models import EngagementDailyStats

    cache_key = get_cache_key('engagement_features', days=days)

    def compute():
        end_date = timezone.now().date() - timedelta(days=1)
        start_date = end_date - timedelta(days=days - 1)
        mid_date = start_date + timedelta(days=days // 2)

        current = list(EngagementDailyStats.objects.filter(date__gte=mid_date, date__lte=end_date))
        previous = list(EngagementDailyStats.objects.filter(date__gte=start_date, date__lt=mid_date))

        feature_names = {
            'quiz_complete': 'Quizzes',
            'project_create': 'Projects Created',
            'project_update': 'Project Updates',
            'comment': 'Comments',
            'reaction': 'Reactions',
            'daily_login': 'Daily Logins',
            'prompt_battle': 'Battles Played',
            'prompt_battle_win': 'Battle Wins',
            'side_quest': 'Side Quests',
            'streak_bonus': 'Streak Bonuses',
            'weekly_goal': 'Weekly Goals',
            'referral': 'Referrals',
        }

        # Aggregate feature usage
        def aggregate_features(queryset):
            result = {}
            for stat in queryset:
                for feat, data in stat.feature_usage.items():
                    if feat not in result:
                        result[feat] = {'users': 0, 'actions': 0}
                    result[feat]['users'] += data.get('users', 0)
                    result[feat]['actions'] += data.get('actions', 0)
            return result

        current_features = aggregate_features(current)
        prev_features = aggregate_features(previous)

        features = []
        for key, name in feature_names.items():
            curr = current_features.get(key, {'users': 0, 'actions': 0})
            prev = prev_features.get(key, {'users': 0, 'actions': 0})

            prev_actions = prev['actions']
            if prev_actions > 0:
                trend = ((curr['actions'] - prev_actions) / prev_actions) * 100
            elif curr['actions'] > 0:
                trend = 100.0
            else:
                trend = 0.0

            features.append(
                {
                    'name': name,
                    'activityType': key,
                    'uniqueUsers': curr['users'],
                    'totalActions': curr['actions'],
                    'trend': round(trend, 1),
                }
            )

        features.sort(key=lambda x: x['totalActions'], reverse=True)

        return {
            'features': features,
            'topFeature': features[0]['name'] if features else None,
            'totalUniqueUsers': sum(s.unique_active_users for s in current),
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_ENGAGEMENT)


def get_engagement_retention(days: int = 30) -> dict:
    """
    Build retention cohort data and conversion funnel.

    Returns:
        dict with keys: funnel, funnelRates, retentionCohorts
    """
    from core.ai_usage.models import EngagementDailyStats

    cache_key = get_cache_key('engagement_retention', days=days)

    def compute():
        end_date = timezone.now().date() - timedelta(days=1)
        start_date = end_date - timedelta(days=days - 1)

        stats = list(EngagementDailyStats.objects.filter(date__gte=start_date, date__lte=end_date).order_by('date'))

        # Funnel aggregates
        signups = sum(s.signups_today for s in stats)
        first_actions = sum(s.first_action_count for s in stats)
        d7_retained = sum(s.d7_retained for s in stats)
        d30_retained = sum(s.d30_retained for s in stats)

        funnel = {
            'signedUp': signups,
            'hadFirstAction': first_actions,
            'returnedDay7': d7_retained,
            'returnedDay30': d30_retained,
        }

        funnel_rates = {
            'signupToAction': round((first_actions / signups * 100) if signups else 0, 1),
            'actionToDay7': round((d7_retained / first_actions * 100) if first_actions else 0, 1),
            'day7ToDay30': round((d30_retained / d7_retained * 100) if d7_retained else 0, 1),
        }

        # Weekly retention cohorts (last 8 weeks)
        cohorts = []
        for week_offset in range(8):
            week_end = end_date - timedelta(weeks=week_offset)
            week_start = week_end - timedelta(days=6)

            week_stats = [s for s in stats if week_start <= s.date <= week_end]
            if not week_stats:
                continue

            cohort_signups = sum(s.signups_today for s in week_stats)
            if cohort_signups == 0:
                continue

            # D7 rate is based on d7_retained relative to signups
            d7_rate = sum(s.d7_retained for s in week_stats) / cohort_signups * 100 if cohort_signups else 0
            # D30 rate
            d30_rate = sum(s.d30_retained for s in week_stats) / cohort_signups * 100 if cohort_signups else 0

            cohorts.append(
                {
                    'cohortWeek': str(week_start),
                    'size': cohort_signups,
                    'week0': 100,
                    'week1': round(d7_rate, 1),
                    'week4': round(d30_rate, 1),
                }
            )

        return {
            'funnel': funnel,
            'funnelRates': funnel_rates,
            'retentionCohorts': cohorts,
        }

    return xfetch_get_or_compute(cache_key, compute, CACHE_TTL_ENGAGEMENT)
