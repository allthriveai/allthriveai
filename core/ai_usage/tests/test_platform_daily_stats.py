"""
Unit tests for aggregate_platform_daily_stats Celery task.

Tests that the task correctly calculates and stores all daily user growth,
AI usage, and content metrics.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from core.agents.models import HallucinationMetrics
from core.ai_usage.models import AIUsageLog, PlatformDailyStats
from core.ai_usage.tasks import aggregate_platform_daily_stats
from core.events.models import Event
from core.projects.models import Project, ProjectClick, ProjectComment, ProjectView
from core.quizzes.models import QuizAttempt
from core.thrive_circle.models import UserSideQuest
from core.tools.models import ToolReview

User = get_user_model()


@pytest.fixture
def test_date():
    """Target date for aggregation."""
    return date(2025, 1, 15)


@pytest.fixture
def users(db, test_date):
    """Create test users with different join dates."""
    # Users before test date
    user1 = User.objects.create_user(
        username='user1',
        email='user1@example.com',
        password='test123',
    )
    user1.date_joined = timezone.make_aware(timezone.datetime(2025, 1, 10, 10, 0, 0))
    user1.last_login = timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time()))
    user1.save()

    # User joined on test date
    user2 = User.objects.create_user(
        username='user2',
        email='user2@example.com',
        password='test123',
    )
    user2.date_joined = timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time()))
    user2.save()

    # User joined after test date (should not be counted in totals)
    user3 = User.objects.create_user(
        username='user3',
        email='user3@example.com',
        password='test123',
    )
    user3.date_joined = timezone.make_aware(timezone.datetime(2025, 1, 20, 10, 0, 0))
    user3.save()

    return {'user1': user1, 'user2': user2, 'user3': user3}


@pytest.mark.django_db
class TestUserGrowthMetrics:
    """Test user growth metric calculations."""

    def test_total_users_cumulative(self, users, test_date):
        """Total users includes all users up to target date."""
        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Should include user1 and user2, not user3
        assert stats.total_users == 2

    def test_new_users_today_count(self, users, test_date):
        """New users today counts only users who joined on target date."""
        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Only user2 joined on test_date
        assert stats.new_users_today == 1

    def test_active_users_today_with_login(self, users, test_date):
        """Active users includes users who logged in on target date."""
        # user1 has last_login on test_date
        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.active_users_today >= 1

    def test_active_users_today_with_activity(self, users, test_date):
        """Active users includes users with AI usage on target date."""
        # Create AI usage for user1 on test_date
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test_feature',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.01'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.active_users_today >= 1
        assert stats.dau >= 1

    def test_wau_trailing_7_days(self, users, test_date):
        """WAU counts users active in trailing 7 days."""
        # Create activity for user1 5 days before test_date
        past_date = test_date - timedelta(days=5)
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=50,
            created_at=timezone.make_aware(timezone.datetime.combine(past_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # user1 should be in WAU due to activity in last 7 days
        assert stats.wau >= 1

    def test_mau_trailing_30_days(self, users, test_date):
        """MAU counts users active in trailing 30 days."""
        # Create activity for user1 20 days before test_date
        past_date = test_date - timedelta(days=20)
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=50,
            created_at=timezone.make_aware(timezone.datetime.combine(past_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # user1 should be in MAU due to activity in last 30 days
        assert stats.mau >= 1


@pytest.mark.django_db
class TestAIUsageMetrics:
    """Test AI usage metric calculations."""

    def test_total_ai_requests(self, users, test_date):
        """Total AI requests counts all logs on target date."""
        # Create multiple AI logs on test_date
        for i in range(5):
            AIUsageLog.objects.create(
                user=users['user1'],
                feature='test',
                provider='openai',
                model='gpt-4',
                total_tokens=100,
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_ai_requests == 5

    def test_total_ai_tokens(self, users, test_date):
        """Total AI tokens sums all tokens used."""
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=500,
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        AIUsageLog.objects.create(
            user=users['user2'],
            feature='test',
            provider='anthropic',
            model='claude-3',
            total_tokens=300,
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_ai_tokens == 800

    def test_total_ai_cost(self, users, test_date):
        """Total AI cost sums all costs."""
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.50'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.30'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_ai_cost == Decimal('0.80')

    def test_ai_users_today(self, users, test_date):
        """AI users today counts unique users who made AI requests."""
        # user1 makes 3 requests
        for _ in range(3):
            AIUsageLog.objects.create(
                user=users['user1'],
                feature='test',
                provider='openai',
                model='gpt-4',
                total_tokens=100,
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        # user2 makes 1 request
        AIUsageLog.objects.create(
            user=users['user2'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Should count 2 unique users, not 4 requests
        assert stats.ai_users_today == 2

    def test_cau_cost_per_active_user(self, users, test_date):
        """CAU (Cost per Active User) calculation."""
        # 2 users, total cost $1.00
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.60'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        AIUsageLog.objects.create(
            user=users['user2'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.40'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # CAU = 1.00 / 2 = 0.50
        assert stats.cau == Decimal('0.50')

    def test_cau_zero_when_no_users(self, users, test_date):
        """CAU is zero when no AI users."""
        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.cau == Decimal('0')

    def test_ai_by_feature_breakdown(self, users, test_date):
        """AI breakdown by feature includes requests and costs."""
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='chat',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.30'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='project_gen',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.50'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert 'chat' in stats.ai_by_feature
        assert stats.ai_by_feature['chat']['requests'] == 1
        assert stats.ai_by_feature['chat']['cost'] == 0.30
        assert 'project_gen' in stats.ai_by_feature
        assert stats.ai_by_feature['project_gen']['requests'] == 1
        assert stats.ai_by_feature['project_gen']['cost'] == 0.50

    def test_ai_by_provider_breakdown(self, users, test_date):
        """AI breakdown by provider includes requests and costs."""
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('0.40'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='anthropic',
            model='claude-3',
            total_tokens=100,
            total_cost=Decimal('0.20'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert 'openai' in stats.ai_by_provider
        assert stats.ai_by_provider['openai']['requests'] == 1
        assert stats.ai_by_provider['openai']['cost'] == 0.40
        assert 'anthropic' in stats.ai_by_provider
        assert stats.ai_by_provider['anthropic']['requests'] == 1


@pytest.mark.django_db
class TestContentMetrics:
    """Test content metric calculations."""

    def test_total_projects_cumulative(self, users, test_date):
        """Total projects includes all projects up to target date."""
        # Projects before test date
        Project.objects.create(
            user=users['user1'],
            title='Old Project',
            slug='old-project',
            created_at=timezone.make_aware(timezone.datetime(2025, 1, 10, 10, 0, 0)),
        )
        # Project on test date
        Project.objects.create(
            user=users['user1'],
            title='Test Project',
            slug='test-project',
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_projects == 2

    def test_new_projects_today(self, users, test_date):
        """New projects today counts only projects created on target date."""
        Project.objects.create(
            user=users['user1'],
            title='Project 1',
            slug='project-1',
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        Project.objects.create(
            user=users['user2'],
            title='Project 2',
            slug='project-2',
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.new_projects_today == 2

    def test_project_views_count(self, users, test_date):
        """Project views counts all views on target date."""
        project = Project.objects.create(
            user=users['user1'],
            title='Test',
            slug='test',
        )

        # Create views on test_date
        for _ in range(3):
            ProjectView.objects.create(
                project=project,
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_project_views == 3

    def test_project_clicks_count(self, users, test_date):
        """Project clicks counts all clicks on target date."""
        project = Project.objects.create(
            user=users['user1'],
            title='Test',
            slug='test',
        )

        # Create clicks on test_date
        for _ in range(2):
            ProjectClick.objects.create(
                project=project,
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_project_clicks == 2

    def test_comments_count(self, users, test_date):
        """Comments counts all comments on target date."""
        project = Project.objects.create(
            user=users['user1'],
            title='Test',
            slug='test',
        )

        # Create comments on test_date
        for _ in range(4):
            ProjectComment.objects.create(
                project=project,
                author=users['user1'],
                content='Test comment',
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_comments == 4


@pytest.mark.django_db
class TestEngagementMetrics:
    """Test engagement metric calculations."""

    def test_quests_completed_count(self, users, test_date):
        """Quests completed counts side quests completed on target date."""
        UserSideQuest.objects.create(
            user=users['user1'],
            quest_id='quest1',
            is_completed=True,
            completed_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_quests_completed == 1

    def test_quiz_attempts_count(self, users, test_date):
        """Quiz attempts counts all quiz attempts on target date."""
        for _ in range(3):
            QuizAttempt.objects.create(
                user=users['user1'],
                quiz_id=1,
                started_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_quiz_attempts == 3

    def test_events_created_count(self, users, test_date):
        """Events created counts all events created on target date."""
        for _ in range(2):
            Event.objects.create(
                organizer=users['user1'],
                name='Test Event',
                slug='test-event',
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_events_created >= 2

    def test_tool_reviews_count(self, users, test_date):
        """Tool reviews counts all reviews posted on target date."""
        for _ in range(5):
            ToolReview.objects.create(
                tool_id=1,
                user=users['user1'],
                rating=5,
                title='Great tool',
                content='Really useful',
                created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
            )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        assert stats.total_tool_reviews == 5


@pytest.mark.django_db
class TestQualityMetrics:
    """Test quality metric calculations."""

    def test_avg_hallucination_score(self, users, test_date):
        """Average hallucination score calculated correctly."""
        HallucinationMetrics.objects.create(
            user=users['user1'],
            confidence_score=0.9,
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        HallucinationMetrics.objects.create(
            user=users['user1'],
            confidence_score=0.7,
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Average should be (0.9 + 0.7) / 2 = 0.8
        assert abs(stats.avg_hallucination_score - 0.8) < 0.01

    def test_hallucination_flags_count(self, users, test_date):
        """Hallucination flags count includes only entries with flags."""
        HallucinationMetrics.objects.create(
            user=users['user1'],
            confidence_score=0.9,
            flags=[],
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )
        HallucinationMetrics.objects.create(
            user=users['user1'],
            confidence_score=0.6,
            flags=['overconfident'],
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Only 1 entry has flags
        assert stats.hallucination_flags_count == 1


@pytest.mark.django_db
class TestAggregationBehavior:
    """Test aggregation task behavior."""

    def test_creates_new_stats_record(self, users, test_date):
        """Task creates new stats record if none exists."""
        assert not PlatformDailyStats.objects.filter(date=test_date).exists()

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        assert PlatformDailyStats.objects.filter(date=test_date).exists()
        assert result['action'] == 'created'

    def test_updates_existing_stats_record(self, users, test_date):
        """Task updates existing stats record if it exists."""
        # Create initial stats
        PlatformDailyStats.objects.create(
            date=test_date,
            total_users=5,
            new_users_today=0,
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        stats = PlatformDailyStats.objects.get(date=test_date)
        # Should be updated to actual count (2 users)
        assert stats.total_users == 2
        assert result['action'] == 'updated'

    def test_defaults_to_yesterday_if_no_date_provided(self, users):
        """Task defaults to yesterday if no date provided."""
        yesterday = (timezone.now() - timedelta(days=1)).date()

        result = aggregate_platform_daily_stats()

        assert result['date'] == str(yesterday)
        assert PlatformDailyStats.objects.filter(date=yesterday).exists()

    def test_handles_custom_date_string(self, users):
        """Task accepts date string in YYYY-MM-DD format."""
        custom_date = '2025-02-01'

        result = aggregate_platform_daily_stats(custom_date)

        assert result['date'] == custom_date
        assert PlatformDailyStats.objects.filter(date=date(2025, 2, 1)).exists()

    def test_returns_summary_data(self, users, test_date):
        """Task returns summary of aggregated data."""
        AIUsageLog.objects.create(
            user=users['user1'],
            feature='test',
            provider='openai',
            model='gpt-4',
            total_tokens=100,
            total_cost=Decimal('1.50'),
            created_at=timezone.make_aware(timezone.datetime.combine(test_date, timezone.datetime.min.time())),
        )

        result = aggregate_platform_daily_stats(test_date.strftime('%Y-%m-%d'))

        assert 'date' in result
        assert 'action' in result
        assert 'total_users' in result
        assert 'total_ai_cost' in result
        assert result['total_users'] == 2
        assert result['total_ai_cost'] == 1.50
