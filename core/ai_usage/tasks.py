"""
Celery tasks for AI usage analytics and platform statistics aggregation.

These tasks run in background workers for heavy aggregation operations.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 300},
    retry_backoff=True,
)
def aggregate_platform_daily_stats(self, date_str=None):
    """
    Aggregate platform-wide statistics for a given date.

    Runs once per day (typically at midnight) to aggregate all platform metrics.
    Can also be run manually for historical dates.

    Args:
        date_str: Date in YYYY-MM-DD format. If None, uses yesterday.
    """
    from core.agents.models import HallucinationMetrics
    from core.ai_usage.models import AIUsageLog, PlatformDailyStats
    from core.events.models import Event
    from core.projects.models import Project, ProjectClick, ProjectComment, ProjectView
    from core.quizzes.models import QuizAttempt
    from core.thrive_circle.models import UserSideQuest
    from core.tools.models import ToolReview

    try:
        # Determine date to aggregate
        if date_str:
            from datetime import datetime

            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            # Default to yesterday (since today is incomplete)
            target_date = (timezone.now() - timedelta(days=1)).date()

        logger.info(f'[PLATFORM_STATS] Starting aggregation for {target_date}')

        # =================================================================
        # USER GROWTH METRICS
        # =================================================================

        # Total users (cumulative up to this date)
        total_users = User.objects.filter(date_joined__date__lte=target_date).count()

        # New users on this day
        new_users_today = User.objects.filter(date_joined__date=target_date).count()

        # Active users today (users who logged in or took any tracked action)
        # Note: Django tracks last_login, so we'll use that + users with activity
        active_users_today = (
            User.objects.filter(
                Q(last_login__date=target_date)
                | Q(ai_usage_logs__created_at__date=target_date)
                | Q(projects__created_at__date=target_date)
            )
            .distinct()
            .count()
        )

        # DAU (Daily Active Users) - same as active_users_today
        dau = active_users_today

        # WAU (Weekly Active Users) - trailing 7 days including target_date
        wau_start = target_date - timedelta(days=6)
        wau = (
            User.objects.filter(
                Q(last_login__date__gte=wau_start, last_login__date__lte=target_date)
                | Q(ai_usage_logs__created_at__date__gte=wau_start, ai_usage_logs__created_at__date__lte=target_date)
                | Q(projects__created_at__date__gte=wau_start, projects__created_at__date__lte=target_date)
            )
            .distinct()
            .count()
        )

        # MAU (Monthly Active Users) - trailing 30 days including target_date
        mau_start = target_date - timedelta(days=29)
        mau = (
            User.objects.filter(
                Q(last_login__date__gte=mau_start, last_login__date__lte=target_date)
                | Q(ai_usage_logs__created_at__date__gte=mau_start, ai_usage_logs__created_at__date__lte=target_date)
                | Q(projects__created_at__date__gte=mau_start, projects__created_at__date__lte=target_date)
            )
            .distinct()
            .count()
        )

        # =================================================================
        # AI USAGE METRICS
        # =================================================================

        ai_logs = AIUsageLog.objects.filter(created_at__date=target_date)

        total_ai_requests = ai_logs.count()
        total_ai_tokens = ai_logs.aggregate(total=Sum('total_tokens'))['total'] or 0
        total_ai_cost = ai_logs.aggregate(total=Sum('total_cost'))['total'] or Decimal('0')

        # Unique users who made AI requests today
        ai_users_today = ai_logs.values('user').distinct().count()

        # CAU (Cost per Active User)
        cau = (total_ai_cost / ai_users_today) if ai_users_today > 0 else Decimal('0')

        # AI breakdown by feature
        ai_by_feature = {}
        feature_stats = ai_logs.values('feature').annotate(
            requests=Count('id'),
            cost=Sum('total_cost'),
        )
        for stat in feature_stats:
            ai_by_feature[stat['feature']] = {
                'requests': stat['requests'],
                'cost': float(stat['cost'] or 0),
            }

        # AI breakdown by provider
        ai_by_provider = {}
        provider_stats = ai_logs.values('provider').annotate(
            requests=Count('id'),
            cost=Sum('total_cost'),
        )
        for stat in provider_stats:
            ai_by_provider[stat['provider']] = {
                'requests': stat['requests'],
                'cost': float(stat['cost'] or 0),
            }

        # =================================================================
        # CONTENT METRICS
        # =================================================================

        # Total projects (cumulative)
        total_projects = Project.objects.filter(created_at__date__lte=target_date).count()

        # New projects today
        new_projects_today = Project.objects.filter(created_at__date=target_date).count()

        # Project views today
        total_project_views = ProjectView.objects.filter(created_at__date=target_date).count()

        # Project clicks today
        total_project_clicks = ProjectClick.objects.filter(created_at__date=target_date).count()

        # Comments today
        total_comments = ProjectComment.objects.filter(created_at__date=target_date).count()

        # =================================================================
        # ENGAGEMENT METRICS
        # =================================================================

        # Side quests completed today
        total_quests_completed = UserSideQuest.objects.filter(completed_at__date=target_date).count()

        # Quiz attempts today
        total_quiz_attempts = QuizAttempt.objects.filter(started_at__date=target_date).count()

        # Events created today
        total_events_created = Event.objects.filter(created_at__date=target_date).count()

        # Tool reviews posted today
        total_tool_reviews = ToolReview.objects.filter(created_at__date=target_date).count()

        # =================================================================
        # REVENUE METRICS (placeholder for future)
        # =================================================================

        revenue_today = Decimal('0')  # TODO: Add subscription tracking
        new_subscribers_today = 0  # TODO: Add subscription tracking
        total_subscribers = 0  # TODO: Add subscription tracking

        # =================================================================
        # QUALITY METRICS
        # =================================================================

        hallucination_logs = HallucinationMetrics.objects.filter(created_at__date=target_date)

        avg_hallucination_score = hallucination_logs.aggregate(avg=Avg('confidence_score'))['avg']
        hallucination_flags_count = hallucination_logs.exclude(flags=[]).count()

        # =================================================================
        # SAVE OR UPDATE
        # =================================================================

        stats, created = PlatformDailyStats.objects.update_or_create(
            date=target_date,
            defaults={
                # User Growth
                'total_users': total_users,
                'new_users_today': new_users_today,
                'active_users_today': active_users_today,
                'dau': dau,
                'wau': wau,
                'mau': mau,
                # AI Usage
                'total_ai_requests': total_ai_requests,
                'total_ai_tokens': total_ai_tokens,
                'total_ai_cost': total_ai_cost,
                'ai_users_today': ai_users_today,
                'cau': cau,
                'ai_by_feature': ai_by_feature,
                'ai_by_provider': ai_by_provider,
                # Content
                'total_projects': total_projects,
                'new_projects_today': new_projects_today,
                'total_project_views': total_project_views,
                'total_project_clicks': total_project_clicks,
                'total_comments': total_comments,
                # Engagement
                'total_quests_completed': total_quests_completed,
                'total_quiz_attempts': total_quiz_attempts,
                'total_events_created': total_events_created,
                'total_tool_reviews': total_tool_reviews,
                # Revenue
                'revenue_today': revenue_today,
                'new_subscribers_today': new_subscribers_today,
                'total_subscribers': total_subscribers,
                # Quality
                'avg_hallucination_score': avg_hallucination_score,
                'hallucination_flags_count': hallucination_flags_count,
            },
        )

        action = 'Created' if created else 'Updated'
        logger.info(
            f'[PLATFORM_STATS] {action} stats for {target_date}: '
            f'{total_users} users, {total_ai_requests} AI reqs, ${total_ai_cost}'
        )

        return {
            'date': str(target_date),
            'action': action.lower(),
            'total_users': total_users,
            'total_ai_cost': float(total_ai_cost),
        }

    except Exception as e:
        logger.error(f'[PLATFORM_STATS] Failed to aggregate stats for {target_date}: {e}', exc_info=True)
        raise
