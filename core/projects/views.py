import logging
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import Throttled
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.taxonomy.models import UserInteraction
from core.throttles import AuthenticatedProjectsThrottle, ProjectLikeThrottle, PublicProjectsThrottle
from core.users.models import User

from .constants import MIN_RESPONSE_TIME_SECONDS
from .models import Project, ProjectLike
from .serializers import ProjectSerializer

logger = logging.getLogger(__name__)

# URL constants for explore pagination
EXPLORE_BASE_URL = '/api/v1/projects/explore/'


def apply_throttle(request):
    """Apply throttling based on authentication status.

    Raises Throttled exception if rate limit exceeded.
    """
    throttle_class = AuthenticatedProjectsThrottle if request.user.is_authenticated else PublicProjectsThrottle
    throttle = throttle_class()
    if not throttle.allow_request(request, None):
        raise Throttled(wait=throttle.wait())


def build_pagination_urls(tab: str, page_num: int, page_size: int, total_count: int) -> tuple[str | None, str | None]:
    """Build next and previous pagination URLs for explore endpoint.

    Returns:
        Tuple of (next_url, previous_url)
    """
    has_next = page_num * page_size < total_count
    next_url = f'{EXPLORE_BASE_URL}?tab={tab}&page={page_num + 1}&page_size={page_size}' if has_next else None
    previous_url = f'{EXPLORE_BASE_URL}?tab={tab}&page={page_num - 1}&page_size={page_size}' if page_num > 1 else None
    return next_url, previous_url


def build_paginated_response(
    projects, metadata: dict, page_num: int, page_size: int, tab: str, metadata_key: str = 'personalization'
) -> dict:
    """Build a standard paginated response for explore endpoint.

    Args:
        projects: Queryset or list of projects to serialize
        metadata: Additional metadata to include in response
        page_num: Current page number
        page_size: Items per page
        tab: Tab name for URL building (e.g., 'for-you', 'trending')
        metadata_key: Key name for metadata in response (default: 'personalization')
    """
    serializer = ProjectSerializer(projects, many=True)
    # Handle different metadata count keys
    total_count = metadata.get('total_candidates', metadata.get('total_trending', len(projects)))
    next_url, previous_url = build_pagination_urls(tab, page_num, page_size, total_count)

    return {
        'count': total_count,
        'next': next_url,
        'previous': previous_url,
        'results': serializer.data,
        metadata_key: metadata,
    }


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
        # Admin users can see all projects, regular users only see their own
        from core.users.models import UserRole

        if self.request.user.role == UserRole.ADMIN:
            # Admins can manage all projects
            queryset = Project.objects.all()
        else:
            # Only return projects for the current user
            queryset = Project.objects.filter(user=self.request.user)

        # Optimize with select_related for user and prefetch_related for tools to prevent N+1 queries
        return (
            queryset.select_related('user').prefetch_related('tools', 'likes', 'reddit_thread').order_by('-created_at')
        )

    def perform_create(self, serializer):
        # Bind project to the authenticated user and let the model handle slug
        # generation / uniqueness on save.
        serializer.save(user=self.request.user)

        # Invalidate user projects cache
        self._invalidate_user_cache(self.request.user)

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

    def perform_update(self, serializer):
        """Called when updating a project."""
        serializer.save()
        # Invalidate cache after update
        self._invalidate_user_cache(self.request.user)

    def perform_destroy(self, instance):
        """Called when deleting a project.

        Admins can delete any project, regular users can only delete their own.
        For Reddit thread projects, records deletion to prevent resync recreation.
        """
        from core.users.models import UserRole

        # Check permissions
        if self.request.user.role != UserRole.ADMIN and instance.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied('You do not have permission to delete this project.')

        user = instance.user

        # If this is a Reddit thread project, record the deletion
        if instance.type == Project.ProjectType.REDDIT_THREAD and hasattr(instance, 'reddit_thread'):
            self._record_reddit_thread_deletion(instance, self.request.user)

        instance.delete()
        # Invalidate cache after delete
        self._invalidate_user_cache(user)

    def _record_reddit_thread_deletion(self, project, deleted_by):
        """Record a Reddit thread deletion to prevent resync recreation."""
        try:
            from core.integrations.reddit_models import DeletedRedditThread

            thread = project.reddit_thread

            # Create a deletion record
            DeletedRedditThread.objects.create(
                reddit_post_id=thread.reddit_post_id,
                agent=thread.agent,
                subreddit=thread.subreddit,
                deleted_by=deleted_by,
                deletion_type=DeletedRedditThread.DeletionType.ADMIN_DELETED,
                deletion_reason=f'Inappropriate content - deleted by admin {deleted_by.username}',
            )

            logger.info(
                f'Recorded deletion of Reddit thread {thread.reddit_post_id} '
                f'(r/{thread.subreddit}) by {deleted_by.username}'
            )
        except Exception as e:
            logger.error(f'Failed to record Reddit thread deletion: {e}', exc_info=True)

    def _invalidate_user_cache(self, user):
        """Invalidate cached project lists for a user."""
        username_lower = user.username.lower()
        cache.delete(f'projects:v2:{username_lower}:own')
        cache.delete(f'projects:v2:{username_lower}:public')
        logger.debug(f'Invalidated project cache for user {user.username}')

    @action(detail=True, methods=['patch'], url_path='update-tags')
    def update_tags(self, request, pk=None):
        """Update project tags (tools, categories, topics) - Admin only.

        Sets tags_manually_edited=True to prevent auto-tagging during resync.

        Payload:
        {
            "tools": [1, 2, 3],  # Tool IDs
            "categories": [4, 5],  # Category/Taxonomy IDs
            "topics": ["python", "ai_agents"]  # String array
        }
        """
        from core.taxonomy.models import Taxonomy
        from core.tools.models import Tool
        from core.users.models import UserRole

        # Only admins can manually edit tags
        if request.user.role != UserRole.ADMIN:
            return Response(
                {'error': 'Only admins can manually edit project tags'},
                status=status.HTTP_403_FORBIDDEN,
            )

        project = self.get_object()

        # Update tools
        if 'tools' in request.data:
            tool_ids = request.data['tools']
            if not isinstance(tool_ids, list):
                return Response(
                    {'error': {'field': 'tools', 'message': 'Must be a list of tool IDs'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tools = Tool.objects.filter(id__in=tool_ids)
            project.tools.set(tools)

        # Update categories
        if 'categories' in request.data:
            category_ids = request.data['categories']
            if not isinstance(category_ids, list):
                return Response(
                    {'error': {'field': 'categories', 'message': 'Must be a list of category IDs'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            categories = Taxonomy.objects.filter(id__in=category_ids, taxonomy_type='category')
            project.categories.set(categories)

        # Update topics
        if 'topics' in request.data:
            topics = request.data['topics']
            if not isinstance(topics, list):
                return Response(
                    {'error': {'field': 'topics', 'message': 'Must be a list of strings'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Validate and clean topics
            cleaned_topics = [str(t).strip().lower()[:50] for t in topics if t]
            project.topics = cleaned_topics[:15]  # Limit to 15 topics

        # Mark as manually edited
        project.tags_manually_edited = True
        project.save()

        # Invalidate cache
        self._invalidate_user_cache(project.user)

        logger.info(
            f'Admin {request.user.username} manually edited tags for project {project.id} '
            f'({project.user.username}/{project.slug})'
        )

        # Return updated project
        serializer = self.get_serializer(project)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Bulk delete projects.

        Expects a JSON payload with a list of project IDs:
        {"project_ids": [1, 2, 3]}

        Admins can delete any projects, regular users can only delete their own.
        """
        from core.users.models import UserRole

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

        # Admin can delete any projects, regular users only their own
        if request.user.role == UserRole.ADMIN:
            queryset = Project.objects.filter(id__in=project_ids).select_related('reddit_thread')
        else:
            queryset = Project.objects.filter(id__in=project_ids, user=request.user).select_related('reddit_thread')

        # Get affected users for cache invalidation
        affected_users = set(queryset.values_list('user', flat=True))

        # Record Reddit thread deletions before actual deletion
        for project in queryset:
            if project.type == Project.ProjectType.REDDIT_THREAD and hasattr(project, 'reddit_thread'):
                self._record_reddit_thread_deletion(project, request.user)

        deleted_count, _ = queryset.delete()

        # Invalidate cache for all affected users
        if deleted_count > 0:
            from core.users.models import User

            for user_id in affected_users:
                try:
                    user = User.objects.get(id=user_id)
                    self._invalidate_user_cache(user)
                except User.DoesNotExist:
                    pass

        return Response(
            {'deleted_count': deleted_count, 'message': f'Successfully deleted {deleted_count} project(s)'},
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_project_by_slug(request, username, slug):
    """Get a single project by username and slug.

    Security:
    - Public for all projects that are not private and not archived
    - Private projects only visible to owner
    - Archived projects only visible to owner
    """
    try:
        user = User.objects.get(username__iexact=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Try to find the project
    try:
        project = (
            Project.objects.select_related('user')
            .prefetch_related('tools', 'likes', 'reddit_thread')
            .get(user=user, slug=slug)
        )
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check visibility permissions
    is_owner = request.user.is_authenticated and request.user == project.user

    # Allow access if:
    # 1. User is the owner
    # 2. Project is not private and not archived
    if not is_owner:
        if project.is_private or project.is_archived:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectSerializer(project, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_user_projects(request, username):
    """Get projects for a user by username.

    For public/other users: Returns only showcased projects (is_showcased=True, not archived)
    For the user viewing their own profile: Returns showcased + all projects in playground

    This endpoint is accessible to everyone, including logged-out users.

    Security:
    - Rate limited to prevent data harvesting
    - Uses select_related to prevent N+1 queries
    - Consistent response time to prevent user enumeration
    """
    apply_throttle(request)

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
        .filter(user=user, is_showcased=True, is_archived=False)
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
    - Only returns projects that are public (is_private=False, not archived)
    - Rate limited similarly to other public project endpoints
    - Uses select_related/prefetch_related to avoid N+1 queries
    """
    apply_throttle(request)

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

    Returns paginated list of all public projects (not private, not archived) regardless of showcase status.
    """
    import logging

    from django.db.models import Count, Q

    logger = logging.getLogger(__name__)

    # Debug: Log all query parameters
    logger.info(f'explore_projects called with params: {dict(request.GET)}')

    # Get query parameters
    tab = request.GET.get('tab', 'all')
    search_query = request.GET.get('search', '')
    sort = request.GET.get('sort', 'newest')

    # Build base queryset - all public projects (not private, not archived)
    queryset = (
        Project.objects.filter(is_private=False, is_archived=False)
        .select_related('user')
        .prefetch_related('tools', 'likes')
    )

    # Apply search filter
    if search_query:
        queryset = queryset.filter(Q(title__icontains=search_query) | Q(description__icontains=search_query))

    # Apply tools filter - handle both array params (tools=1&tools=2) and comma-separated (tools=1,2)
    tools_list = request.GET.getlist('tools')
    if tools_list:
        try:
            # If multiple values received as array parameters
            if len(tools_list) > 1:
                tool_ids = [int(tid) for tid in tools_list if tid]
            # If single value, check if it's comma-separated
            elif tools_list[0]:
                tool_ids = [int(tid) for tid in tools_list[0].split(',') if tid.strip()]
            else:
                tool_ids = []

            if tool_ids:
                queryset = queryset.filter(tools__id__in=tool_ids).distinct()
        except (ValueError, IndexError):
            pass  # Invalid tool IDs, ignore

    # Apply categories filter (predefined taxonomy) - handle both array params and comma-separated
    categories_list = request.GET.getlist('categories')
    if categories_list:
        try:
            # If multiple values received as array parameters
            if len(categories_list) > 1:
                category_ids = [int(cid) for cid in categories_list if cid]
            # If single value, check if it's comma-separated
            elif categories_list[0]:
                category_ids = [int(cid) for cid in categories_list[0].split(',') if cid.strip()]
            else:
                category_ids = []

            if category_ids:
                # OR logic: match projects that have ANY of the selected categories
                queryset = queryset.filter(categories__id__in=category_ids).distinct()
        except (ValueError, IndexError):
            pass  # Invalid category IDs, ignore

    # Apply topics filter (user-generated tags) - handle both array params and comma-separated
    topics_list = request.GET.getlist('topics')
    if topics_list:
        # Topics are free-form strings, not IDs
        try:
            # If multiple values received as array parameters
            if len(topics_list) > 1:
                topic_names = [t for t in topics_list if t]
            # If single value, check if it's comma-separated
            elif topics_list[0]:
                topic_names = [t.strip() for t in topics_list[0].split(',') if t.strip()]
            else:
                topic_names = []

            if topic_names:
                # OR logic: match projects that have ANY of the selected topics
                # Topics are stored as ArrayField, use __overlap to find any match
                queryset = queryset.filter(topics__overlap=topic_names).distinct()
        except (ValueError, IndexError):
            pass  # Invalid topics, ignore

    # Apply sorting or personalization based on tab
    if tab == 'for-you':
        # Use new personalization engine for "For You" feed
        from services.personalization import ColdStartService, PersonalizationEngine

        page_num = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 30)), 100)

        if request.user.is_authenticated:
            cold_start = ColdStartService()

            if cold_start.has_sufficient_data(request.user):
                # Use full personalization engine
                try:
                    engine = PersonalizationEngine()
                    result = engine.get_for_you_feed(
                        user=request.user,
                        page=page_num,
                        page_size=page_size,
                    )
                    return Response(
                        build_paginated_response(result['projects'], result['metadata'], page_num, page_size, 'for-you')
                    )
                except Exception as e:
                    logger.error(f'Personalization engine error: {e}', exc_info=True)
                    # Fall through to cold start

            # Cold start or personalization failed
            result = cold_start.get_cold_start_feed(
                user=request.user,
                page=page_num,
                page_size=page_size,
            )
            return Response(
                build_paginated_response(result['projects'], result['metadata'], page_num, page_size, 'for-you')
            )
        else:
            # Anonymous user - show popular
            cold_start = ColdStartService()
            result = cold_start.get_cold_start_feed(
                user=None,
                page=page_num,
                page_size=page_size,
            )
            return Response(
                build_paginated_response(result['projects'], result['metadata'], page_num, page_size, 'for-you')
            )

    elif tab == 'trending':
        # Use trending engine for engagement velocity-based feed
        from services.personalization import TrendingEngine

        page_num = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 30)), 100)

        try:
            engine = TrendingEngine()
            result = engine.get_trending_feed(
                user=request.user if request.user.is_authenticated else None,
                page=page_num,
                page_size=page_size,
            )
            return Response(
                build_paginated_response(
                    result['projects'], result['metadata'], page_num, page_size, 'trending', 'trending'
                )
            )
        except Exception as e:
            logger.error(f'Trending engine error: {e}', exc_info=True)
            # Fall through to default sorting

    # Default sorting for 'all' tab or fallback
    if sort == 'trending':
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
    """Semantic search using Weaviate vector similarity.

    Request body:
    - query: Search query text (required)
    - limit: Maximum results (default: 50, max: 100)
    - alpha: Weight for vector vs keyword (0=keyword, 1=vector, default: 0.7)

    Returns projects matching the semantic query.
    """
    import logging

    logger = logging.getLogger(__name__)

    query = request.data.get('query', '').strip()
    if not query:
        return Response({'error': 'Query is required'}, status=400)

    limit = min(int(request.data.get('limit', 50)), 100)
    alpha = float(request.data.get('alpha', 0.7))

    try:
        from services.weaviate import get_embedding_service, get_weaviate_client
        from services.weaviate.schema import WeaviateSchema

        client = get_weaviate_client()

        if not client.is_available():
            # Fallback to basic text search
            logger.warning('Weaviate unavailable, falling back to text search')
            from django.db.models import Q

            queryset = (
                Project.objects.filter(
                    is_private=False,
                    is_archived=False,
                )
                .filter(Q(title__icontains=query) | Q(description__icontains=query))
                .select_related('user')
                .prefetch_related('tools', 'categories', 'likes')
                .order_by('-created_at')[:limit]
            )
            serializer = ProjectSerializer(queryset, many=True)
            return Response(
                {
                    'results': serializer.data,
                    'search_type': 'text_fallback',
                }
            )

        # Generate query embedding
        embedding_service = get_embedding_service()
        query_vector = embedding_service.generate_embedding(query)

        # Perform hybrid search
        results = client.hybrid_search(
            collection=WeaviateSchema.PROJECT_COLLECTION,
            query=query,
            vector=query_vector if query_vector else None,
            alpha=alpha,
            limit=limit,
        )

        # Get Django objects in order
        project_ids = [r.get('project_id') for r in results if r.get('project_id')]
        projects = (
            Project.objects.filter(id__in=project_ids)
            .select_related('user')
            .prefetch_related('tools', 'categories', 'likes')
        )

        # Maintain search order
        project_map = {p.id: p for p in projects}
        ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

        serializer = ProjectSerializer(ordered_projects, many=True)
        return Response(
            {
                'results': serializer.data,
                'search_type': 'semantic',
                'alpha': alpha,
            }
        )

    except Exception as e:
        logger.error(f'Semantic search error: {e}', exc_info=True)
        return Response({'error': 'Search failed'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def personalization_status(request):
    """Get user's personalization status and cold-start info.

    Returns:
    - is_cold_start: Whether user is in cold-start state
    - has_sufficient_data: Whether personalization can be used
    - has_onboarding: Whether user completed onboarding
    - data_score: Completion percentage (0-1)
    - stats: Current interaction counts
    """
    from services.personalization import ColdStartService

    cold_start = ColdStartService()
    status = cold_start.get_onboarding_status(request.user)

    return Response(status)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_project_by_id(request, project_id):
    """Delete a project by ID.

    Admins can delete any project, regular users can only delete their own.
    """
    from rest_framework.exceptions import NotFound, PermissionDenied

    from core.users.models import UserRole

    try:
        project = Project.objects.select_related('user').get(id=project_id)
    except Project.DoesNotExist:
        raise NotFound('Project not found') from None

    # Check permissions
    if request.user.role != UserRole.ADMIN and project.user != request.user:
        raise PermissionDenied('You do not have permission to delete this project.')

    # Store user for cache invalidation
    user = project.user
    username_lower = user.username.lower()

    # Delete the project
    project.delete()

    # Invalidate cache
    from django.core.cache import cache

    cache.delete(f'projects:v2:{username_lower}:own')
    cache.delete(f'projects:v2:{username_lower}:public')

    return Response({'message': 'Project deleted successfully'}, status=status.HTTP_200_OK)
