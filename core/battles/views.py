"""Views for Prompt Battle feature."""

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import StructuredLogger
from services.gamification import BattleService
from services.projects import ProjectService

from .models import (
    BattleInvitation,
    BattleStatus,
    BattleSubmission,
    InvitationStatus,
    InvitationType,
    MatchSource,
    PromptBattle,
)
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
            StructuredLogger.log_validation_error(
                message='Battle submission validation failed',
                user=request.user,
                errors={'validation': [str(e)]},
            )
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to submit battle prompt',
                error=e,
                user=request.user,
                extra={
                    'battle_id': battle.id,
                    'submission_type': request.data.get('submission_type'),
                },
            )
            return Response(
                {'error': 'Failed to submit prompt. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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

    @action(detail=True, methods=['post'], url_path='refresh-challenge')
    def refresh_challenge(self, request, pk=None):
        """Refresh the challenge prompt (Pip battles only, before submission)."""
        battle = self.get_object()

        battle_service = BattleService()
        new_challenge = battle_service.refresh_challenge(battle, request.user)

        if new_challenge is None:
            return Response(
                {'error': 'Cannot refresh challenge. Only available for Pip battles before you submit.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'challenge_text': new_challenge,
                'message': 'Challenge refreshed!',
            }
        )

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
                'criteria_scores': opponent_submission.criteria_scores,
                'feedback': opponent_submission.evaluation_feedback,
            }

        # Add criteria scores and feedback to my submission
        battle_result['my_submission']['criteria_scores'] = my_submission.criteria_scores
        battle_result['my_submission']['feedback'] = my_submission.evaluation_feedback

        # Add challenge type info
        if battle.challenge_type:
            battle_result['challenge_type'] = {
                'key': battle.challenge_type.key,
                'name': battle.challenge_type.name,
            }

        # Truncate challenge text for title
        challenge_preview = battle.challenge_text[:50]
        if len(battle.challenge_text) > 50:
            challenge_preview += '...'

        # Generate tags based on battle content
        tags = ['AI Image Generation', 'Prompt Battle']

        # Add challenge type as a tag
        if battle.challenge_type:
            tags.append(battle.challenge_type.name)

        # Add result tag
        if won:
            tags.append('Winner')
        elif is_tie:
            tags.append('Tie')

        # Add AI opponent tag if applicable
        if is_ai_opponent:
            tags.append('vs AI')

        # Create project with battle type
        project, error = ProjectService.create_project(
            user_id=request.user.id,
            title=f'Battle: {challenge_preview}',
            project_type='battle',
            description=f'Challenge: {battle.challenge_text}\n\nMy prompt: {my_submission.prompt_text}',
            featured_image_url=my_submission.generated_output_url or '',
            is_showcase=True,
            content={'battleResult': battle_result},
            tags=tags,
        )

        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'project_id': project.id,
                'slug': project.slug,
                'url': f'/{request.user.username}/{project.slug}/',
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

    @action(detail=False, methods=['post'])
    def send_sms(self, request):
        """Send an SMS battle invitation to a phone number."""
        from django.core.exceptions import ValidationError

        from core.battles.models import ChallengeType
        from core.sms.utils import normalize_phone_number

        # Validate phone number
        phone = request.data.get('phone_number', '').strip()
        recipient_name = request.data.get('recipient_name', '').strip()
        challenge_type_key = request.data.get('challenge_type')

        if not phone:
            return Response({'error': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            normalized_phone = normalize_phone_number(phone)
        except ValidationError as e:
            return Response({'error': str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

        # Get challenge type
        challenge_type = None
        if challenge_type_key:
            try:
                challenge_type = ChallengeType.objects.get(key=challenge_type_key, is_active=True)
            except ChallengeType.DoesNotExist:
                pass

        if not challenge_type:
            challenge_type = ChallengeType.objects.filter(is_active=True).first()

        if not challenge_type:
            return Response({'error': 'No challenge types available.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate challenge
        challenge_text = challenge_type.generate_challenge()

        # Create the battle (opponent will be set when they accept)
        battle = PromptBattle.objects.create(
            challenger=request.user,
            opponent=None,  # Will be set when SMS recipient accepts
            challenge_text=challenge_text,
            challenge_type=challenge_type,
            match_source=MatchSource.INVITATION,
            duration_minutes=challenge_type.default_duration_minutes,
            status=BattleStatus.PENDING,
        )

        # Create SMS invitation
        invitation = BattleInvitation.objects.create(
            battle=battle,
            sender=request.user,
            recipient=None,  # Will be set when user accepts
            recipient_phone=normalized_phone,
            recipient_name=recipient_name,
            invitation_type=InvitationType.SMS,
        )

        # Send the SMS
        try:
            invitation.send_sms_invitation()
        except ValidationError as e:
            # Clean up if SMS fails
            invitation.delete()
            battle.delete()
            return Response({'error': str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BattleInvitationSerializer(invitation)
        return Response(
            {
                'invitation': serializer.data,
                'invite_url': invitation.invite_url,
                'message': f'SMS invitation sent to {normalized_phone[:6]}****',
            },
            status=status.HTTP_201_CREATED,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_invitation_by_token(request, token):
    """Get invitation details by token (for SMS invitation links)."""
    try:
        invitation = BattleInvitation.objects.select_related('sender', 'battle').get(invite_token=token)
    except BattleInvitation.DoesNotExist:
        return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.is_expired:
        return Response({'error': 'Invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.status != InvitationStatus.PENDING:
        return Response({'error': 'Invitation has already been responded to.'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            'invitation_id': invitation.id,
            'sender': {
                'id': invitation.sender.id,
                'username': invitation.sender.username,
                'display_name': invitation.sender.display_name,
                'avatar_url': invitation.sender.avatar_url,
            },
            'battle': {
                'id': invitation.battle.id,
                'topic': invitation.battle.topic,
                'challenge_type': invitation.battle.challenge_type.name if invitation.battle.challenge_type else None,
            },
            'expires_at': invitation.expires_at.isoformat(),
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invitation_by_token(request, token):
    """Accept an SMS invitation by token."""
    try:
        invitation = BattleInvitation.objects.select_related('sender', 'battle').get(invite_token=token)
    except BattleInvitation.DoesNotExist:
        return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.is_expired:
        return Response({'error': 'Invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.status != InvitationStatus.PENDING:
        return Response({'error': 'Invitation has already been responded to.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.sender == request.user:
        return Response({'error': 'You cannot accept your own invitation.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        invitation.accept(accepting_user=request.user)
        battle = invitation.battle
        battle.refresh_from_db()

        battle_serializer = PromptBattleSerializer(battle, context={'request': request})
        return Response(battle_serializer.data)

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to accept battle invitation',
            error=e,
            user=request.user,
            extra={
                'invitation_id': invitation.id,
                'endpoint': '/battles/invitations/accept/',
            },
        )
        return Response({'error': 'Failed to accept invitation. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)


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


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_battles(request, username):
    """Get public battle history for a specific user by username.

    Returns completed battles where the user participated,
    with submissions and results visible.

    Args:
        username: The username of the user to get battles for

    Returns:
        List of battles with submissions and results
    """
    from django.contrib.auth import get_user_model
    from django.shortcuts import get_object_or_404

    User = get_user_model()
    user = get_object_or_404(User, username=username)

    # Get completed battles where the user was challenger or opponent
    battles = (
        PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user),
            status=BattleStatus.COMPLETED,
        )
        .select_related('challenger', 'opponent', 'winner', 'challenge_type')
        .prefetch_related('submissions__user')
        .order_by('-completed_at')[:50]
    )

    # Build response with full battle details
    battle_list = []
    for battle in battles:
        # Get submissions for this battle
        submissions = []
        for sub in battle.submissions.all():
            submissions.append(
                {
                    'id': sub.id,
                    'user': {
                        'id': sub.user.id,
                        'username': sub.user.username,
                        'avatar_url': sub.user.avatar_url,
                    },
                    'prompt_text': sub.prompt_text,
                    'generated_output_url': sub.generated_output_url,
                    'generated_output_text': sub.generated_output_text,
                    'score': float(sub.score) if sub.score else None,
                    'criteria_scores': sub.criteria_scores,
                    'evaluation_feedback': sub.evaluation_feedback,
                    'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
                }
            )

        battle_data = {
            'id': battle.id,
            'challenger': {
                'id': battle.challenger.id,
                'username': battle.challenger.username,
                'avatar_url': battle.challenger.avatar_url,
            },
            'opponent': {
                'id': battle.opponent.id if battle.opponent else None,
                'username': battle.opponent.username if battle.opponent else None,
                'avatar_url': battle.opponent.avatar_url if battle.opponent else None,
            }
            if battle.opponent
            else None,
            'challenge_text': battle.challenge_text,
            'challenge_type': {
                'key': battle.challenge_type.key,
                'name': battle.challenge_type.name,
            }
            if battle.challenge_type
            else None,
            'status': battle.status,
            'battle_type': battle.battle_type,
            'match_source': battle.match_source,
            'duration_minutes': battle.duration_minutes,
            'created_at': battle.created_at.isoformat() if battle.created_at else None,
            'started_at': battle.started_at.isoformat() if battle.started_at else None,
            'completed_at': battle.completed_at.isoformat() if battle.completed_at else None,
            'winner': {
                'id': battle.winner.id,
                'username': battle.winner.username,
                'avatar_url': battle.winner.avatar_url,
            }
            if battle.winner
            else None,
            'is_user_winner': battle.winner_id == user.id if battle.winner_id else False,
            'submissions': submissions,
        }
        battle_list.append(battle_data)

    # Calculate stats
    total_battles = len(battle_list)
    wins = sum(1 for b in battle_list if b['is_user_winner'])
    losses = sum(1 for b in battle_list if b['winner'] and not b['is_user_winner'])
    ties = total_battles - wins - losses

    return Response(
        {
            'battles': battle_list,
            'stats': {
                'total_battles': total_battles,
                'wins': wins,
                'losses': losses,
                'ties': ties,
                'win_rate': round((wins / total_battles * 100) if total_battles > 0 else 0, 1),
            },
        }
    )
