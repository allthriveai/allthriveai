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
    InvitationStatus,
    InvitationType,
    MatchSource,
    PromptBattle,
    PromptChallengePrompt,
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
        """Refresh the challenge prompt (Pip battles or pending invitation battles)."""
        battle = self.get_object()

        battle_service = BattleService()
        new_challenge = battle_service.refresh_challenge(battle, request.user)

        if new_challenge is None:
            return Response(
                {'error': 'Cannot refresh challenge. Only available before you submit and before opponent joins.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Refresh battle from DB to get updated timer and challenge type
        battle.refresh_from_db()

        response_data = {
            'challenge_text': new_challenge,
            'time_remaining': battle.time_remaining,
            'message': 'Challenge refreshed!',
        }

        # Include prompt category if available
        if battle.prompt and battle.prompt.category:
            response_data['category'] = {
                'id': battle.prompt.category.id,
                'name': battle.prompt.category.name,
            }

        return Response(response_data)

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

    @action(detail=True, methods=['post'], url_path='set-friend-name')
    def set_friend_name(self, request, pk=None):
        """Set the friend's name for an invitation battle.

        Allows the challenger to set a display name for their friend before
        they join the battle. This name shows in the opponent circle.
        """
        battle = self.get_object()

        # Only challenger can set friend name
        if request.user != battle.challenger:
            return Response(
                {'error': 'Only the challenger can set the friend name.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Must be an invitation battle
        if battle.match_source != MatchSource.INVITATION:
            return Response(
                {'error': 'Friend name can only be set for invitation battles.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get and validate the friend name
        friend_name = request.data.get('friend_name', '').strip()
        if not friend_name:
            return Response(
                {'error': 'Friend name is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(friend_name) > 50:
            return Response(
                {'error': 'Friend name must be 50 characters or less.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Sanitize the name
        friend_name = bleach.clean(friend_name, tags=[], strip=True)

        # Update the invitation's recipient_name
        try:
            invitation = battle.invitation
            invitation.recipient_name = friend_name
            invitation.save(update_fields=['recipient_name'])

            return Response(
                {
                    'friend_name': friend_name,
                    'message': 'Friend name saved!',
                }
            )
        except BattleInvitation.DoesNotExist:
            return Response(
                {'error': 'No invitation found for this battle.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'], url_path='test-expire-invite')
    def test_expire_invite(self, request, pk=None):
        """TEST ONLY: Expire a battle invitation for E2E testing.

        This endpoint is only available in DEBUG mode and allows tests
        to expire an invitation without waiting 24 hours.
        """
        from django.conf import settings

        # Only allow in DEBUG mode
        if not settings.DEBUG:
            return Response(
                {'error': 'This endpoint is only available in DEBUG mode.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        battle = self.get_object()

        # Only the battle owner can expire the invite
        if request.user != battle.challenger:
            return Response(
                {'error': 'Only the challenger can expire the invite.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get the invitation and set expires_at to the past
        try:
            invitation = battle.invitation
            invitation.expires_at = timezone.now() - timezone.timedelta(hours=1)
            invitation.save(update_fields=['expires_at'])

            return Response(
                {
                    'message': 'Invitation expired for testing.',
                    'expires_at': invitation.expires_at.isoformat(),
                }
            )
        except BattleInvitation.DoesNotExist:
            return Response(
                {'error': 'No invitation found for this battle.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get'], url_path='test-generation-prompt')
    def test_generation_prompt(self, request, pk=None):
        """TEST ONLY: Get the prompt that would be sent to the AI image generator.

        This endpoint is only available in DEBUG mode and allows E2E tests
        to verify that the challenge text is NOT included in the image generation
        prompt - only the user's creative direction should be used.

        Returns:
            - generation_prompt: The actual prompt sent to AI image generator
            - user_prompt: The user's original prompt text
            - challenge_text: The battle's challenge text (for verification it's NOT in generation_prompt)
        """
        from django.conf import settings

        # Only allow in DEBUG mode
        if not settings.DEBUG:
            return Response(
                {'error': 'This endpoint is only available in DEBUG mode.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        battle = self.get_object()

        # Only participants can access
        if request.user not in [battle.challenger, battle.opponent]:
            return Response(
                {'error': 'Only battle participants can access this endpoint.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get user's submission
        try:
            submission = BattleSubmission.objects.get(battle=battle, user=request.user)
        except BattleSubmission.DoesNotExist:
            return Response(
                {'error': 'No submission found. Submit a prompt first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build the SAME prompt that would be sent to the AI image generator
        # This MUST match the logic in services.py generate_image_for_submission()
        generation_prompt = f"""{submission.prompt_text}

Generate a high-quality, creative image that brings this vision to life.
Focus on visual impact and artistic interpretation."""

        return Response(
            {
                'generation_prompt': generation_prompt,
                'user_prompt': submission.prompt_text,
                'challenge_text': battle.challenge_text,
                'challenge_in_prompt': battle.challenge_text in generation_prompt,
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

        # Add prompt category info
        if battle.prompt and battle.prompt.category:
            battle_result['category'] = {
                'id': battle.prompt.category.id,
                'name': battle.prompt.category.name,
            }

        # Truncate challenge text for title
        challenge_preview = battle.challenge_text[:50]
        if len(battle.challenge_text) > 50:
            challenge_preview += '...'

        # Generate tags based on battle content
        tags = ['AI Image Generation', 'Prompt Battle']

        # Add category as a tag
        if battle.prompt and battle.prompt.category:
            tags.append(battle.prompt.category.name)

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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Bulk delete/cancel battles.

        Only allows deleting battles where:
        - User is a participant (challenger or opponent)
        - Battle is pending, cancelled, expired, or completed

        Request body:
            { "battle_ids": [1, 2, 3] }

        Response:
            { "deleted": 2, "failed": [{"id": 3, "reason": "..."}] }
        """
        battle_ids = request.data.get('battle_ids', [])

        if not battle_ids:
            return Response({'error': 'No battle IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(battle_ids) > 50:
            return Response(
                {'error': 'Cannot delete more than 50 battles at once.'}, status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        deleted_count = 0
        failed = []

        for battle_id in battle_ids:
            try:
                battle = PromptBattle.objects.get(pk=battle_id)

                # Check user is a participant
                if user not in [battle.challenger, battle.opponent]:
                    failed.append({'id': battle_id, 'reason': 'Not a participant'})
                    continue

                # For active battles, cancel instead of delete
                if battle.status == BattleStatus.ACTIVE:
                    # Only allow if user hasn't submitted yet
                    has_submitted = BattleSubmission.objects.filter(battle=battle, user=user).exists()
                    if has_submitted:
                        failed.append({'id': battle_id, 'reason': 'Cannot delete - you already submitted'})
                        continue
                    battle.cancel_battle()
                    # Also hide it from user's view
                    battle.hidden_by.add(user)
                    deleted_count += 1
                elif battle.status == BattleStatus.PENDING:
                    # Cancel pending battles
                    battle.cancel_battle()
                    # Also hide it from user's view
                    battle.hidden_by.add(user)
                    deleted_count += 1
                elif battle.status in [BattleStatus.CANCELLED, BattleStatus.EXPIRED, BattleStatus.COMPLETED]:
                    # For finished battles, hide them from the user's view
                    # We don't actually delete to preserve data integrity
                    battle.hidden_by.add(user)
                    deleted_count += 1
                else:
                    failed.append({'id': battle_id, 'reason': f'Invalid status: {battle.status}'})

            except PromptBattle.DoesNotExist:
                failed.append({'id': battle_id, 'reason': 'Battle not found'})

        return Response(
            {
                'deleted': deleted_count,
                'failed': failed,
            }
        )

    @action(detail=False, methods=['get'], url_path='my-history')
    def my_history(self, request):
        """Get full battle history for the user with pagination and filters.

        Query params:
            - status: 'all', 'completed', 'cancelled', 'expired', 'active', 'pending' (default: 'all')
            - page: page number (default: 1)
            - page_size: results per page (default: 20, max: 50)

        Response includes battles where user is challenger or opponent.
        """
        user = request.user
        status_filter = request.query_params.get('status', 'all')
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 50)

        queryset = (
            PromptBattle.objects.filter(Q(challenger=user) | Q(opponent=user))
            .exclude(
                hidden_by=user  # Exclude battles hidden by this user
            )
            .select_related('challenger', 'opponent', 'winner', 'prompt', 'prompt__category')
        )

        # Apply status filter
        if status_filter == 'completed':
            queryset = queryset.filter(status=BattleStatus.COMPLETED)
        elif status_filter == 'cancelled':
            queryset = queryset.filter(status=BattleStatus.CANCELLED)
        elif status_filter == 'expired':
            queryset = queryset.filter(status=BattleStatus.EXPIRED)
        elif status_filter == 'active':
            queryset = queryset.filter(status=BattleStatus.ACTIVE)
        elif status_filter == 'pending':
            queryset = queryset.filter(status=BattleStatus.PENDING)
        # 'all' returns everything

        # Order by most recent first
        queryset = queryset.order_by('-created_at')

        # Paginate
        total_count = queryset.count()
        offset = (page - 1) * page_size
        battles = queryset[offset : offset + page_size]

        serializer = PromptBattleListSerializer(battles, many=True, context={'request': request})

        return Response(
            {
                'battles': serializer.data,
                'total': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': (total_count + page_size - 1) // page_size,
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

        from core.sms.utils import normalize_phone_number

        # Validate phone number
        phone = request.data.get('phone_number', '').strip()
        recipient_name = request.data.get('recipient_name', '').strip()

        if not phone:
            return Response({'error': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            normalized_phone = normalize_phone_number(phone)
        except ValidationError as e:
            return Response({'error': str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

        # Get a random active prompt
        prompt = PromptChallengePrompt.objects.filter(is_active=True).order_by('?').first()

        if not prompt:
            return Response({'error': 'No prompts available.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create the battle (opponent will be set when they accept)
        battle = PromptBattle.objects.create(
            challenger=request.user,
            opponent=None,  # Will be set when SMS recipient accepts
            challenge_text=prompt.prompt_text,
            prompt=prompt,
            match_source=MatchSource.INVITATION,
            duration_minutes=3,  # Default duration
            status=BattleStatus.PENDING,
        )

        # Increment usage counter
        from django.db.models import F

        PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=F('times_used') + 1)

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
        category_id (optional): Filter prompts by category ID

    Returns:
        invite_url: The shareable link
        invitation: Invitation details
    """

    category_id = request.data.get('category_id')

    # Build queryset for active prompts
    queryset = PromptChallengePrompt.objects.filter(is_active=True)
    if category_id:
        queryset = queryset.filter(category_id=category_id)

    # Get random prompt using weighted selection
    prompt = queryset.order_by('?').first()
    if not prompt:
        return Response({'error': 'No prompts available.'}, status=status.HTTP_400_BAD_REQUEST)

    # Create the battle
    battle = PromptBattle.objects.create(
        challenger=request.user,
        opponent=None,  # Will be set when recipient accepts
        challenge_text=prompt.prompt_text,
        prompt=prompt,
        match_source=MatchSource.INVITATION,
        duration_minutes=3,  # Default duration
        status=BattleStatus.PENDING,
    )

    # Increment usage counter
    from django.db.models import F

    PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=F('times_used') + 1)

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
        invitation = BattleInvitation.objects.select_related(
            'sender', 'battle', 'battle__prompt', 'battle__prompt__category'
        ).get(invite_token=token)
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
                'category': invitation.battle.prompt.category.name
                if invitation.battle.prompt and invitation.battle.prompt.category
                else None,
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

                # ALSO notify any users connected to the battle itself
                # This updates the challenger's BattlePage if they're already on it
                battle_group = f'battle_{battle.id}'
                async_to_sync(channel_layer.group_send)(
                    battle_group,
                    {
                        'type': 'send_state_to_group',
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
        PromptBattle.objects.select_related(
            'challenger', 'opponent', 'winner', 'prompt', 'prompt__category'
        ).prefetch_related('submissions__user'),
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
            'category': {
                'id': battle.prompt.category.id,
                'name': battle.prompt.category.name,
            }
            if battle.prompt and battle.prompt.category
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
        .select_related('challenger', 'opponent', 'winner', 'prompt', 'prompt__category')
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
            'category': {
                'id': battle.prompt.category.id,
                'name': battle.prompt.category.name,
            }
            if battle.prompt and battle.prompt.category
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
        PromptBattle.objects.select_related(
            'challenger', 'opponent', 'winner', 'prompt', 'prompt__category'
        ).prefetch_related('submissions__user'),
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

    # Get all active battles for this user (excluding hidden ones)
    user_battles = (
        PromptBattle.objects.filter(
            Q(challenger=user) | Q(opponent=user),
            status__in=[BattleStatus.ACTIVE, BattleStatus.PENDING],
        )
        .exclude(hidden_by=user)
        .select_related('challenger', 'opponent', 'prompt', 'prompt__category', 'current_turn_user', 'invitation')
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
        .select_related('challenger', 'opponent', 'winner', 'prompt', 'prompt__category')
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
    is_challenger = battle.challenger == user

    # Determine user's submission status
    user_submission = battle.submissions.filter(user=user).first()
    opponent_submission = battle.submissions.filter(user=opponent).first() if opponent else None

    # Build deadline info
    deadlines = {}
    if battle.async_deadline:
        deadlines['response'] = battle.async_deadline.isoformat()
    if battle.current_turn_expires_at:
        deadlines['turn'] = battle.current_turn_expires_at.isoformat()

    # Get friend name from invitation (only show to challenger)
    friend_name = None
    if is_challenger:
        try:
            invitation = battle.invitation
            if invitation and invitation.recipient_name:
                friend_name = invitation.recipient_name
        except BattleInvitation.DoesNotExist:
            pass

    # Determine opponent display name (friend name if set, otherwise username)
    opponent_display_name = None
    if is_challenger and friend_name:
        opponent_display_name = friend_name
    elif opponent:
        opponent_display_name = opponent.username
    else:
        opponent_display_name = 'Waiting...'

    return {
        'id': battle.id,
        'opponent': {
            'id': opponent.id if opponent else None,
            'username': opponent.username if opponent else 'Waiting...',
            'avatar_url': opponent.avatar_url if opponent else None,
        }
        if opponent
        else None,
        'opponent_display_name': opponent_display_name,
        'challenge_text': battle.challenge_text[:100] + ('...' if len(battle.challenge_text) > 100 else ''),
        'category': {
            'id': battle.prompt.category.id,
            'name': battle.prompt.category.name,
        }
        if battle.prompt and battle.prompt.category
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


# =============================================================================
# ADMIN - PROMPT CHALLENGE PROMPTS MANAGEMENT
# =============================================================================


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_prompt_list(request):
    """List all curated prompts for admin management.

    Query params:
        - category: Filter by category ID
        - difficulty: Filter by difficulty (easy/medium/hard)
        - is_active: Filter by active status (true/false)
        - search: Search in prompt text
        - page: Page number (default: 1)
        - page_size: Items per page (default: 20, max: 100)
    """
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.battles.models import PromptChallengePrompt

    queryset = PromptChallengePrompt.objects.select_related('category').all()

    # Apply filters
    category_id = request.query_params.get('category')
    if category_id:
        queryset = queryset.filter(category_id=category_id)

    difficulty = request.query_params.get('difficulty')
    if difficulty:
        queryset = queryset.filter(difficulty=difficulty)

    is_active = request.query_params.get('is_active')
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == 'true')

    search = request.query_params.get('search')
    if search:
        queryset = queryset.filter(prompt_text__icontains=search)

    # Order by most recently created first
    queryset = queryset.order_by('-created_at')

    # Pagination
    total = queryset.count()
    page = int(request.query_params.get('page', 1))
    page_size = min(int(request.query_params.get('page_size', 20)), 100)
    offset = (page - 1) * page_size

    prompts = queryset[offset : offset + page_size]

    data = [
        {
            'id': p.id,
            'promptText': p.prompt_text,
            'category': {'id': p.category.id, 'name': p.category.name, 'slug': p.category.slug} if p.category else None,
            'difficulty': p.difficulty,
            'isActive': p.is_active,
            'weight': p.weight,
            'timesUsed': p.times_used,
            'createdAt': p.created_at.isoformat(),
            'updatedAt': p.updated_at.isoformat(),
        }
        for p in prompts
    ]

    return Response(
        {
            'prompts': data,
            'total': total,
            'page': page,
            'pageSize': page_size,
            'totalPages': (total + page_size - 1) // page_size,
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_prompt_create(request):
    """Create a new curated prompt."""
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f'admin_prompt_create request.data: {request.data}')

    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.battles.models import PromptChallengePrompt

    # Support both camelCase and snake_case keys
    prompt_text = (request.data.get('promptText') or request.data.get('prompt_text', '')).strip()
    if not prompt_text:
        return Response({'error': 'promptText is required'}, status=400)

    if len(prompt_text) < 10:
        return Response({'error': 'promptText must be at least 10 characters'}, status=400)

    # Support both camelCase and snake_case keys
    # Default to "Images & Video" category (ID: 9) if not provided
    category_id = request.data.get('categoryId') or request.data.get('category_id') or 9
    difficulty = request.data.get('difficulty', 'medium')
    weight = float(request.data.get('weight', 1.0))
    is_active = request.data.get('isActive') if 'isActive' in request.data else request.data.get('is_active', True)

    prompt = PromptChallengePrompt.objects.create(
        prompt_text=prompt_text,
        category_id=category_id,
        difficulty=difficulty,
        weight=weight,
        is_active=is_active,
    )

    return Response(
        {
            'id': prompt.id,
            'promptText': prompt.prompt_text,
            'category': {'id': prompt.category.id, 'name': prompt.category.name} if prompt.category else None,
            'difficulty': prompt.difficulty,
            'isActive': prompt.is_active,
            'weight': prompt.weight,
            'timesUsed': prompt.times_used,
            'createdAt': prompt.created_at.isoformat(),
        },
        status=201,
    )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_prompt_detail(request, pk):
    """Get, update, or delete a single prompt."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.battles.models import PromptChallengePrompt

    try:
        prompt = PromptChallengePrompt.objects.select_related('category').get(id=pk)
    except PromptChallengePrompt.DoesNotExist:
        return Response({'error': 'Prompt not found'}, status=404)

    if request.method == 'GET':
        return Response(
            {
                'id': prompt.id,
                'promptText': prompt.prompt_text,
                'category': {'id': prompt.category.id, 'name': prompt.category.name, 'slug': prompt.category.slug}
                if prompt.category
                else None,
                'difficulty': prompt.difficulty,
                'isActive': prompt.is_active,
                'weight': prompt.weight,
                'timesUsed': prompt.times_used,
                'createdAt': prompt.created_at.isoformat(),
                'updatedAt': prompt.updated_at.isoformat(),
            }
        )

    elif request.method == 'PUT':
        # Frontend sends snake_case keys via axios interceptor
        if 'prompt_text' in request.data:
            prompt_text = request.data['prompt_text'].strip()
            if len(prompt_text) < 10:
                return Response({'error': 'prompt_text must be at least 10 characters'}, status=400)
            prompt.prompt_text = prompt_text

        if 'category_id' in request.data:
            prompt.category_id = request.data['category_id']

        if 'difficulty' in request.data:
            prompt.difficulty = request.data['difficulty']

        if 'weight' in request.data:
            prompt.weight = float(request.data['weight'])

        if 'is_active' in request.data:
            prompt.is_active = request.data['is_active']

        prompt.save()

        return Response(
            {
                'id': prompt.id,
                'promptText': prompt.prompt_text,
                'category': {'id': prompt.category.id, 'name': prompt.category.name} if prompt.category else None,
                'difficulty': prompt.difficulty,
                'isActive': prompt.is_active,
                'weight': prompt.weight,
                'timesUsed': prompt.times_used,
                'createdAt': prompt.created_at.isoformat(),
                'updatedAt': prompt.updated_at.isoformat(),
            }
        )

    elif request.method == 'DELETE':
        prompt.delete()
        return Response({'message': 'Prompt deleted'}, status=204)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_prompt_stats(request):
    """Get prompt statistics for the admin dashboard."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from django.db.models import Count, Sum

    from core.battles.models import PromptChallengePrompt

    total = PromptChallengePrompt.objects.count()
    active = PromptChallengePrompt.objects.filter(is_active=True).count()
    inactive = total - active

    # By difficulty
    by_difficulty = (
        PromptChallengePrompt.objects.values('difficulty').annotate(count=Count('id')).order_by('difficulty')
    )

    # By category
    by_category = (
        PromptChallengePrompt.objects.filter(category__isnull=False)
        .values('category__id', 'category__name')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    # Most used
    most_used = PromptChallengePrompt.objects.filter(times_used__gt=0).order_by('-times_used')[:5]

    # Least used (active prompts that haven't been used)
    least_used = PromptChallengePrompt.objects.filter(is_active=True, times_used=0).order_by('created_at')[:5]

    # Total times used
    total_usage = PromptChallengePrompt.objects.aggregate(total=Sum('times_used'))['total'] or 0

    return Response(
        {
            'total': total,
            'active': active,
            'inactive': inactive,
            'totalUsage': total_usage,
            'byDifficulty': {item['difficulty']: item['count'] for item in by_difficulty},
            'byCategory': [
                {'categoryId': item['category__id'], 'categoryName': item['category__name'], 'count': item['count']}
                for item in by_category
            ],
            'mostUsed': [
                {
                    'id': p.id,
                    'promptText': p.prompt_text[:100] + ('...' if len(p.prompt_text) > 100 else ''),
                    'timesUsed': p.times_used,
                }
                for p in most_used
            ],
            'leastUsed': [
                {
                    'id': p.id,
                    'promptText': p.prompt_text[:100] + ('...' if len(p.prompt_text) > 100 else ''),
                    'timesUsed': p.times_used,
                }
                for p in least_used
            ],
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_prompt_categories(request):
    """Get available categories for the prompt filter dropdown."""
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.taxonomy.models import Taxonomy

    categories = Taxonomy.objects.filter(taxonomy_type='category', is_active=True).order_by('name')

    return Response(
        {
            'categories': [{'id': c.id, 'name': c.name, 'slug': c.slug} for c in categories],
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_prompt_bulk_update(request):
    """Bulk update multiple prompts at once.

    Request body:
        {
            "ids": [1, 2, 3],
            "updates": {
                "categoryId": 5,        # optional
                "difficulty": "hard",   # optional
                "isActive": true,       # optional
                "weight": 1.5           # optional
            }
        }

    Returns:
        {
            "updated": 3,
            "failed": []
        }
    """
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.battles.models import PromptChallengePrompt

    ids = request.data.get('ids', [])
    updates = request.data.get('updates', {})

    if not ids:
        return Response({'error': 'No prompt IDs provided'}, status=400)

    if len(ids) > 100:
        return Response({'error': 'Cannot update more than 100 prompts at once'}, status=400)

    if not updates:
        return Response({'error': 'No updates provided'}, status=400)

    # Build the update dict
    update_fields = {}

    if 'categoryId' in updates:
        update_fields['category_id'] = updates['categoryId']

    if 'difficulty' in updates:
        if updates['difficulty'] not in ['easy', 'medium', 'hard']:
            return Response({'error': 'Invalid difficulty value'}, status=400)
        update_fields['difficulty'] = updates['difficulty']

    if 'isActive' in updates:
        update_fields['is_active'] = bool(updates['isActive'])

    if 'weight' in updates:
        try:
            weight = float(updates['weight'])
            if weight < 0.1 or weight > 10.0:
                return Response({'error': 'Weight must be between 0.1 and 10.0'}, status=400)
            update_fields['weight'] = weight
        except (ValueError, TypeError):
            return Response({'error': 'Invalid weight value'}, status=400)

    if not update_fields:
        return Response({'error': 'No valid update fields provided'}, status=400)

    # Perform bulk update
    updated_count = PromptChallengePrompt.objects.filter(id__in=ids).update(**update_fields)

    return Response(
        {
            'updated': updated_count,
            'failed': [],
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_prompt_bulk_delete(request):
    """Bulk delete multiple prompts at once.

    Request body:
        {
            "ids": [1, 2, 3]
        }

    Returns:
        {
            "deleted": 3,
            "failed": []
        }
    """
    if request.user.role != 'admin':
        return Response({'error': 'Admin access required'}, status=403)

    from core.battles.models import PromptChallengePrompt

    ids = request.data.get('ids', [])

    if not ids:
        return Response({'error': 'No prompt IDs provided'}, status=400)

    if len(ids) > 100:
        return Response({'error': 'Cannot delete more than 100 prompts at once'}, status=400)

    # Perform bulk delete
    deleted_count, _ = PromptChallengePrompt.objects.filter(id__in=ids).delete()

    return Response(
        {
            'deleted': deleted_count,
            'failed': [],
        }
    )
