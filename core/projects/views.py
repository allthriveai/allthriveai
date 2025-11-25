from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.taxonomy.models import UserInteraction
from core.throttles import ProjectLikeThrottle
from core.users.models import User

from .constants import MIN_RESPONSE_TIME_SECONDS
from .models import Project, ProjectLike
from .serializers import ProjectSerializer


class ProjectPagination(PageNumberPagination):
    """Pagination for project lists."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user projects.

    All projects are scoped to the authenticated user; `user` is never
    client-controlled.
    """

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ProjectPagination

    def get_queryset(self):
        # Only return projects for the current user
        # Optimize with select_related for user and prefetch_related for tools to prevent N+1 queries
        return (
            Project.objects.filter(user=self.request.user)
            .select_related('user')
            .prefetch_related('tools', 'likes')
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        # Bind project to the authenticated user and let the model handle slug
        # generation / uniqueness on save.
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='toggle-like', throttle_classes=[ProjectLikeThrottle])
    def toggle_like(self, request, pk=None):
        """Toggle like/heart on a project.

        If the user has already liked the project, remove the like.
        If the user hasn't liked it, add a like.
        Also tracks the interaction in the user's activity feed.

        Rate limited to prevent abuse (60 requests/hour).
        """
        project = self.get_object()
        user = request.user

        # Check if user has already liked this project
        existing_like = ProjectLike.objects.filter(user=user, project=project).first()

        if existing_like:
            # Unlike - remove the like
            existing_like.delete()
            liked = False
        else:
            # Like - create new like
            ProjectLike.objects.create(user=user, project=project)
            liked = True

            # Track interaction in activity feed
            UserInteraction.objects.create(
                user=user,
                interaction_type='project_view',  # Using existing type since project_like doesn't exist yet
                metadata={
                    'action': 'like',
                    'project_id': project.id,
                    'project_title': project.title,
                    'project_slug': project.slug,
                    'project_owner': project.user.username,
                },
            )

        return Response(
            {
                'liked': liked,
                'heart_count': project.heart_count,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Bulk delete projects for the authenticated user.

        Expects a JSON payload with a list of project IDs:
        {"project_ids": [1, 2, 3]}

        Only deletes projects owned by the authenticated user.
        """
        project_ids = request.data.get('project_ids', [])

        if not project_ids:
            return Response(
                {'error': {'field': 'project_ids', 'message': 'This field is required and must be a non-empty list'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(project_ids, list):
            return Response(
                {'error': {'field': 'project_ids', 'message': 'This field must be a list'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only delete projects owned by the authenticated user
        deleted_count, _ = Project.objects.filter(id__in=project_ids, user=request.user).delete()

        return Response(
            {'deleted_count': deleted_count, 'message': f'Successfully deleted {deleted_count} project(s)'},
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def public_user_projects(request, username):
    """Get projects for a user by username.

    For public/other users: Returns only showcase projects (is_showcase=True, not archived)
    For the user viewing their own profile: Returns showcase + all projects in playground

    This endpoint is accessible to everyone, including logged-out users.

    Security:
    - Rate limited to prevent data harvesting
    - Uses select_related to prevent N+1 queries
    - Consistent response time to prevent user enumeration
    """
    import logging
    import time

    from django.conf import settings
    from django.core.cache import cache

    from core.throttles import AuthenticatedProjectsThrottle, PublicProjectsThrottle

    logger = logging.getLogger(__name__)

    # Apply throttling based on authentication status
    throttle_class = AuthenticatedProjectsThrottle if request.user.is_authenticated else PublicProjectsThrottle
    throttle = throttle_class()
    if not throttle.allow_request(request, None):
        from rest_framework.exceptions import Throttled

        raise Throttled(wait=throttle.wait())

    start_time = time.time()

    # Check cache for public projects
    is_own_profile = request.user.is_authenticated and request.user.username.lower() == username.lower()
    # Include version in cache key to prevent stale data after schema changes
    # v2: playground now includes all projects, not just non-showcase ones
    cache_key = f'projects:v2:{username.lower()}:{"own" if is_own_profile else "public"}'

    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)

    try:
        user = User.objects.get(username=username.lower())
    except User.DoesNotExist:
        # Log suspicious activity - repeated requests for non-existent users
        logger.warning(
            f'Public project access attempt for non-existent user: {username} '
            f'from IP: {request.META.get("REMOTE_ADDR")}'
        )
        # Return 404 but maintain consistent response time (prevent timing attacks)
        elapsed = time.time() - start_time
        if elapsed < MIN_RESPONSE_TIME_SECONDS:
            time.sleep(MIN_RESPONSE_TIME_SECONDS - elapsed)
        return Response({'error': 'User not found', 'showcase': [], 'playground': []}, status=404)

    # Optimize query with select_related to prevent N+1 queries
    # The serializer accesses user.username, so we fetch user data upfront
    showcase_projects = (
        Project.objects.select_related('user')
        .filter(user=user, is_showcase=True, is_archived=False)
        .order_by('-created_at')
    )

    # If the requesting user is authenticated and viewing their own profile,
    # include all projects (both showcase and non-showcase) in playground
    if is_own_profile:
        playground_projects = (
            Project.objects.select_related('user').filter(user=user, is_archived=False).order_by('-created_at')
        )

        response_data = {
            'showcase': ProjectSerializer(showcase_projects, many=True).data,
            'playground': ProjectSerializer(playground_projects, many=True).data,
        }
        # Shorter cache for own projects (they change more frequently)
        cache.set(cache_key, response_data, settings.CACHE_TTL.get('USER_PROJECTS', 60))
    else:
        # For non-authenticated users or other users, only return showcase
        response_data = {
            'showcase': ProjectSerializer(showcase_projects, many=True).data,
            'playground': [],
        }
        # Longer cache for public projects
        cache.set(cache_key, response_data, settings.CACHE_TTL.get('PUBLIC_PROJECTS', 180))

    return Response(response_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def user_liked_projects(request, username):
    """Get the list of projects liked by a given user.

    This powers the Collection tab on profile pages.

    Security:
    - Only returns projects that are public (is_published=True, is_private=False, not archived)
    - Rate limited similarly to other public project endpoints
    - Uses select_related/prefetch_related to avoid N+1 queries
    """
    import logging
    import time

    from core.throttles import AuthenticatedProjectsThrottle, PublicProjectsThrottle

    logger = logging.getLogger(__name__)

    # Apply throttling based on authentication status
    throttle_class = AuthenticatedProjectsThrottle if request.user.is_authenticated else PublicProjectsThrottle
    throttle = throttle_class()
    if not throttle.allow_request(request, None):
        from rest_framework.exceptions import Throttled

        raise Throttled(wait=throttle.wait())

    start_time = time.time()

    try:
        profile_user = User.objects.get(username=username.lower())
    except User.DoesNotExist:
        # Log suspicious activity - repeated requests for non-existent users
        logger.warning(
            f'Liked projects access attempt for non-existent user: {username} '
            f'from IP: {request.META.get("REMOTE_ADDR")}'
        )
        # Return 404 but maintain consistent response time (prevent timing attacks)
        elapsed = time.time() - start_time
        if elapsed < MIN_RESPONSE_TIME_SECONDS:
            time.sleep(MIN_RESPONSE_TIME_SECONDS - elapsed)
        return Response({'error': 'User not found', 'results': []}, status=404)

    # Only include projects that are publicly visible to avoid leaking private/archived content
    # Hard-limit to a reasonable maximum to avoid unbounded payloads; lazy loading on the client
    # ensures we only hit this when the Collection tab is opened.
    MAX_LIKED_PROJECTS = 500
    queryset = (
        Project.objects.filter(
            likes__user=profile_user,
            is_published=True,
            is_private=False,
            is_archived=False,
        )
        .select_related('user')
        .prefetch_related('tools', 'likes')
        .order_by('-likes__created_at')
        .distinct()[:MAX_LIKED_PROJECTS]
    )

    serializer = ProjectSerializer(queryset, many=True, context={'request': request})
    return Response({'results': serializer.data})


@api_view(['GET'])
@permission_classes([AllowAny])
def explore_projects(request):
    """Explore projects with filtering, search, and pagination.

    Query parameters:
    - tab: 'for-you' | 'trending' | 'all' (default: 'all')
    - search: text search query
    - tools: comma-separated tool IDs
    - topics: comma-separated topic slugs
    - sort: 'newest' | 'trending' | 'popular' | 'random' (default: 'newest')
    - page: page number (default: 1)
    - page_size: results per page (default: 30, max: 100)

    Returns paginated list of showcase projects visible to all users.
    """
    from django.db.models import Count, Q

    # Get query parameters
    tab = request.GET.get('tab', 'all')
    search_query = request.GET.get('search', '')
    tools_param = request.GET.get('tools', '')
    topics_param = request.GET.get('topics', '')
    sort = request.GET.get('sort', 'newest')

    # Build base queryset - all published, public projects
    queryset = (
        Project.objects.filter(is_published=True, is_private=False, is_archived=False)
        .select_related('user')
        .prefetch_related('tools', 'likes')
    )

    # Apply search filter
    if search_query:
        queryset = queryset.filter(Q(title__icontains=search_query) | Q(description__icontains=search_query))

    # Apply tools filter
    if tools_param:
        try:
            tool_ids = [int(tid) for tid in tools_param.split(',') if tid.strip()]
            if tool_ids:
                queryset = queryset.filter(tools__id__in=tool_ids).distinct()
        except ValueError:
            pass  # Invalid tool IDs, ignore

    # Apply topics filter (assuming topics are stored in a related field - placeholder for now)
    # TODO: Implement topic filtering when topic model is ready
    if topics_param:
        pass  # Topics will be implemented when topic tagging is added

    # Apply sorting or personalization
    if tab == 'for-you' and request.user.is_authenticated:
        # Personalized feed based on user's auto-detected preferences
        from core.taxonomy.models import UserTag

        # Get user's tool preferences
        user_tool_tags = UserTag.objects.filter(user=request.user, taxonomy__category='tool').select_related('taxonomy')

        if user_tool_tags.exists():
            # Score each project based on tool matches
            scored_projects = []
            for project in queryset:
                score = 0
                project_tools = set(project.tools.values_list('id', flat=True))

                # Calculate match score (40% weight for tools)
                for tag in user_tool_tags:
                    if tag.taxonomy and hasattr(tag.taxonomy, 'tool_entity'):
                        tool = tag.taxonomy.tool_entity
                        if tool and tool.id in project_tools:
                            # Weighted by confidence score
                            score += tag.confidence_score * 0.40

                # Diversity bonus for newer projects (10% weight)
                from django.utils import timezone

                days_old = (timezone.now() - project.created_at).days
                if days_old < 7:
                    score += 0.10
                elif days_old < 30:
                    score += 0.05

                # Popularity bonus (small weight to avoid echo chamber)
                like_count = project.likes.count() if hasattr(project, 'likes') else 0
                if like_count > 10:
                    score += 0.05

                scored_projects.append((project, score))

            # Sort by score descending
            scored_projects.sort(key=lambda x: x[1], reverse=True)
            queryset = [p[0] for p in scored_projects]
        else:
            # No preferences yet, fall back to newest
            queryset = queryset.order_by('-created_at')
    elif sort == 'trending':
        # Trending: most likes in the last 7 days
        queryset = queryset.annotate(recent_likes=Count('likes')).order_by('-recent_likes', '-created_at')
    elif sort == 'popular':
        # Popular: most likes all-time
        queryset = queryset.annotate(total_likes=Count('likes')).order_by('-total_likes', '-created_at')
    elif sort == 'random':
        queryset = queryset.order_by('?')
    else:  # newest (default)
        queryset = queryset.order_by('-created_at')

    # Apply pagination
    paginator = ProjectPagination()
    paginator.page_size = min(int(request.GET.get('page_size', 30)), 100)
    page = paginator.paginate_queryset(queryset, request)

    serializer = ProjectSerializer(page, many=True)

    return paginator.get_paginated_response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def semantic_search(request):
    """Semantic search for projects using Weaviate (AI-powered).

    Request body:
    {
        "query": "search query text",
        "filters": {optional filters}
    }

    Returns list of projects matching the semantic query.

    TODO: Integrate with Weaviate vector database for true semantic search.
    For now, falls back to basic text search as a placeholder.
    """
    from django.db.models import Q

    query = request.data.get('query', '')

    if not query:
        return Response({'results': []})

    # TODO: Replace this with Weaviate semantic search
    # For now, use basic text search as fallback
    queryset = (
        Project.objects.filter(is_published=True, is_private=False, is_archived=False)
        .filter(Q(title__icontains=query) | Q(description__icontains=query))
        .select_related('user')
        .prefetch_related('tools', 'likes')
        .order_by('-created_at')[:30]
    )

    serializer = ProjectSerializer(queryset, many=True)

    return Response({'results': serializer.data})
