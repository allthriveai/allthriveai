"""
Tests for AI usage cache service.

Tests dashboard metrics caching with XFetch stampede prevention.
"""

import time
from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from core.ai_usage.cache_service import (
    CACHE_TTL_BREAKDOWN,
    CACHE_TTL_ENGAGEMENT,
    CACHE_TTL_OVERVIEW,
    CACHE_TTL_TIMESERIES,
    _compute_and_cache,
    get_ai_breakdown,
    get_cache_key,
    get_engagement_features,
    get_engagement_heatmap,
    get_engagement_overview,
    get_engagement_retention,
    get_overview_kpis,
    get_timeseries_data,
    get_user_growth_metrics,
    invalidate_dashboard_cache,
    xfetch_get_or_compute,
)
from core.ai_usage.models import EngagementDailyStats, PlatformDailyStats


class GetCacheKeyTestCase(TestCase):
    """Tests for get_cache_key function."""

    def test_basic_cache_key(self):
        """Test generating basic cache key."""
        key = get_cache_key('overview_kpis', days=30)
        self.assertEqual(key, 'dashboard:overview_kpis:days30')

    def test_cache_key_with_kwargs(self):
        """Test cache key with additional kwargs."""
        key = get_cache_key('timeseries', days=30, metric='users')
        self.assertEqual(key, 'dashboard:timeseries:days30:metric_users')

    def test_cache_key_kwargs_sorted(self):
        """Test that kwargs are sorted for consistent keys."""
        key1 = get_cache_key('breakdown', days=30, type='feature', scope='all')
        key2 = get_cache_key('breakdown', days=30, scope='all', type='feature')
        # Should be the same regardless of kwarg order
        self.assertEqual(key1, key2)

    def test_different_days_different_keys(self):
        """Test that different days produce different keys."""
        key1 = get_cache_key('overview_kpis', days=7)
        key2 = get_cache_key('overview_kpis', days=30)
        self.assertNotEqual(key1, key2)


class XFetchGetOrComputeTestCase(TestCase):
    """Tests for xfetch_get_or_compute function."""

    @patch('core.ai_usage.cache_service.cache')
    def test_cache_miss_computes_value(self, mock_cache):
        """Test that cache miss triggers computation."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True  # Lock acquired

        compute_func = MagicMock(return_value={'data': 'computed'})

        result = xfetch_get_or_compute('test_key', compute_func, ttl=300)

        self.assertEqual(result, {'data': 'computed'})
        compute_func.assert_called_once()
        mock_cache.set.assert_called_once()

    @patch('core.ai_usage.cache_service.cache')
    def test_cache_hit_returns_cached_value(self, mock_cache):
        """Test that cache hit returns cached value without computation."""
        cached_data = {
            'value': {'data': 'cached'},
            'cached_at': time.time(),
            'delta': 0.1,
        }
        mock_cache.get.return_value = cached_data

        compute_func = MagicMock()

        result = xfetch_get_or_compute('test_key', compute_func, ttl=300)

        self.assertEqual(result, {'data': 'cached'})
        compute_func.assert_not_called()

    @patch('core.ai_usage.cache_service.cache')
    def test_compute_and_cache_stores_metadata(self, mock_cache):
        """Test that computed values are stored with metadata."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        compute_func = MagicMock(return_value='test_value')

        _compute_and_cache('test_key', compute_func, ttl=300)

        # Verify cache.set was called with proper structure
        call_args = mock_cache.set.call_args
        cached_data = call_args[0][1]
        self.assertEqual(cached_data['value'], 'test_value')
        self.assertIn('cached_at', cached_data)
        self.assertIn('delta', cached_data)

    @patch('core.ai_usage.cache_service.cache')
    def test_lock_not_acquired_retries(self, mock_cache):
        """Test that lock acquisition retries eventually compute."""
        # When lock is not acquired, we wait and retry
        mock_cache.get.return_value = None
        mock_cache.add.side_effect = [
            False,  # First attempt - lock not acquired
            True,  # Second attempt - lock acquired
        ]

        compute_func = MagicMock(return_value='computed')

        with patch('core.ai_usage.cache_service.time.sleep'):
            result = _compute_and_cache('test_key', compute_func, ttl=300)

        # Should eventually compute and return value
        self.assertEqual(result, 'computed')
        compute_func.assert_called_once()


class GetOverviewKPIsTestCase(TestCase):
    """Tests for get_overview_kpis function."""

    def setUp(self):
        """Set up test data."""
        today = timezone.now().date()
        for i in range(7):
            date = today - timedelta(days=i)
            PlatformDailyStats.objects.create(
                date=date,
                total_users=1000 + i * 10,
                new_users_today=5,
                active_users_today=100,
                dau=100 + i * 5,
                total_ai_cost=Decimal('10.00'),
                new_projects_today=10,
                total_projects=500 + i * 10,
            )

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_overview_kpis(self, mock_cache):
        """Test that function returns expected KPIs."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_overview_kpis(days=7)

        self.assertIn('totalUsers', result)
        self.assertIn('activeUsers', result)
        self.assertIn('totalAiCost', result)
        self.assertIn('totalProjects', result)

    @patch('core.ai_usage.cache_service.cache')
    def test_uses_latest_cumulative_values(self, mock_cache):
        """Test that cumulative values use latest stats."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_overview_kpis(days=7)

        # totalUsers should be from the most recent day (1000)
        self.assertEqual(result['totalUsers'], 1000)


class GetTimeseriesDataTestCase(TestCase):
    """Tests for get_timeseries_data function."""

    def setUp(self):
        """Set up test data."""
        today = timezone.now().date()
        for i in range(7):
            date = today - timedelta(days=i)
            PlatformDailyStats.objects.create(
                date=date,
                dau=100 + i * 10,
                total_ai_cost=Decimal('10.00') + Decimal(i),
                new_projects_today=5 + i,
                active_users_today=80 + i * 5,
            )

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_timeseries_for_users(self, mock_cache):
        """Test timeseries for users metric."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_timeseries_data(metric='users', days=7)

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        for item in result:
            self.assertIn('date', item)
            self.assertIn('value', item)

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_timeseries_for_ai_cost(self, mock_cache):
        """Test timeseries for ai_cost metric."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_timeseries_data(metric='ai_cost', days=7)

        self.assertIsInstance(result, list)
        # Values should be numeric
        for item in result:
            self.assertIsInstance(item['value'], (int, float))

    @patch('core.ai_usage.cache_service.cache')
    def test_unknown_metric_defaults_to_dau(self, mock_cache):
        """Test that unknown metric defaults to DAU."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_timeseries_data(metric='unknown', days=7)

        # Should still return data (defaulting to DAU)
        self.assertIsInstance(result, list)


class GetAIBreakdownTestCase(TestCase):
    """Tests for get_ai_breakdown function."""

    def setUp(self):
        """Set up test data."""
        today = timezone.now().date()
        for i in range(3):
            date = today - timedelta(days=i)
            PlatformDailyStats.objects.create(
                date=date,
                ai_by_feature={
                    'chat': {'requests': 100, 'cost': 5.0},
                    'project_agent': {'requests': 50, 'cost': 3.0},
                },
                ai_by_provider={
                    'openai': {'requests': 120, 'cost': 6.0},
                    'anthropic': {'requests': 30, 'cost': 2.0},
                },
            )

    @patch('core.ai_usage.cache_service.cache')
    def test_breakdown_by_feature(self, mock_cache):
        """Test AI breakdown by feature."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_ai_breakdown(breakdown_type='feature', days=7)

        self.assertIn('chat', result)
        self.assertIn('project_agent', result)
        # Should aggregate across days
        self.assertEqual(result['chat']['requests'], 300)  # 100 * 3 days
        self.assertEqual(result['chat']['cost'], 15.0)  # 5.0 * 3 days

    @patch('core.ai_usage.cache_service.cache')
    def test_breakdown_by_provider(self, mock_cache):
        """Test AI breakdown by provider."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_ai_breakdown(breakdown_type='provider', days=7)

        self.assertIn('openai', result)
        self.assertIn('anthropic', result)
        self.assertEqual(result['openai']['requests'], 360)  # 120 * 3 days

    @patch('core.ai_usage.cache_service.cache')
    def test_breakdown_sorted_by_cost(self, mock_cache):
        """Test that breakdown is sorted by cost descending."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_ai_breakdown(breakdown_type='feature', days=7)

        costs = [v['cost'] for v in result.values()]
        self.assertEqual(costs, sorted(costs, reverse=True))


class GetUserGrowthMetricsTestCase(TestCase):
    """Tests for get_user_growth_metrics function."""

    def setUp(self):
        """Set up test data."""
        today = timezone.now().date()
        for i in range(7):
            date = today - timedelta(days=i)
            PlatformDailyStats.objects.create(
                date=date,
                total_users=1000 + (6 - i) * 50,  # Growing over time
                new_users_today=10,
                dau=100 + i,
                mau=500 + i * 10,
            )

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_growth_metrics(self, mock_cache):
        """Test that function returns expected metrics."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_user_growth_metrics(days=7)

        self.assertIn('totalUsers', result)
        self.assertIn('newUsers', result)
        self.assertIn('avgDau', result)
        self.assertIn('avgMau', result)
        self.assertIn('growthRate', result)
        self.assertIn('stickiness', result)

    @patch('core.ai_usage.cache_service.cache')
    def test_calculates_growth_rate(self, mock_cache):
        """Test that growth rate is calculated correctly."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_user_growth_metrics(days=7)

        # Growth rate should be positive (users are increasing)
        self.assertGreater(result['growthRate'], 0)

    @patch('core.ai_usage.cache_service.cache')
    def test_calculates_stickiness(self, mock_cache):
        """Test that stickiness (DAU/MAU) is calculated."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_user_growth_metrics(days=7)

        # Stickiness should be between 0 and 100
        self.assertGreaterEqual(result['stickiness'], 0)
        self.assertLessEqual(result['stickiness'], 100)


class EngagementCacheServicesTestCase(TestCase):
    """Tests for engagement-related cache services."""

    def setUp(self):
        """Set up test data."""
        today = timezone.now().date()
        for i in range(7):
            date = today - timedelta(days=i + 1)  # Start from yesterday
            EngagementDailyStats.objects.create(
                date=date,
                hourly_activity={str(h): 10 + h for h in range(24)},
                day_of_week=date.weekday(),
                total_actions=500 + i * 50,
                peak_hour=14,
                unique_active_users=100 + i * 10,
                feature_usage={
                    'quiz_complete': {'users': 30, 'actions': 90},
                    'daily_login': {'users': 100, 'actions': 100},
                },
                signups_today=20 + i,
                d1_cohort_size=15,
                d1_retained=10,
                d7_cohort_size=18,
                d7_retained=8,
                d30_cohort_size=20,
                d30_retained=5,
                first_action_count=15,
            )


class GetEngagementOverviewTestCase(EngagementCacheServicesTestCase):
    """Tests for get_engagement_overview function."""

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_overview_kpis(self, mock_cache):
        """Test that function returns expected KPIs."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_overview(days=7)

        self.assertIn('totalActions', result)
        self.assertIn('uniqueActiveUsers', result)
        self.assertIn('peakHour', result)
        self.assertIn('d7RetentionRate', result)

    @patch('core.ai_usage.cache_service.cache')
    def test_aggregates_total_actions(self, mock_cache):
        """Test that total actions are aggregated correctly."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_overview(days=7)

        # Should be sum of all days
        self.assertGreater(result['totalActions'], 0)


class GetEngagementHeatmapTestCase(EngagementCacheServicesTestCase):
    """Tests for get_engagement_heatmap function."""

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_heatmap_structure(self, mock_cache):
        """Test that function returns proper heatmap structure."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_heatmap(days=7)

        self.assertIn('heatmap', result)
        self.assertIn('dailyActions', result)
        self.assertIn('peakHour', result)
        self.assertIn('peakDay', result)
        self.assertIn('totalActions', result)

    @patch('core.ai_usage.cache_service.cache')
    def test_heatmap_dimensions(self, mock_cache):
        """Test that heatmap has correct dimensions (7x24)."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_heatmap(days=7)

        self.assertEqual(len(result['heatmap']), 7)
        for row in result['heatmap']:
            self.assertEqual(len(row), 24)

    @patch('core.ai_usage.cache_service.cache')
    def test_peak_day_is_valid(self, mock_cache):
        """Test that peak day is a valid day name."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_heatmap(days=7)

        valid_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        self.assertIn(result['peakDay'], valid_days)


class GetEngagementFeaturesTestCase(EngagementCacheServicesTestCase):
    """Tests for get_engagement_features function."""

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_features_list(self, mock_cache):
        """Test that function returns features list."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_features(days=7)

        self.assertIn('features', result)
        self.assertIn('topFeature', result)
        self.assertIn('totalUniqueUsers', result)
        self.assertIsInstance(result['features'], list)

    @patch('core.ai_usage.cache_service.cache')
    def test_feature_structure(self, mock_cache):
        """Test that each feature has expected fields."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_features(days=7)

        if result['features']:
            feature = result['features'][0]
            self.assertIn('name', feature)
            self.assertIn('activityType', feature)
            self.assertIn('uniqueUsers', feature)
            self.assertIn('totalActions', feature)
            self.assertIn('trend', feature)

    @patch('core.ai_usage.cache_service.cache')
    def test_features_sorted_by_actions(self, mock_cache):
        """Test that features are sorted by total actions descending."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_features(days=7)

        if len(result['features']) > 1:
            actions = [f['totalActions'] for f in result['features']]
            self.assertEqual(actions, sorted(actions, reverse=True))


class GetEngagementRetentionTestCase(EngagementCacheServicesTestCase):
    """Tests for get_engagement_retention function."""

    @patch('core.ai_usage.cache_service.cache')
    def test_returns_retention_data(self, mock_cache):
        """Test that function returns retention data."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_retention(days=7)

        self.assertIn('funnel', result)
        self.assertIn('funnelRates', result)
        self.assertIn('retentionCohorts', result)

    @patch('core.ai_usage.cache_service.cache')
    def test_funnel_structure(self, mock_cache):
        """Test that funnel has expected stages."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_retention(days=7)

        funnel = result['funnel']
        self.assertIn('signedUp', funnel)
        self.assertIn('hadFirstAction', funnel)
        self.assertIn('returnedDay7', funnel)
        self.assertIn('returnedDay30', funnel)

    @patch('core.ai_usage.cache_service.cache')
    def test_funnel_rates_structure(self, mock_cache):
        """Test that funnel rates have expected fields."""
        mock_cache.get.return_value = None
        mock_cache.add.return_value = True

        result = get_engagement_retention(days=7)

        rates = result['funnelRates']
        self.assertIn('signupToAction', rates)
        self.assertIn('actionToDay7', rates)
        self.assertIn('day7ToDay30', rates)


class InvalidateDashboardCacheTestCase(TestCase):
    """Tests for invalidate_dashboard_cache function."""

    def test_invalidate_logs_message(self):
        """Test that invalidation logs a message."""
        with self.assertLogs('core.ai_usage.cache_service', level='INFO') as logs:
            invalidate_dashboard_cache()

        self.assertTrue(any('invalidation' in log.lower() for log in logs.output))


class CacheTTLConstantsTestCase(TestCase):
    """Tests for cache TTL constants."""

    def test_overview_ttl_reasonable(self):
        """Test that overview TTL is reasonable (5-15 minutes)."""
        self.assertGreaterEqual(CACHE_TTL_OVERVIEW, 60)  # At least 1 minute
        self.assertLessEqual(CACHE_TTL_OVERVIEW, 900)  # At most 15 minutes

    def test_timeseries_ttl_reasonable(self):
        """Test that timeseries TTL is reasonable."""
        self.assertGreaterEqual(CACHE_TTL_TIMESERIES, 60)
        self.assertLessEqual(CACHE_TTL_TIMESERIES, 1800)  # At most 30 minutes

    def test_breakdown_ttl_reasonable(self):
        """Test that breakdown TTL is reasonable."""
        self.assertGreaterEqual(CACHE_TTL_BREAKDOWN, 60)
        self.assertLessEqual(CACHE_TTL_BREAKDOWN, 1800)

    def test_engagement_ttl_reasonable(self):
        """Test that engagement TTL is reasonable."""
        self.assertGreaterEqual(CACHE_TTL_ENGAGEMENT, 60)
        self.assertLessEqual(CACHE_TTL_ENGAGEMENT, 1800)
