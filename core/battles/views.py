"""Views for Prompt Battle feature."""

import bleach
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import escape
from django_ratelimit.decorators import ratelimit
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.logging_utils import StructuredLogger
from services.auth import GuestUserService
from services.projects import ProjectService

from .models import (
    BattleInvitation,
    BattleStatus,
    BattleSubmission,
    ChallengeType,
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
from .services import BattleService


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
        from core.battles.phase_utils import can_submit_prompt

        battle = self.get_object()

        # Use centralized submission validation (includes participant, phase, turn, and status checks)
        result = can_submit_prompt(battle, request.user, check_existing=True)
        if not result:
            # Determine appropriate status code based on error
            if 'not a participant' in (result.error or ''):
                return Response({'error': result.error}, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)

        # Check if expired (separate check as it triggers expiration)
        if battle.is_expired:
            battle.expire_battle()
            return Response({'error': 'Battle has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create submission using service
        battle_service = BattleService()
        try:
            submission = battle_service.submit_prompt(
                battle=battle,
                user=request.user,
                prompt_text=request.data.get('prompt_text', ''),
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

        # Refresh battle from DB to get updated timer
        battle.refresh_from_db()

        return Response(
            {
                'challenge_text': new_challenge,
                'time_remaining': battle.time_remaining,
                'message': 'Challenge refreshed!',
            }
        )

    @action(detail=True, methods=['post'], url_path='update-challenge')
    def update_challenge(self, request, pk=None):
        """Update the challenge prompt (challenger only, before opponent accepts).

        Allows the challenger to modify the prompt if:
        - They are the challenger
        - The battle is still pending
        - The opponent hasn't accepted the invitation yet
        """
        battle = self.get_object()

        # Only challenger can update
        if request.user != battle.challenger:
            return Response(
                {'error': 'Only the challenger can update the prompt.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Battle must still be pending
        if battle.status != BattleStatus.PENDING:
            return Response(
                {'error': 'Cannot update prompt after the battle has started.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if opponent has accepted (if there's an invitation)
        try:
            invitation = battle.invitation
            if invitation and invitation.status != InvitationStatus.PENDING:
                return Response(
                    {'error': 'Cannot update prompt after your opponent has seen the invitation.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except BattleInvitation.DoesNotExist:
            pass  # No invitation, check opponent directly

        # If opponent is set and connected, they've seen it
        if battle.opponent is not None:
            return Response(
                {'error': 'Cannot update prompt after an opponent has joined.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get and validate new challenge text
        new_challenge = request.data.get('challenge_text', '').strip()
        if not new_challenge:
            return Response(
                {'error': 'Challenge text is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_challenge) < 10:
            return Response(
                {'error': 'Challenge text must be at least 10 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_challenge) > 500:
            return Response(
                {'error': 'Challenge text must be less than 500 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update the challenge
        battle.challenge_text = new_challenge
        battle.save(update_fields=['challenge_text'])

        return Response(
            {
                'challenge_text': battle.challenge_text,
                'message': 'Challenge prompt updated!',
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_battle_link(request):
    """Generate a shareable battle invitation link.

    Creates a battle and invitation that the user can share manually
    via WhatsApp, iMessage, social media, etc. No SMS is sent.

    Request body:
        challenge_type_key (optional): Specific challenge type key

    Returns:
        invite_url: The shareable link
        invitation: Invitation details
    """
    challenge_type_key = request.data.get('challenge_type_key')

    # Get challenge type
    if challenge_type_key:
        try:
            challenge_type = ChallengeType.objects.get(key=challenge_type_key)
        except ChallengeType.DoesNotExist:
            return Response(
                {'error': f'Challenge type "{challenge_type_key}" not found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        # Get random active challenge type
        challenge_type = ChallengeType.objects.filter(is_active=True).order_by('?').first()
        if not challenge_type:
            return Response({'error': 'No challenge types available.'}, status=status.HTTP_400_BAD_REQUEST)

    # Generate challenge
    challenge_text = challenge_type.generate_challenge()

    # Create the battle
    battle = PromptBattle.objects.create(
        challenger=request.user,
        opponent=None,  # Will be set when recipient accepts
        challenge_text=challenge_text,
        challenge_type=challenge_type,
        match_source=MatchSource.INVITATION,
        duration_minutes=challenge_type.default_duration_minutes,
        status=BattleStatus.PENDING,
    )

    # Create link invitation (no SMS sent)
    invitation = BattleInvitation.objects.create(
        battle=battle,
        sender=request.user,
        recipient=None,  # Will be set when user accepts
        invitation_type=InvitationType.LINK,
    )

    serializer = BattleInvitationSerializer(invitation)
    return Response(
        {
            'invitation': serializer.data,
            'invite_url': invitation.invite_url,
            'invite_token': invitation.invite_token,
            'message': 'Shareable link generated. Copy and share with your opponent!',
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_invitation_by_token(request, token):
    """Get invitation details by token (for SMS invitation links).

    Returns consistent response structure for all states:
    - pending: Full invitation details
    - already_accepted: Includes battle_id for redirect + already_accepted flag
    - expired/cancelled: Error response
    """
    try:
        invitation = BattleInvitation.objects.select_related('sender', 'battle', 'battle__challenge_type').get(
            invite_token=token
        )
    except BattleInvitation.DoesNotExist:
        return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.is_expired:
        return Response({'error': 'Invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.status != InvitationStatus.PENDING:
        # Invitation already accepted - return battle info so frontend can redirect
        return Response(
            {
                'already_accepted': True,
                'battle_id': invitation.battle.id,
                'battle_status': invitation.battle.status,
            },
            status=status.HTTP_200_OK,
        )

    # Check if the battle is still valid (not cancelled or expired)
    if invitation.battle.status == BattleStatus.CANCELLED:
        return Response(
            {'error': 'The challenger has cancelled this battle invitation.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if invitation.battle.status == BattleStatus.EXPIRED:
        return Response({'error': 'This battle has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    # Build sender info safely
    sender_data = None
    if invitation.sender:
        sender_data = {
            'id': invitation.sender.id,
            'username': invitation.sender.username,
            'display_name': invitation.sender.first_name or invitation.sender.username,
            'avatar_url': invitation.sender.avatar_url if hasattr(invitation.sender, 'avatar_url') else None,
        }

    return Response(
        {
            'invitation_id': invitation.id,
            'sender': sender_data,
            'battle': {
                'id': invitation.battle.id,
                'challenge_text': invitation.battle.challenge_text,
                'challenge_type': invitation.battle.challenge_type.name if invitation.battle.challenge_type else None,
            },
            'expires_at': invitation.expires_at.isoformat(),
        }
    )


@ratelimit(key='ip', rate='20/h', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def accept_invitation_by_token(request, token):
    """Accept an SMS invitation by token.

    Supports both authenticated users and guest users.
    For guest users, creates a temporary account and returns auth tokens.
    """
    try:
        invitation = BattleInvitation.objects.select_related('sender', 'battle').get(invite_token=token)
    except BattleInvitation.DoesNotExist:
        return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.is_expired:
        return Response({'error': 'Invitation has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    # Idempotency: If invitation already accepted, check if current user is the one who accepted
    # and return the battle instead of an error (allows retry on network failures)
    if invitation.status == InvitationStatus.ACCEPTED:
        battle = invitation.battle
        # If the current user is authenticated and is the opponent, return the battle
        if request.user and request.user.is_authenticated and battle.opponent_id == request.user.id:
            battle_serializer = PromptBattleSerializer(battle, context={'request': request})
            return Response(battle_serializer.data)
        # Otherwise, return already accepted (different user or not logged in)
        return Response({'error': 'Invitation has already been accepted.'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.status != InvitationStatus.PENDING:
        return Response({'error': 'Invitation has already been responded to.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the battle is still valid (not cancelled or expired)
    if invitation.battle.status == BattleStatus.CANCELLED:
        return Response(
            {'error': 'The challenger has cancelled this battle invitation.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if invitation.battle.status == BattleStatus.EXPIRED:
        return Response({'error': 'This battle has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    # Determine if user is authenticated or needs guest account
    is_authenticated = request.user and request.user.is_authenticated
    is_guest_flow = False
    accepting_user = None
    auth_tokens = None

    if is_authenticated:
        accepting_user = request.user
        if invitation.sender == accepting_user:
            return Response({'error': 'You cannot accept your own invitation.'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        # Guest flow - create temporary user
        is_guest_flow = True
        display_name = request.data.get('display_name', None)

        # Sanitize display_name to prevent XSS
        if display_name:
            display_name = bleach.clean(display_name, tags=[], strip=True).strip()
            # Limit length
            if len(display_name) > 50:
                display_name = display_name[:50]
            # Clear if empty after sanitization
            if not display_name:
                display_name = None

    try:
        if is_guest_flow:
            # Create guest user and accept invitation
            accepting_user, auth_tokens = GuestUserService.accept_battle_invitation_as_guest(
                invitation=invitation,
                display_name=display_name,
            )
        else:
            # Regular authenticated flow
            invitation.accept(accepting_user=accepting_user)

        battle = invitation.battle
        battle.refresh_from_db()

        # Notify the challenger via WebSocket that their invitation was accepted
        # This allows them to navigate to the battle
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                challenger_group = f'battle_notifications_{invitation.sender.id}'
                async_to_sync(channel_layer.group_send)(
                    challenger_group,
                    {
                        'type': 'battle_notification',
                        'event': 'invitation_accepted',
                        'battle_id': battle.id,
                        'opponent': {
                            'id': accepting_user.id,
                            'username': accepting_user.username,
                        },
                        'timestamp': timezone.now().isoformat(),
                    },
                )
        except Exception as ws_error:
            # Log but don't fail the request if WebSocket notification fails
            StructuredLogger.log_warning(
                message='Failed to send WebSocket notification for invitation acceptance',
                extra={
                    'battle_id': battle.id,
                    'challenger_id': invitation.sender.id,
                    'error': str(ws_error),
                },
            )

        # Build response
        battle_serializer = PromptBattleSerializer(battle, context={'request': request})
        response_data = battle_serializer.data

        # Include auth info for guest users
        if is_guest_flow and auth_tokens:
            response_data['auth'] = auth_tokens
            response_data['is_guest'] = True

        response = Response(response_data)

        # Set auth cookies for guest users so they're authenticated for subsequent requests
        if is_guest_flow and accepting_user:
            from core.audits.models import UserAuditLog
            from services.auth import set_auth_cookies

            response = set_auth_cookies(response, accepting_user)

            # Track guest creation for analytics
            UserAuditLog.log_action(
                user=accepting_user,
                action=UserAuditLog.Action.GUEST_CREATED,
                request=request,
                details={
                    'invitation_id': invitation.id,
                    'battle_id': battle.id,
                    'sender_username': invitation.sender.username,
                },
                success=True,
            )

        return response

    except ValidationError as e:
        # Handle validation errors with user-friendly messages
        error_message = str(e.message if hasattr(e, 'message') else e)
        StructuredLogger.log_warning(
            message='Battle invitation acceptance validation failed',
            extra={
                'invitation_id': invitation.id,
                'error': error_message,
                'is_guest_flow': is_guest_flow,
            },
        )
        return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to accept battle invitation',
            error=e,
            user=accepting_user if accepting_user else None,
            extra={
                'invitation_id': invitation.id,
                'endpoint': '/battles/invitations/accept/',
                'is_guest_flow': is_guest_flow,
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
def get_battle_public(request, battle_id):
    """Get battle details for a completed battle (public endpoint).

    This endpoint allows anyone to view completed battles without authentication.
    In-progress battles require authentication and participation.

    Args:
        battle_id: The ID of the battle to view

    Returns:
        Full battle details for completed battles
        403 error for in-progress battles (must be authenticated participant)
    """
    from django.shortcuts import get_object_or_404

    battle = get_object_or_404(
        PromptBattle.objects.select_related('challenger', 'opponent', 'winner', 'challenge_type').prefetch_related(
            'submissions__user'
        ),
        id=battle_id,
    )

    # Only completed battles are publicly viewable
    if battle.status != BattleStatus.COMPLETED:
        return Response(
            {'error': 'This battle is not yet complete. Please sign in if you are a participant.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Build submissions data
    submissions = []
    for sub in battle.submissions.all():
        submissions.append(
            {
                'id': sub.id,
                'user': sub.user.id,
                'user_data': {
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

    return Response(
        {
            'id': battle.id,
            'challenger': battle.challenger.id,
            'opponent': battle.opponent.id if battle.opponent else None,
            'challenger_data': {
                'id': battle.challenger.id,
                'username': battle.challenger.username,
                'avatar_url': battle.challenger.avatar_url,
            },
            'opponent_data': {
                'id': battle.opponent.id,
                'username': battle.opponent.username,
                'avatar_url': battle.opponent.avatar_url,
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
            'time_remaining': 0,  # Completed battles have no time remaining
            'created_at': battle.created_at.isoformat() if battle.created_at else None,
            'started_at': battle.started_at.isoformat() if battle.started_at else None,
            'completed_at': battle.completed_at.isoformat() if battle.completed_at else None,
            'winner': battle.winner.id if battle.winner else None,
            'submissions': submissions,
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


@api_view(['GET'])
@permission_classes([AllowAny])
def get_battle_share_data(request, battle_id):
    """Get share data for a completed battle including OG image and platform share URLs.

    Returns all the data needed for social sharing:
    - Share URL for the battle
    - OG image URL (pre-generated)
    - Pre-formatted share text for each platform
    - Platform-specific share URLs

    Args:
        battle_id: The ID of the battle to get share data for

    Returns:
        Share data for all supported platforms
    """
    from urllib.parse import urlencode

    from django.conf import settings
    from django.shortcuts import get_object_or_404

    battle = get_object_or_404(
        PromptBattle.objects.select_related('challenger', 'opponent', 'winner', 'challenge_type').prefetch_related(
            'submissions__user'
        ),
        id=battle_id,
    )

    # Only completed battles can be shared
    if battle.status != BattleStatus.COMPLETED:
        return Response(
            {'error': 'Only completed battles can be shared.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Build the share URLs
    base_url = settings.FRONTEND_URL
    battle_url = f'{base_url}/battles/{battle.id}'
    # Use root-level share URL for social platforms (has OG tags for crawlers)
    # This uses the same domain as frontend, which serves HTML with OG meta tags
    share_page_url = f'{base_url}/battles/{battle.id}/share'

    # Get winner info for share text
    winner_username = battle.winner.username if battle.winner else None
    is_tie = battle.winner is None

    # Build share text variants
    challenge_preview = battle.challenge_text[:50] + ('...' if len(battle.challenge_text) > 50 else '')

    if is_tie:
        result_text = "It's a tie!"
        share_headline = 'Prompt Battle ended in a tie!'
    else:
        result_text = f'Winner: @{winner_username}'
        share_headline = f'@{winner_username} won this Prompt Battle!'

    # Short text for Twitter (280 char limit including URL)
    twitter_text = f'{share_headline}\n\nChallenge: "{challenge_preview}"\n\nSee the results on AllThrive AI'

    # Medium text for Facebook/LinkedIn
    facebook_text = (
        f'{share_headline}\n\n'
        f'Challenge: "{battle.challenge_text}"\n\n'
        f'Both players used AI to create amazing images from the same prompt. {result_text}\n\n'
        f'Check out who created the better image!'
    )

    # Longer text for Reddit
    reddit_title = f'[Prompt Battle] {share_headline}'
    reddit_text = (
        f'Challenge: "{battle.challenge_text}"\n\n'
        f'Two players competed to create the best AI-generated image from the same prompt.\n\n'
        f'{result_text}\n\n'
        f'View the full battle and both images: {battle_url}'
    )

    # Email subject and body
    email_subject = 'Check out this Prompt Battle on AllThrive AI'
    email_body = (
        f'Hey!\n\n'
        f'Check out this Prompt Battle I found on AllThrive AI:\n\n'
        f'Challenge: "{battle.challenge_text}"\n\n'
        f'{share_headline}\n\n'
        f'See the full results: {battle_url}'
    )

    # Build platform share URLs
    # Use share_page_url for platforms that need OG tags (LinkedIn, Facebook)
    # Use battle_url for platforms that work with text (Twitter, Reddit, Email)
    platform_urls = {
        'twitter': f'https://twitter.com/intent/tweet?{urlencode({"text": twitter_text, "url": share_page_url})}',
        'facebook': f'https://www.facebook.com/sharer/sharer.php?{urlencode({"u": share_page_url})}',
        'linkedin': f'https://www.linkedin.com/sharing/share-offsite/?{urlencode({"url": share_page_url})}',
        'reddit': f'https://www.reddit.com/submit?{urlencode({"url": share_page_url, "title": reddit_title})}',
        'email': f'mailto:?{urlencode({"subject": email_subject, "body": email_body})}',
    }

    return Response(
        {
            'battle_id': battle.id,
            'share_url': battle_url,
            'og_image_url': battle.og_image_url,
            'share_text': {
                'headline': share_headline,
                'twitter': twitter_text,
                'facebook': facebook_text,
                'reddit': reddit_text,
                'email_subject': email_subject,
                'email_body': email_body,
            },
            'platform_urls': platform_urls,
            'meta': {
                'title': f'Prompt Battle: {challenge_preview}',
                'description': f'{share_headline} Challenge: "{challenge_preview}"',
                'image': battle.og_image_url,
            },
        }
    )


# =============================================================================
# ASYNC BATTLE MANAGEMENT ENDPOINTS
# =============================================================================


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def pending_battles(request):
    """Get user's active async battles for the My Battles tab.

    Returns battles grouped by status:
    - your_turn: Battles where it's the user's turn to submit
    - their_turn: Battles waiting for opponent
    - judging: Battles being judged
    - recently_completed: Completed battles from last 7 days

    Returns:
        Dict with battles grouped by status
    """
    from datetime import timedelta

    from .models import BattlePhase

    user = request.user
    now = timezone.now()

    # Get all active battles for this user
    user_battles = (
        PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user),
            status__in=[BattleStatus.ACTIVE, BattleStatus.PENDING],
        )
        .select_related('challenger', 'opponent', 'challenge_type', 'current_turn_user', 'invitation')
        .prefetch_related('submissions')
    )

    your_turn = []
    their_turn = []
    judging = []
    pending_invitations = []  # Battles waiting for opponent to accept invitation

    for battle in user_battles:
        battle_data = _serialize_async_battle(battle, user)

        # Check if this is a pending invitation (no opponent yet)
        if battle.opponent is None and battle.status == BattleStatus.PENDING:
            battle_data['status'] = 'pending_invitation'
            # Include invitation info if available
            try:
                invitation = battle.invitation
                if invitation:
                    battle_data['invite_url'] = invitation.invite_url
                    battle_data['invite_token'] = invitation.invite_token
            except BattleInvitation.DoesNotExist:
                pass
            pending_invitations.append(battle_data)
            continue

        # Determine status based on phase
        if battle.phase in [BattlePhase.JUDGING, BattlePhase.GENERATING, BattlePhase.REVEAL]:
            judging.append(battle_data)
        elif battle.phase in [BattlePhase.CHALLENGER_TURN, BattlePhase.OPPONENT_TURN]:
            # Check whose turn it is
            if battle.current_turn_user == user:
                battle_data['status'] = 'your_turn'
                your_turn.append(battle_data)
            else:
                battle_data['status'] = 'their_turn'
                their_turn.append(battle_data)
        elif battle.phase in [BattlePhase.WAITING, BattlePhase.COUNTDOWN, BattlePhase.ACTIVE]:
            # Check if user has submitted
            user_submitted = battle.submissions.filter(user=user).exists()

            if user_submitted:
                # User submitted, waiting for opponent
                battle_data['status'] = 'their_turn'
                their_turn.append(battle_data)
            else:
                # User hasn't submitted yet
                battle_data['status'] = 'your_turn'
                your_turn.append(battle_data)

    # Get recently completed battles (last 7 days)
    seven_days_ago = now - timedelta(days=7)
    completed_battles = (
        PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user),
            status=BattleStatus.COMPLETED,
            completed_at__gte=seven_days_ago,
        )
        .select_related('challenger', 'opponent', 'winner', 'challenge_type')
        .order_by('-completed_at')[:10]
    )

    recently_completed = [_serialize_async_battle(b, user) for b in completed_battles]

    # Sort by urgency (soonest deadline first)
    your_turn.sort(key=lambda x: x.get('deadlines', {}).get('turn') or x.get('deadlines', {}).get('response') or '')
    their_turn.sort(key=lambda x: x.get('deadlines', {}).get('response') or '')

    return Response(
        {
            'your_turn': your_turn,
            'their_turn': their_turn,
            'judging': judging,
            'pending_invitations': pending_invitations,
            'recently_completed': recently_completed,
            'counts': {
                'your_turn': len(your_turn),
                'their_turn': len(their_turn),
                'judging': len(judging),
                'pending_invitations': len(pending_invitations),
                'total_active': len(your_turn) + len(their_turn) + len(judging) + len(pending_invitations),
            },
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extend_battle_deadline(request, battle_id):
    """Extend the async deadline for a battle.

    Only the user waiting for opponent can extend (max 2 times, 1 day each).

    Args:
        battle_id: The ID of the battle

    Returns:
        Updated battle data with new deadline
    """

    user = request.user

    try:
        battle = PromptBattle.objects.select_related('challenger', 'opponent').get(id=battle_id)
    except PromptBattle.DoesNotExist:
        return Response({'error': 'Battle not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Verify user is participant
    if user not in [battle.challenger, battle.opponent]:
        return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

    # Only allow extension if it's not your turn (you're waiting for opponent)
    if battle.current_turn_user == user:
        return Response(
            {'error': 'You can only extend the deadline when waiting for your opponent.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify battle is in async mode
    if not battle.is_async_mode():
        return Response(
            {'error': 'Deadline extensions are only available for async battles.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check extension limit
    if battle.extension_count >= 2:
        return Response(
            {'error': 'Maximum deadline extensions (2) already used.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check if battle has async deadline
    if not battle.async_deadline:
        return Response(
            {'error': 'This battle does not have an async deadline.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Extend the deadline
    days_to_extend = request.data.get('days', 1)
    if days_to_extend not in [1, 2]:
        days_to_extend = 1

    success = battle.extend_deadline(user, days=days_to_extend)

    if not success:
        return Response({'error': 'Failed to extend deadline.'}, status=status.HTTP_400_BAD_REQUEST)

    # Notify opponent
    from .tasks import _send_async_battle_notification

    opponent = battle.opponent if battle.challenger == user else battle.challenger
    _send_async_battle_notification(
        battle,
        'deadline_extended',
        {
            'extended_by_user_id': user.id,
            'new_deadline': battle.async_deadline.isoformat() if battle.async_deadline else None,
            'extensions_remaining': 2 - battle.extension_count,
        },
        target_user=opponent,
    )

    return Response(
        {
            'success': True,
            'new_deadline': battle.async_deadline.isoformat() if battle.async_deadline else None,
            'extensions_used': battle.extension_count,
            'extensions_remaining': 2 - battle.extension_count,
            'message': f'Deadline extended by {days_to_extend} day(s).',
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_battle_reminder(request, battle_id):
    """Send a reminder to the opponent for an async battle.

    Only allowed once per 24 hours.

    Args:
        battle_id: The ID of the battle

    Returns:
        Success/error response
    """

    user = request.user

    try:
        battle = PromptBattle.objects.select_related('challenger', 'opponent').get(id=battle_id)
    except PromptBattle.DoesNotExist:
        return Response({'error': 'Battle not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Verify user is participant
    if user not in [battle.challenger, battle.opponent]:
        return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

    # Verify battle is in async mode
    if not battle.is_async_mode():
        return Response(
            {'error': 'Reminders are only available for async battles.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Only allow reminder if it's not your turn (you're waiting for opponent)
    opponent = battle.opponent if battle.challenger == user else battle.challenger
    if battle.current_turn_user == user:
        return Response(
            {'error': 'You can only send reminders when waiting for your opponent.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check cooldown
    if not battle.can_send_reminder():
        return Response(
            {'error': 'You can only send one reminder per 24 hours.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Send notification
    from .tasks import _send_async_battle_notification

    _send_async_battle_notification(
        battle,
        'battle_reminder',
        {
            'from_user_id': user.id,
            'from_username': user.username,
            'deadline': battle.async_deadline.isoformat() if battle.async_deadline else None,
        },
        target_user=opponent,
    )

    # Update reminder tracking
    battle.last_reminder_sent_at = timezone.now()
    battle.reminder_count += 1
    battle.save(update_fields=['last_reminder_sent_at', 'reminder_count'])

    return Response(
        {
            'success': True,
            'message': f'Reminder sent to @{opponent.username}.',
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_battle_turn(request, battle_id):
    """Start the user's 3-minute turn for an async battle.

    Called when user opens the battle to take their turn.
    Starts the 3-minute countdown.

    Args:
        battle_id: The ID of the battle

    Returns:
        Turn info with expiration time
    """
    from .tasks import start_async_turn_task

    user = request.user

    try:
        battle = PromptBattle.objects.select_related('challenger', 'opponent').get(id=battle_id)
    except PromptBattle.DoesNotExist:
        return Response({'error': 'Battle not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Verify user is participant (handle case where opponent is None for pending invitations)
    is_challenger = user == battle.challenger
    is_opponent = battle.opponent is not None and user == battle.opponent
    if not is_challenger and not is_opponent:
        return Response({'error': 'You are not a participant in this battle.'}, status=status.HTTP_403_FORBIDDEN)

    # Trigger the task synchronously for immediate feedback
    result = start_async_turn_task(battle_id, user.id)

    if result.get('status') == 'error':
        return Response({'error': result.get('reason', 'Failed to start turn.')}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            'status': result.get('status'),
            'expires_at': result.get('expires_at'),
            'time_remaining': result.get('time_remaining'),
        }
    )


def _serialize_async_battle(battle: PromptBattle, user) -> dict:
    """Serialize a battle for the async battles list."""
    opponent = battle.opponent if battle.challenger == user else battle.challenger

    # Determine user's submission status
    user_submission = battle.submissions.filter(user=user).first()
    opponent_submission = battle.submissions.filter(user=opponent).first() if opponent else None

    # Build deadline info
    deadlines = {}
    if battle.async_deadline:
        deadlines['response'] = battle.async_deadline.isoformat()
    if battle.current_turn_expires_at:
        deadlines['turn'] = battle.current_turn_expires_at.isoformat()

    return {
        'id': battle.id,
        'opponent': {
            'id': opponent.id if opponent else None,
            'username': opponent.username if opponent else 'Waiting...',
            'avatar_url': opponent.avatar_url if opponent else None,
        }
        if opponent
        else None,
        'challenge_text': battle.challenge_text[:100] + ('...' if len(battle.challenge_text) > 100 else ''),
        'challenge_type': {
            'key': battle.challenge_type.key,
            'name': battle.challenge_type.name,
        }
        if battle.challenge_type
        else None,
        'status': 'pending',  # Will be overwritten by caller
        'phase': battle.phase,
        'battle_mode': battle.battle_mode,
        'deadlines': deadlines,
        'extensions': {
            'used': battle.extension_count,
            'max': 2,
        },
        'has_submitted': user_submission is not None,
        'opponent_submitted': opponent_submission is not None,
        'winner_id': battle.winner_id,
        'is_winner': battle.winner_id == user.id if battle.winner_id else None,
        'created_at': battle.created_at.isoformat() if battle.created_at else None,
    }


# =============================================================================
# SOCIAL SHARE PAGE (HTML with OG tags for crawlers)
# =============================================================================


def battle_share_page(request, battle_id):
    """Serve HTML page with OG meta tags for social media crawlers.

    Social platforms (LinkedIn, Facebook, Twitter) don't execute JavaScript,
    so they can't see meta tags set by React. This endpoint serves a minimal
    HTML page with proper OG tags that redirects browsers to the SPA.

    Args:
        battle_id: The ID of the battle to share

    Returns:
        HTML page with OG meta tags
    """
    from django.shortcuts import get_object_or_404

    battle = get_object_or_404(
        PromptBattle.objects.select_related('challenger', 'opponent', 'winner'),
        id=battle_id,
    )

    # Build URLs
    frontend_url = settings.FRONTEND_URL
    spa_url = f'{frontend_url}/battles/{battle.id}'

    # Get battle info for meta tags
    challenge_preview = battle.challenge_text[:100] + ('...' if len(battle.challenge_text) > 100 else '')

    if battle.winner:
        title = f'@{battle.winner.username} won this Prompt Battle!'
        description = f'Challenge: "{challenge_preview}" - See who created the better AI image!'
    else:
        title = 'Prompt Battle Results'
        description = f'Challenge: "{challenge_preview}" - Two players competed to create the best AI image!'

    og_image = battle.og_image_url or f'{frontend_url}/og-image.jpg'

    # Escape values for HTML
    title = escape(title)
    description = escape(description)
    challenge_preview = escape(challenge_preview)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | All Thrive AI</title>
    <meta name="description" content="{description}">

    <!-- Open Graph / Facebook / LinkedIn -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{spa_url}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="All Thrive AI">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{spa_url}">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{og_image}">

    <!-- Redirect browsers to SPA (crawlers don't execute JS) -->
    <script>window.location.href = "{spa_url}";</script>
    <noscript>
        <meta http-equiv="refresh" content="0;url={spa_url}">
    </noscript>
</head>
<body>
    <p>Redirecting to <a href="{spa_url}">battle results</a>...</p>
</body>
</html>"""

    return HttpResponse(html, content_type='text/html')
