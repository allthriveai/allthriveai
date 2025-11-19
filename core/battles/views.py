"""Views for Prompt Battle feature."""
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.battle_service import BattleService

from .models import BattleInvitation, BattleStatus, BattleSubmission, InvitationStatus, PromptBattle
from .serializers import (
    BattleInvitationSerializer,
    BattleStatsSerializer,
    BattleSubmissionSerializer,
    CreateBattleInvitationSerializer,
    PromptBattleListSerializer,
    PromptBattleSerializer,
)


class PromptBattleViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing prompt battles.

    Users can view battles they're participating in.
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return PromptBattleListSerializer
        return PromptBattleSerializer

    def get_queryset(self):
        """Return battles for the authenticated user."""
        user = self.request.user
        return (
            PromptBattle.objects.filter(Q(challenger=user) | Q(opponent=user))
            .select_related("challenger", "opponent", "winner")
            .prefetch_related("submissions")
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get all active battles for the user."""
        user = request.user
        battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status=BattleStatus.ACTIVE
        ).select_related("challenger", "opponent")

        serializer = PromptBattleListSerializer(battles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def history(self, request):
        """Get battle history for the user."""
        user = request.user
        battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status__in=[BattleStatus.COMPLETED, BattleStatus.EXPIRED]
        ).select_related("challenger", "opponent", "winner")[:20]

        serializer = PromptBattleListSerializer(battles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit a prompt for a battle."""
        battle = self.get_object()

        # Validate user is participant
        if request.user not in [battle.challenger, battle.opponent]:
            return Response({"error": "You are not a participant in this battle."}, status=status.HTTP_403_FORBIDDEN)

        # Check if already submitted
        if BattleSubmission.objects.filter(battle=battle, user=request.user).exists():
            return Response(
                {"error": "You have already submitted a prompt for this battle."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check battle status
        if battle.status != BattleStatus.ACTIVE:
            return Response({"error": "Battle is not active."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if expired
        if battle.is_expired:
            battle.expire_battle()
            return Response({"error": "Battle has expired."}, status=status.HTTP_400_BAD_REQUEST)

        # Create submission using service
        battle_service = BattleService()
        try:
            submission = battle_service.submit_prompt(
                battle_id=battle.id,
                user=request.user,
                prompt_text=request.data.get("prompt_text", ""),
                submission_type=request.data.get("submission_type", "text"),
            )

            serializer = BattleSubmissionSerializer(submission)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a battle (only for challenger or opponent if not started)."""
        battle = self.get_object()

        # Only participants can cancel
        if request.user not in [battle.challenger, battle.opponent]:
            return Response({"error": "You are not a participant in this battle."}, status=status.HTTP_403_FORBIDDEN)

        # Can only cancel pending or active battles
        if battle.status not in [BattleStatus.PENDING, BattleStatus.ACTIVE]:
            return Response({"error": "Can only cancel pending or active battles."}, status=status.HTTP_400_BAD_REQUEST)

        battle.cancel_battle()

        serializer = self.get_serializer(battle)
        return Response(serializer.data)


class BattleInvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing battle invitations."""

    permission_classes = [IsAuthenticated]
    serializer_class = BattleInvitationSerializer

    def get_queryset(self):
        """Return invitations for the authenticated user."""
        user = self.request.user
        return BattleInvitation.objects.filter(Q(sender=user) | Q(recipient=user)).select_related(
            "sender", "recipient", "battle"
        )

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Get pending invitations received by the user."""
        user = request.user
        invitations = BattleInvitation.objects.filter(recipient=user, status=InvitationStatus.PENDING).select_related(
            "sender", "battle"
        )

        serializer = self.get_serializer(invitations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def sent(self, request):
        """Get invitations sent by the user."""
        user = request.user
        invitations = BattleInvitation.objects.filter(sender=user).select_related("recipient", "battle")[:20]

        serializer = self.get_serializer(invitations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_invitation(self, request):
        """Create a new battle invitation."""
        serializer = CreateBattleInvitationSerializer(data=request.data, context={"request": request})

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()

        try:
            invitation = battle_service.create_battle_invitation(
                challenger=request.user,
                opponent_username=serializer.validated_data["opponent_username"],
                battle_type=serializer.validated_data.get("battle_type", "text_prompt"),
                duration_minutes=serializer.validated_data.get("duration_minutes", 10),
                message=serializer.validated_data.get("message", ""),
            )

            response_serializer = BattleInvitationSerializer(invitation)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Accept a battle invitation."""
        invitation = self.get_object()

        # Validate user is recipient
        if invitation.recipient != request.user:
            return Response(
                {"error": "You are not the recipient of this invitation."}, status=status.HTTP_403_FORBIDDEN
            )

        # Check if already responded
        if invitation.status != InvitationStatus.PENDING:
            return Response({"error": "Invitation has already been responded to."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if expired
        if invitation.is_expired:
            return Response({"error": "Invitation has expired."}, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()
        try:
            battle = battle_service.accept_invitation(invitation.id, request.user)
            battle_serializer = PromptBattleSerializer(battle, context={"request": request})
            return Response(battle_serializer.data)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        """Decline a battle invitation."""
        invitation = self.get_object()

        # Validate user is recipient
        if invitation.recipient != request.user:
            return Response(
                {"error": "You are not the recipient of this invitation."}, status=status.HTTP_403_FORBIDDEN
            )

        # Check if already responded
        if invitation.status != InvitationStatus.PENDING:
            return Response({"error": "Invitation has already been responded to."}, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()
        try:
            battle_service.decline_invitation(invitation.id, request.user)
            serializer = self.get_serializer(invitation)
            return Response(serializer.data)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def battle_stats(request):
    """Get battle statistics for the authenticated user."""
    battle_service = BattleService()
    stats = battle_service.get_user_stats(request.user)

    serializer = BattleStatsSerializer(stats)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def battle_leaderboard(request):
    """Get battle leaderboard showing top players."""
    from django.db.models import Avg, Count

    from core.users.models import User

    # Get top 20 users by win count
    top_users = (
        User.objects.annotate(
            total_wins=Count("battles_won"),
            total_battles=Count("battles_initiated") + Count("battles_received"),
            avg_score=Avg("battle_submissions__score"),
        )
        .filter(total_battles__gt=0)
        .order_by("-total_wins", "-avg_score")[:20]
    )

    leaderboard = []
    for idx, user in enumerate(top_users, start=1):
        win_rate = (user.total_wins / user.total_battles * 100) if user.total_battles > 0 else 0
        leaderboard.append(
            {
                "rank": idx,
                "username": user.username,
                "avatar_url": user.avatar_url,
                "total_wins": user.total_wins,
                "total_battles": user.total_battles,
                "win_rate": round(win_rate, 2),
                "average_score": round(user.avg_score or 0, 2),
            }
        )

    return Response(leaderboard)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def expire_battles(request):
    """Administrative endpoint to expire old battles and invitations.

    This would typically be called by a scheduled task/cron job.
    For now, can be called manually by authenticated users.
    """
    battle_service = BattleService()

    expired_battles_count = battle_service.expire_old_battles()
    expired_invitations_count = battle_service.expire_old_invitations()

    return Response(
        {
            "expired_battles": expired_battles_count,
            "expired_invitations": expired_invitations_count,
        }
    )
