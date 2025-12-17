"""
Tests for AI usage analytics dashboard views.

Tests admin analytics API endpoints.
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.ai_usage.models import EngagementDailyStats, PlatformDailyStats
from core.users.models import User


class AdminAnalyticsViewsBaseTestCase(TestCase):
    """Base test case for admin analytics views."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin_analytics_user',
            email='admin_analytics@example.com',
            password='testpass123',
            role='admin',
        )

        # Create regular user
        self.regular_user = User.objects.create_user(
            username='regular_analytics_user',
            email='regular_analytics@example.com',
            password='testpass123',
        )

        # Create test platform stats
        today = timezone.now().date()
        for i in range(7):
            date = today - timedelta(days=i)
            PlatformDailyStats.objects.create(
                date=date,
                total_users=1000 + i * 10,
                new_users_today=5 + i,
                active_users_today=100 + i * 5,
                dau=100 + i * 5,
                wau=400,
                mau=800,
                total_ai_requests=500 + i * 50,
                total_ai_tokens=250000 + i * 25000,
                total_ai_cost=Decimal('25.00') + Decimal(i),
                ai_users_today=50 + i * 3,
                cau=Decimal('0.50'),
                ai_by_feature={
                    'chat': {'requests': 300, 'cost': 15.0},
                    'project_agent': {'requests': 200, 'cost': 10.0},
                },
                ai_by_provider={
                    'openai': {'requests': 400, 'cost': 20.0},
                    'anthropic': {'requests': 100, 'cost': 5.0},
                },
                new_projects_today=20 + i,
                total_projects=500 + i * 20,
                total_project_views=1000 + i * 100,
                total_project_clicks=200 + i * 20,
                total_comments=50 + i * 5,
            )


class DashboardOverviewTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_overview endpoint."""

    def test_overview_requires_admin(self):
        """Test that overview endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/overview/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_overview_accessible_by_admin(self):
        """Test that admin can access overview endpoint."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_overview_returns_kpis(self):
        """Test that overview returns expected KPI fields."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/overview/')

        data = response.json()
        self.assertIn('totalUsers', data)
        self.assertIn('activeUsers', data)
        self.assertIn('totalAiCost', data)
        self.assertIn('totalProjects', data)

    def test_overview_with_days_param(self):
        """Test overview with custom days parameter."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/overview/?days=7')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_overview_unauthenticated(self):
        """Test that unauthenticated requests are rejected."""
        response = self.client.get('/api/v1/admin/analytics/overview/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DashboardTimeseriesTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_timeseries endpoint."""

    def test_timeseries_requires_admin(self):
        """Test that timeseries endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=users')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_timeseries_requires_metric_param(self):
        """Test that metric parameter is required."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('metric parameter is required', response.json()['error'])

    def test_timeseries_users_metric(self):
        """Test timeseries with users metric."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=users')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('data', data)
        self.assertIsInstance(data['data'], list)

    def test_timeseries_ai_cost_metric(self):
        """Test timeseries with ai_cost metric."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=ai_cost')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('data', data)

    def test_timeseries_projects_metric(self):
        """Test timeseries with projects metric."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=projects')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_timeseries_engagement_metric(self):
        """Test timeseries with engagement metric."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=engagement')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_timeseries_with_days_param(self):
        """Test timeseries with custom days parameter."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=users&days=7')

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DashboardAIBreakdownTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_ai_breakdown endpoint."""

    def test_ai_breakdown_requires_admin(self):
        """Test that AI breakdown endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/?type=feature')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ai_breakdown_requires_type_param(self):
        """Test that type parameter is required."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('type must be', response.json()['error'])

    def test_ai_breakdown_invalid_type(self):
        """Test that invalid type parameter is rejected."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/?type=invalid')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ai_breakdown_by_feature(self):
        """Test AI breakdown by feature."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/?type=feature')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('breakdown', data)
        # Should have aggregated feature data
        if data['breakdown']:
            for key, value in data['breakdown'].items():
                self.assertIn('requests', value)
                self.assertIn('cost', value)

    def test_ai_breakdown_by_provider(self):
        """Test AI breakdown by provider."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/?type=provider')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('breakdown', data)


class DashboardUserGrowthTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_user_growth endpoint."""

    def test_user_growth_requires_admin(self):
        """Test that user growth endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/user-growth/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_growth_returns_metrics(self):
        """Test that user growth returns expected metrics."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/user-growth/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('totalUsers', data)
        self.assertIn('newUsers', data)
        self.assertIn('avgDau', data)
        self.assertIn('avgMau', data)
        self.assertIn('growthRate', data)
        self.assertIn('stickiness', data)

    def test_user_growth_with_days_param(self):
        """Test user growth with custom days parameter."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/user-growth/?days=14')

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DashboardContentMetricsTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_content_metrics endpoint."""

    def test_content_metrics_requires_admin(self):
        """Test that content metrics endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/content/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_content_metrics_returns_data(self):
        """Test that content metrics returns expected fields."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/content/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('totalProjects', data)
        self.assertIn('totalViews', data)
        self.assertIn('totalClicks', data)
        self.assertIn('totalComments', data)
        self.assertIn('engagementRate', data)


class DashboardGuestBattlesTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for dashboard_guest_battles endpoint."""

    def test_guest_battles_requires_admin(self):
        """Test that guest battles endpoint requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/guest-battles/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_guest_battles_returns_metrics(self):
        """Test that guest battles returns expected metrics."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/guest-battles/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('totalGuests', data)
        self.assertIn('guestsConverted', data)
        self.assertIn('conversionRate', data)
        self.assertIn('battlesWithGuests', data)
        self.assertIn('conversionFunnel', data)


class EngagementDashboardViewsTestCase(TestCase):
    """Tests for engagement dashboard endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create admin user
        self.admin_user = User.objects.create_user(
            username='engagement_admin',
            email='engagement_admin@example.com',
            password='testpass123',
            role='admin',
        )

        # Create regular user
        self.regular_user = User.objects.create_user(
            username='engagement_regular',
            email='engagement_regular@example.com',
            password='testpass123',
        )

        # Create test engagement stats
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


class EngagementOverviewTestCase(EngagementDashboardViewsTestCase):
    """Tests for engagement overview endpoint."""

    def test_engagement_overview_requires_admin(self):
        """Test that engagement overview requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/overview/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_engagement_overview_returns_kpis(self):
        """Test that engagement overview returns expected KPIs."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('totalActions', data)
        self.assertIn('uniqueActiveUsers', data)
        self.assertIn('peakHour', data)
        self.assertIn('d7RetentionRate', data)


class EngagementHeatmapTestCase(EngagementDashboardViewsTestCase):
    """Tests for engagement heatmap endpoint."""

    def test_engagement_heatmap_requires_admin(self):
        """Test that engagement heatmap requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/heatmap/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_engagement_heatmap_returns_data(self):
        """Test that engagement heatmap returns expected data."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/heatmap/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('heatmap', data)
        self.assertIn('dailyActions', data)
        self.assertIn('peakHour', data)
        self.assertIn('peakDay', data)
        self.assertIn('totalActions', data)

        # Heatmap should be 7x24 matrix
        self.assertEqual(len(data['heatmap']), 7)
        for row in data['heatmap']:
            self.assertEqual(len(row), 24)


class EngagementFeaturesTestCase(EngagementDashboardViewsTestCase):
    """Tests for engagement features endpoint."""

    def test_engagement_features_requires_admin(self):
        """Test that engagement features requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/features/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_engagement_features_returns_data(self):
        """Test that engagement features returns expected data."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/features/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('features', data)
        self.assertIn('topFeature', data)
        self.assertIn('totalUniqueUsers', data)

        # Each feature should have expected fields
        if data['features']:
            feature = data['features'][0]
            self.assertIn('name', feature)
            self.assertIn('activityType', feature)
            self.assertIn('uniqueUsers', feature)
            self.assertIn('totalActions', feature)
            self.assertIn('trend', feature)


class EngagementRetentionTestCase(EngagementDashboardViewsTestCase):
    """Tests for engagement retention endpoint."""

    def test_engagement_retention_requires_admin(self):
        """Test that engagement retention requires admin role."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/retention/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_engagement_retention_returns_data(self):
        """Test that engagement retention returns expected data."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/engagement/retention/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('funnel', data)
        self.assertIn('funnelRates', data)
        self.assertIn('retentionCohorts', data)

        # Funnel should have expected stages
        funnel = data['funnel']
        self.assertIn('signedUp', funnel)
        self.assertIn('hadFirstAction', funnel)
        self.assertIn('returnedDay7', funnel)
        self.assertIn('returnedDay30', funnel)

        # Funnel rates should have expected fields
        rates = data['funnelRates']
        self.assertIn('signupToAction', rates)
        self.assertIn('actionToDay7', rates)
        self.assertIn('day7ToDay30', rates)


class ErrorHandlingTestCase(AdminAnalyticsViewsBaseTestCase):
    """Tests for error handling in analytics views."""

    @patch('core.ai_usage.views.get_overview_kpis')
    def test_overview_handles_errors(self, mock_get_kpis):
        """Test that overview endpoint handles errors gracefully."""
        mock_get_kpis.side_effect = Exception('Database error')

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/overview/')

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.json())

    @patch('core.ai_usage.views.get_timeseries_data')
    def test_timeseries_handles_errors(self, mock_get_timeseries):
        """Test that timeseries endpoint handles errors gracefully."""
        mock_get_timeseries.side_effect = Exception('Database error')

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/timeseries/?metric=users')

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.json())

    @patch('core.ai_usage.views.get_ai_breakdown')
    def test_ai_breakdown_handles_errors(self, mock_get_breakdown):
        """Test that AI breakdown endpoint handles errors gracefully."""
        mock_get_breakdown.side_effect = Exception('Database error')

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/admin/analytics/ai-breakdown/?type=feature')

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.json())
