import logging
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.taxonomy.models import UserInteraction
from core.thrive_circle.models import UserSideQuest
from core.thrive_circle.signals import track_search_used
from core.throttles import AuthenticatedProjectsThrottle, ProjectLikeThrottle, PublicProjectsThrottle
from core.users.models import User

from .constants import MIN_RESPONSE_TIME_SECONDS, PROMOTION_DURATION_DAYS
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
    projects,
    metadata: dict,
    page_num: int,
    page_size: int,
    tab: str,
    metadata_key: str = 'personalization',
    promoted_projects: list | None = None,
) -> dict:
    """Build a standard paginated response for explore endpoint.

    Args:
        projects: Queryset or list of projects to serialize
        metadata: Additional metadata to include in response
        page_num: Current page number
        page_size: Items per page
        tab: Tab name for URL building (e.g., 'for-you', 'trending')
        metadata_key: Key name for metadata in response (default: 'personalization')
        promoted_projects: Optional list of promoted projects to prepend on page 1
    """
    serializer = ProjectSerializer(projects, many=True)
    results = serializer.data

    # Prepend promoted projects on page 1
    if page_num == 1 and promoted_projects:
        promoted_serializer = ProjectSerializer(promoted_projects, many=True)
        results = promoted_serializer.data + results

    # Handle different metadata count keys
    total_count = metadata.get('total_candidates', metadata.get('total_trending', len(projects)))
    # Add promoted count to total
    if promoted_projects:
        total_count += len(promoted_projects)
    next_url, previous_url = build_pagination_urls(tab, page_num, page_size, total_count)

    return {
        'count': total_count,
        'next': next_url,
        'previous': previous_url,
        'results': results,
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

        response_data = {
            'liked': liked,
            'heart_count': project.heart_count,
        }

        # Check for completed quests only when liking (not unliking)
        if liked:
            from django.utils import timezone

            recent_completed_quests = UserSideQuest.objects.filter(
                user=user,
                status='completed',
                completed_at__gte=timezone.now() - timezone.timedelta(seconds=5),
            ).select_related('side_quest', 'side_quest__category')

            if recent_completed_quests.exists():
                response_data['completedQuests'] = [
                    {
                        'id': str(uq.side_quest.id),
                        'title': uq.side_quest.title,
                        'description': uq.side_quest.description,
                        'pointsAwarded': uq.points_awarded or uq.side_quest.points_reward,
                        'categoryName': uq.side_quest.category.name if uq.side_quest.category else None,
                    }
                    for uq in recent_completed_quests
                ]

        return Response(response_data, status=status.HTTP_200_OK)

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
    # v3: playground is now public by default for non-authenticated users
    cache_key = f'projects:v3:{username.lower()}:{"own" if is_own_profile else "public"}'

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

    try:
        # Optimize query with select_related to prevent N+1 queries
        # The serializer accesses user.username, so we fetch user data upfront
        # For curation tier users (agents), order by video published_at if available
        is_curation = user.tier == 'curation'

        if is_curation:
            # For curation agents, order by original publish date from the source
            # YouTube videos: youtube_feed_video__published_at
            # Reddit threads: reddit_thread__created_utc
            # Fall back to created_at for other content types
            from django.db.models.functions import Coalesce

            showcase_projects = (
                Project.objects.select_related('user')
                .filter(user=user, is_showcased=True, is_archived=False)
                .annotate(
                    sort_date=Coalesce('youtube_feed_video__published_at', 'reddit_thread__created_utc', 'created_at')
                )
                .order_by('-sort_date')
            )
        else:
            showcase_projects = (
                Project.objects.select_related('user')
                .filter(user=user, is_showcased=True, is_archived=False)
                .order_by('-created_at')
            )

        # If the requesting user is authenticated and viewing their own profile,
        # include all projects (both showcase and non-showcase) in playground
        if is_own_profile:
            if is_curation:
                from django.db.models.functions import Coalesce

                playground_projects = (
                    Project.objects.select_related('user')
                    .filter(user=user, is_archived=False)
                    .annotate(
                        sort_date=Coalesce(
                            'youtube_feed_video__published_at', 'reddit_thread__created_utc', 'created_at'
                        )
                    )
                    .order_by('-sort_date')
                )
            else:
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
            # For non-authenticated users or other users viewing the profile
            # Check if the user has made their playground public (default is True)
            playground_is_public = getattr(user, 'playground_is_public', True)

            if playground_is_public:
                # Return playground projects for public profiles
                if is_curation:
                    from django.db.models.functions import Coalesce

                    playground_projects = (
                        Project.objects.select_related('user')
                        .filter(user=user, is_archived=False)
                        .annotate(
                            sort_date=Coalesce(
                                'youtube_feed_video__published_at', 'reddit_thread__created_utc', 'created_at'
                            )
                        )
                        .order_by('-sort_date')
                    )
                else:
                    playground_projects = (
                        Project.objects.select_related('user')
                        .filter(user=user, is_archived=False)
                        .order_by('-created_at')
                    )
                response_data = {
                    'showcase': ProjectSerializer(showcase_projects, many=True).data,
                    'playground': ProjectSerializer(playground_projects, many=True).data,
                }
            else:
                # Playground is private - only return showcase
                response_data = {
                    'showcase': ProjectSerializer(showcase_projects, many=True).data,
                    'playground': [],
                }
            # Longer cache for public projects
            cache.set(cache_key, response_data, settings.CACHE_TTL.get('PUBLIC_PROJECTS', 180))

        return Response(response_data)
    except Exception as e:
        logger.error(f'Error fetching projects for user {username}: {e}', exc_info=True)
        return Response(
            {'error': 'Failed to load projects', 'showcase': [], 'playground': []},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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
    - tab: 'for-you' | 'trending' | 'new' | 'news' | 'all' (default: 'all')
    - search: text search query
    - tools: comma-separated tool IDs
    - topics: comma-separated topic slugs
    - sort: 'newest' | 'trending' | 'popular' | 'random' (default: 'newest')
    - page: page number (default: 1)
    - page_size: results per page (default: 30, max: 100)

    Returns paginated list of all public projects (not private, not archived) regardless of showcase status.
    """
    import logging

    from django.contrib.postgres.search import TrigramWordSimilarity
    from django.db.models import Count, Q
    from django.db.models.functions import Greatest

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

    # Get promoted projects for page 1 (shown at top of feed regardless of tab)
    # Only include promotions that haven't expired (within PROMOTION_DURATION_DAYS)
    # Skip promoted projects when user is filtering (search, tools, categories, topics)
    page_num_check = int(request.GET.get('page', 1))
    promoted_projects = []
    promoted_ids = []

    # Check if user is filtering
    search_query = request.GET.get('search', '')
    tools_list = request.GET.getlist('tools')
    categories_list = request.GET.getlist('categories')
    topics_list = request.GET.getlist('topics')
    is_filtering = bool(search_query or any(tools_list) or any(categories_list) or any(topics_list))

    if page_num_check == 1 and not is_filtering:
        from datetime import timedelta

        from django.utils import timezone

        promotion_cutoff = timezone.now() - timedelta(days=PROMOTION_DURATION_DAYS)
        promoted_qs = queryset.filter(
            is_promoted=True,
            promoted_at__gte=promotion_cutoff,  # Only promotions within the time limit
        ).order_by('-promoted_at')
        promoted_projects = list(promoted_qs)
        promoted_ids = [p.id for p in promoted_projects]
        # Exclude promoted from main queryset to avoid duplicates
        if promoted_ids:
            queryset = queryset.exclude(id__in=promoted_ids)

    # Apply search filter with fuzzy matching (trigram similarity)
    # This handles slight misspellings like "javascrpt" -> "javascript"
    search_similarity_applied = False
    if search_query:
        # First try exact/contains match for best performance on exact queries
        exact_match = queryset.filter(Q(title__icontains=search_query) | Q(description__icontains=search_query))

        if exact_match.exists():
            # Use exact match if found
            queryset = exact_match
        else:
            # Fall back to trigram word similarity for fuzzy matching
            # TrigramWordSimilarity finds similar words within text fields
            queryset = queryset.annotate(
                title_similarity=TrigramWordSimilarity(search_query, 'title'),
                description_similarity=TrigramWordSimilarity(search_query, 'description'),
                search_similarity=Greatest('title_similarity', 'description_similarity'),
            ).filter(
                search_similarity__gt=0.3  # Threshold for fuzzy match (0.3 = moderate tolerance)
            )
            search_similarity_applied = True

    # Extract filter values for use with personalization engines
    # These are stored separately so we can pass them to engines that handle their own queries
    filter_tool_ids: list[int] | None = None
    filter_category_ids: list[int] | None = None
    filter_topic_names: list[str] | None = None

    # Apply tools filter - handle both array params (tools=1&tools=2) and comma-separated (tools=1,2)
    tools_list = request.GET.getlist('tools')
    if tools_list:
        try:
            # If multiple values received as array parameters
            if len(tools_list) > 1:
                filter_tool_ids = [int(tid) for tid in tools_list if tid]
            # If single value, check if it's comma-separated
            elif tools_list[0]:
                filter_tool_ids = [int(tid) for tid in tools_list[0].split(',') if tid.strip()]

            if filter_tool_ids:
                queryset = queryset.filter(tools__id__in=filter_tool_ids).distinct()
        except (ValueError, IndexError):
            filter_tool_ids = None  # Invalid tool IDs, ignore

    # Apply categories filter (predefined taxonomy) - handle both array params and comma-separated
    categories_list = request.GET.getlist('categories')
    if categories_list:
        try:
            # If multiple values received as array parameters
            if len(categories_list) > 1:
                filter_category_ids = [int(cid) for cid in categories_list if cid]
            # If single value, check if it's comma-separated
            elif categories_list[0]:
                filter_category_ids = [int(cid) for cid in categories_list[0].split(',') if cid.strip()]

            if filter_category_ids:
                # OR logic: match projects that have ANY of the selected categories
                queryset = queryset.filter(categories__id__in=filter_category_ids).distinct()
        except (ValueError, IndexError):
            filter_category_ids = None  # Invalid category IDs, ignore

    # Apply topics filter (user-generated tags) - handle both array params and comma-separated
    topics_list = request.GET.getlist('topics')
    if topics_list:
        # Topics are free-form strings, not IDs
        try:
            # If multiple values received as array parameters
            if len(topics_list) > 1:
                filter_topic_names = [t for t in topics_list if t]
            # If single value, check if it's comma-separated
            elif topics_list[0]:
                filter_topic_names = [t.strip() for t in topics_list[0].split(',') if t.strip()]

            if filter_topic_names:
                # OR logic: match projects that have ANY of the selected topics
                # Topics are stored as ArrayField, use __overlap to find any match
                queryset = queryset.filter(topics__overlap=filter_topic_names).distinct()
        except (ValueError, IndexError):
            filter_topic_names = None  # Invalid topics, ignore

    # Apply tab-specific filters
    if tab == 'news':
        # Filter for RSS article projects only
        # Sort by published_date (original article date) when available, otherwise by created_at
        from django.db.models.functions import Coalesce

        queryset = (
            queryset.filter(type='rss_article')
            .annotate(effective_date=Coalesce('published_date', 'created_at'))
            .order_by('-effective_date')
        )

        # Paginate and return news feed
        page_size = min(int(request.GET.get('page_size', 30)), 100)
        page_num = int(request.GET.get('page', 1))

        paginator = ProjectPagination()
        paginator.page_size = page_size
        page = paginator.paginate_queryset(queryset, request)

        serializer = ProjectSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    # Apply sorting or personalization based on tab
    elif tab == 'for-you':
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
                        tool_ids=filter_tool_ids,
                        category_ids=filter_category_ids,
                        topic_names=filter_topic_names,
                    )
                    return Response(
                        build_paginated_response(
                            result['projects'],
                            result['metadata'],
                            page_num,
                            page_size,
                            'for-you',
                            promoted_projects=promoted_projects,
                        )
                    )
                except Exception as e:
                    logger.error(f'Personalization engine error: {e}', exc_info=True)
                    # Fall through to cold start

            # Cold start or personalization failed
            result = cold_start.get_cold_start_feed(
                user=request.user,
                page=page_num,
                page_size=page_size,
                tool_ids=filter_tool_ids,
                category_ids=filter_category_ids,
                topic_names=filter_topic_names,
            )
            return Response(
                build_paginated_response(
                    result['projects'],
                    result['metadata'],
                    page_num,
                    page_size,
                    'for-you',
                    promoted_projects=promoted_projects,
                )
            )
        else:
            # Anonymous user - show popular
            cold_start = ColdStartService()
            result = cold_start.get_cold_start_feed(
                user=None,
                page=page_num,
                page_size=page_size,
                tool_ids=filter_tool_ids,
                category_ids=filter_category_ids,
                topic_names=filter_topic_names,
            )
            return Response(
                build_paginated_response(
                    result['projects'],
                    result['metadata'],
                    page_num,
                    page_size,
                    'for-you',
                    promoted_projects=promoted_projects,
                )
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
                tool_ids=filter_tool_ids,
                category_ids=filter_category_ids,
                topic_names=filter_topic_names,
            )
            return Response(
                build_paginated_response(
                    result['projects'],
                    result['metadata'],
                    page_num,
                    page_size,
                    'trending',
                    'trending',
                    promoted_projects=promoted_projects,
                )
            )
        except Exception as e:
            logger.error(f'Trending engine error: {e}', exc_info=True)
            # Fall through to default sorting

    elif tab == 'new':
        # Newest-first ordering with user diversity
        # Sort by published_date if available, otherwise by created_at
        from django.db.models.functions import Coalesce

        from services.personalization import apply_user_diversity

        queryset = queryset.annotate(effective_date=Coalesce('published_date', 'created_at')).order_by(
            '-effective_date'
        )

        page_size = min(int(request.GET.get('page_size', 30)), 100)
        page_num = int(request.GET.get('page', 1))

        # Fetch extra to account for diversity filtering
        start_idx = (page_num - 1) * page_size
        fetch_size = page_size * 3
        raw_projects = list(queryset[start_idx : start_idx + fetch_size])

        # Apply user diversity - max 3 posts per user per page
        diverse_projects = apply_user_diversity(
            raw_projects,
            max_per_user=3,
            page_size=page_size,
        )

        serializer = ProjectSerializer(diverse_projects, many=True)
        results = serializer.data

        # Prepend promoted projects on page 1
        if page_num == 1 and promoted_projects:
            promoted_serializer = ProjectSerializer(promoted_projects, many=True)
            results = promoted_serializer.data + results

        # Build paginated response
        total_count = queryset.count() + len(promoted_projects)
        has_next = start_idx + page_size < total_count
        next_url = f'?tab=new&page={page_num + 1}&page_size={page_size}' if has_next else None
        prev_url = f'?tab=new&page={page_num - 1}&page_size={page_size}' if page_num > 1 else None
        return Response(
            {
                'count': total_count,
                'next': next_url,
                'previous': prev_url,
                'results': results,
            }
        )

    # Default sorting for 'all' tab or fallback
    # If fuzzy search was applied, prioritize by similarity score
    if search_similarity_applied:
        # Order by similarity first, then by creation date
        queryset = queryset.order_by('-search_similarity', '-created_at')
    elif sort == 'trending':
        # Trending: most likes in the last 7 days
        queryset = queryset.annotate(recent_likes=Count('likes')).order_by('-recent_likes', '-created_at')
    elif sort == 'popular':
        # Popular: most likes all-time
        queryset = queryset.annotate(total_likes=Count('likes')).order_by('-total_likes', '-created_at')
    elif sort == 'random':
        queryset = queryset.order_by('?')
    else:  # newest (default)
        # Sort by newest, then apply user diversity to prevent feed domination
        queryset = queryset.order_by('-created_at')

    # Apply pagination with user diversity for newest sort
    page_size = min(int(request.GET.get('page_size', 30)), 100)
    page_num = int(request.GET.get('page', 1))

    if sort == 'newest' or sort is None:
        # Apply user diversity - max 3 posts per user per page
        from services.personalization import apply_user_diversity

        # Fetch extra to account for diversity filtering
        start_idx = (page_num - 1) * page_size
        fetch_size = page_size * 3
        raw_projects = list(queryset[start_idx : start_idx + fetch_size])

        diverse_projects = apply_user_diversity(
            raw_projects,
            max_per_user=3,
            page_size=page_size,
        )

        serializer = ProjectSerializer(diverse_projects, many=True)
        results = serializer.data

        # Prepend promoted projects on page 1
        if page_num == 1 and promoted_projects:
            promoted_serializer = ProjectSerializer(promoted_projects, many=True)
            results = promoted_serializer.data + results

        # Build paginated response manually
        total_count = queryset.count() + len(promoted_projects)
        has_next = start_idx + page_size < total_count
        next_url = f'?page={page_num + 1}&page_size={page_size}' if has_next else None
        prev_url = f'?page={page_num - 1}&page_size={page_size}' if page_num > 1 else None
        return Response(
            {
                'count': total_count,
                'next': next_url,
                'previous': prev_url,
                'results': results,
            }
        )

    # For other sorts (trending, popular, random), use standard pagination
    paginator = ProjectPagination()
    paginator.page_size = page_size
    page = paginator.paginate_queryset(queryset, request)

    serializer = ProjectSerializer(page, many=True)
    results = serializer.data

    # Prepend promoted projects on page 1
    if page_num == 1 and promoted_projects:
        promoted_serializer = ProjectSerializer(promoted_projects, many=True)
        results = promoted_serializer.data + results

    response = paginator.get_paginated_response(results)
    # Adjust count to include promoted projects
    if promoted_projects:
        response.data['count'] = response.data.get('count', 0) + len(promoted_projects)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def semantic_search(request):
    """Semantic search using Weaviate vector similarity.

    Request body:
    - query: Search query text (required)
    - types: List of content types to search (default: all)
             Options: 'projects', 'tools', 'quizzes', 'users'
    - limit: Maximum results per type (default: 10, max: 50)
    - alpha: Weight for vector vs keyword (0=keyword, 1=vector, default: 0.7)

    Returns results grouped by content type.
    """
    import logging

    from django.db.models import Q

    from core.quizzes.models import Quiz
    from core.tools.models import Tool
    from core.users.models import User

    logger = logging.getLogger(__name__)

    query = request.data.get('query', '').strip()
    if not query:
        return Response({'error': 'Query is required'}, status=400)

    # Track search usage for quest progress (only for authenticated users)
    if request.user.is_authenticated:
        track_search_used(request.user, query)

    # Get search parameters
    requested_types = request.data.get('types', ['projects', 'tools', 'quizzes', 'users'])
    if isinstance(requested_types, str):
        requested_types = [requested_types]
    valid_types = {'projects', 'tools', 'quizzes', 'users'}
    types_to_search = [t for t in requested_types if t in valid_types]

    limit = min(int(request.data.get('limit', 10)), 50)
    alpha = float(request.data.get('alpha', 0.7))

    results = {
        'projects': [],
        'tools': [],
        'quizzes': [],
        'users': [],
    }
    search_type = 'text_fallback'

    try:
        from services.weaviate import get_embedding_service, get_weaviate_client
        from services.weaviate.schema import WeaviateSchema

        client = get_weaviate_client()
        weaviate_available = client.is_available()
        query_vector = None

        if weaviate_available:
            # Try to generate query embedding
            try:
                embedding_service = get_embedding_service()
                query_vector = embedding_service.generate_embedding(query)
                search_type = 'semantic'
            except Exception as embed_error:
                logger.warning(f'Embedding generation failed, falling back to text search: {embed_error}')
                # Fall back to text search - still use Weaviate for keyword matching if available
                search_type = 'text_fallback'

        # Search Projects
        if 'projects' in types_to_search:
            try:
                if weaviate_available and query_vector:
                    weaviate_results = client.hybrid_search(
                        collection=WeaviateSchema.PROJECT_COLLECTION,
                        query=query,
                        vector=query_vector,
                        alpha=alpha,
                        limit=limit,
                    )
                    project_ids = [r.get('project_id') for r in weaviate_results if r.get('project_id')]
                    projects = (
                        Project.objects.filter(id__in=project_ids)
                        .select_related('user')
                        .prefetch_related('tools', 'categories', 'likes')
                    )
                    project_map = {p.id: p for p in projects}
                    ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]
                else:
                    # Text fallback - search title, description, tools, and categories
                    ordered_projects = list(
                        Project.objects.filter(is_private=False, is_archived=False)
                        .filter(
                            Q(title__icontains=query)
                            | Q(description__icontains=query)
                            | Q(tools__name__icontains=query)
                            | Q(categories__name__icontains=query)
                        )
                        .select_related('user')
                        .prefetch_related('tools', 'categories', 'likes')
                        .distinct()  # Required due to M2M joins
                        .order_by('-created_at')[:limit]
                    )

                results['projects'] = [
                    {
                        'id': p.id,
                        'title': p.title,
                        'slug': p.slug,
                        'description': (p.description or '')[:150],
                        'username': p.user.username,
                        'featured_image_url': p.featured_image_url,
                        'url': f'/{p.user.username}/{p.slug}',
                    }
                    for p in ordered_projects
                ]
            except Exception as e:
                logger.warning(f'Project search failed: {e}')

        # Search Tools
        if 'tools' in types_to_search:
            try:
                if weaviate_available and query_vector:
                    weaviate_results = client.hybrid_search(
                        collection=WeaviateSchema.TOOL_COLLECTION,
                        query=query,
                        vector=query_vector,
                        alpha=alpha,
                        limit=limit,
                    )
                    tool_ids = [r.get('tool_id') for r in weaviate_results if r.get('tool_id')]
                    tools = Tool.objects.filter(id__in=tool_ids, is_active=True)
                    tool_map = {t.id: t for t in tools}
                    ordered_tools = [tool_map[tid] for tid in tool_ids if tid in tool_map]
                else:
                    ordered_tools = list(
                        Tool.objects.filter(is_active=True)
                        .filter(
                            Q(name__icontains=query) | Q(description__icontains=query) | Q(tagline__icontains=query)
                        )
                        .order_by('-popularity_score')[:limit]
                    )

                results['tools'] = [
                    {
                        'id': t.id,
                        'name': t.name,
                        'slug': t.slug,
                        'tagline': t.tagline or '',
                        'logo_url': t.logo_url,
                        'category': t.category,
                        'url': f'/tools/{t.slug}',
                    }
                    for t in ordered_tools
                ]
            except Exception as e:
                logger.warning(f'Tool search failed: {e}')

        # Search Quizzes
        if 'quizzes' in types_to_search:
            try:
                if weaviate_available and query_vector:
                    weaviate_results = client.hybrid_search(
                        collection=WeaviateSchema.QUIZ_COLLECTION,
                        query=query,
                        vector=query_vector,
                        alpha=alpha,
                        limit=limit,
                    )
                    quiz_ids = [r.get('quiz_id') for r in weaviate_results if r.get('quiz_id')]
                    quizzes = Quiz.objects.filter(id__in=quiz_ids, is_published=True).prefetch_related('questions')
                    quiz_map = {str(q.id): q for q in quizzes}
                    ordered_quizzes = [quiz_map[qid] for qid in quiz_ids if qid in quiz_map]
                else:
                    ordered_quizzes = list(
                        Quiz.objects.filter(is_published=True)
                        .filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(topic__icontains=query))
                        .prefetch_related('questions')
                        .order_by('-created_at')[:limit]
                    )

                results['quizzes'] = [
                    {
                        'id': str(q.id),
                        'title': q.title,
                        'slug': q.slug,
                        'description': (q.description or '')[:150],
                        'difficulty': q.difficulty,
                        'topic': q.topic,
                        'question_count': q.questions.count(),
                        'thumbnail_url': q.thumbnail_url,
                        'url': f'/quizzes/{q.slug}',
                    }
                    for q in ordered_quizzes
                ]
            except Exception as e:
                logger.warning(f'Quiz search failed: {e}')

        # Search Users
        if 'users' in types_to_search:
            try:
                # Users always use text search (no Weaviate collection for user search)
                users = list(
                    User.objects.filter(is_active=True, is_profile_public=True)
                    .filter(
                        Q(username__icontains=query)
                        | Q(first_name__icontains=query)
                        | Q(last_name__icontains=query)
                        | Q(bio__icontains=query)
                    )
                    .order_by('-date_joined')[:limit]
                )

                results['users'] = [
                    {
                        'id': u.id,
                        'username': u.username,
                        'full_name': u.get_full_name() or u.username,
                        'avatar_url': u.avatar_url,
                        'bio': (u.bio or '')[:100],
                        'project_count': u.projects.filter(is_private=False, is_archived=False).count(),
                        'url': f'/{u.username}',
                    }
                    for u in users
                ]
            except Exception as e:
                logger.warning(f'User search failed: {e}')

        # Calculate total results
        total_results = sum(len(v) for v in results.values())

        return Response(
            {
                'query': query,
                'search_type': search_type,
                'results': results,
                'meta': {
                    'total_results': total_results,
                    'weaviate_available': weaviate_available if 'weaviate_available' in dir() else False,
                    'alpha': alpha,
                },
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_project_promotion(request, project_id):
    """Toggle project promotion status. Admin only.

    Promotes a project to appear at the top of explore feeds.
    Only admins can promote/unpromote projects.

    Returns:
        - is_promoted: new promotion status
        - promoted_at: timestamp when promoted (or null if unpromoted)
    """
    from django.utils import timezone

    # Only admins can promote projects
    if request.user.role != 'admin':
        raise PermissionDenied('Only admins can promote projects.')

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # Toggle promotion status
    if project.is_promoted:
        # Unpromote
        project.is_promoted = False
        project.promoted_at = None
        project.promoted_by = None
    else:
        # Promote
        project.is_promoted = True
        project.promoted_at = timezone.now()
        project.promoted_by = request.user

    project.save()

    return Response(
        {
            'success': True,
            'data': {
                'id': project.id,
                'is_promoted': project.is_promoted,
                'promoted_at': project.promoted_at,
            },
        }
    )
