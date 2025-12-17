"""
Tests for AI Usage models.

Tests AIProviderPricing, AIUsageLog, UserAICostSummary, PlatformDailyStats,
and EngagementDailyStats models.
"""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.ai_usage.models import (
    AIProviderPricing,
    AIUsageLog,
    EngagementDailyStats,
    PlatformDailyStats,
    UserAICostSummary,
)
from core.users.models import User


class AIProviderPricingTestCase(TestCase):
    """Tests for AIProviderPricing model."""

    def test_create_pricing(self):
        """Test creating a pricing record."""
        pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('30.00'),
            output_price_per_million=Decimal('60.00'),
        )

        self.assertEqual(pricing.provider, 'openai')
        self.assertEqual(pricing.model, 'gpt-4')
        self.assertEqual(pricing.input_price_per_million, Decimal('30.00'))
        self.assertEqual(pricing.output_price_per_million, Decimal('60.00'))
        self.assertTrue(pricing.is_active)

    def test_str_representation(self):
        """Test string representation of pricing."""
        pricing = AIProviderPricing.objects.create(
            provider='anthropic',
            model='claude-3-opus',
            input_price_per_million=Decimal('15.00'),
            output_price_per_million=Decimal('75.00'),
        )

        str_repr = str(pricing)
        self.assertIn('anthropic', str_repr)
        self.assertIn('claude-3-opus', str_repr)
        self.assertIn('$15.00', str_repr)
        self.assertIn('$75.00', str_repr)

    def test_display_name(self):
        """Test display_name property."""
        pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4o-mini',
            input_price_per_million=Decimal('0.15'),
            output_price_per_million=Decimal('0.60'),
        )

        self.assertEqual(pricing.display_name, 'Openai gpt-4o-mini')

    def test_effective_date_default(self):
        """Test that effective_date defaults to now."""
        before = timezone.now()
        pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('30.00'),
            output_price_per_million=Decimal('60.00'),
        )
        after = timezone.now()

        self.assertGreaterEqual(pricing.effective_date, before)
        self.assertLessEqual(pricing.effective_date, after)

    def test_pricing_ordering(self):
        """Test pricing records are ordered by effective_date descending."""
        old_pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('30.00'),
            output_price_per_million=Decimal('60.00'),
            effective_date=timezone.now() - timedelta(days=30),
        )
        new_pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('25.00'),
            output_price_per_million=Decimal('50.00'),
            effective_date=timezone.now(),
        )

        all_pricing = list(AIProviderPricing.objects.filter(model='gpt-4'))
        # Newest should be first
        self.assertEqual(all_pricing[0], new_pricing)
        self.assertEqual(all_pricing[1], old_pricing)

    def test_multiple_versions_same_model(self):
        """Test creating multiple pricing versions for same model."""
        # Old pricing
        AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('30.00'),
            output_price_per_million=Decimal('60.00'),
            effective_date=timezone.now() - timedelta(days=30),
            is_active=False,
        )
        # New pricing
        AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('25.00'),
            output_price_per_million=Decimal('50.00'),
            is_active=True,
        )

        active_count = AIProviderPricing.objects.filter(provider='openai', model='gpt-4', is_active=True).count()
        total_count = AIProviderPricing.objects.filter(provider='openai', model='gpt-4').count()

        self.assertEqual(active_count, 1)
        self.assertEqual(total_count, 2)


class AIUsageLogTestCase(TestCase):
    """Tests for AIUsageLog model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='ai_usage_test_user',
            email='ai_usage_test@example.com',
            password='testpass123',
        )
        self.pricing = AIProviderPricing.objects.create(
            provider='openai',
            model='gpt-4',
            input_price_per_million=Decimal('30.00'),
            output_price_per_million=Decimal('60.00'),
        )

    def test_create_usage_log(self):
        """Test creating a usage log entry."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            input_cost=Decimal('0.030000'),
            output_cost=Decimal('0.030000'),
            total_cost=Decimal('0.060000'),
            latency_ms=1500,
            status='success',
        )

        self.assertEqual(log.user, self.user)
        self.assertEqual(log.feature, 'chat')
        self.assertEqual(log.provider, 'openai')
        self.assertEqual(log.total_tokens, 1500)
        self.assertEqual(log.total_cost, Decimal('0.060000'))

    def test_cost_calculation_formula(self):
        """Test that cost is calculated correctly: (tokens / 1M) * price."""
        # 10,000 input tokens at $30/1M = $0.30
        # 5,000 output tokens at $60/1M = $0.30
        # Total = $0.60
        input_tokens = 10000
        output_tokens = 5000
        input_cost = (Decimal(input_tokens) / Decimal('1000000')) * Decimal('30.00')
        output_cost = (Decimal(output_tokens) / Decimal('1000000')) * Decimal('60.00')
        total_cost = input_cost + output_cost

        log = AIUsageLog.objects.create(
            user=self.user,
            feature='project_generation',
            provider='openai',
            model='gpt-4',
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            input_cost=input_cost,
            output_cost=output_cost,
            total_cost=total_cost,
            pricing_version=self.pricing,
        )

        self.assertEqual(log.input_cost, Decimal('0.30'))
        self.assertEqual(log.output_cost, Decimal('0.30'))
        self.assertEqual(log.total_cost, Decimal('0.60'))

    def test_cost_per_token_property(self):
        """Test cost_per_token property calculation."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            total_cost=Decimal('0.060000'),
        )

        cost_per_token = log.cost_per_token
        expected = Decimal('0.060000') / 1500
        self.assertEqual(cost_per_token, expected)

    def test_cost_per_token_zero_tokens(self):
        """Test cost_per_token returns 0 when total_tokens is 0."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            total_cost=Decimal('0'),
        )

        self.assertEqual(log.cost_per_token, Decimal('0'))

    def test_str_representation_privacy_safe(self):
        """Test string representation doesn't expose email."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_cost=Decimal('0.060000'),
        )

        str_repr = str(log)
        # Should contain user ID, not email
        self.assertIn(str(self.user.id), str_repr)
        self.assertNotIn(self.user.email, str_repr)
        self.assertIn('chat', str_repr)
        self.assertIn('openai', str_repr)

    def test_status_choices(self):
        """Test various status values."""
        for status_code, status_name in AIUsageLog.STATUS_CHOICES:
            log = AIUsageLog.objects.create(
                user=self.user,
                feature='chat',
                provider='openai',
                model='gpt-4',
                status=status_code,
            )
            self.assertEqual(log.status, status_code)

    def test_request_type_choices(self):
        """Test various request type values."""
        for request_type, type_name in AIUsageLog.REQUEST_TYPE_CHOICES:
            log = AIUsageLog.objects.create(
                user=self.user,
                feature='test_feature',
                provider='openai',
                model='gpt-4',
                request_type=request_type,
            )
            self.assertEqual(log.request_type, request_type)

    def test_metadata_json_fields(self):
        """Test storing metadata in JSON fields."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            request_metadata={
                'prompt_length': 500,
                'temperature': 0.7,
                'max_tokens': 1000,
            },
            response_metadata={
                'finish_reason': 'stop',
                'model_version': '2024-01-01',
            },
        )

        log.refresh_from_db()
        self.assertEqual(log.request_metadata['prompt_length'], 500)
        self.assertEqual(log.request_metadata['temperature'], 0.7)
        self.assertEqual(log.response_metadata['finish_reason'], 'stop')

    def test_usage_with_pricing_version(self):
        """Test linking usage log to pricing version."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            pricing_version=self.pricing,
            input_tokens=1000,
            total_cost=Decimal('0.03'),
        )

        self.assertEqual(log.pricing_version, self.pricing)
        self.assertEqual(log.pricing_version.input_price_per_million, Decimal('30.00'))

    def test_error_logging(self):
        """Test logging error status and message."""
        log = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
            status='error',
            error_message='Rate limit exceeded',
            latency_ms=500,
        )

        self.assertEqual(log.status, 'error')
        self.assertEqual(log.error_message, 'Rate limit exceeded')

    def test_ordering_by_created_at(self):
        """Test logs are ordered by created_at descending."""
        log1 = AIUsageLog.objects.create(
            user=self.user,
            feature='chat',
            provider='openai',
            model='gpt-4',
        )
        log2 = AIUsageLog.objects.create(
            user=self.user,
            feature='project_generation',
            provider='openai',
            model='gpt-4',
        )

        logs = list(AIUsageLog.objects.all())
        # Most recent should be first
        self.assertEqual(logs[0], log2)
        self.assertEqual(logs[1], log1)


class UserAICostSummaryTestCase(TestCase):
    """Tests for UserAICostSummary model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='cost_summary_test_user',
            email='cost_summary@example.com',
            password='testpass123',
        )
        self.user2 = User.objects.create_user(
            username='cost_summary_test_user2',
            email='cost_summary2@example.com',
            password='testpass123',
        )

    def test_create_daily_summary(self):
        """Test creating a daily cost summary."""
        today = timezone.now().date()
        summary = UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_requests=50,
            total_tokens=25000,
            total_cost=Decimal('1.50'),
            cost_by_feature={'chat': 1.0, 'project_gen': 0.5},
            cost_by_provider={'openai': 1.0, 'anthropic': 0.5},
            requests_by_feature={'chat': 30, 'project_gen': 20},
        )

        self.assertEqual(summary.user, self.user)
        self.assertEqual(summary.date, today)
        self.assertEqual(summary.total_requests, 50)
        self.assertEqual(summary.total_cost, Decimal('1.50'))
        self.assertEqual(summary.cost_by_feature['chat'], 1.0)

    def test_unique_together_constraint(self):
        """Test that user/date combination must be unique."""
        today = timezone.now().date()
        UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_cost=Decimal('1.00'),
        )

        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            UserAICostSummary.objects.create(
                user=self.user,
                date=today,
                total_cost=Decimal('2.00'),
            )

    def test_get_user_monthly_cost(self):
        """Test get_user_monthly_cost class method."""
        today = timezone.now()
        year, month = today.year, today.month

        # Create summaries for this month
        for day in range(1, 6):
            try:
                date = today.replace(day=day).date()
                UserAICostSummary.objects.create(
                    user=self.user,
                    date=date,
                    total_cost=Decimal('10.00'),
                )
            except ValueError:
                # Skip invalid dates (e.g., Feb 30)
                pass

        monthly_cost = UserAICostSummary.get_user_monthly_cost(self.user, year=year, month=month)

        # Should be sum of all days we created
        self.assertGreaterEqual(monthly_cost, Decimal('10.00'))

    def test_get_user_monthly_cost_defaults_to_current_month(self):
        """Test get_user_monthly_cost uses current month by default."""
        today = timezone.now().date()
        UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_cost=Decimal('25.00'),
        )

        monthly_cost = UserAICostSummary.get_user_monthly_cost(self.user)

        self.assertEqual(monthly_cost, Decimal('25.00'))

    def test_get_user_monthly_cost_returns_zero_for_no_data(self):
        """Test get_user_monthly_cost returns 0 when no data exists."""
        monthly_cost = UserAICostSummary.get_user_monthly_cost(self.user, year=2020, month=1)

        self.assertEqual(monthly_cost, Decimal('0'))

    def test_get_top_users_by_cost(self):
        """Test get_top_users_by_cost class method."""
        today = timezone.now().date()

        # User 1: high cost
        UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_cost=Decimal('100.00'),
            total_requests=500,
        )
        # User 2: low cost
        UserAICostSummary.objects.create(
            user=self.user2,
            date=today,
            total_cost=Decimal('10.00'),
            total_requests=50,
        )

        top_users = UserAICostSummary.get_top_users_by_cost(days=30, limit=10)
        top_users_list = list(top_users)

        self.assertEqual(len(top_users_list), 2)
        # User 1 should be first (highest cost)
        self.assertEqual(top_users_list[0]['user__id'], self.user.id)
        self.assertEqual(top_users_list[0]['total_cost'], Decimal('100.00'))

    def test_get_cau_calculation(self):
        """Test CAU (Cost per Active User) calculation."""
        from django.core.cache import cache

        today = timezone.now().date()

        # Create data for 2 users
        UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_cost=Decimal('30.00'),
        )
        UserAICostSummary.objects.create(
            user=self.user2,
            date=today,
            total_cost=Decimal('20.00'),
        )

        # Clear cache to ensure fresh calculation
        cache.clear()
        result = UserAICostSummary.get_cau(days=30)

        # Total cost = $50, active users = 2, CAU = $25
        self.assertEqual(result['total_cost'], Decimal('50.00'))
        self.assertEqual(result['active_users'], 2)
        self.assertEqual(result['cau'], Decimal('25.00'))

    def test_get_cau_no_active_users(self):
        """Test CAU returns 0 when no active users."""
        from django.core.cache import cache

        cache.clear()
        result = UserAICostSummary.get_cau(days=30)

        self.assertEqual(result['cau'], Decimal('0'))
        self.assertEqual(result['active_users'], 0)

    def test_get_cau_with_date_range(self):
        """Test CAU with explicit start and end dates."""
        from django.core.cache import cache

        start_date = timezone.now().date() - timedelta(days=7)
        end_date = timezone.now().date()

        UserAICostSummary.objects.create(
            user=self.user,
            date=start_date,
            total_cost=Decimal('50.00'),
        )

        cache.clear()
        result = UserAICostSummary.get_cau(start_date=start_date, end_date=end_date)

        self.assertEqual(result['start_date'], start_date)
        self.assertEqual(result['end_date'], end_date)
        self.assertEqual(result['total_cost'], Decimal('50.00'))

    def test_str_representation_privacy_safe(self):
        """Test string representation doesn't expose email."""
        today = timezone.now().date()
        summary = UserAICostSummary.objects.create(
            user=self.user,
            date=today,
            total_cost=Decimal('25.50'),
        )

        str_repr = str(summary)
        self.assertIn(str(self.user.id), str_repr)
        self.assertNotIn(self.user.email, str_repr)
        self.assertIn('$25.50', str_repr)


class PlatformDailyStatsTestCase(TestCase):
    """Tests for PlatformDailyStats model."""

    def test_create_daily_stats(self):
        """Test creating platform daily stats."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            total_users=1000,
            new_users_today=50,
            active_users_today=300,
            dau=300,
            wau=600,
            mau=800,
            total_ai_requests=5000,
            total_ai_tokens=2500000,
            total_ai_cost=Decimal('125.00'),
            ai_users_today=200,
            cau=Decimal('0.625'),
        )

        self.assertEqual(stats.total_users, 1000)
        self.assertEqual(stats.new_users_today, 50)
        self.assertEqual(stats.dau, 300)
        self.assertEqual(stats.total_ai_cost, Decimal('125.00'))

    def test_unique_date_constraint(self):
        """Test that date must be unique."""
        today = timezone.now().date()
        PlatformDailyStats.objects.create(
            date=today,
            total_users=1000,
        )

        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            PlatformDailyStats.objects.create(
                date=today,
                total_users=1100,
            )

    def test_user_growth_rate_property(self):
        """Test user_growth_rate property calculation."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            total_users=1000,
            new_users_today=50,
        )

        # 50 new users / 1000 total * 100 = 5%
        self.assertEqual(stats.user_growth_rate, 5.0)

    def test_user_growth_rate_zero_users(self):
        """Test user_growth_rate returns 0 when no users."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            total_users=0,
            new_users_today=0,
        )

        self.assertEqual(stats.user_growth_rate, 0.0)

    def test_ai_adoption_rate_property(self):
        """Test ai_adoption_rate property calculation."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            active_users_today=100,
            ai_users_today=40,
        )

        # 40 AI users / 100 active * 100 = 40%
        self.assertEqual(stats.ai_adoption_rate, 40.0)

    def test_ai_adoption_rate_no_active_users(self):
        """Test ai_adoption_rate returns 0 when no active users."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            active_users_today=0,
            ai_users_today=0,
        )

        self.assertEqual(stats.ai_adoption_rate, 0.0)

    def test_ai_breakdown_json_fields(self):
        """Test storing AI breakdown in JSON fields."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            ai_by_feature={
                'project_agent': {'requests': 1000, 'cost': 50.0},
                'chat': {'requests': 500, 'cost': 25.0},
            },
            ai_by_provider={
                'openai': {'requests': 1200, 'cost': 60.0},
                'anthropic': {'requests': 300, 'cost': 15.0},
            },
        )

        stats.refresh_from_db()
        self.assertEqual(stats.ai_by_feature['project_agent']['requests'], 1000)
        self.assertEqual(stats.ai_by_provider['openai']['cost'], 60.0)

    def test_str_representation(self):
        """Test string representation."""
        today = timezone.now().date()
        stats = PlatformDailyStats.objects.create(
            date=today,
            total_users=1000,
            total_ai_requests=5000,
            total_ai_cost=Decimal('125.00'),
        )

        str_repr = str(stats)
        self.assertIn(str(today), str_repr)
        self.assertIn('1000', str_repr)
        self.assertIn('5000', str_repr)


class EngagementDailyStatsTestCase(TestCase):
    """Tests for EngagementDailyStats model."""

    def test_create_engagement_stats(self):
        """Test creating engagement daily stats."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            hourly_activity={
                '9': 50,
                '10': 80,
                '11': 100,
                '12': 75,
                '14': 90,
                '15': 85,
                '16': 70,
                '17': 40,
            },
            day_of_week=today.weekday(),
            total_actions=590,
            peak_hour=11,
            unique_active_users=150,
        )

        self.assertEqual(stats.total_actions, 590)
        self.assertEqual(stats.peak_hour, 11)
        self.assertEqual(stats.unique_active_users, 150)

    def test_unique_date_constraint(self):
        """Test that date must be unique."""
        today = timezone.now().date()
        EngagementDailyStats.objects.create(
            date=today,
            total_actions=100,
        )

        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            EngagementDailyStats.objects.create(
                date=today,
                total_actions=200,
            )

    def test_d7_retention_rate_property(self):
        """Test d7_retention_rate property calculation."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            d7_cohort_size=100,
            d7_retained=35,
        )

        # 35 retained / 100 cohort * 100 = 35%
        self.assertEqual(stats.d7_retention_rate, 35.0)

    def test_d7_retention_rate_zero_cohort(self):
        """Test d7_retention_rate returns 0 when cohort size is 0."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            d7_cohort_size=0,
            d7_retained=0,
        )

        self.assertEqual(stats.d7_retention_rate, 0.0)

    def test_feature_usage_json_field(self):
        """Test storing feature usage in JSON field."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            feature_usage={
                'quiz_complete': {'users': 50, 'actions': 120},
                'project_create': {'users': 30, 'actions': 45},
                'daily_login': {'users': 150, 'actions': 150},
            },
        )

        stats.refresh_from_db()
        self.assertEqual(stats.feature_usage['quiz_complete']['users'], 50)
        self.assertEqual(stats.feature_usage['daily_login']['actions'], 150)

    def test_retention_cohort_fields(self):
        """Test retention cohort tracking fields."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            signups_today=100,
            d1_cohort_size=95,
            d1_retained=70,
            d7_cohort_size=80,
            d7_retained=40,
            d30_cohort_size=50,
            d30_retained=20,
            first_action_count=85,
        )

        self.assertEqual(stats.signups_today, 100)
        self.assertEqual(stats.d1_retained, 70)
        self.assertEqual(stats.d7_retained, 40)
        self.assertEqual(stats.d30_retained, 20)
        self.assertEqual(stats.first_action_count, 85)

    def test_str_representation(self):
        """Test string representation."""
        today = timezone.now().date()
        stats = EngagementDailyStats.objects.create(
            date=today,
            total_actions=500,
            unique_active_users=150,
        )

        str_repr = str(stats)
        self.assertIn(str(today), str_repr)
        self.assertIn('500', str_repr)
        self.assertIn('150', str_repr)

    def test_hourly_activity_structure(self):
        """Test hourly activity stores all 24 hours correctly."""
        today = timezone.now().date()
        hourly = {str(h): h * 10 for h in range(24)}

        stats = EngagementDailyStats.objects.create(
            date=today,
            hourly_activity=hourly,
        )

        stats.refresh_from_db()
        self.assertEqual(len(stats.hourly_activity), 24)
        self.assertEqual(stats.hourly_activity['0'], 0)
        self.assertEqual(stats.hourly_activity['12'], 120)
        self.assertEqual(stats.hourly_activity['23'], 230)
