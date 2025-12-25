"""
AI Analytics and Monitoring Dashboard Views

Provides endpoints for:
- User cost analytics
- System-wide AI metrics
- Spend limit monitoring
- Performance dashboards
"""

from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.billing.permissions import RequiresAnalytics
from core.permissions import IsAdminRole


@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresAnalytics])
def user_ai_analytics(request):
    """
    Get AI cost and usage analytics for the authenticated user.

    Query params:
        days: Number of days to look back (default: 30)

    Returns:
        {
            'user_id': int,
            'period_days': int,
            'daily_spend': float,
            'monthly_spend': float,
            'daily_limit': float,
            'monthly_limit': float,
            'limit_status': 'ok' | 'warning' | 'exceeded'
        }
    """
    days = int(request.query_params.get('days', 30))
    user_id = request.user.id

    try:
        # Get current spend from cache
        today = datetime.utcnow().strftime('%Y-%m-%d')
        month = datetime.utcnow().strftime('%Y-%m')
        daily_key = f'ai_cost:user:{user_id}:daily:{today}'
        monthly_key = f'ai_cost:user:{user_id}:monthly:{month}'

        daily_spend = cache.get(daily_key, 0.0)
        monthly_spend = cache.get(monthly_key, 0.0)

        analytics = {
            'user_id': user_id,
            'period_days': days,
            'daily_spend': round(daily_spend, 4),
            'monthly_spend': round(monthly_spend, 4),
            'daily_limit': settings.AI_USER_DAILY_SPEND_LIMIT_USD,
            'monthly_limit': settings.AI_MONTHLY_SPEND_LIMIT_USD,
        }

        # Determine limit status
        daily_pct = (daily_spend / settings.AI_USER_DAILY_SPEND_LIMIT_USD) * 100
        monthly_pct = (monthly_spend / settings.AI_MONTHLY_SPEND_LIMIT_USD) * 100

        if daily_pct >= 100 or monthly_pct >= 100:
            analytics['limit_status'] = 'exceeded'
        elif daily_pct >= 80 or monthly_pct >= 80:
            analytics['limit_status'] = 'warning'
        else:
            analytics['limit_status'] = 'ok'

        return Response(analytics)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def system_ai_analytics(request):
    """
    Get system-wide AI analytics (admin only).

    Query params:
        days: Number of days to look back (default: 7)

    Returns:
        {
            'period_days': int,
            'phoenix_enabled': bool,
            'phoenix_url': str,
            'message': str
        }
    """
    days = int(request.query_params.get('days', 7))

    # Phoenix handles detailed analytics via its UI
    from services.ai.phoenix import get_phoenix_url, is_phoenix_enabled

    return Response(
        {
            'period_days': days,
            'phoenix_enabled': is_phoenix_enabled(),
            'phoenix_url': get_phoenix_url() or 'https://app.phoenix.arize.com',
            'message': 'View detailed traces and analytics in Phoenix UI',
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, RequiresAnalytics])
def check_user_spend_limit(request):
    """
    Check if user is approaching or has exceeded spend limits.

    Returns:
        {
            'within_limits': bool,
            'daily_spend': float,
            'daily_limit': float,
            'daily_remaining': float,
            'daily_percent_used': float,
            'monthly_spend': float,
            'monthly_limit': float,
            'monthly_remaining': float,
            'monthly_percent_used': float,
            'warning_message': str | null,
            'blocked': bool
        }
    """
    user_id = request.user.id
    today = datetime.utcnow().strftime('%Y-%m-%d')
    month = datetime.utcnow().strftime('%Y-%m')

    daily_key = f'ai_cost:user:{user_id}:daily:{today}'
    monthly_key = f'ai_cost:user:{user_id}:monthly:{month}'

    daily_spend = cache.get(daily_key, 0.0)
    monthly_spend = cache.get(monthly_key, 0.0)

    daily_limit = settings.AI_USER_DAILY_SPEND_LIMIT_USD
    monthly_limit = settings.AI_MONTHLY_SPEND_LIMIT_USD

    daily_remaining = max(0, daily_limit - daily_spend)
    monthly_remaining = max(0, monthly_limit - monthly_spend)

    daily_percent = (daily_spend / daily_limit) * 100 if daily_limit > 0 else 0
    monthly_percent = (monthly_spend / monthly_limit) * 100 if monthly_limit > 0 else 0

    within_limits = daily_spend <= daily_limit and monthly_spend <= monthly_limit
    blocked = daily_spend > daily_limit or monthly_spend > monthly_limit

    warning_message = None
    if blocked:
        warning_message = 'You have exceeded your AI usage limits for today or this month.'
    elif daily_percent >= 80 or monthly_percent >= 80:
        warning_message = f"You've used {max(daily_percent, monthly_percent):.1f}% of your AI usage limit."

    return Response(
        {
            'within_limits': within_limits,
            'daily_spend': round(daily_spend, 4),
            'daily_limit': daily_limit,
            'daily_remaining': round(daily_remaining, 4),
            'daily_percent_used': round(daily_percent, 2),
            'monthly_spend': round(monthly_spend, 4),
            'monthly_limit': monthly_limit,
            'monthly_remaining': round(monthly_remaining, 4),
            'monthly_percent_used': round(monthly_percent, 2),
            'warning_message': warning_message,
            'blocked': blocked,
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def reset_user_spend(request, user_id):
    """
    Reset spend tracking for a specific user (admin only).

    Useful for testing or resolving billing issues.
    """
    today = datetime.utcnow().strftime('%Y-%m-%d')
    month = datetime.utcnow().strftime('%Y-%m')

    daily_key = f'ai_cost:user:{user_id}:daily:{today}'
    monthly_key = f'ai_cost:user:{user_id}:monthly:{month}'

    cache.delete(daily_key)
    cache.delete(monthly_key)

    return Response(
        {
            'message': f'Spend tracking reset for user {user_id}',
            'user_id': user_id,
            'reset_date': datetime.utcnow().isoformat(),
        }
    )


@api_view(['GET'])
@permission_classes([IsAdminRole])
def phoenix_health(request):
    """
    Check Phoenix integration health (admin only).

    Returns:
        {
            'enabled': bool,
            'local_url': str | null,
            'cloud_url': str
        }
    """
    from services.ai.phoenix import get_phoenix_url, is_phoenix_enabled

    return Response(
        {
            'enabled': is_phoenix_enabled(),
            'local_url': get_phoenix_url(),
            'cloud_url': 'https://app.phoenix.arize.com',
        }
    )
