"""API views for Thrive Circle."""

import logging

from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import UserTier, XPActivity
from .serializers import AwardXPSerializer, UserTierSerializer, XPActivitySerializer
from .services import XPService

logger = logging.getLogger(__name__)


class XPAwardThrottle(UserRateThrottle):
    """Rate limit for XP award endpoint - prevent spam."""

    rate = '100/hour'


class ThriveCircleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Thrive Circle tier status and XP activities.

    Endpoints:
    - GET /api/thrive-circle/ - List all user tiers (for leaderboard)
    - GET /api/thrive-circle/{id}/ - Get specific user tier
    - GET /api/thrive-circle/my-status/ - Get current user's tier status
    - POST /api/thrive-circle/award-xp/ - Award XP to current user
    """

    serializer_class = UserTierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Optimize queryset with select_related and prefetch_related to prevent N+1 queries.
        """
        return UserTier.objects.select_related('user').prefetch_related(
            Prefetch('user__xp_activities', queryset=XPActivity.objects.order_by('-created_at')[:20])
        )

    @action(detail=False, methods=['get'])
    def my_status(self, request):
        """
        Get the authenticated user's tier status and recent XP activities.

        Returns:
            {
                "tier_status": {...},
                "recent_activities": [...]
            }
        """
        user = request.user

        # Get or create user tier
        tier_status, created = UserTier.objects.get_or_create(
            user=user,
            defaults={
                'tier': 'ember',
                'total_xp': 0,
            },
        )

        # Get recent activities (last 20)
        recent_activities = XPActivity.objects.filter(user=user).order_by('-created_at')[:20]

        return Response(
            {
                'tier_status': UserTierSerializer(tier_status).data,
                'recent_activities': XPActivitySerializer(recent_activities, many=True).data,
            }
        )

    @action(detail=False, methods=['post'], throttle_classes=[XPAwardThrottle])
    def award_xp(self, request):
        """
        Award XP to the authenticated user.

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
                "xp_activity": {...},
                "tier_upgraded": bool,
                "old_tier": "ember" | null,
                "new_tier": "spark" | null
            }
        """
        serializer = AwardXPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        amount = serializer.validated_data['amount']
        activity_type = serializer.validated_data['activity_type']
        description = serializer.validated_data.get('description', '')

        try:
            # Validate using service layer
            XPService.validate_xp_award(amount, activity_type)

            # Get or create user tier
            tier_status, created = UserTier.objects.get_or_create(
                user=user,
                defaults={
                    'tier': 'ember',
                    'total_xp': 0,
                },
            )

            # Record old tier for upgrade detection
            old_tier = tier_status.tier

            # Add XP (this creates the activity record and checks for tier upgrade)
            # This is atomic and uses F() expressions
            tier_status.add_xp(amount, activity_type, description)

            # Refresh to get updated tier
            tier_status.refresh_from_db()

            # Check if tier upgraded
            tier_upgraded = tier_status.tier != old_tier

            # Get the activity that was just created
            latest_activity = XPActivity.objects.filter(user=user).order_by('-created_at').first()

            logger.info(
                f'XP awarded via API: {amount} XP for {activity_type}',
                extra={
                    'user_id': user.id,
                    'amount': amount,
                    'activity_type': activity_type,
                    'tier_upgraded': tier_upgraded,
                },
            )

            return Response(
                {
                    'tier_status': UserTierSerializer(tier_status).data,
                    'xp_activity': XPActivitySerializer(latest_activity).data,
                    'tier_upgraded': tier_upgraded,
                    'old_tier': old_tier if tier_upgraded else None,
                    'new_tier': tier_status.tier if tier_upgraded else None,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            logger.warning(
                f'Invalid XP award attempt: {e}',
                extra={'user_id': user.id, 'amount': amount, 'activity_type': activity_type},
            )
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(
                f'Failed to award XP: {e}',
                exc_info=True,
                extra={'user_id': user.id, 'amount': amount, 'activity_type': activity_type},
            )
            return Response(
                {'error': 'Failed to award XP. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class XPActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for XP activities.

    Endpoints:
    - GET /api/xp-activities/ - List all XP activities (filtered to current user)
    - GET /api/xp-activities/{id}/ - Get specific XP activity
    """

    serializer_class = XPActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter activities to current user only."""
        return XPActivity.objects.filter(user=self.request.user).select_related('user').order_by('-created_at')
