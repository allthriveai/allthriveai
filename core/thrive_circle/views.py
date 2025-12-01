"""API views for Thrive Circle."""

import logging

from django.db import models
from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.users.models import User

from .models import PointActivity, SideQuest, UserSideQuest, WeeklyGoal
from .serializers import (
    AwardPointsSerializer,
    PointActivitySerializer,
    SideQuestSerializer,
    UserPointsSerializer,
    UserSideQuestSerializer,
    WeeklyGoalSerializer,
)
from .services import PointsService
from .utils import get_week_start

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
        """
        return User.objects.prefetch_related(
            Prefetch('point_activities', queryset=PointActivity.objects.order_by('-created_at')[:20])
        ).order_by('-total_points')

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
        limit = min(int(request.query_params.get('limit', 10)), 50)

        # Get users in the same tier (excluding current user)
        same_tier_users = User.objects.filter(tier=user.tier).exclude(id=user.id).values_list('id', flat=True)

        # Get recent published projects from same-tier users
        projects = (
            Project.objects.filter(
                user_id__in=same_tier_users,
                is_archived=False,
            )
            .select_related('user')
            .order_by('-published_at')[:limit]
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


class SideQuestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Side Quests.

    Endpoints:
    - GET /api/side-quests/ - List all available side quests
    - GET /api/side-quests/{id}/ - Get specific side quest
    - GET /api/side-quests/my-quests/ - Get current user's active and completed quests
    - POST /api/side-quests/{id}/start/ - Start (accept) a side quest
    - POST /api/side-quests/{id}/update-progress/ - Update progress on a side quest
    - POST /api/side-quests/{id}/complete/ - Mark a side quest as completed
    """

    serializer_class = SideQuestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return only active quests that are currently available.

        Supports filtering by:
        - topic: Filter quests by topic slug (e.g., 'chatbots-conversation')
        - skill_level: Filter quests by skill level (beginner, intermediate, advanced, master)
        - quest_type: Filter quests by type (quiz_mastery, project_showcase, etc.)

        Query params:
            ?topic=chatbots-conversation
            ?skill_level=beginner
            ?quest_type=project_showcase
        """
        from django.utils import timezone

        now = timezone.now()
        queryset = SideQuest.objects.filter(
            is_active=True,
        ).filter(
            models.Q(starts_at__isnull=True) | models.Q(starts_at__lte=now),
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=now),
        )

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

        return queryset

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
        limit = min(int(request.query_params.get('limit', 50)), 100)

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
        try:
            user_quest = UserSideQuest.objects.get(user=user, side_quest=side_quest)
        except UserSideQuest.DoesNotExist:
            return Response({'error': 'You have not started this quest yet.'}, status=status.HTTP_404_NOT_FOUND)

        if user_quest.is_completed:
            return Response({'error': 'This quest is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Update progress
        user_quest.current_progress = min(user_quest.current_progress + increment, user_quest.target_progress)
        user_quest.save()

        # Check if quest is now complete
        if user_quest.current_progress >= user_quest.target_progress:
            user_quest.complete()

            logger.info(
                f'User completed side quest: {side_quest.title}',
                extra={
                    'user_id': user.id,
                    'quest_id': str(side_quest.id),
                    'xp_awarded': user_quest.xp_awarded,
                },
            )

        return Response(UserSideQuestSerializer(user_quest).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Manually mark a side quest as completed.

        This is for quests that don't track numeric progress,
        or for admin/system completion.

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
        try:
            user_quest = UserSideQuest.objects.get(user=user, side_quest=side_quest)
        except UserSideQuest.DoesNotExist:
            return Response({'error': 'You have not started this quest yet.'}, status=status.HTTP_404_NOT_FOUND)

        if user_quest.is_completed:
            return Response({'error': 'This quest is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        # Complete the quest
        user_quest.complete()

        logger.info(
            f'User completed side quest: {side_quest.title}',
            extra={
                'user_id': user.id,
                'quest_id': str(side_quest.id),
                'xp_awarded': user_quest.xp_awarded,
            },
        )

        return Response(UserSideQuestSerializer(user_quest).data)
