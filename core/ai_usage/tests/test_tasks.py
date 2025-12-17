"""
Tests for AI usage Celery tasks.

Tests aggregate_platform_daily_stats and aggregate_engagement_daily_stats tasks.
"""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.ai_usage.models import (
    AIUsageLog,
    EngagementDailyStats,
    PlatformDailyStats,
)
from core.ai_usage.tasks import (
    aggregate_engagement_daily_stats,
    aggregate_platform_daily_stats,
)
from core.users.models import User


class AggregatePlatformDailyStatsTestCase(TestCase):
    """Tests for aggregate_platform_daily_stats Celery task."""

    def setUp(self):
        """Set up test data."""
        # Create regular user (not internal)
        self.user = User.objects.create_user(
            username='platform_stats_user',
            email='platform_stats@example.com',
            password='testpass123',
            tier='free',
        )
        self.user2 = User.objects.create_user(
            username='platform_stats_user2',
            email='platform_stats2@example.com',
            password='testpass123',
            tier='free',
        )
        # Create internal user (should be excluded from some metrics)
        self.internal_user = User.objects.create_user(
            username='internal_user',
            email='internal@allthrive.ai',
            password='testpass123',
        )

    def test_aggregates_user_metrics(self):
        """Test that task correctly aggregates user metrics."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        # Set user join dates to before yesterday
        self.user.date_joined = timezone.now() - timedelta(days=10)
        self.user.save()
        self.user2.date_joined = timezone.now() - timedelta(days=5)
        self.user2.save()

        result = aggregate_platform_daily_stats(date_str=str(yesterday))

        self.assertEqual(result['date'], str(yesterday))
        self.assertIn('action', result)
        self.assertIn('total_users', result)

        # Check stats were created
        stats = PlatformDailyStats.objects.get(date=yesterday)
        self.assertIsNotNone(stats)
        # Should count users who joined before this date
        self.assertGreaterEqual(stats.total_users, 2)

    def test_aggregates_ai_metrics(self):
        """Test that task correctly aggregates AI usage metrics."""
        yesterday = (timezone.now() - timedelta(days=1)).date()
        yesterday_datetime = timezone.now() - timedelta(days=1)

        # Create AI usage logs and manually update their created_at
        # (auto_now_add ignores the field on create)
        log1 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            total_cost=Decimal('0.06'),
        )
        log2 = AIUsageLog.objects.create(
            user=self.user2,
            feature='project_generation',
            provider='anthropic',
            model='claude-3',
            input_tokens=2000,
            output_tokens=1000,
            total_tokens=3000,
            total_cost=Decimal('0.12'),
        )
        # Update created_at using raw SQL to bypass auto_now_add
        AIUsageLog.objects.filter(id=log1.id).update(created_at=yesterday_datetime)
        AIUsageLog.objects.filter(id=log2.id).update(created_at=yesterday_datetime)

        result = aggregate_platform_daily_stats(date_str=str(yesterday))

        stats = PlatformDailyStats.objects.get(date=yesterday)

        self.assertEqual(stats.total_ai_requests, 2)
        self.assertEqual(stats.total_ai_tokens, 4500)
        self.assertEqual(stats.total_ai_cost, Decimal('0.18'))
        self.assertEqual(stats.ai_users_today, 2)

    def test_aggregates_ai_breakdown_by_feature(self):
        """Test that task correctly breaks down AI usage by feature."""
        yesterday = (timezone.now() - timedelta(days=1)).date()
        yesterday_datetime = timezone.now() - timedelta(days=1)

        # Create AI usage logs with different features
        log1 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.05'),
        )
        log2 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.03'),
        )
        log3 = AIUsageLog.objects.create(
            user=self.user,
            feature='project_generation',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.10'),
        )
        # Update created_at using queryset update to bypass auto_now_add
        AIUsageLog.objects.filter(id__in=[log1.id, log2.id, log3.id]).update(created_at=yesterday_datetime)

        aggregate_platform_daily_stats(date_str=str(yesterday))

        stats = PlatformDailyStats.objects.get(date=yesterday)

        # Check feature breakdown
        self.assertIn('chat', stats.ai_by_feature)
        self.assertIn('project_generation', stats.ai_by_feature)
        self.assertEqual(stats.ai_by_feature['chat']['requests'], 2)
        self.assertEqual(stats.ai_by_feature['chat']['cost'], 0.08)
        self.assertEqual(stats.ai_by_feature['project_generation']['requests'], 1)
        self.assertEqual(stats.ai_by_feature['project_generation']['cost'], 0.10)

    def test_aggregates_ai_breakdown_by_provider(self):
        """Test that task correctly breaks down AI usage by provider."""
        yesterday = (timezone.now() - timedelta(days=1)).date()
        yesterday_datetime = timezone.now() - timedelta(days=1)

        # Create AI usage logs with different providers
        log1 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.10'),
        )
        log2 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='anthropic',
            model='claude-3',
            total_cost=Decimal('0.08'),
        )
        # Update created_at using queryset update to bypass auto_now_add
        AIUsageLog.objects.filter(id__in=[log1.id, log2.id]).update(created_at=yesterday_datetime)

        aggregate_platform_daily_stats(date_str=str(yesterday))

        stats = PlatformDailyStats.objects.get(date=yesterday)

        # Check provider breakdown
        self.assertIn('openai', stats.ai_by_provider)
        self.assertIn('anthropic', stats.ai_by_provider)
        self.assertEqual(stats.ai_by_provider['openai']['cost'], 0.10)
        self.assertEqual(stats.ai_by_provider['anthropic']['cost'], 0.08)

    def test_cau_calculation(self):
        """Test CAU (Cost per Active User) calculation."""
        yesterday = (timezone.now() - timedelta(days=1)).date()
        yesterday_datetime = timezone.now() - timedelta(days=1)

        # Create AI usage: 2 users, $0.50 total cost
        log1 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.30'),
        )
        log2 = AIUsageLog.objects.create(
            user=self.user2,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.20'),
        )
        # Update created_at using queryset update to bypass auto_now_add
        AIUsageLog.objects.filter(id__in=[log1.id, log2.id]).update(created_at=yesterday_datetime)

        aggregate_platform_daily_stats(date_str=str(yesterday))

        stats = PlatformDailyStats.objects.get(date=yesterday)

        # CAU = $0.50 / 2 users = $0.25
        self.assertEqual(stats.total_ai_cost, Decimal('0.50'))
        self.assertEqual(stats.ai_users_today, 2)
        self.assertEqual(stats.cau, Decimal('0.25'))

    def test_cau_zero_when_no_ai_users(self):
        """Test CAU is 0 when no AI users."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        # No AI usage logs

        aggregate_platform_daily_stats(date_str=str(yesterday))

        stats = PlatformDailyStats.objects.get(date=yesterday)

        self.assertEqual(stats.ai_users_today, 0)
        self.assertEqual(stats.cau, Decimal('0'))

    def test_update_existing_stats(self):
        """Test that running task again updates existing stats."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        # Create initial stats
        PlatformDailyStats.objects.create(
            date=yesterday,
            total_users=100,
            total_ai_requests=50,
        )

        result = aggregate_platform_daily_stats(date_str=str(yesterday))

        self.assertEqual(result['action'], 'updated')

        # Should still only have one record
        count = PlatformDailyStats.objects.filter(date=yesterday).count()
        self.assertEqual(count, 1)

    def test_defaults_to_yesterday(self):
        """Test that task defaults to yesterday when no date provided."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        # Call without date_str
        result = aggregate_platform_daily_stats()

        self.assertEqual(result['date'], str(yesterday))


class AggregateEngagementDailyStatsTestCase(TestCase):
    """Tests for aggregate_engagement_daily_stats Celery task."""

    def setUp(self):
        """Set up test data."""
        # Create regular user
        self.user = User.objects.create_user(
            username='engagement_stats_user',
            email='engagement@example.com',
            password='testpass123',
            tier='free',
        )
        self.user2 = User.objects.create_user(
            username='engagement_stats_user2',
            email='engagement2@example.com',
            password='testpass123',
            tier='free',
        )

    def test_creates_engagement_stats(self):
        """Test that task creates engagement stats record."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        result = aggregate_engagement_daily_stats(date_str=str(yesterday))

        self.assertEqual(result['date'], str(yesterday))
        self.assertIn('action', result)

        stats = EngagementDailyStats.objects.get(date=yesterday)
        self.assertIsNotNone(stats)
        self.assertEqual(stats.day_of_week, yesterday.weekday())

    def test_update_existing_stats(self):
        """Test that running task again updates existing stats."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        # Create initial stats
        EngagementDailyStats.objects.create(
            date=yesterday,
            total_actions=50,
        )

        result = aggregate_engagement_daily_stats(date_str=str(yesterday))

        self.assertEqual(result['action'], 'updated')

        # Should still only have one record
        count = EngagementDailyStats.objects.filter(date=yesterday).count()
        self.assertEqual(count, 1)

    def test_defaults_to_yesterday(self):
        """Test that task defaults to yesterday when no date provided."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        result = aggregate_engagement_daily_stats()

        self.assertEqual(result['date'], str(yesterday))

    def test_day_of_week_calculation(self):
        """Test that day_of_week is correctly set."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        aggregate_engagement_daily_stats(date_str=str(yesterday))

        stats = EngagementDailyStats.objects.get(date=yesterday)
        self.assertEqual(stats.day_of_week, yesterday.weekday())

    def test_hourly_activity_initialized(self):
        """Test that hourly_activity is initialized."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        aggregate_engagement_daily_stats(date_str=str(yesterday))

        stats = EngagementDailyStats.objects.get(date=yesterday)
        # Should have hourly activity dict
        self.assertIsNotNone(stats.hourly_activity)
        self.assertIsInstance(stats.hourly_activity, dict)

    def test_retention_cohorts_tracked(self):
        """Test that retention cohort metrics are tracked."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        aggregate_engagement_daily_stats(date_str=str(yesterday))

        stats = EngagementDailyStats.objects.get(date=yesterday)
        # Should have cohort tracking fields
        self.assertIsNotNone(stats.signups_today)
        self.assertIsNotNone(stats.d1_cohort_size)
        self.assertIsNotNone(stats.d7_cohort_size)
        self.assertIsNotNone(stats.d30_cohort_size)
