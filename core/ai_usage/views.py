"""
API views for admin analytics dashboard.

All endpoints require admin authentication (IsAdminUser permission).
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .cache_service import (
    get_ai_breakdown,
    get_overview_kpis,
    get_timeseries_data,
    get_user_growth_metrics,
)

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
        logger.error(f'[ADMIN_ANALYTICS] Error fetching overview: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to fetch overview metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
        logger.error(f'[ADMIN_ANALYTICS] Error fetching timeseries: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to fetch timeseries data'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
        logger.error(f'[ADMIN_ANALYTICS] Error fetching AI breakdown: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to fetch AI breakdown'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
        logger.error(f'[ADMIN_ANALYTICS] Error fetching user growth: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to fetch user growth metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
        logger.error(f'[ADMIN_ANALYTICS] Error fetching content metrics: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to fetch content metrics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
