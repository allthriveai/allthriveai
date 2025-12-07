"""
Vendor Analytics Services

Provides:
- track_tool_impression: Track tool impressions (async-safe)
- track_tool_engagement: Track tool engagements (async-safe)
- get_tool_analytics: Get analytics data for vendor dashboard
"""

import logging
import time
from datetime import timedelta

from django.db import DatabaseError, IntegrityError
from django.utils import timezone

from core.logging_utils import StructuredLogger

logger = logging.getLogger(__name__)


def get_session_id(request) -> str:
    """
    Get or create a session ID for tracking.

    Uses session key if available, otherwise generates one.
    """
    if hasattr(request, 'session') and request.session.session_key:
        return request.session.session_key

    # Fallback: use a hash of user agent + IP (anonymized)
    import hashlib

    user_agent = request.headers.get('user-agent', '')
    # Only use first two octets of IP for privacy
    ip = request.META.get('REMOTE_ADDR', '')
    ip_prefix = '.'.join(ip.split('.')[:2]) if ip else ''

    raw = f'{user_agent}:{ip_prefix}'
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _resolve_user_and_session(request, user, session_id: str | None) -> tuple:
    """
    Extract user and session_id from request if not provided.

    Args:
        request: Django request object (optional)
        user: User object (optional, takes precedence over request.user)
        session_id: Session ID (optional, derived from request if not provided)

    Returns:
        Tuple of (user, session_id)
    """
    if user is None and request and hasattr(request, 'user') and request.user.is_authenticated:
        user = request.user

    if session_id is None:
        if request:
            session_id = get_session_id(request)
        else:
            session_id = 'unknown'

    return user, session_id


def track_tool_impression(
    tool_id: int,
    context: str,
    request=None,
    user=None,
    session_id: str | None = None,
    position: int | None = None,
    search_query: str = '',
    referrer_tool_id: int | None = None,
) -> None:
    """
    Track a tool impression (tool shown to user).

    Called from views when tools are displayed:
    - Search results
    - Directory listings
    - Project detail pages
    - Recommendations

    Args:
        tool_id: ID of the tool being shown
        context: Where the impression occurred (use ToolImpression.ImpressionContext)
        request: Django request object (for session/user)
        user: User object (optional, takes precedence over request.user)
        session_id: Session ID (optional, derived from request if not provided)
        position: Position in list (1-indexed)
        search_query: Search query if from search results
        referrer_tool_id: Related tool ID if from "related tools"
    """
    from .models import ToolImpression

    try:
        # Get user and session
        user, session_id = _resolve_user_and_session(request, user, session_id)

        ToolImpression.objects.create(
            tool_id=tool_id,
            user=user if user and user.is_authenticated else None,
            session_id=session_id,
            context=context,
            position=position,
            search_query=search_query[:500] if search_query else '',
            referrer_tool_id=referrer_tool_id,
        )

    except (DatabaseError, IntegrityError) as e:
        # Database errors - log but don't break main flow (tracking is non-critical)
        StructuredLogger.log_error(
            message='Failed to track tool impression',
            error=e,
            user=user,
            extra={
                'tool_id': tool_id,
                'context': context,
                'session_id': session_id,
            },
            level='warning',
            logger_instance=logger,
        )
    except Exception as e:
        # Unexpected errors - log at error level for investigation
        StructuredLogger.log_error(
            message='Unexpected error tracking tool impression',
            error=e,
            user=user,
            extra={
                'tool_id': tool_id,
                'context': context,
            },
            logger_instance=logger,
        )


def track_tool_engagement(
    tool_id: int,
    engagement_type: str,
    request=None,
    user=None,
    session_id: str | None = None,
    dwell_time_seconds: int | None = None,
    scroll_depth_percent: int | None = None,
    destination_url: str = '',
    source_context: str = '',
    metadata: dict | None = None,
) -> None:
    """
    Track a tool engagement (meaningful user action).

    Called from views when users interact with tools:
    - Page views
    - External clicks
    - Bookmarks
    - Project adds

    Args:
        tool_id: ID of the tool
        engagement_type: Type of engagement (use ToolEngagement.EngagementType)
        request: Django request object
        user: User object (optional)
        session_id: Session ID (optional)
        dwell_time_seconds: Time on page (for page_view)
        scroll_depth_percent: Scroll depth (for page_view)
        destination_url: URL clicked (for external clicks)
        source_context: Where user came from
        metadata: Additional data
    """
    from .models import ToolEngagement

    try:
        user, session_id = _resolve_user_and_session(request, user, session_id)

        ToolEngagement.objects.create(
            tool_id=tool_id,
            user=user if user and user.is_authenticated else None,
            session_id=session_id,
            engagement_type=engagement_type,
            dwell_time_seconds=dwell_time_seconds,
            scroll_depth_percent=scroll_depth_percent,
            destination_url=destination_url[:200] if destination_url else '',
            source_context=source_context[:50] if source_context else '',
            metadata=metadata or {},
        )

        # Check for competitor view tracking (if page_view)
        if engagement_type == 'page_view':
            _maybe_track_competitor_view(tool_id, session_id, user)

    except (DatabaseError, IntegrityError) as e:
        # Database errors - log but don't break main flow
        StructuredLogger.log_error(
            message='Failed to track tool engagement',
            error=e,
            user=user,
            extra={
                'tool_id': tool_id,
                'engagement_type': engagement_type,
                'session_id': session_id,
            },
            level='warning',
            logger_instance=logger,
        )
    except Exception as e:
        # Unexpected errors - log at error level
        StructuredLogger.log_error(
            message='Unexpected error tracking tool engagement',
            error=e,
            user=user,
            extra={
                'tool_id': tool_id,
                'engagement_type': engagement_type,
            },
            logger_instance=logger,
        )


def _maybe_track_competitor_view(tool_id: int, session_id: str, user=None) -> None:
    """
    Track competitor views when user views multiple tool pages in same session.

    Called after each page_view engagement. Looks for other tool page views
    in the same session within the last 30 minutes.
    """
    from .models import ToolCompetitorView, ToolEngagement

    try:
        # Find other tool page views in this session within last 30 minutes
        cutoff = timezone.now() - timedelta(minutes=30)
        recent_views = (
            ToolEngagement.objects.filter(
                session_id=session_id,
                engagement_type='page_view',
                created_at__gte=cutoff,
            )
            .exclude(tool_id=tool_id)
            .values_list('tool_id', 'created_at')
            .order_by('-created_at')[:5]
        )

        now = timezone.now()
        for other_tool_id, view_time in recent_views:
            minutes_between = int((now - view_time).total_seconds() / 60)

            # Ensure consistent ordering (tool_a.id < tool_b.id)
            if tool_id < other_tool_id:
                tool_a_id, tool_b_id = tool_id, other_tool_id
            else:
                tool_a_id, tool_b_id = other_tool_id, tool_id

            # Create or update competitor view
            ToolCompetitorView.objects.get_or_create(
                session_id=session_id,
                tool_a_id=tool_a_id,
                tool_b_id=tool_b_id,
                defaults={
                    'user': user if user and user.is_authenticated else None,
                    'minutes_between': minutes_between,
                },
            )

    except (DatabaseError, IntegrityError) as e:
        # Database errors - log at debug level (competitor tracking is low priority)
        StructuredLogger.log_error(
            message='Failed to track competitor view',
            error=e,
            user=user,
            extra={
                'tool_id': tool_id,
                'session_id': session_id,
            },
            level='warning',
            logger_instance=logger,
        )
    except Exception as e:
        StructuredLogger.log_error(
            message='Unexpected error tracking competitor view',
            error=e,
            user=user,
            extra={'tool_id': tool_id},
            logger_instance=logger,
        )


def get_tool_analytics(tool_id: int, days: int = 30) -> dict:
    """
    Get analytics data for a tool (for vendor dashboard).

    Returns real metrics from the Tool model and related tables:
    - Page views (view_count on Tool model)
    - Bookmarks (ToolBookmark count)
    - Reviews (ToolReview count and avg rating)
    - Popularity ranking
    - Projects using this tool

    Args:
        tool_id: Tool ID to get analytics for
        days: Number of days of data to include

    Returns:
        Dict with analytics data
    """
    from django.db.models import Avg

    from core.projects.models import Project
    from core.tools.models import Tool, ToolBookmark, ToolReview

    start_time = time.time()

    try:
        tool = Tool.objects.get(id=tool_id)
    except Tool.DoesNotExist:
        logger.warning(f'Tool not found for analytics: tool_id={tool_id}')
        return {'error': 'Tool not found'}

    cutoff = timezone.now() - timedelta(days=days)

    # Get real metrics from existing data
    total_bookmarks = ToolBookmark.objects.filter(tool_id=tool_id).count()
    recent_bookmarks = ToolBookmark.objects.filter(tool_id=tool_id, created_at__gte=cutoff).count()

    # Reviews
    all_reviews = ToolReview.objects.filter(tool_id=tool_id, is_approved=True)
    total_reviews = all_reviews.count()
    recent_reviews = all_reviews.filter(created_at__gte=cutoff).count()
    avg_rating = all_reviews.aggregate(avg=Avg('rating'))['avg'] or 0

    # Projects using this tool (tools is a ManyToManyField)
    projects_using_tool = Project.objects.filter(tools__id=tool_id).count()

    # Category ranking - rank by number of projects using the tool
    from django.db.models import Count

    category_tools = (
        Tool.objects.filter(category=tool.category, is_active=True)
        .annotate(project_count=Count('projects'))
        .order_by('-project_count', '-view_count')
    )

    category_rank = None
    category_total = category_tools.count()
    for idx, t in enumerate(category_tools, 1):
        if t.id == tool_id:
            category_rank = idx
            break

    # Similar tools in same category (potential competitors)
    similar_tools = list(
        category_tools.exclude(id=tool_id).values('id', 'name', 'slug', 'logo_url', 'view_count', 'project_count')[:5]
    )

    # Recent reviews for display
    recent_review_list = list(
        all_reviews.filter(created_at__gte=cutoff)
        .select_related('user')
        .values('rating', 'title', 'content', 'user__username', 'created_at')
        .order_by('-created_at')[:5]
    )

    # Log performance metrics
    duration_ms = (time.time() - start_time) * 1000
    StructuredLogger.log_service_operation(
        service_name='VendorAnalytics',
        operation='get_tool_analytics',
        success=True,
        duration_ms=duration_ms,
        metadata={
            'tool_id': tool_id,
            'days': days,
        },
        logger_instance=logger,
    )

    return {
        'tool': {
            'id': tool.id,
            'name': tool.name,
            'slug': tool.slug,
            'logo_url': tool.logo_url,
            'category': tool.category,
            'tagline': tool.tagline,
            'is_featured': tool.is_featured,
            'is_verified': tool.is_verified,
        },
        'period': {
            'days': days,
            'start_date': cutoff.date().isoformat(),
            'end_date': timezone.now().date().isoformat(),
        },
        'metrics': {
            # Core engagement metrics
            'total_views': tool.view_count,
            'popularity_score': round(tool.popularity_score, 2),
            # User actions
            'total_bookmarks': total_bookmarks,
            'recent_bookmarks': recent_bookmarks,
            # Reviews
            'total_reviews': total_reviews,
            'recent_reviews': recent_reviews,
            'avg_rating': round(avg_rating, 1) if avg_rating else None,
            # Projects
            'projects_using_tool': projects_using_tool,
            # Category performance
            'category_rank': category_rank,
            'category_total': category_total,
        },
        'similar_tools': similar_tools,
        'recent_reviews': recent_review_list,
    }


def get_vendor_tools(user) -> list:
    """
    Get list of tools a vendor user has access to.

    Args:
        user: User object (must have role='vendor')

    Returns:
        List of tool dicts with access info
    """
    from .models import VendorToolAccess

    access_records = VendorToolAccess.objects.filter(user=user).select_related('tool')

    return [
        {
            'id': access.tool.id,
            'name': access.tool.name,
            'slug': access.tool.slug,
            'logo_url': access.tool.logo_url,
            'access': {
                'can_view_basic': access.can_view_basic,
                'can_view_competitive': access.can_view_competitive,
                'can_view_segments': access.can_view_segments,
                'can_view_queries': access.can_view_queries,
                'can_export': access.can_export,
            },
        }
        for access in access_records
    ]
