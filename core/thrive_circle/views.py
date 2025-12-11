"""API views for Thrive Circle."""

import logging

from django.db import models
from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.users.models import User

from .models import (
    Circle,
    CircleMembership,
    Kudos,
    PointActivity,
    QuestCategory,
    SideQuest,
    UserSideQuest,
    WeeklyGoal,
)
from .quest_tracker import QuestTracker
from .serializers import (
    AwardPointsSerializer,
    CircleDetailSerializer,
    CreateKudosSerializer,
    KudosSerializer,
    PointActivitySerializer,
    QuestCategoryDetailSerializer,
    QuestCategorySerializer,
    SideQuestSerializer,
    UserPointsSerializer,
    UserSideQuestSerializer,
    WeeklyGoalSerializer,
)
from .services import PointsService
from .signals import track_page_visited
from .utils import get_week_start, safe_int_param

logger = logging.getLogger(__name__)


class PointsAwardThrottle(UserRateThrottle):
    """Rate limit for points award endpoint - prevent spam."""

    rate = '100/hour'


class ThriveCircleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Thrive Circle gamification status.

    Endpoints:
    - GET /api/thrive-circle/ - List all users by points (leaderboard)
    - GET /api/thrive-circle/{id}/ - Get specific user's points status
    - GET /api/thrive-circle/my-status/ - Get current user's points status
    - POST /api/thrive-circle/award-points/ - Award points to current user
    """

    serializer_class = UserPointsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Optimize queryset with prefetch_related to prevent N+1 queries.

        For list views (leaderboard), returns all users ordered by points.
        Note: Consider adding privacy filtering based on user preferences if needed.
        """
        return User.objects.prefetch_related(
            Prefetch('point_activities', queryset=PointActivity.objects.order_by('-created_at')[:20])
        ).order_by('-total_points')

    def get_object(self):
        """
        Override to enforce user isolation - users can only view their own detailed data.

        For leaderboard privacy, users can only retrieve their own full profile via ID.
        Other users' detailed gamification data is not accessible via direct ID lookup.
        Use the list endpoint for public leaderboard view (limited data).
        """
        obj = super().get_object()

        # Allow users to only view their own detailed gamification data
        if obj.id != self.request.user.id:
            raise PermissionDenied(
                'You can only view your own detailed gamification data. '
                'Use /my-status/ endpoint or view the leaderboard for public stats.'
            )

        return obj

    @action(detail=False, methods=['get'])
    def my_status(self, request):
        """
        Get the authenticated user's points status and recent activities.

        Returns:
            {
                ...user points data with recent_activities...
            }
        """
        user = request.user
        return Response(UserPointsSerializer(user).data)

    @action(detail=False, methods=['post'], throttle_classes=[PointsAwardThrottle])
    def award_points(self, request):
        """
        Award points to the authenticated user.

        This endpoint is rate-limited and restricted to non-system activity types.
        System activities (quiz_complete, project_create, etc.) can only be awarded internally.

        Request body:
            {
                "amount": 50,
                "activity_type": "comment",  # Must be user-triggered, not system
                "description": "Posted helpful comment"
            }

        Returns:
            {
                "tier_status": {...},
                "point_activity": {...},
                "tier_upgraded": bool,
                "old_tier": "ember" | null,
                "new_tier": "spark" | null
            }
        """
        serializer = AwardPointsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        amount = serializer.validated_data['amount']
        activity_type = serializer.validated_data['activity_type']
        description = serializer.validated_data.get('description', '')

        try:
            # Validate using service layer
            PointsService.validate_points_award(amount, activity_type)

            # Record old tier for upgrade detection
            old_tier = user.tier

            # Add points (this creates the activity record and checks for tier upgrade)
            # This is atomic and uses F() expressions
            user.add_points(amount, activity_type, description)

            # Refresh to get updated tier
            user.refresh_from_db()

            # Check if tier upgraded
            tier_upgraded = user.tier != old_tier

            # Get the activity that was just created
            latest_activity = PointActivity.objects.filter(user=user).order_by('-created_at').first()

            logger.info(
                f'Points awarded via API: {amount} points for {activity_type}',
                extra={
                    'user_id': user.id,
                    'amount': amount,
                    'activity_type': activity_type,
                    'tier_upgraded': tier_upgraded,
                },
            )

            return Response(
                {
                    'user': UserPointsSerializer(user).data,
                    'point_activity': PointActivitySerializer(latest_activity).data,
                    'tier_upgraded': tier_upgraded,
                    'old_tier': old_tier if tier_upgraded else None,
                    'new_tier': user.tier if tier_upgraded else None,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            logger.warning(
                f'Invalid points award attempt: {e}',
                extra={'user_id': user.id, 'amount': amount, 'activity_type': activity_type},
            )
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(
                f'Failed to award points: {e}',
                exc_info=True,
                extra={'user_id': user.id, 'amount': amount, 'activity_type': activity_type},
            )
            return Response(
                {'error': 'Failed to award points. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'])
    def weekly_goals(self, request):
        """
        Get the authenticated user's weekly goals for the current week.

        Returns a list of weekly goals with progress information.

        Returns:
            [
                {
                    "id": "...",
                    "goal_type": "activities_3",
                    "goal_type_display": "Complete 3 Activities",
                    "current_progress": 1,
                    "target_progress": 3,
                    "progress_percentage": 33,
                    "is_completed": false,
                    "points_reward": 30,
                    ...
                },
                ...
            ]
        """
        user = request.user
        week_start = get_week_start()

        # Get this week's goals for the user
        goals = WeeklyGoal.objects.filter(user=user, week_start=week_start).order_by('goal_type')

        return Response(WeeklyGoalSerializer(goals, many=True).data)

    @action(detail=False, methods=['get'], url_path='circle-projects')
    def circle_projects(self, request):
        """
        Get recent projects from members in the same tier circle.

        Returns a list of recent projects created by users in the same tier,
        excluding the current user's own projects.

        Query params:
            - limit: Number of projects to return (default: 10, max: 50)

        Returns:
            [
                {
                    "id": 1,
                    "username": "...",
                    "user_avatar_url": "...",
                    "title": "...",
                    "slug": "...",
                    "description": "...",
                    "thumbnail_url": "...",
                    ...
                },
                ...
            ]
        """
        from core.projects.models import Project
        from core.projects.serializers import ProjectSerializer

        user = request.user
        limit = safe_int_param(request.query_params.get('limit'), default=10, min_val=1, max_val=50)

        # Get users in the same tier (including current user to show community projects)
        same_tier_users = User.objects.filter(tier=user.tier).values_list('id', flat=True)

        # Get recent published projects from same-tier users
        projects = (
            Project.objects.filter(
                user_id__in=same_tier_users,
                is_archived=False,
                is_private=False,
            )
            .select_related('user')
            .order_by('-created_at')[:limit]
        )

        return Response(ProjectSerializer(projects, many=True).data)


class PointActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for point activities.

    Endpoints:
    - GET /api/point-activities/ - List all point activities (filtered to current user)
    - GET /api/point-activities/{id}/ - Get specific point activity
    """

    serializer_class = PointActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter activities to current user only."""
        return PointActivity.objects.filter(user=self.request.user).select_related('user').order_by('-created_at')


class QuestCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Quest Categories/Pathways.

    Endpoints:
    - GET /api/quest-categories/ - List all active categories
    - GET /api/quest-categories/{slug}/ - Get category with quests
    - GET /api/quest-categories/{slug}/progress/ - Get user's progress in category
    """

    serializer_class = QuestCategorySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'slug'

    def get_queryset(self):
        """
        Return active categories with annotated quest count to prevent N+1 queries.

        Uses annotate instead of the quest_count property to efficiently count
        active quests per category in a single query.
        """
        return (
            QuestCategory.objects.filter(is_active=True)
            .annotate(annotated_quest_count=models.Count('quests', filter=models.Q(quests__is_active=True)))
            .order_by('order')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuestCategoryDetailSerializer
        return QuestCategorySerializer

    @action(detail=True, methods=['get'])
    def progress(self, request, slug=None):
        """Get user's progress in a specific category."""
        category = self.get_object()
        progress = QuestTracker.get_category_progress(request.user, category)
        return Response(
            {
                'category': QuestCategorySerializer(category).data,
                'progress': progress,
            }
        )

    @action(detail=False, methods=['get'])
    def all_progress(self, request):
        """
        Get user's progress across all categories.

        Optimized to fetch all progress data in 2 queries instead of 2N+1.
        """
        user = request.user
        categories = list(self.get_queryset())
        category_ids = [c.id for c in categories]

        # Single query to get all user quest progress grouped by category
        from django.db.models import Count, Q

        user_quest_stats = (
            UserSideQuest.objects.filter(
                user=user,
                side_quest__category_id__in=category_ids,
                side_quest__is_active=True,
            )
            .values('side_quest__category_id')
            .annotate(
                completed_count=Count('id', filter=Q(is_completed=True)),
                in_progress_count=Count('id', filter=Q(status='in_progress', is_completed=False)),
                bonus_claimed=Count('id', filter=Q(side_quest__quest_type='category_complete', is_completed=True)),
            )
        )

        # Build lookup dict
        progress_by_category = {stat['side_quest__category_id']: stat for stat in user_quest_stats}

        # Get total quests per category (already annotated in queryset)
        result = []
        for category in categories:
            stats = progress_by_category.get(category.id, {})
            completed = stats.get('completed_count', 0)
            total = category.annotated_quest_count if hasattr(category, 'annotated_quest_count') else 0

            progress = {
                'total_quests': total,
                'completed_quests': completed,
                'in_progress_quests': stats.get('in_progress_count', 0),
                'completion_percentage': int(completed / total * 100) if total > 0 else 0,
                'is_complete': completed >= total and total > 0,
                'bonus_claimed': stats.get('bonus_claimed', 0) > 0,
            }
            result.append(
                {
                    'category': QuestCategorySerializer(category).data,
                    'progress': progress,
                }
            )
        return Response(result)


class SideQuestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Side Quests.

    Endpoints:
    - GET /api/side-quests/ - List all available side quests
    - GET /api/side-quests/{id}/ - Get specific side quest
    - GET /api/side-quests/my-quests/ - Get current user's active and completed quests
    - GET /api/side-quests/daily/ - Get today's daily quests
    - POST /api/side-quests/{id}/start/ - Start (accept) a side quest
    - POST /api/side-quests/{id}/update-progress/ - Update progress on a side quest
    - POST /api/side-quests/{id}/complete/ - Mark a side quest as completed
    """

    serializer_class = SideQuestSerializer
    permission_classes = [IsAuthenticated]

    def _get_user_quest_or_404(self, user, side_quest):
        """
        Retrieve a UserSideQuest or raise 404 if not found.

        Args:
            user: The authenticated user
            side_quest: The SideQuest object

        Returns:
            UserSideQuest: The user's quest record

        Raises:
            NotFound: If user has not started this quest
        """
        try:
            return UserSideQuest.objects.get(user=user, side_quest=side_quest)
        except UserSideQuest.DoesNotExist as e:
            raise NotFound('You have not started this quest yet.') from e

    def _log_quest_completion(self, user, side_quest, user_quest):
        """
        Log when a user completes a quest.

        Args:
            user: The authenticated user
            side_quest: The SideQuest object
            user_quest: The UserSideQuest object with completion details
        """
        logger.info(
            f'User completed side quest: {side_quest.title}',
            extra={
                'user_id': user.id,
                'quest_id': str(side_quest.id),
                'points_awarded': user_quest.points_awarded,
            },
        )

    def get_queryset(self):
        """
        Return only active quests that are currently available.

        Supports filtering by:
        - topic: Filter quests by topic slug (e.g., 'chatbots-conversation')
        - skill_level: Filter quests by skill level (beginner, intermediate, advanced, master)
        - quest_type: Filter quests by type (quiz_mastery, project_showcase, etc.)
        - category: Filter quests by category slug
        - is_daily: Filter to only daily quests

        Query params:
            ?topic=chatbots-conversation
            ?skill_level=beginner
            ?quest_type=project_showcase
            ?category=community-builder
            ?is_daily=true
        """
        from django.utils import timezone

        now = timezone.now()
        queryset = (
            SideQuest.objects.filter(
                is_active=True,
            )
            .filter(
                models.Q(starts_at__isnull=True) | models.Q(starts_at__lte=now),
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=now),
            )
            .select_related('category')
        )

        # Filter by category if provided
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__slug=category)

        # Filter by topic if provided
        topic = self.request.query_params.get('topic')
        if topic:
            # Include quests specific to this topic OR universal quests (topic=null)
            queryset = queryset.filter(models.Q(topic=topic) | models.Q(topic__isnull=True))

        # Filter by skill_level if provided
        skill_level = self.request.query_params.get('skill_level')
        if skill_level:
            # Include quests for this skill level OR universal quests (skill_level=null)
            queryset = queryset.filter(models.Q(skill_level=skill_level) | models.Q(skill_level__isnull=True))

        # Filter by quest_type if provided
        quest_type = self.request.query_params.get('quest_type')
        if quest_type:
            queryset = queryset.filter(quest_type=quest_type)

        # Filter by is_daily if provided
        is_daily = self.request.query_params.get('is_daily')
        if is_daily and is_daily.lower() == 'true':
            queryset = queryset.filter(is_daily=True)

        return queryset

    @action(detail=False, methods=['get'])
    def daily(self, request):
        """
        Get today's daily quests for the user.

        Returns daily quests the user is working on or can start,
        and auto-starts any new daily quests.
        """
        user = request.user

        # Auto-start daily quests for the user
        QuestTracker.auto_start_daily_quests(user)

        # Get user's daily quests (in progress and available)
        daily_quests = QuestTracker.get_daily_quests(user)

        # Get user progress for these quests
        user_quests = UserSideQuest.objects.filter(
            user=user,
            side_quest__in=daily_quests,
        ).select_related('side_quest')

        # Build response with quest + progress
        result = []
        for quest in daily_quests:
            user_quest = next((uq for uq in user_quests if uq.side_quest_id == quest.id), None)
            result.append(
                {
                    'quest': SideQuestSerializer(quest).data,
                    'progress': UserSideQuestSerializer(user_quest).data if user_quest else None,
                }
            )

        return Response(result)

    @action(detail=False, methods=['get'], url_path='my-quests')
    def my_quests(self, request):
        """
        Get the authenticated user's side quests.

        Query params:
            - status: Filter by status (not_started, in_progress, completed, expired)
            - limit: Number of quests to return (default: 50)

        Returns:
            [
                {
                    "id": "...",
                    "side_quest": {...},
                    "status": "in_progress",
                    "current_progress": 5,
                    "target_progress": 10,
                    "progress_percentage": 50,
                    ...
                },
                ...
            ]
        """
        user = request.user
        status_filter = request.query_params.get('status', None)
        limit = safe_int_param(request.query_params.get('limit'), default=50, min_val=1, max_val=100)

        queryset = UserSideQuest.objects.filter(user=user).select_related('side_quest')

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        quests = queryset.order_by('-started_at')[:limit]

        return Response(UserSideQuestSerializer(quests, many=True).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """
        Start (accept) a side quest.

        This creates a UserSideQuest record for the authenticated user.

        Returns:
            {
                "id": "...",
                "side_quest": {...},
                "status": "in_progress",
                "current_progress": 0,
                "target_progress": 10,
                ...
            }
        """
        user = request.user
        side_quest = self.get_object()

        # Check if quest is available
        if not side_quest.is_available():
            return Response({'error': 'This quest is not currently available.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if user already has this quest
        existing_quest = UserSideQuest.objects.filter(user=user, side_quest=side_quest).first()

        if existing_quest:
            if existing_quest.is_completed:
                return Response({'error': 'You have already completed this quest.'}, status=status.HTTP_400_BAD_REQUEST)
            # Return existing in-progress quest
            return Response(UserSideQuestSerializer(existing_quest).data)

        # Create new user quest
        try:
            # Extract target from requirements
            target = side_quest.requirements.get('target', 1)

            user_quest = UserSideQuest.objects.create(
                user=user,
                side_quest=side_quest,
                status='in_progress',
                current_progress=0,
                target_progress=target,
            )

            logger.info(
                f'User started side quest: {side_quest.title}',
                extra={'user_id': user.id, 'quest_id': str(side_quest.id)},
            )

            return Response(UserSideQuestSerializer(user_quest).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(
                f'Failed to start side quest: {e}',
                exc_info=True,
                extra={'user_id': user.id, 'quest_id': str(pk)},
            )
            return Response(
                {'error': 'Failed to start quest. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'], url_path='update-progress')
    def update_progress(self, request, pk=None):
        """
        Update progress on a side quest.

        Request body:
            {
                "increment": 1  # Amount to increment current_progress by
            }

        Returns:
            {
                "id": "...",
                "side_quest": {...},
                "status": "in_progress",
                "current_progress": 6,
                "target_progress": 10,
                ...
            }
        """
        user = request.user
        side_quest = self.get_object()

        increment = request.data.get('increment', 1)

        if not isinstance(increment, int) or increment < 0:
            return Response({'error': 'Increment must be a non-negative integer.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get user's quest
        user_quest = self._get_user_quest_or_404(user, side_quest)

        if user_quest.is_completed:
            return Response({'error': 'This quest is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Update progress
        user_quest.current_progress = min(user_quest.current_progress + increment, user_quest.target_progress)
        user_quest.save()

        # Check if quest is now complete
        if user_quest.current_progress >= user_quest.target_progress:
            user_quest.complete()
            self._log_quest_completion(user, side_quest, user_quest)

        return Response(UserSideQuestSerializer(user_quest).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Manually mark a side quest as completed.

        This endpoint verifies that quest requirements are met before allowing completion.
        Users must have reached the target progress to complete a quest.

        Returns:
            {
                "id": "...",
                "side_quest": {...},
                "status": "completed",
                "is_completed": true,
                "xp_awarded": 100,
                ...
            }
        """
        user = request.user
        side_quest = self.get_object()

        # Get user's quest
        user_quest = self._get_user_quest_or_404(user, side_quest)

        if user_quest.is_completed:
            return Response({'error': 'This quest is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY: Verify quest requirements are actually met
        # For guided quests, all steps must be completed
        if side_quest.is_guided:
            if user_quest.current_step_index < len(side_quest.steps):
                steps_remaining = len(side_quest.steps) - user_quest.current_step_index
                return Response(
                    {'error': f'Quest not complete. {steps_remaining} steps remaining.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # For progress-based quests, must reach target
        elif user_quest.current_progress < user_quest.target_progress:
            progress_info = f'{user_quest.current_progress}/{user_quest.target_progress}'
            return Response(
                {'error': f'Quest requirements not met. Progress: {progress_info}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Complete the quest
        user_quest.complete()
        self._log_quest_completion(user, side_quest, user_quest)

        return Response(UserSideQuestSerializer(user_quest).data)

    @action(detail=True, methods=['post'])
    def abandon(self, request, pk=None):
        """
        Abandon (cancel) an in-progress side quest.

        This deletes the UserSideQuest record, allowing the user to restart the quest later.

        Returns:
            204 No Content on success
        """
        user = request.user
        side_quest = self.get_object()

        # Get user's quest
        user_quest = self._get_user_quest_or_404(user, side_quest)

        if user_quest.is_completed:
            return Response({'error': 'Cannot abandon a completed quest.'}, status=status.HTTP_400_BAD_REQUEST)

        # Log before deletion
        logger.info(
            f'User abandoned side quest: {side_quest.title}',
            extra={
                'user_id': user.id,
                'quest_id': str(side_quest.id),
                'progress': f'{user_quest.current_progress}/{user_quest.target_progress}',
            },
        )

        # Delete the user quest record
        user_quest.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='track-page-visit')
    def track_page_visit(self, request):
        """
        Track when a user visits a specific page (for guided quests).

        Request body:
            {
                "page_path": "/explore",
                "page_name": "Explore"  # Optional human-readable name
            }

        Returns:
            {
                "tracked": true,
                "completed_quests": [...]  # If any quests were completed
            }
        """
        user = request.user
        page_path = request.data.get('page_path', '')
        page_name = request.data.get('page_name', '')

        if not page_path:
            return Response(
                {'error': 'page_path is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        completed = track_page_visited(user, page_path=page_path, page_name=page_name)

        # Format completed quests for frontend celebration
        completed_quests = []
        if completed:
            completed_user_quests = UserSideQuest.objects.filter(
                user=user,
                side_quest_id__in=completed,
                is_completed=True,
            ).select_related('side_quest', 'side_quest__category')

            for uq in completed_user_quests:
                completed_quests.append(
                    {
                        'id': str(uq.side_quest.id),
                        'title': uq.side_quest.title,
                        'pointsAwarded': uq.points_awarded,
                        'categoryName': uq.side_quest.category.name if uq.side_quest.category else None,
                    }
                )

        return Response(
            {
                'tracked': True,
                'completedQuests': completed_quests,
            }
        )


# =============================================================================
# Circle ViewSet - Community Micro-Groups
# =============================================================================


class CircleViewSet(viewsets.ViewSet):
    """
    ViewSet for Circle community features.

    Endpoints:
    - GET /api/circles/my-circle/ - Get current user's circle with members and challenge
    - GET /api/circles/activity/ - Get activity feed for user's circle
    - POST /api/circles/kudos/ - Give kudos to a circle member
    - GET /api/circles/kudos/received/ - Get kudos the user has received
    - GET /api/circles/kudos/given/ - Get kudos the user has given
    """

    permission_classes = [IsAuthenticated]

    def _get_user_current_circle(self, user):
        """
        Get the user's current active circle.

        Returns the Circle object if found, None otherwise.
        """
        week_start = get_week_start()

        try:
            membership = CircleMembership.objects.select_related('circle').get(
                user=user,
                circle__week_start=week_start,
                circle__is_active=True,
                is_active=True,
            )
            return membership.circle
        except CircleMembership.DoesNotExist:
            return None

    @action(detail=False, methods=['get'], url_path='my-circle')
    def my_circle(self, request):
        """
        Get the authenticated user's current circle.

        Returns the circle details including:
        - Circle metadata (name, tier, week dates)
        - All members with their points earned in circle
        - Current active challenge with progress
        - User's own membership details

        Returns:
            {
                "id": "...",
                "name": "Eager Explorers #42",
                "tier": "seedling",
                "tier_display": "Seedling",
                "week_start": "2024-01-01",
                "week_end": "2024-01-07",
                "member_count": 25,
                "active_member_count": 18,
                "members": [...],
                "active_challenge": {...},
                "my_membership": {...}
            }
        """
        circle = self._get_user_current_circle(request.user)

        if not circle:
            return Response(
                {
                    'detail': 'You are not in a circle this week. Circles are formed weekly - check back on Monday!',
                    'has_circle': False,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CircleDetailSerializer(circle, context={'request': request})
        return Response({**serializer.data, 'has_circle': True})

    @action(detail=False, methods=['get'])
    def activity(self, request):
        """
        Get activity feed for the user's current circle.

        Shows recent activities (projects, quests, etc.) and kudos from circle members.

        Query params:
            - limit: Number of items to return (default: 20, max: 50)

        Returns:
            {
                "activities": [...],  # Combined activity feed
                "kudos": [...],  # Recent kudos in the circle (for backward compat)
                "has_circle": true
            }
        """
        circle = self._get_user_current_circle(request.user)

        if not circle:
            return Response(
                {'detail': 'You are not in a circle this week.', 'has_circle': False},
                status=status.HTTP_404_NOT_FOUND,
            )

        limit = safe_int_param(request.query_params.get('limit'), default=20, min_val=1, max_val=50)

        # Get circle member user IDs
        member_ids = list(
            CircleMembership.objects.filter(circle=circle, is_active=True).values_list('user_id', flat=True)
        )

        # Get recent kudos in this circle
        kudos = (
            Kudos.objects.filter(circle=circle)
            .select_related('from_user', 'to_user', 'project')
            .order_by('-created_at')[:limit]
        )

        # Get recent point activities from circle members (this week only)
        # Convert date to timezone-aware datetime for proper comparison
        from datetime import datetime, time

        from django.utils import timezone as tz

        week_start_dt = tz.make_aware(datetime.combine(circle.week_start, time.min))

        activities = (
            PointActivity.objects.filter(
                user_id__in=member_ids,
                created_at__gte=week_start_dt,
            )
            .select_related('user')
            .order_by('-created_at')[:limit]
        )

        # Map activity types to frontend types
        activity_type_map = {
            'project_create': 'project',
            'project_update': 'project',
            'quiz_complete': 'quiz',
            'streak_bonus': 'streak',
            'comment': 'comment',
            'help': 'kudos',  # Help activities map to kudos style
            'daily_login': 'joined',
            'side_quest': 'quiz',
            'weekly_goal': 'level_up',
            'reaction': 'kudos',  # Likes/reactions shown as kudos style
            'prompt_battle': 'project',  # Battles shown as project style
        }

        # Build combined activities list
        activity_items = []

        # Add point activities
        for act in activities:
            activity_type = activity_type_map.get(act.activity_type, 'project')
            message = act.description or act.get_activity_type_display()

            # Create friendlier messages
            if act.activity_type == 'project_create':
                message = 'created a new project'
            elif act.activity_type == 'project_update':
                message = 'updated a project'
            elif act.activity_type == 'quiz_complete':
                message = 'completed a quiz'
            elif act.activity_type == 'side_quest':
                message = 'completed a side quest'
            elif act.activity_type == 'streak_bonus':
                message = f'maintained a {act.description}' if act.description else 'kept their streak going'
            elif act.activity_type == 'daily_login':
                message = 'logged in today'
            elif act.activity_type == 'weekly_goal':
                message = 'completed a weekly goal'
            elif act.activity_type == 'comment':
                message = 'left feedback on a project'
            elif act.activity_type == 'reaction':
                message = 'liked a project'
            elif act.activity_type == 'prompt_battle':
                message = 'competed in a Prompt Battle'

            activity_items.append(
                {
                    'id': str(act.id),
                    'type': activity_type,
                    'username': act.user.username,
                    'message': message,
                    'timestamp': act.created_at.isoformat(),
                    'points': act.amount,
                }
            )

        # Add kudos as activities
        for k in kudos:
            activity_items.append(
                {
                    'id': str(k.id),
                    'type': 'kudos',
                    'username': k.from_user.username,
                    'message': f'gave {k.get_kudos_type_display()} to {k.to_user.username}',
                    'timestamp': k.created_at.isoformat(),
                    'target_username': k.to_user.username,
                }
            )

        # Sort by timestamp descending
        activity_items.sort(key=lambda x: x['timestamp'], reverse=True)

        return Response(
            {
                'activities': activity_items[:limit],
                'kudos': KudosSerializer(kudos, many=True).data,
                'circle_name': circle.name,
                'has_circle': True,
            }
        )

    @action(detail=False, methods=['post'])
    def kudos(self, request):
        """
        Give kudos to a circle member.

        Users can give kudos to recognize and appreciate fellow circle members.
        Limited to one of each kudos type per user pair per circle to prevent spam.

        Request body:
            {
                "to_user_id": "uuid",
                "kudos_type": "helpful",  # great_project, helpful, inspiring, creative, supportive, welcome
                "message": "Thanks for the feedback!",  # Optional, max 280 chars
                "project_id": "uuid"  # Optional, link to specific project
            }

        Returns:
            {
                "id": "...",
                "from_user": {...},
                "to_user": {...},
                "kudos_type": "helpful",
                "kudos_type_display": "🤝 Helpful",
                "message": "Thanks for the feedback!",
                ...
            }
        """
        circle = self._get_user_current_circle(request.user)

        if not circle:
            return Response(
                {'detail': 'You must be in a circle to give kudos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateKudosSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        to_user_id = serializer.validated_data['to_user_id']
        kudos_type = serializer.validated_data['kudos_type']
        message = serializer.validated_data.get('message', '')
        project_id = serializer.validated_data.get('project_id')

        # Verify target user is in the same circle
        try:
            to_user = User.objects.get(id=to_user_id)
            CircleMembership.objects.get(user=to_user, circle=circle, is_active=True)
        except (User.DoesNotExist, CircleMembership.DoesNotExist):
            return Response(
                {'detail': 'User is not a member of your circle.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for duplicate kudos (same type from same user in same circle)
        if Kudos.objects.filter(
            from_user=request.user,
            to_user=to_user,
            circle=circle,
            kudos_type=kudos_type,
        ).exists():
            return Response(
                {'detail': f'You have already given "{kudos_type}" kudos to this user this week.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get project if provided
        project = None
        if project_id:
            from core.projects.models import Project

            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                pass  # Project is optional, just skip if not found

        # Create the kudos
        new_kudos = Kudos.objects.create(
            from_user=request.user,
            to_user=to_user,
            circle=circle,
            kudos_type=kudos_type,
            message=message,
            project=project,
        )

        # Award points to the recipient
        try:
            to_user.add_points(
                amount=5,  # Small reward for being recognized
                activity_type='help',
                description=f'Received kudos: {new_kudos.get_kudos_type_display()}',
            )
        except Exception as e:
            logger.warning(f'Failed to award kudos points: {e}')

        logger.info(
            f'Kudos given: {request.user.username} → {to_user.username} ({kudos_type})',
            extra={
                'from_user_id': str(request.user.id),
                'to_user_id': str(to_user.id),
                'circle_id': str(circle.id),
                'kudos_type': kudos_type,
            },
        )

        return Response(KudosSerializer(new_kudos).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='kudos/received')
    def kudos_received(self, request):
        """
        Get kudos the user has received.

        Query params:
            - limit: Number of items to return (default: 20, max: 100)
            - circle_only: If 'true', only show kudos from current circle

        Returns:
            [
                {
                    "id": "...",
                    "from_user": {...},
                    "kudos_type": "helpful",
                    "kudos_type_display": "🤝 Helpful",
                    "message": "Great work!",
                    ...
                },
                ...
            ]
        """
        limit = safe_int_param(request.query_params.get('limit'), default=20, min_val=1, max_val=100)
        circle_only = request.query_params.get('circle_only', 'false').lower() == 'true'

        queryset = Kudos.objects.filter(to_user=request.user).select_related(
            'from_user', 'to_user', 'circle', 'project'
        )

        if circle_only:
            circle = self._get_user_current_circle(request.user)
            if circle:
                queryset = queryset.filter(circle=circle)

        kudos = queryset.order_by('-created_at')[:limit]
        return Response(KudosSerializer(kudos, many=True).data)

    @action(detail=False, methods=['get'], url_path='kudos/given')
    def kudos_given(self, request):
        """
        Get kudos the user has given.

        Query params:
            - limit: Number of items to return (default: 20, max: 100)

        Returns:
            [
                {
                    "id": "...",
                    "to_user": {...},
                    "kudos_type": "helpful",
                    ...
                },
                ...
            ]
        """
        limit = safe_int_param(request.query_params.get('limit'), default=20, min_val=1, max_val=100)

        kudos = (
            Kudos.objects.filter(from_user=request.user)
            .select_related('from_user', 'to_user', 'circle', 'project')
            .order_by('-created_at')[:limit]
        )

        return Response(KudosSerializer(kudos, many=True).data)


class AdminCircleViewSet(viewsets.ViewSet):
    """
    Admin ViewSet for managing Thrive Circles.

    Endpoints:
    - GET /api/admin/circles/ - List all circles with filters
    - GET /api/admin/circles/users/ - Search users and their circle memberships
    - POST /api/admin/circles/assign/ - Assign a user to a circle
    - POST /api/admin/circles/remove/ - Remove a user from a circle
    - POST /api/admin/circles/move/ - Move a user to a different circle
    """

    permission_classes = [IsAuthenticated]

    def _is_admin(self, user):
        """Check if user is admin."""
        return user.role == 'admin'

    def list(self, request):
        """
        List all circles with optional filters.

        Query params:
            - tier: Filter by tier (seedling, sprout, blossom, bloom, evergreen)
            - week_start: Filter by week start date (YYYY-MM-DD)
            - is_active: Filter by active status (true/false)
            - search: Search circle name
            - limit: Number of items (default: 50, max: 100)

        Returns:
            {
                "circles": [...],
                "total": 123
            }
        """
        if not self._is_admin(request.user):
            raise PermissionDenied('Admin access required.')

        from .serializers import CircleSerializer

        queryset = Circle.objects.all().order_by('-week_start', 'tier', 'name')

        # Apply filters
        tier = request.query_params.get('tier')
        if tier:
            queryset = queryset.filter(tier=tier)

        week_start = request.query_params.get('week_start')
        if week_start:
            queryset = queryset.filter(week_start=week_start)

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        total = queryset.count()
        limit = safe_int_param(request.query_params.get('limit'), default=50, min_val=1, max_val=100)
        circles = queryset[:limit]

        return Response(
            {
                'circles': CircleSerializer(circles, many=True).data,
                'total': total,
            }
        )

    @action(detail=False, methods=['get'])
    def users(self, request):
        """
        Search users and their current circle memberships.

        Query params:
            - search: Search by username, email, or name
            - tier: Filter by user tier
            - has_circle: Filter by whether user has a circle this week (true/false)
            - limit: Number of items (default: 50, max: 100)

        Returns:
            {
                "users": [
                    {
                        "id": "...",
                        "username": "...",
                        "email": "...",
                        "first_name": "...",
                        "last_name": "...",
                        "avatar_url": "...",
                        "tier": "seedling",
                        "tier_display": "Seedling",
                        "total_points": 150,
                        "current_circle": {...} or null,
                        "current_membership": {...} or null
                    },
                    ...
                ],
                "total": 123
            }
        """
        if not self._is_admin(request.user):
            raise PermissionDenied('Admin access required.')

        from .utils import get_week_start

        week_start = get_week_start()

        queryset = User.objects.filter(is_active=True).exclude(role='admin')

        # Apply filters
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(username__icontains=search)
                | models.Q(email__icontains=search)
                | models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
            )

        tier = request.query_params.get('tier')
        if tier:
            queryset = queryset.filter(tier=tier)

        has_circle = request.query_params.get('has_circle')
        if has_circle is not None:
            users_with_circle = CircleMembership.objects.filter(
                circle__week_start=week_start,
                circle__is_active=True,
                is_active=True,
            ).values_list('user_id', flat=True)

            if has_circle.lower() == 'true':
                queryset = queryset.filter(id__in=users_with_circle)
            else:
                queryset = queryset.exclude(id__in=users_with_circle)

        total = queryset.count()
        limit = safe_int_param(request.query_params.get('limit'), default=50, min_val=1, max_val=100)
        users = queryset.order_by('username')[:limit]

        # Build response with circle info
        result = []
        for user in users:
            # Get current circle membership
            try:
                membership = CircleMembership.objects.select_related('circle').get(
                    user=user,
                    circle__week_start=week_start,
                    circle__is_active=True,
                    is_active=True,
                )
                circle_data = {
                    'id': str(membership.circle.id),
                    'name': membership.circle.name,
                    'tier': membership.circle.tier,
                    'tier_display': membership.circle.get_tier_display(),
                    'member_count': membership.circle.member_count,
                }
                membership_data = {
                    'id': str(membership.id),
                    'joined_at': membership.joined_at.isoformat(),
                    'points_earned_in_circle': membership.points_earned_in_circle,
                    'was_active': membership.was_active,
                }
            except CircleMembership.DoesNotExist:
                circle_data = None
                membership_data = None

            result.append(
                {
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'avatar_url': user.avatar_url,
                    'tier': user.tier,
                    'tier_display': user.tier_display,
                    'total_points': user.total_points,
                    'current_circle': circle_data,
                    'current_membership': membership_data,
                }
            )

        return Response(
            {
                'users': result,
                'total': total,
            }
        )

    @action(detail=False, methods=['post'])
    def assign(self, request):
        """
        Assign a user to a circle.

        Request body:
            {
                "user_id": "uuid",
                "circle_id": "uuid"
            }

        Returns:
            {
                "success": true,
                "membership": {...}
            }
        """
        if not self._is_admin(request.user):
            raise PermissionDenied('Admin access required.')

        user_id = request.data.get('user_id')
        circle_id = request.data.get('circle_id')

        if not user_id or not circle_id:
            return Response(
                {'detail': 'Both user_id and circle_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            circle = Circle.objects.get(id=circle_id)
        except Circle.DoesNotExist:
            return Response(
                {'detail': 'Circle not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if user already has a membership in this circle's week
        existing = CircleMembership.objects.filter(
            user=target_user,
            circle__week_start=circle.week_start,
            is_active=True,
        ).first()

        if existing:
            return Response(
                {
                    'detail': (
                        f'User already has an active membership in a circle ' f'for this week ({existing.circle.name}).'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create membership
        membership = CircleMembership.objects.create(
            user=target_user,
            circle=circle,
            is_active=True,
        )

        # Update circle member count
        circle.update_member_counts()

        logger.info(
            f'Admin assigned user to circle: {target_user.username} → {circle.name}',
            extra={
                'admin_id': str(request.user.id),
                'admin_username': request.user.username,
                'user_id': str(target_user.id),
                'circle_id': str(circle.id),
            },
        )

        from .serializers import CircleMembershipSerializer

        return Response(
            {
                'success': True,
                'membership': CircleMembershipSerializer(membership).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'])
    def remove(self, request):
        """
        Remove a user from their current circle.

        Request body:
            {
                "user_id": "uuid"
            }

        Returns:
            {
                "success": true,
                "message": "..."
            }
        """
        if not self._is_admin(request.user):
            raise PermissionDenied('Admin access required.')

        from .utils import get_week_start

        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'detail': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        week_start = get_week_start()

        try:
            membership = CircleMembership.objects.select_related('circle').get(
                user=target_user,
                circle__week_start=week_start,
                is_active=True,
            )
        except CircleMembership.DoesNotExist:
            return Response(
                {'detail': 'User does not have an active circle membership this week.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        circle = membership.circle
        membership.is_active = False
        membership.save(update_fields=['is_active'])

        # Update circle member count
        circle.update_member_counts()

        logger.info(
            f'Admin removed user from circle: {target_user.username} from {circle.name}',
            extra={
                'admin_id': str(request.user.id),
                'admin_username': request.user.username,
                'user_id': str(target_user.id),
                'circle_id': str(circle.id),
            },
        )

        return Response(
            {
                'success': True,
                'message': f'Removed {target_user.username} from {circle.name}',
            }
        )

    @action(detail=False, methods=['post'])
    def move(self, request):
        """
        Move a user to a different circle.

        Request body:
            {
                "user_id": "uuid",
                "target_circle_id": "uuid"
            }

        Returns:
            {
                "success": true,
                "old_circle": {...},
                "new_circle": {...},
                "membership": {...}
            }
        """
        if not self._is_admin(request.user):
            raise PermissionDenied('Admin access required.')

        from .utils import get_week_start

        user_id = request.data.get('user_id')
        target_circle_id = request.data.get('target_circle_id')

        if not user_id or not target_circle_id:
            return Response(
                {'detail': 'Both user_id and target_circle_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            new_circle = Circle.objects.get(id=target_circle_id)
        except Circle.DoesNotExist:
            return Response(
                {'detail': 'Target circle not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        week_start = get_week_start()

        # Get current membership if exists
        old_membership = None
        old_circle = None
        try:
            old_membership = CircleMembership.objects.select_related('circle').get(
                user=target_user,
                circle__week_start=week_start,
                is_active=True,
            )
            old_circle = old_membership.circle

            if old_circle.id == new_circle.id:
                return Response(
                    {'detail': 'User is already in the target circle.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Deactivate old membership
            old_membership.is_active = False
            old_membership.save(update_fields=['is_active'])
            old_circle.update_member_counts()
        except CircleMembership.DoesNotExist:
            pass  # User doesn't have a current circle, that's ok

        # Create new membership
        new_membership = CircleMembership.objects.create(
            user=target_user,
            circle=new_circle,
            is_active=True,
        )

        # Update new circle member count
        new_circle.update_member_counts()

        old_circle_name = old_circle.name if old_circle else 'none'
        logger.info(
            f'Admin moved user between circles: {target_user.username} ' f'from {old_circle_name} → {new_circle.name}',
            extra={
                'admin_id': str(request.user.id),
                'admin_username': request.user.username,
                'user_id': str(target_user.id),
                'old_circle_id': str(old_circle.id) if old_circle else None,
                'new_circle_id': str(new_circle.id),
            },
        )

        from .serializers import CircleMembershipSerializer, CircleSerializer

        return Response(
            {
                'success': True,
                'old_circle': CircleSerializer(old_circle).data if old_circle else None,
                'new_circle': CircleSerializer(new_circle).data,
                'membership': CircleMembershipSerializer(new_membership).data,
            }
        )
