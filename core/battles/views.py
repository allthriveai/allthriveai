"""Views for Prompt Battle feature."""

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from services.gamification import BattleService
from services.projects import ProjectService

from .models import BattleInvitation, BattleStatus, BattleSubmission, InvitationStatus, MatchSource, PromptBattle
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
        if self.action == 'list':
            return PromptBattleListSerializer
        return PromptBattleSerializer

    def get_queryset(self):
        """Return battles for the authenticated user."""
        user = self.request.user
        return (
            PromptBattle.objects.filter(Q(challenger=user) | Q(opponent=user))
            .select_related('challenger', 'opponent', 'winner')
            .prefetch_related('submissions')
        )

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active battles for the user."""
        user = request.user
        battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status=BattleStatus.ACTIVE
        ).select_related('challenger', 'opponent')

        serializer = PromptBattleListSerializer(battles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get battle history for the user."""
        user = request.user
        battles = PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user), status__in=[BattleStatus.COMPLETED, BattleStatus.EXPIRED]
        ).select_related('challenger', 'opponent', 'winner')[:20]

        serializer = PromptBattleListSerializer(battles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a prompt for a battle."""
        battle = self.get_object()

        # Validate user is participant
        if request.user not in [battle.challenger, battle.opponent]:
            return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

        # Check if already submitted
        if BattleSubmission.objects.filter(battle=battle, user=request.user).exists():
            return Response(
                {'error': 'You have already submitted a prompt for this battle.'}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check battle status
        if battle.status != BattleStatus.ACTIVE:
            return Response({'error': 'Battle is not active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if expired
        if battle.is_expired:
            battle.expire_battle()
            return Response({'error': 'Battle has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create submission using service
        battle_service = BattleService()
        try:
            submission = battle_service.submit_prompt(
                battle_id=battle.id,
                user=request.user,
                prompt_text=request.data.get('prompt_text', ''),
                submission_type=request.data.get('submission_type', 'text'),
            )

            serializer = BattleSubmissionSerializer(submission)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a battle (only for challenger or opponent if not started)."""
        battle = self.get_object()

        # Only participants can cancel
        if request.user not in [battle.challenger, battle.opponent]:
            return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

        # Can only cancel pending or active battles
        if battle.status not in [BattleStatus.PENDING, BattleStatus.ACTIVE]:
            return Response({'error': 'Can only cancel pending or active battles.'}, status=status.HTTP_400_BAD_REQUEST)

        battle.cancel_battle()

        serializer = self.get_serializer(battle)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def save_to_profile(self, request, pk=None):
        """Save battle result as a project on user's profile."""
        from core.projects.models import Project

        battle = self.get_object()

        # Validate user was a participant
        if request.user not in [battle.challenger, battle.opponent]:
            return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

        # Check battle is completed
        if battle.status != BattleStatus.COMPLETED:
            return Response({'error': 'Battle is not completed yet.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already saved (prevent duplicates)
        existing_project = Project.objects.filter(
            user=request.user,
            content__battleResult__battle_id=battle.id,
        ).first()
        if existing_project:
            return Response(
                {
                    'project_id': existing_project.id,
                    'slug': existing_project.slug,
                    'message': 'Battle already saved to your profile!',
                    'already_saved': True,
                }
            )

        # Get user's submission
        try:
            my_submission = BattleSubmission.objects.get(battle=battle, user=request.user)
        except BattleSubmission.DoesNotExist:
            return Response({'error': 'No submission found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get opponent info and submission
        opponent = battle.opponent if battle.challenger == request.user else battle.challenger
        try:
            opponent_submission = BattleSubmission.objects.get(battle=battle, user=opponent)
        except BattleSubmission.DoesNotExist:
            opponent_submission = None

        # Determine win status
        won = battle.winner_id == request.user.id if battle.winner_id else False
        is_tie = battle.winner_id is None

        # Check if opponent is AI (Pip)
        is_ai_opponent = battle.match_source == MatchSource.AI_OPPONENT

        # Build project content with both submissions
        battle_result = {
            'battle_id': battle.id,
            'challenge_text': battle.challenge_text,
            'won': won,
            'is_tie': is_tie,
            'my_submission': {
                'prompt': my_submission.prompt_text,
                'image_url': my_submission.generated_output_url,
                'score': float(my_submission.score) if my_submission.score else None,
            },
            'opponent': {
                'username': opponent.username,
                'is_ai': is_ai_opponent,
            },
        }

        # Include opponent submission if available
        if opponent_submission:
            battle_result['opponent_submission'] = {
                'prompt': opponent_submission.prompt_text,
                'image_url': opponent_submission.generated_output_url,
                'score': float(opponent_submission.score) if opponent_submission.score else None,
            }

        # Truncate challenge text for title
        challenge_preview = battle.challenge_text[:50]
        if len(battle.challenge_text) > 50:
            challenge_preview += '...'

        # Create project
        project, error = ProjectService.create_project(
            user_id=request.user.id,
            title=f'Battle: {challenge_preview}',
            project_type='other',
            description=f'Challenge: {battle.challenge_text}\n\nMy prompt: {my_submission.prompt_text}',
            featured_image_url=my_submission.generated_output_url or '',
            is_showcase=True,
            content={'battleResult': battle_result},
        )

        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'project_id': project.id,
                'slug': project.slug,
                'message': 'Battle saved to your profile!',
            }
        )


class BattleInvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing battle invitations."""

    permission_classes = [IsAuthenticated]
    serializer_class = BattleInvitationSerializer

    def get_queryset(self):
        """Return invitations for the authenticated user."""
        user = self.request.user
        return BattleInvitation.objects.filter(Q(sender=user) | Q(recipient=user)).select_related(
            'sender', 'recipient', 'battle'
        )

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending invitations received by the user."""
        user = request.user
        invitations = BattleInvitation.objects.filter(recipient=user, status=InvitationStatus.PENDING).select_related(
            'sender', 'battle'
        )

        serializer = self.get_serializer(invitations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def sent(self, request):
        """Get invitations sent by the user."""
        user = request.user
        invitations = BattleInvitation.objects.filter(sender=user).select_related('recipient', 'battle')[:20]

        serializer = self.get_serializer(invitations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def create_invitation(self, request):
        """Create a new battle invitation."""
        serializer = CreateBattleInvitationSerializer(data=request.data, context={'request': request})

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()

        try:
            invitation = battle_service.create_battle_invitation(
                challenger=request.user,
                opponent_username=serializer.validated_data['opponent_username'],
                battle_type=serializer.validated_data.get('battle_type', 'text_prompt'),
                duration_minutes=serializer.validated_data.get('duration_minutes', 10),
                message=serializer.validated_data.get('message', ''),
            )

            response_serializer = BattleInvitationSerializer(invitation)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a battle invitation."""
        invitation = self.get_object()

        # Validate user is recipient
        if invitation.recipient != request.user:
            return Response(
                {'error': 'You are not the recipient of this invitation.'}, status=status.HTTP_403_FORBIDDEN
            )

        # Check if already responded
        if invitation.status != InvitationStatus.PENDING:
            return Response({'error': 'Invitation has already been responded to.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if expired
        if invitation.is_expired:
            return Response({'error': 'Invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()
        try:
            battle = battle_service.accept_invitation(invitation.id, request.user)
            battle_serializer = PromptBattleSerializer(battle, context={'request': request})
            return Response(battle_serializer.data)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a battle invitation."""
        invitation = self.get_object()

        # Validate user is recipient
        if invitation.recipient != request.user:
            return Response(
                {'error': 'You are not the recipient of this invitation.'}, status=status.HTTP_403_FORBIDDEN
            )

        # Check if already responded
        if invitation.status != InvitationStatus.PENDING:
            return Response({'error': 'Invitation has already been responded to.'}, status=status.HTTP_400_BAD_REQUEST)

        battle_service = BattleService()
        try:
            battle_service.decline_invitation(invitation.id, request.user)
            serializer = self.get_serializer(invitation)
            return Response(serializer.data)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def battle_stats(request):
    """Get battle statistics for the authenticated user."""
    battle_service = BattleService()
    stats = battle_service.get_user_stats(request.user)

    serializer = BattleStatsSerializer(stats)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def battle_leaderboard(request):
    """Get battle leaderboard showing top players."""
    from django.db.models import Avg, Count

    from core.users.models import User

    # Get top 20 users by win count
    top_users = (
        User.objects.annotate(
            total_wins=Count('battles_won'),
            total_battles=Count('battles_initiated') + Count('battles_received'),
            avg_score=Avg('battle_submissions__score'),
        )
        .filter(total_battles__gt=0)
        .order_by('-total_wins', '-avg_score')[:20]
    )

    leaderboard = []
    for idx, user in enumerate(top_users, start=1):
        win_rate = (user.total_wins / user.total_battles * 100) if user.total_battles > 0 else 0
        leaderboard.append(
            {
                'rank': idx,
                'username': user.username,
                'avatar_url': user.avatar_url,
                'total_wins': user.total_wins,
                'total_battles': user.total_battles,
                'win_rate': round(win_rate, 2),
                'average_score': round(user.avg_score or 0, 2),
            }
        )

    return Response(leaderboard)


@api_view(['POST'])
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
            'expired_battles': expired_battles_count,
            'expired_invitations': expired_invitations_count,
        }
    )
