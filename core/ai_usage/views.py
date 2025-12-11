"""
API views for admin analytics dashboard.

All endpoints require admin authentication (IsAdminUser permission).
"""

import logging
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.logging_utils import StructuredLogger
from core.permissions import IsAdminRole

from .cache_service import (
    get_ai_breakdown,
    get_overview_kpis,
    get_timeseries_data,
    get_user_growth_metrics,
)

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_overview(request):
    """
    GET /api/admin/analytics/overview/

    Returns overview KPIs for dashboard header.

    Query params:
        - days: Number of days to aggregate (default: 30)

    Response:
        {
            "total_users": 1234,
            "active_users": 456,
            "total_ai_cost": 123.45,
            "total_projects": 789
        }
    """
    try:
        days = int(request.GET.get('days', 30))
        data = get_overview_kpis(days=days)
        return Response(data)
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_overview',
            user=request.user,
            success=False,
            metadata={'days': days if 'days' in locals() else None},
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch overview metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_timeseries(request):
    """
    GET /api/admin/analytics/timeseries/

    Returns time-series data for charts.

    Query params:
        - metric: 'users', 'ai_cost', 'projects', or 'engagement' (required)
        - days: Number of days (default: 30)

    Response:
        {
            "data": [
                {"date": "2024-01-01", "value": 123},
                {"date": "2024-01-02", "value": 145},
                ...
            ]
        }
    """
    try:
        metric = request.GET.get('metric')
        if not metric:
            return Response(
                {'error': 'metric parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        days = int(request.GET.get('days', 30))
        data = get_timeseries_data(metric=metric, days=days)
        return Response({'data': data})
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_timeseries',
            user=request.user,
            success=False,
            metadata={'metric': metric if 'metric' in locals() else None, 'days': days if 'days' in locals() else None},
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch timeseries data'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_ai_breakdown(request):
    """
    GET /api/admin/analytics/ai-breakdown/

    Returns AI usage breakdown by feature or provider.

    Query params:
        - type: 'feature' or 'provider' (required)
        - days: Number of days (default: 30)

    Response:
        {
            "breakdown": {
                "project_agent": {"requests": 1234, "cost": 12.34},
                "auth_chat": {"requests": 456, "cost": 4.56},
                ...
            }
        }
    """
    try:
        breakdown_type = request.GET.get('type')
        if breakdown_type not in ['feature', 'provider']:
            return Response(
                {'error': 'type must be "feature" or "provider"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        days = int(request.GET.get('days', 30))
        data = get_ai_breakdown(breakdown_type=breakdown_type, days=days)
        return Response({'breakdown': data})
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_ai_breakdown',
            user=request.user,
            success=False,
            metadata={
                'type': breakdown_type if 'breakdown_type' in locals() else None,
                'days': days if 'days' in locals() else None,
            },
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch AI breakdown'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_user_growth(request):
    """
    GET /api/admin/analytics/user-growth/

    Returns user growth metrics.

    Query params:
        - days: Number of days (default: 30)

    Response:
        {
            "total_users": 1234,
            "new_users": 56,
            "avg_dau": 123,
            "avg_mau": 456,
            "growth_rate": 12.34,
            "stickiness": 27.0
        }
    """
    try:
        days = int(request.GET.get('days', 30))
        data = get_user_growth_metrics(days=days)
        return Response(data)
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_user_growth',
            user=request.user,
            success=False,
            metadata={'days': days if 'days' in locals() else None},
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch user growth metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_content_metrics(request):
    """
    GET /api/admin/analytics/content/

    Returns content and engagement metrics.

    Query params:
        - days: Number of days (default: 30)

    Response:
        {
            "total_projects": 1234,
            "total_views": 5678,
            "total_clicks": 890,
            "total_comments": 123,
            "engagement_rate": 12.34
        }
    """
    try:
        from datetime import timedelta

        from django.utils import timezone

        from .models import PlatformDailyStats

        days = int(request.GET.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = PlatformDailyStats.objects.filter(date__gte=start_date, date__lte=end_date)

        # Aggregate content metrics
        total_projects = sum(s.new_projects_today for s in stats)
        total_views = sum(s.total_project_views for s in stats)
        total_clicks = sum(s.total_project_clicks for s in stats)
        total_comments = sum(s.total_comments for s in stats)

        # Calculate engagement rate
        engagement_rate = (total_clicks / total_views * 100) if total_views > 0 else 0

        return Response(
            {
                'total_projects': total_projects,
                'total_views': total_views,
                'total_clicks': total_clicks,
                'total_comments': total_comments,
                'engagement_rate': round(engagement_rate, 2),
            }
        )
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_content_metrics',
            user=request.user,
            success=False,
            metadata={'days': days if 'days' in locals() else None},
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch content metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_guest_battles(request):
    """
    GET /api/admin/analytics/guest-battles/

    Returns guest user and battle metrics with conversion funnel.

    Query params:
        - days: Number of days (default: 30)

    Response:
        {
            "totalGuests": 123,
            "guestsConverted": 45,
            "conversionRate": 36.6,
            "battlesWithGuests": 100,
            "totalBattles": 500,
            "guestWins": 30,
            "guestLosses": 60,
            "guestTies": 10,
            "recentGuests": [...],
            "conversionFunnel": {...}
        }
    """
    try:
        from core.audits.models import UserAuditLog
        from core.battles.models import PromptBattle
        from core.users.models import User

        days = int(request.GET.get('days', 30))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)

        # Total guest users created in the time period (from audit log)
        total_guests_period = UserAuditLog.objects.filter(
            action=UserAuditLog.Action.GUEST_CREATED,
            timestamp__gte=start_date,
            timestamp__lte=end_date,
            success=True,
        ).count()

        # Guest users who converted in the time period (from audit log)
        guests_converted_period = UserAuditLog.objects.filter(
            action=UserAuditLog.Action.GUEST_CONVERTED,
            timestamp__gte=start_date,
            timestamp__lte=end_date,
            success=True,
        ).count()

        # Current guests who haven't converted (all-time)
        current_guests = User.objects.filter(is_guest=True).count()

        # All-time conversion metrics for funnel (from audit logs)
        all_time_guests_created = UserAuditLog.objects.filter(
            action=UserAuditLog.Action.GUEST_CREATED,
            success=True,
        ).count()
        all_time_converted = UserAuditLog.objects.filter(
            action=UserAuditLog.Action.GUEST_CONVERTED,
            success=True,
        ).count()

        # Use max of audit log count or current guests + converted (for accuracy)
        all_time_guests = max(all_time_guests_created, current_guests + all_time_converted)

        # Guests who completed at least one battle
        guests_with_battles = (
            User.objects.filter(
                is_guest=True,
            )
            .filter(Q(battles_initiated__status='completed') | Q(battles_received__status='completed'))
            .distinct()
            .count()
        )

        # Get user IDs of converted users from audit log
        converted_user_ids = UserAuditLog.objects.filter(
            action=UserAuditLog.Action.GUEST_CONVERTED,
            success=True,
        ).values_list('user_id', flat=True)

        # Converted users who had battles
        converted_with_battles = (
            User.objects.filter(
                id__in=converted_user_ids,
            )
            .filter(Q(battles_initiated__isnull=False) | Q(battles_received__isnull=False))
            .distinct()
            .count()
        )

        # Conversion rate for period
        total_ever_guests_period = total_guests_period + guests_converted_period
        conversion_rate = (
            (guests_converted_period / total_ever_guests_period * 100) if total_ever_guests_period > 0 else 0
        )

        # All-time conversion rate
        all_time_conversion_rate = (all_time_converted / all_time_guests * 100) if all_time_guests > 0 else 0

        # Battles involving guest users
        battles_with_guests = (
            PromptBattle.objects.filter(
                Q(challenger__is_guest=True) | Q(opponent__is_guest=True),
                created_at__gte=start_date,
                created_at__lte=end_date,
            )
            .distinct()
            .count()
        )

        # Total battles in the period
        total_battles = PromptBattle.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date,
        ).count()

        # Guest wins/losses - check both challenger and opponent
        guest_battles = PromptBattle.objects.filter(
            Q(challenger__is_guest=True) | Q(opponent__is_guest=True),
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date,
        ).distinct()

        guest_wins = guest_battles.filter(winner__is_guest=True).count()
        guest_losses = guest_battles.exclude(winner__isnull=True).exclude(winner__is_guest=True).count()
        guest_ties = guest_battles.filter(winner__isnull=True).count()

        # Recent guest users (last 10) - use camelCase for frontend
        recent_guests_qs = User.objects.filter(
            is_guest=True,
        ).order_by('-date_joined')[:10]

        recent_guests = [
            {
                'id': g.id,
                'username': g.username,
                'dateJoined': g.date_joined.isoformat(),
            }
            for g in recent_guests_qs
        ]

        # Build conversion funnel data
        conversion_funnel = {
            'invited': all_time_guests,  # Total guests ever created
            'joinedBattle': guests_with_battles + converted_with_battles,  # Completed at least one battle
            'converted': all_time_converted,  # Became full users
            'rates': {
                'inviteToJoin': round(
                    ((guests_with_battles + converted_with_battles) / all_time_guests * 100)
                    if all_time_guests > 0
                    else 0,
                    1,
                ),
                'joinToConvert': round(
                    (all_time_converted / (guests_with_battles + converted_with_battles) * 100)
                    if (guests_with_battles + converted_with_battles) > 0
                    else 0,
                    1,
                ),
                'overallConversion': round(all_time_conversion_rate, 1),
            },
        }

        return Response(
            {
                'totalGuests': total_guests_period,
                'currentGuests': current_guests,
                'guestsConverted': guests_converted_period,
                'conversionRate': round(conversion_rate, 1),
                'allTimeConversionRate': round(all_time_conversion_rate, 1),
                'battlesWithGuests': battles_with_guests,
                'totalBattles': total_battles,
                'guestBattlePercentage': round(
                    (battles_with_guests / total_battles * 100) if total_battles > 0 else 0, 1
                ),
                'guestWins': guest_wins,
                'guestLosses': guest_losses,
                'guestTies': guest_ties,
                'recentGuests': recent_guests,
                'conversionFunnel': conversion_funnel,
            }
        )
    except Exception as e:
        StructuredLogger.log_service_operation(
            service_name='AdminAnalytics',
            operation='fetch_guest_battle_metrics',
            user=request.user,
            success=False,
            metadata={'days': days if 'days' in locals() else None},
            error=e,
            logger_instance=logger,
        )
        return Response(
            {'error': 'Failed to fetch guest battle metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
