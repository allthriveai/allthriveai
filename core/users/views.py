from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .models import User


class UserPagination(PageNumberPagination):
    """Pagination for user lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([AllowAny])
def explore_users(request):
    """Explore top user profiles with pagination.

    Query parameters:
    - page: page number (default: 1)
    - page_size: results per page (default: 20, max: 100)

    Returns paginated list of users sorted by:
    1. Number of showcase projects (descending)
    2. Join date (most recent first)

    Only returns users with at least one showcase project.
    """
    # Get users with showcase projects, annotate with counts
    queryset = (
        User.objects.filter(
            is_active=True,
            projects__is_showcase=True,
            projects__is_archived=False,
        )
        .annotate(
            project_count=Count('projects', distinct=True),
            showcase_count=Count(
                'projects',
                distinct=True,
            ),
        )
        .filter(showcase_count__gt=0)  # Only users with showcase projects
        .order_by('-showcase_count', '-date_joined')
        .distinct()
    )

    # Apply pagination
    paginator = UserPagination()
    paginator.page_size = min(int(request.GET.get('page_size', 20)), 100)
    page = paginator.paginate_queryset(queryset, request)

    # Serialize users
    users_data = []
    for user in page:
        users_data.append(
            {
                'id': user.id,
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'avatar_url': user.avatar_url,
                'bio': user.bio or '',
                'tagline': user.tagline or '',
                'project_count': user.project_count,
                'total_points': user.total_points,
                'level': user.level,
                'tier': user.tier,
                'tier_display': user.get_tier_display(),
            }
        )

    return paginator.get_paginated_response(users_data)
