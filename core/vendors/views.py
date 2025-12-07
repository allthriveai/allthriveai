"""
Vendor Analytics API Views

Endpoints:
- GET /api/v1/vendor/tools/ - List tools vendor has access to
- GET /api/v1/vendor/tools/{id}/analytics/ - Get analytics for a specific tool
- POST /api/v1/analytics/impressions/ - Track tool impressions (public)
- POST /api/v1/analytics/engagements/ - Track tool engagements (public)
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import SecureLogger, StructuredLogger

from .models import VendorToolAccess
from .serializers import (
    TrackEngagementSerializer,
    TrackImpressionSerializer,
)
from .services import (
    get_session_id,
    get_tool_analytics,
    get_vendor_tools,
    track_tool_engagement,
    track_tool_impression,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Vendor Dashboard Endpoints (Authenticated, Vendor Role Required)
# =============================================================================


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_tools_list(request):
    """
    List tools the vendor has analytics access to.

    Admins can see all tools. Vendors see only tools they have access to.
    Returns 403 if user is not a vendor or admin.
    """
    is_admin = request.user.is_admin_role or request.user.is_superuser

    if not request.user.is_vendor and not is_admin:
        # Log authorization failure
        SecureLogger.log_auth_event(
            event_type='vendor_access_denied',
            user_id=request.user.id,
            username=request.user.username,
            success=False,
        )
        return Response(
            {
                'error': 'Vendor access required',
                'detail': 'You must have vendor or admin role to access this endpoint.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if is_admin:
        # Admins can see all active tools
        from core.tools.models import Tool

        all_tools = Tool.objects.filter(is_active=True).order_by('name')
        tools = [
            {
                'id': tool.id,
                'name': tool.name,
                'slug': tool.slug,
                'logo_url': tool.logo_url,
                'access': {
                    'can_view_basic': True,
                    'can_view_competitive': True,
                    'can_view_segments': True,
                    'can_view_queries': True,
                    'can_export': True,
                },
            }
            for tool in all_tools
        ]
    else:
        tools = get_vendor_tools(request.user)

    return Response(
        {
            'tools': tools,
            'count': len(tools),
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_tool_analytics(request, tool_id):
    """
    Get analytics for a specific tool.

    Query params:
    - days: Number of days of data (default 30, max 365)

    Admins have full access to all tools. Vendors only see tools they have access to.
    Returns 403 if user doesn't have access to this tool.
    """
    is_admin = request.user.is_admin_role or request.user.is_superuser

    if not request.user.is_vendor and not is_admin:
        # Log authorization failure
        SecureLogger.log_auth_event(
            event_type='vendor_analytics_denied',
            user_id=request.user.id,
            username=request.user.username,
            success=False,
        )
        return Response(
            {'error': 'Vendor access required'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Check user has access to this tool (admins have full access)
    if is_admin:
        access = None  # Admins have full access
    else:
        try:
            access = VendorToolAccess.objects.get(user=request.user, tool_id=tool_id)
        except VendorToolAccess.DoesNotExist:
            # Log tool-specific access denial
            SecureLogger.log_action(
                action=f'Vendor tool access denied for tool_id={tool_id}',
                user_id=request.user.id,
                username=request.user.username,
                level='warning',
            )
            return Response(
                {'error': 'Access denied', 'detail': "You do not have access to this tool's analytics."},
                status=status.HTTP_403_FORBIDDEN,
            )

    # Get days parameter
    days = request.query_params.get('days', 30)
    try:
        days = min(int(days), 365)  # Max 1 year
    except (ValueError, TypeError):
        days = 30

    # Get analytics data
    analytics = get_tool_analytics(tool_id, days=days)

    if 'error' in analytics:
        return Response(analytics, status=status.HTTP_404_NOT_FOUND)

    # Filter data based on access level (admins see everything)
    if access and not access.can_view_competitive:
        analytics.pop('co_viewed_tools', None)

    if access and not access.can_view_queries:
        analytics.pop('top_search_queries', None)

    if access and not access.can_view_segments:
        # Remove any user segment data (not yet implemented)
        pass

    # Add access info to response
    if is_admin:
        analytics['access'] = {
            'can_view_basic': True,
            'can_view_competitive': True,
            'can_view_segments': True,
            'can_view_queries': True,
            'can_export': True,
        }
    else:
        analytics['access'] = {
            'can_view_basic': access.can_view_basic,
            'can_view_competitive': access.can_view_competitive,
            'can_view_segments': access.can_view_segments,
            'can_view_queries': access.can_view_queries,
            'can_export': access.can_export,
        }

    return Response(analytics)


# =============================================================================
# Public Tracking Endpoints (Used by Frontend)
# =============================================================================


@api_view(['POST'])
@permission_classes([AllowAny])
def track_impressions(request):
    """
    Track tool impressions (batch).

    Called by frontend when tools are displayed to users.
    Accepts array of tool IDs for efficiency.

    Body:
    {
        "tool_ids": [1, 2, 3],
        "context": "search",
        "positions": [1, 2, 3],  // optional, maps to tool_ids
        "search_query": "ai tools"  // optional
    }
    """
    serializer = TrackImpressionSerializer(data=request.data)
    if not serializer.is_valid():
        StructuredLogger.log_validation_error(
            message='Invalid impression tracking request',
            user=request.user if request.user.is_authenticated else None,
            errors=serializer.errors,
            logger_instance=logger,
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    tool_ids = data['tool_ids']
    context = data['context']
    positions = data.get('positions', [])
    search_query = data.get('search_query', '')

    # Get session and user
    session_id = get_session_id(request)
    user = request.user if request.user.is_authenticated else None

    # Track each impression
    tracked = 0
    for i, tool_id in enumerate(tool_ids):
        position = positions[i] if i < len(positions) else None
        track_tool_impression(
            tool_id=tool_id,
            context=context,
            user=user,
            session_id=session_id,
            position=position,
            search_query=search_query,
        )
        tracked += 1

    return Response({'tracked': tracked})


@api_view(['POST'])
@permission_classes([AllowAny])
def track_engagement(request):
    """
    Track a single tool engagement.

    Called by frontend when user interacts with a tool.

    Body:
    {
        "tool_id": 123,
        "engagement_type": "page_view",
        "dwell_time_seconds": 45,  // optional
        "scroll_depth_percent": 80,  // optional
        "destination_url": "https://...",  // for external clicks
        "source_context": "search"  // where user came from
    }
    """
    serializer = TrackEngagementSerializer(data=request.data)
    if not serializer.is_valid():
        StructuredLogger.log_validation_error(
            message='Invalid engagement tracking request',
            user=request.user if request.user.is_authenticated else None,
            errors=serializer.errors,
            logger_instance=logger,
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = get_session_id(request)
    user = request.user if request.user.is_authenticated else None

    track_tool_engagement(
        tool_id=data['tool_id'],
        engagement_type=data['engagement_type'],
        user=user,
        session_id=session_id,
        dwell_time_seconds=data.get('dwell_time_seconds'),
        scroll_depth_percent=data.get('scroll_depth_percent'),
        destination_url=data.get('destination_url', ''),
        source_context=data.get('source_context', ''),
    )

    return Response({'tracked': True})
