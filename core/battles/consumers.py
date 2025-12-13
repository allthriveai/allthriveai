"""
WebSocket Consumers for Prompt Battles

Handles real-time battle communication:
- BattleConsumer: Real-time battle events during a match
- MatchmakingConsumer: Queue management and match finding
"""

import asyncio
import json
import logging
from datetime import timedelta
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from core.battles.models import (
    BattleInvitation,
    BattleMatchmakingQueue,
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    ChallengeType,
    MatchSource,
    MatchType,
    PromptBattle,
)
from core.battles.utils import sanitize_prompt, validate_prompt_for_battle
from core.users.models import User

logger = logging.getLogger(__name__)

# Countdown duration in seconds
COUNTDOWN_SECONDS = 3


class BattleConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time battle events.

    Handles:
    - Connection status (both users connected)
    - Countdown synchronization
    - Typing indicators
    - Submission notifications
    - AI generation progress (your output only)
    - Judging progress
    - Results reveal sequence

    URL: ws/battle/<battle_id>/
    """

    async def connect(self):
        """Handle WebSocket connection to a battle."""
        self.battle_id = self.scope['url_route']['kwargs']['battle_id']
        self.user = self.scope.get('user')
        self.group_name = f'battle_{self.battle_id}'

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'Battle WebSocket from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated battle WebSocket attempt for battle {self.battle_id}')
            await self.close(code=4001)
            return

        # Validate battle access
        battle = await self._get_battle()
        if not battle:
            logger.warning(f'Battle {self.battle_id} not found')
            await self.close(code=4004)
            return

        if not await self._user_is_participant(battle):
            logger.warning(f'User {self.user.id} is not a participant in battle {self.battle_id}')
            await self.close(code=4003)
            return

        # Join battle group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Mark user as connected
        await self._set_user_connected(True)

        logger.info(f'Battle WebSocket connected: user={self.user.id}, battle={self.battle_id}')

        # Send initial state
        await self.send_battle_state()

        # Check if both users are now connected
        await self._check_both_connected()

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        # Mark user as disconnected
        if hasattr(self, 'battle_id') and hasattr(self, 'user') and self.user.is_authenticated:
            await self._set_user_connected(False)

            # Notify opponent of disconnection
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'opponent_status',
                    'user_id': self.user.id,
                    'status': 'disconnected',
                },
            )

        logger.info(f'Battle WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, code={close_code}')

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages from client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong', 'timestamp': self._get_timestamp()}))
                return

            # Verify user is still authenticated for all non-ping messages
            if not self.user or not self.user.is_authenticated:
                await self._send_error('Authentication required')
                await self.close(code=4001)
                return

            # Verify user is still a participant in this battle for state-changing actions
            if message_type in ('typing', 'submit_prompt'):
                battle = await self._get_battle()
                if not battle or not await self._user_is_participant(battle):
                    await self._send_error('Not authorized for this battle')
                    return

            if message_type == 'typing':
                # Broadcast typing status to opponent
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'battle_event',
                        'event': 'opponent_status',
                        'user_id': self.user.id,
                        'status': 'typing' if data.get('is_typing', False) else 'idle',
                    },
                )

            elif message_type == 'submit_prompt':
                prompt_text = data.get('prompt_text', '').strip()
                if prompt_text:
                    await self._handle_submission(prompt_text)

            elif message_type == 'request_state':
                await self.send_battle_state()

        except json.JSONDecodeError:
            await self._send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f'Error processing battle WebSocket message: {e}', exc_info=True)
            await self._send_error('Failed to process message')

    async def battle_event(self, event: dict[str, Any]):
        """
        Receive battle event from channel layer and forward to WebSocket.

        This is called when another consumer or service broadcasts to the group.
        """
        # Don't send opponent's own status back to them
        if event.get('event') == 'opponent_status' and event.get('user_id') == self.user.id:
            return

        # Forward event to client (remove internal fields)
        client_event = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(client_event))

    async def send_battle_state(self):
        """Send current battle state to this client."""
        try:
            battle = await self._get_battle()
            if not battle:
                logger.warning(f'Battle {self.battle_id} not found when sending state')
                return

            state = await self._build_battle_state(battle)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'battle_state',
                        'state': state,
                        'timestamp': self._get_timestamp(),
                    }
                )
            )
        except Exception as e:
            logger.error(f'Error sending battle state for battle {self.battle_id}: {e}', exc_info=True)
            await self._send_error('Failed to load battle state')

    async def _handle_submission(self, prompt_text: str):
        """Handle a user submitting their prompt."""
        from core.battles.phase_utils import can_submit_prompt

        battle = await self._get_battle()
        if not battle:
            await self._send_error('Battle not found')
            return

        # Use centralized submission validation
        can_submit_result = await database_sync_to_async(lambda: can_submit_prompt(battle, self.user))()

        if not can_submit_result:
            await self._send_error(can_submit_result.error or 'Cannot submit')
            return

        # Get validation config from challenge type
        min_length = 10  # default
        max_length = 2000  # default
        if battle.challenge_type:
            min_length = battle.challenge_type.min_submission_length
            max_length = battle.challenge_type.max_submission_length

        # Sanitize and validate prompt
        sanitized_prompt = sanitize_prompt(prompt_text, max_length=max_length)
        is_valid, error_message = validate_prompt_for_battle(
            sanitized_prompt,
            min_length=min_length,
            max_length=max_length,
            block_injections=True,
        )

        if not is_valid:
            await self._send_error(error_message)
            return

        # Check if user already submitted
        existing_submission = await self._get_user_submission(battle)
        if existing_submission:
            await self._send_error('You have already submitted')
            return

        # Create submission with sanitized prompt
        submission = await self._create_submission(battle, sanitized_prompt)

        # Notify opponent that this user submitted
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'battle_event',
                'event': 'opponent_status',
                'user_id': self.user.id,
                'status': 'submitted',
            },
        )

        # Send confirmation to this user
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'submission_confirmed',
                    'submission_id': submission.id,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

        # OPTIMIZATION: Start image generation immediately for this submission
        # Don't wait for opponent - this saves 5-15s in Pip battles since
        # Pip's image is already generating from battle start
        from core.battles.tasks import generate_submission_image_task

        generate_submission_image_task.delay(submission.id)
        logger.info(f'Started image generation immediately for submission {submission.id}')

        # For Pip battles, Pip's submission is already triggered at battle start
        # so we just need to check if both have submitted
        # For PvP battles, check if both users have submitted
        await self._check_both_submitted(battle)

    async def _check_both_connected(self):
        """Check if both users are connected and start countdown if so."""
        battle = await self._get_battle()
        if not battle:
            return

        # Check if both users are connected
        if not (battle.challenger_connected and battle.opponent_connected):
            return

        if battle.phase == BattlePhase.WAITING:
            # Both connected! Transition to countdown
            await self._transition_phase(BattlePhase.COUNTDOWN)

            # Broadcast countdown start
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'countdown_start',
                    'duration': COUNTDOWN_SECONDS,
                },
            )

            # Run countdown with ticks
            asyncio.create_task(self._run_countdown())

        elif battle.phase == BattlePhase.COUNTDOWN:
            # Battle is stuck in countdown (previous countdown task was interrupted)
            # Restart the countdown

            # Broadcast countdown start
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'countdown_start',
                    'duration': COUNTDOWN_SECONDS,
                },
            )

            # Run countdown with ticks
            asyncio.create_task(self._run_countdown())

    async def _run_countdown(self):
        """Run the countdown sequence and transition to active phase."""
        try:
            for i in range(COUNTDOWN_SECONDS, 0, -1):
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'battle_event',
                        'event': 'countdown_tick',
                        'value': i,
                    },
                )
                await asyncio.sleep(1)

            # Countdown complete - transition to active
            battle = await self._transition_phase(BattlePhase.ACTIVE)

            # Broadcast phase change to active
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'phase_change',
                    'phase': BattlePhase.ACTIVE,
                },
            )

            # Send updated battle state
            await self.send_battle_state()

            # For Pip battles, start generating Pip's submission immediately
            # This runs in parallel while user is crafting their prompt
            if battle:
                is_pip_battle = await self._is_pip_battle(battle)
                if is_pip_battle:
                    from core.battles.tasks import create_pip_submission_task

                    # Start immediately - no artificial delay
                    create_pip_submission_task.delay(battle.id)

            # Schedule timeout task for when battle duration expires
            if battle:
                from core.battles.tasks import handle_battle_timeout_task

                # Add 30s buffer for network latency
                timeout_seconds = (battle.duration_minutes * 60) + 30
                handle_battle_timeout_task.apply_async(
                    args=[self.battle_id],
                    countdown=timeout_seconds,
                )

        except Exception as e:
            logger.error(f'Error during countdown: {e}', exc_info=True)

    async def _check_both_submitted(self, battle: PromptBattle):
        """Check if both users have submitted and transition to generating phase."""
        from core.battles.tasks import generate_submission_image_task

        submissions = await self._get_all_submissions(battle)
        if len(submissions) >= 2:
            # Both submitted! Transition to generating phase
            await self._transition_phase(BattlePhase.GENERATING)

            # Broadcast phase change
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'phase_change',
                    'phase': BattlePhase.GENERATING,
                },
            )

            # Trigger AI image generation for all submissions
            for submission in submissions:
                if not submission.generated_output_url:
                    generate_submission_image_task.delay(submission.id)

    @database_sync_to_async
    def _get_battle(self) -> PromptBattle | None:
        """Get the battle instance."""
        try:
            return PromptBattle.objects.select_related('challenger', 'opponent', 'challenge_type').get(
                id=self.battle_id
            )
        except PromptBattle.DoesNotExist:
            return None

    @database_sync_to_async
    def _user_is_participant(self, battle: PromptBattle) -> bool:
        """Check if current user is a participant in the battle."""
        return self.user.id in [battle.challenger_id, battle.opponent_id]

    @database_sync_to_async
    def _set_user_connected(self, connected: bool):
        """Set the user's connection status in the battle using atomic update."""
        try:
            battle = PromptBattle.objects.get(id=self.battle_id)
            if self.user.id == battle.challenger_id:
                PromptBattle.objects.filter(id=self.battle_id).update(challenger_connected=connected)
            elif self.user.id == battle.opponent_id:
                PromptBattle.objects.filter(id=self.battle_id).update(opponent_connected=connected)
        except PromptBattle.DoesNotExist:
            pass

    @database_sync_to_async
    def _get_user_submission(self, battle: PromptBattle) -> BattleSubmission | None:
        """Get the current user's submission for this battle."""
        try:
            return BattleSubmission.objects.get(battle=battle, user=self.user)
        except BattleSubmission.DoesNotExist:
            return None

    @database_sync_to_async
    def _get_all_submissions(self, battle: PromptBattle) -> list[BattleSubmission]:
        """Get all submissions for this battle."""
        return list(BattleSubmission.objects.filter(battle=battle))

    @database_sync_to_async
    def _is_pip_battle(self, battle: PromptBattle) -> bool:
        """Check if this is a battle against Pip (AI opponent)."""
        return battle.match_source == MatchSource.AI_OPPONENT

    @database_sync_to_async
    def _create_submission(self, battle: PromptBattle, prompt_text: str) -> BattleSubmission:
        """Create a submission for the current user."""
        return BattleSubmission.objects.create(
            battle=battle,
            user=self.user,
            prompt_text=prompt_text,
            submission_type='image',  # MVP is image-first
        )

    @database_sync_to_async
    def _transition_phase(self, new_phase: str):
        """Transition battle to a new phase with validation and fresh DB fetch.

        Uses the state machine to validate transitions. Invalid transitions
        are logged but allowed in non-strict mode to prevent breaking existing
        battles during the migration period.
        """
        from core.battles.state_machine import validate_transition

        try:
            battle = PromptBattle.objects.get(id=self.battle_id)

            old_phase = battle.phase

            # Validate transition using state machine (strict=False during migration)
            # Warning is logged inside validate_transition if invalid
            # TODO: Set strict=True once all code paths are validated
            validate_transition(
                old_phase,
                new_phase,
                strict=False,  # Log warning but don't block
                battle_id=battle.id,
            )

            battle.phase = new_phase
            battle.phase_changed_at = timezone.now()

            # Set status to ACTIVE for any "start" phase (sync or async)
            # ACTIVE is for sync battles, CHALLENGER_TURN is for async battles
            if new_phase in (BattlePhase.ACTIVE, BattlePhase.CHALLENGER_TURN):
                battle.status = BattleStatus.ACTIVE
                if not battle.started_at:  # Don't overwrite if already set
                    battle.started_at = timezone.now()
                if not battle.expires_at:  # Don't overwrite if already set
                    battle.expires_at = battle.started_at + timedelta(minutes=battle.duration_minutes)
            elif new_phase == BattlePhase.COMPLETE:
                battle.status = BattleStatus.COMPLETED
                battle.completed_at = timezone.now()

            battle.save()

            logger.info(
                f'Battle {battle.id} phase transition: {old_phase} -> {new_phase}',
                extra={
                    'battle_id': battle.id,
                    'from_phase': old_phase,
                    'to_phase': new_phase,
                },
            )

            return battle
        except PromptBattle.DoesNotExist:
            return None

    @database_sync_to_async
    def _build_battle_state(self, battle: PromptBattle) -> dict:
        """Build the battle state dictionary for the client."""
        # Determine opponent (can be None for pending SMS invitations)
        if self.user.id == battle.challenger_id:
            opponent = battle.opponent
            my_connected = battle.challenger_connected
            opponent_connected = battle.opponent_connected
        else:
            opponent = battle.challenger
            my_connected = battle.opponent_connected
            opponent_connected = battle.challenger_connected

        # Get my submission if it exists
        my_submission = None
        try:
            sub = BattleSubmission.objects.get(battle=battle, user=self.user)
            my_submission = {
                'id': sub.id,
                'prompt_text': sub.prompt_text,
                'image_url': sub.generated_output_url,
                'score': sub.score,
                'criteria_scores': sub.criteria_scores,
                'feedback': sub.evaluation_feedback,
            }
        except BattleSubmission.DoesNotExist:
            pass

        # Get opponent submission if it exists (for reveal/complete phases)
        # Only try to get opponent submission if opponent is set
        opponent_submission = None
        if opponent and battle.phase in [BattlePhase.REVEAL, BattlePhase.COMPLETE]:
            try:
                opp_sub = BattleSubmission.objects.get(battle=battle, user=opponent)
                opponent_submission = {
                    'id': opp_sub.id,
                    'prompt_text': opp_sub.prompt_text,
                    'image_url': opp_sub.generated_output_url,
                    'score': opp_sub.score,
                    'criteria_scores': opp_sub.criteria_scores,
                    'feedback': opp_sub.evaluation_feedback,
                }
            except BattleSubmission.DoesNotExist:
                pass

        # Calculate time remaining using model's centralized method
        time_remaining = None
        remaining_seconds = battle.get_time_remaining_seconds()
        if remaining_seconds is not None:
            time_remaining = max(0, int(remaining_seconds))

        # Build opponent data (handle null opponent for pending SMS invitations)
        opponent_data = None
        if opponent:
            opponent_data = {
                'id': opponent.id,
                'username': opponent.username,
                'avatar_url': getattr(opponent, 'avatar_url', None),
                'connected': opponent_connected,
            }
        else:
            # Placeholder for pending invitation - opponent hasn't accepted yet
            opponent_data = {
                'id': 0,
                'username': 'Waiting for opponent...',
                'avatar_url': None,
                'connected': False,
            }

        # Get invite URL for invitation battles (so frontend can share the correct link)
        invite_url = None
        if battle.match_source == MatchSource.INVITATION:
            try:
                invitation = BattleInvitation.objects.get(battle=battle)
                invite_url = invitation.invite_url
            except BattleInvitation.DoesNotExist:
                pass

        return {
            'id': battle.id,
            'phase': battle.phase,
            'status': battle.status,
            'challenge_text': battle.challenge_text,
            'challenge_type': {
                'key': battle.challenge_type.key,
                'name': battle.challenge_type.name,
            }
            if battle.challenge_type
            else None,
            'duration_minutes': battle.duration_minutes,
            'time_remaining': time_remaining,
            'my_connected': my_connected,
            'opponent': opponent_data,
            'my_submission': my_submission,
            'opponent_submission': opponent_submission,
            'winner_id': battle.winner_id,
            'match_source': battle.match_source,
            'invite_url': invite_url,
        }

    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'error',
                    'error': message,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return timezone.now().isoformat()


class MatchmakingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for matchmaking queue.

    Handles:
    - Join queue (random or AI opponent)
    - Queue status updates
    - Match found notification
    - Queue timeout

    URL: ws/matchmaking/
    """

    async def connect(self):
        """Handle WebSocket connection for matchmaking."""
        self.user = self.scope.get('user')
        self.user_group = None

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'Matchmaking WebSocket from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning('Unauthenticated matchmaking WebSocket attempt')
            await self.close(code=4001)
            return

        # Create user-specific group for direct messages
        self.user_group = f'matchmaking_user_{self.user.id}'
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        await self.accept()

        logger.info(f'Matchmaking WebSocket connected: user={self.user.id}')

        # Send connection confirmation
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'connected',
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if self.user_group:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

        # Remove from queue on disconnect
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self._leave_queue()

        logger.info(
            f'Matchmaking WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, code={close_code}'
        )

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages from client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong', 'timestamp': self._get_timestamp()}))
                return

            elif message_type == 'join_queue':
                match_type = data.get('match_type', 'random')
                challenge_type_key = data.get('challenge_type')
                await self._handle_join_queue(match_type, challenge_type_key)

            elif message_type == 'leave_queue':
                await self._handle_leave_queue()

            elif message_type == 'queue_status':
                await self._send_queue_status()

        except json.JSONDecodeError:
            await self._send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f'Error processing matchmaking WebSocket message: {e}', exc_info=True)
            await self._send_error('Failed to process message')

    async def matchmaking_event(self, event: dict[str, Any]):
        """Receive matchmaking event from channel layer."""
        client_event = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(client_event))

    async def _handle_join_queue(self, match_type: str, challenge_type_key: str | None):
        """Handle user joining the matchmaking queue."""
        # Validate match type
        if match_type not in ['random', 'ai', 'active_user']:
            await self._send_error('Invalid match type')
            return

        # Handle active user matching - find someone who's online now
        if match_type == 'active_user':
            result = await self._find_active_user_match(challenge_type_key)
            if result:
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'match_found',
                            'battle_id': result['battle_id'],
                            'opponent': result['opponent'],
                            'timestamp': self._get_timestamp(),
                        }
                    )
                )
            else:
                # No active users available - fall back to queue
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'no_active_users',
                            'message': 'No active users available right now. Try again or battle Pip!',
                            'timestamp': self._get_timestamp(),
                        }
                    )
                )
            return

        # Handle AI opponent - instant match
        if match_type == 'ai':
            battle = await self._create_pip_battle(challenge_type_key)
            if battle:
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'match_found',
                            'battle_id': battle.id,
                            'opponent': {
                                'id': battle.opponent_id,
                                'username': 'Pip',
                                'is_ai': True,
                            },
                            'timestamp': self._get_timestamp(),
                        }
                    )
                )
            else:
                await self._send_error('Failed to create battle with Pip')
            return

        # Random matchmaking
        # First try to find an existing match
        match = await self._find_match(challenge_type_key)
        if match:
            # Match found! Notify this user
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'match_found',
                        'battle_id': match['battle_id'],
                        'opponent': match['opponent'],
                        'timestamp': self._get_timestamp(),
                    }
                )
            )
            return

        # No match found, add to queue
        queue_entry = await self._join_queue(challenge_type_key)
        if queue_entry:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'queue_joined',
                        'position': await self._get_queue_position(),
                        'expires_at': queue_entry.expires_at.isoformat(),
                        'timestamp': self._get_timestamp(),
                    }
                )
            )
        else:
            await self._send_error('Failed to join queue')

    async def _handle_leave_queue(self):
        """Handle user leaving the queue."""
        await self._leave_queue()
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'queue_left',
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    async def _send_queue_status(self):
        """Send current queue status to client."""
        queue_entry = await self._get_queue_entry()
        if queue_entry:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'queue_status',
                        'in_queue': True,
                        'position': await self._get_queue_position(),
                        'expires_at': queue_entry.expires_at.isoformat(),
                        'timestamp': self._get_timestamp(),
                    }
                )
            )
        else:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'queue_status',
                        'in_queue': False,
                        'timestamp': self._get_timestamp(),
                    }
                )
            )

    @database_sync_to_async
    def _join_queue(self, challenge_type_key: str | None) -> BattleMatchmakingQueue | None:
        """Add user to the matchmaking queue."""
        challenge_type = None
        if challenge_type_key:
            try:
                challenge_type = ChallengeType.objects.get(key=challenge_type_key, is_active=True)
            except ChallengeType.DoesNotExist:
                pass

        queue_entry, created = BattleMatchmakingQueue.objects.update_or_create(
            user=self.user,
            defaults={
                'match_type': MatchType.RANDOM,
                'challenge_type': challenge_type,
                'expires_at': timezone.now() + timedelta(minutes=5),
            },
        )
        return queue_entry

    @database_sync_to_async
    def _leave_queue(self):
        """Remove user from the matchmaking queue."""
        BattleMatchmakingQueue.objects.filter(user=self.user).delete()

    @database_sync_to_async
    def _get_queue_entry(self) -> BattleMatchmakingQueue | None:
        """Get user's current queue entry."""
        try:
            return BattleMatchmakingQueue.objects.get(user=self.user)
        except BattleMatchmakingQueue.DoesNotExist:
            return None

    @database_sync_to_async
    def _get_queue_position(self) -> int:
        """Get user's position in the queue."""
        try:
            queue_entry = BattleMatchmakingQueue.objects.get(user=self.user)
            return (
                BattleMatchmakingQueue.objects.filter(
                    match_type=MatchType.RANDOM,
                    queued_at__lt=queue_entry.queued_at,
                    expires_at__gt=timezone.now(),
                ).count()
                + 1
            )
        except BattleMatchmakingQueue.DoesNotExist:
            return 0

    @database_sync_to_async
    def _find_match_in_db(self, challenge_type_key: str | None) -> dict | None:
        """
        Try to find a match in the queue (DB operations only).

        Uses select_for_update to prevent race conditions where multiple
        users could match with the same queue entry simultaneously.
        """
        from django.db import transaction

        try:
            with transaction.atomic():
                # Find someone waiting in the queue (not ourselves)
                # Use select_for_update to lock the row and prevent race conditions
                queue_filter = {
                    'match_type': MatchType.RANDOM,
                    'expires_at__gt': timezone.now(),
                }

                queue_entry = (
                    BattleMatchmakingQueue.objects.select_for_update(
                        skip_locked=True
                    )  # Skip if already locked by another transaction
                    .filter(**queue_filter)
                    .exclude(user=self.user)
                    .order_by('queued_at')
                    .first()
                )

                if not queue_entry:
                    return None

                # Get or create a challenge type
                challenge_type = None
                if challenge_type_key:
                    try:
                        challenge_type = ChallengeType.objects.get(key=challenge_type_key, is_active=True)
                    except ChallengeType.DoesNotExist:
                        pass

                if not challenge_type and queue_entry.challenge_type:
                    challenge_type = queue_entry.challenge_type

                if not challenge_type:
                    # Get a random active challenge type
                    challenge_type = ChallengeType.objects.filter(is_active=True).order_by('?').first()

                if not challenge_type:
                    logger.warning('No active challenge types available for matchmaking')
                    return None

                # Generate challenge text
                challenge_text = challenge_type.generate_challenge()

                # Store matched user info before deleting
                matched_user_id = queue_entry.user.id
                matched_username = queue_entry.user.username

                # Remove matched user from queue BEFORE creating battle
                # This ensures atomicity - if battle creation fails, user stays in queue
                queue_entry.delete()

                # Create the battle
                battle = PromptBattle.objects.create(
                    challenger_id=matched_user_id,
                    opponent=self.user,
                    challenge_text=challenge_text,
                    challenge_type=challenge_type,
                    match_source=MatchSource.RANDOM,
                    duration_minutes=challenge_type.default_duration_minutes,
                    status=BattleStatus.PENDING,
                    phase=BattlePhase.WAITING,
                )

                logger.info(
                    f'Match created: battle={battle.id}, challenger={matched_user_id}, opponent={self.user.id}',
                    extra={
                        'battle_id': battle.id,
                        'challenger_id': matched_user_id,
                        'opponent_id': self.user.id,
                    },
                )

                return {
                    'battle_id': battle.id,
                    'matched_user_id': matched_user_id,
                    'opponent': {
                        'id': matched_user_id,
                        'username': matched_username,
                        'is_ai': False,
                    },
                }
        except Exception as e:
            logger.error(f'Error in matchmaking: {e}', exc_info=True)
            return None

    async def _find_match(self, challenge_type_key: str | None) -> dict | None:
        """Try to find a match and notify the other user."""
        result = await self._find_match_in_db(challenge_type_key)

        if result:
            # Notify the other user via their WebSocket (proper async call)
            other_user_group = f'matchmaking_user_{result["matched_user_id"]}'
            await self.channel_layer.group_send(
                other_user_group,
                {
                    'type': 'matchmaking_event',
                    'event': 'match_found',
                    'battle_id': result['battle_id'],
                    'opponent': {
                        'id': self.user.id,
                        'username': self.user.username,
                        'is_ai': False,
                    },
                },
            )

        return result

    @database_sync_to_async
    def _create_pip_battle(self, challenge_type_key: str | None) -> PromptBattle | None:
        """Create an instant battle against Pip (AI opponent)."""
        try:
            from core.users.models import UserRole

            pip = User.objects.get(username='pip', role=UserRole.AGENT)
        except User.DoesNotExist:
            logger.error('Pip user not found')
            return None

        # Get challenge type
        challenge_type = None
        if challenge_type_key:
            try:
                challenge_type = ChallengeType.objects.get(key=challenge_type_key, is_active=True)
            except ChallengeType.DoesNotExist:
                pass

        if not challenge_type:
            challenge_type = ChallengeType.objects.filter(is_active=True).order_by('?').first()

        if not challenge_type:
            logger.error('No active challenge types found')
            return None

        # Generate challenge
        challenge_text = challenge_type.generate_challenge()

        # Create battle
        battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=pip,
            challenge_text=challenge_text,
            challenge_type=challenge_type,
            match_source=MatchSource.AI_OPPONENT,
            duration_minutes=challenge_type.default_duration_minutes,
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            opponent_connected=True,  # Pip is always "connected"
        )

        return battle

    @database_sync_to_async
    def _find_active_user_in_db(self, challenge_type_key: str | None) -> dict | None:
        """
        Find an active user to match with.

        An active user is:
        - Seen within the last 5 minutes
        - Available for battles (is_available_for_battles=True)
        - Not currently in an active battle
        - Not ourselves
        """
        from django.db.models import Q

        from core.battles.models import BattleInvitation, InvitationType
        from core.users.models import UserRole

        # Users seen in last 5 minutes, available for battles
        active_threshold = timezone.now() - timedelta(minutes=5)

        # Find active users who aren't in a battle
        active_users = (
            User.objects.filter(
                last_seen_at__gte=active_threshold,
                is_available_for_battles=True,
            )
            .exclude(id=self.user.id)  # Not ourselves
            .exclude(role=UserRole.AGENT)  # Not AI agents like Pip
            .exclude(
                # Not in an active battle as challenger
                Q(battles_as_challenger__status__in=[BattleStatus.PENDING, BattleStatus.ACTIVE])
            )
            .exclude(
                # Not in an active battle as opponent
                Q(battles_as_opponent__status__in=[BattleStatus.PENDING, BattleStatus.ACTIVE])
            )
            .order_by('-last_seen_at')  # Most recently active first
        )

        if not active_users.exists():
            return None

        # Get a random active user (to avoid always matching with same person)
        import secrets

        active_list = list(active_users[:10])  # Limit to 10 candidates
        matched_user = secrets.choice(active_list)

        # Get or create a challenge type
        challenge_type = None
        if challenge_type_key:
            try:
                challenge_type = ChallengeType.objects.get(key=challenge_type_key, is_active=True)
            except ChallengeType.DoesNotExist:
                pass

        if not challenge_type:
            challenge_type = ChallengeType.objects.filter(is_active=True).order_by('?').first()

        if not challenge_type:
            logger.warning('No active challenge types available')
            return None

        # Generate challenge
        challenge_text = challenge_type.generate_challenge()

        # Create the battle (opponent not set yet - will be set when they accept)
        battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=None,  # Set when invitation is accepted
            challenge_text=challenge_text,
            challenge_type=challenge_type,
            match_source=MatchSource.RANDOM,
            duration_minutes=challenge_type.default_duration_minutes,
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
        )

        # Create invitation for the matched user to accept/decline
        invitation = BattleInvitation.objects.create(
            battle=battle,
            sender=self.user,
            recipient=matched_user,
            invitation_type=InvitationType.RANDOM,
            status='pending',
        )

        logger.info(
            f'Active user match created: battle={battle.id}, challenger={self.user.id}, invited={matched_user.id}',
            extra={
                'battle_id': battle.id,
                'challenger_id': self.user.id,
                'invited_user_id': matched_user.id,
                'invitation_id': invitation.id,
                'match_type': 'active_user',
            },
        )

        return {
            'battle_id': battle.id,
            'invitation_id': invitation.id,
            'matched_user_id': matched_user.id,
            'challenge_preview': challenge_text[:100] if challenge_text else '',
            'opponent': {
                'id': matched_user.id,
                'username': matched_user.username,
                'is_ai': False,
            },
        }

    async def _find_active_user_match(self, challenge_type_key: str | None) -> dict | None:
        """Find an active user and notify them of the match."""
        result = await self._find_active_user_in_db(challenge_type_key)

        if result:
            # Notify the matched user via battle notification WebSocket
            # This sends to their BattleNotificationConsumer
            notification_group = f'battle_notifications_{result["matched_user_id"]}'
            await self.channel_layer.group_send(
                notification_group,
                {
                    'type': 'battle_notification',
                    'event': 'battle_invitation',
                    'invitation_id': result.get('invitation_id'),
                    'battle_id': result['battle_id'],
                    'challenger': {
                        'id': self.user.id,
                        'username': self.user.username,
                        'avatar_url': getattr(self.user, 'avatar_url', None),
                    },
                    'challenge_preview': result.get('challenge_preview', ''),
                    'message': f'{self.user.username} wants to battle you!',
                },
            )

        return result

    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'error',
                    'error': message,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return timezone.now().isoformat()


class BattleNotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time battle notifications.

    Users connect to this when logged in to receive battle invitations
    from other users looking for opponents. This enables the "find opponent"
    feature to notify active, available users.

    URL: ws/battle-notifications/

    Events sent to client:
    - connected: Connection confirmed
    - battle_invitation: Someone wants to battle you
    - invitation_cancelled: Invitation was cancelled/expired
    - pong: Response to ping
    """

    async def connect(self):
        """Handle WebSocket connection for notifications."""
        self.user = self.scope.get('user')
        self.user_group = None

        # Extract connection info for debugging
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()
        host = headers.get(b'host', b'').decode()
        user_agent = headers.get(b'user-agent', b'').decode()[:100]  # Truncate UA

        logger.info(
            f'[BattleNotifications] Connect attempt: '
            f'origin={origin!r}, host={host!r}, '
            f'user={getattr(self.user, "id", "anonymous")}, '
            f'is_authenticated={getattr(self.user, "is_authenticated", False)}, '
            f'user_agent={user_agent!r}'
        )

        # Validate origin to prevent CSRF attacks
        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        logger.info(f'[BattleNotifications] CORS check: allowed_origins={allowed_origins}')

        if origin and origin not in allowed_origins:
            logger.warning(
                f'[BattleNotifications] REJECTED - unauthorized origin: origin={origin!r}, allowed={allowed_origins}'
            )
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(
                f'[BattleNotifications] REJECTED - unauthenticated: '
                f'user_type={type(self.user).__name__}, origin={origin!r}'
            )
            await self.close(code=4001)
            return

        # Check if user is available for battles
        is_available = await self._is_user_available()
        logger.info(f'[BattleNotifications] User {self.user.id} availability check: {is_available}')

        # Create user-specific group for receiving notifications
        self.user_group = f'battle_notifications_{self.user.id}'
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        logger.info(f'[BattleNotifications] Added to group: {self.user_group}')

        # Also add to general "available users" group if they opted in
        if is_available:
            await self.channel_layer.group_add('battle_available_users', self.channel_name)
            logger.info('[BattleNotifications] Added to battle_available_users group')

        await self.accept()

        logger.info(
            f'[BattleNotifications] CONNECTED: user={self.user.id}, '
            f'available={is_available}, channel={self.channel_name}'
        )

        # Send connection confirmation
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'connected',
                    'is_available': is_available,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        logger.info(
            f'[BattleNotifications] DISCONNECTING: '
            f'user={getattr(self.user, "id", "unknown")}, '
            f'code={close_code}, '
            f'code_description={self._get_close_code_description(close_code)}'
        )

        if self.user_group:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            logger.info(f'[BattleNotifications] Removed from group: {self.user_group}')

        # Remove from available users group
        await self.channel_layer.group_discard('battle_available_users', self.channel_name)

        logger.info(
            f'[BattleNotifications] DISCONNECTED: user={getattr(self.user, "id", "unknown")}, code={close_code}'
        )

    def _get_close_code_description(self, code: int) -> str:
        """Get human-readable description for WebSocket close codes."""
        descriptions = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1005: 'No status received',
            1006: 'Abnormal closure',
            1007: 'Invalid frame payload',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal error',
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failure',
            4001: 'Authentication required',
            4003: 'Origin not allowed',
            4004: 'Resource not found',
        }
        return descriptions.get(code, f'Unknown code {code}')

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            logger.debug(
                f'[BattleNotifications] Received message: '
                f'type={message_type}, user={getattr(self.user, "id", "unknown")}'
            )

            if message_type == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong', 'timestamp': self._get_timestamp()}))

            elif message_type == 'update_availability':
                # User toggled their availability
                is_available = data.get('is_available', False)
                logger.info(
                    f'[BattleNotifications] Availability update request: '
                    f'user={self.user.id}, is_available={is_available}'
                )
                await self._handle_availability_update(is_available)

            elif message_type == 'respond_to_invitation':
                # User responding to a battle invitation
                invitation_id = data.get('invitation_id')
                response = data.get('response')  # 'accept' or 'decline'
                logger.info(
                    f'[BattleNotifications] Invitation response: '
                    f'user={self.user.id}, invitation_id={invitation_id}, response={response}'
                )
                await self._handle_invitation_response(invitation_id, response)

            else:
                logger.warning(
                    f'[BattleNotifications] Unknown message type: '
                    f'type={message_type}, user={getattr(self.user, "id", "unknown")}'
                )

        except json.JSONDecodeError as e:
            logger.warning(
                f'[BattleNotifications] Invalid JSON: '
                f'user={getattr(self.user, "id", "unknown")}, error={e}, data={text_data[:100]}'
            )
            await self._send_error('Invalid JSON format')
        except Exception as e:
            logger.error(
                f'[BattleNotifications] Error processing message: '
                f'user={getattr(self.user, "id", "unknown")}, error={e}',
                exc_info=True,
            )
            await self._send_error('Failed to process message')

    async def battle_notification(self, event: dict[str, Any]):
        """Receive battle notification event from channel layer."""
        # Forward to client (remove internal 'type' field)
        client_event = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(client_event))

    @database_sync_to_async
    def _is_user_available(self) -> bool:
        """Check if user is available for battles."""
        return User.objects.filter(
            id=self.user.id,
            is_available_for_battles=True,
        ).exists()

    async def _handle_availability_update(self, is_available: bool):
        """Handle user toggling their availability."""
        # Update in database
        await self._update_availability_in_db(is_available)

        # Update group membership
        if is_available:
            await self.channel_layer.group_add('battle_available_users', self.channel_name)
        else:
            await self.channel_layer.group_discard('battle_available_users', self.channel_name)

        # Confirm to client
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'availability_updated',
                    'is_available': is_available,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    @database_sync_to_async
    def _update_availability_in_db(self, is_available: bool):
        """Update user's availability in database."""
        User.objects.filter(id=self.user.id).update(is_available_for_battles=is_available)

    async def _handle_invitation_response(self, invitation_id: int, response: str):
        """Handle user accepting or declining a battle invitation."""
        if response not in ['accept', 'decline']:
            await self._send_error('Invalid response. Must be "accept" or "decline".')
            return

        result = await self._process_invitation_response(invitation_id, response)

        if result.get('error'):
            await self._send_error(result['error'])
        else:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'invitation_response_processed',
                        'invitation_id': invitation_id,
                        'response': response,
                        'battle_id': result.get('battle_id'),
                        'timestamp': self._get_timestamp(),
                    }
                )
            )

            # If accepted, notify the challenger
            if response == 'accept' and result.get('challenger_id'):
                challenger_group = f'battle_notifications_{result["challenger_id"]}'
                await self.channel_layer.group_send(
                    challenger_group,
                    {
                        'type': 'battle_notification',
                        'event': 'invitation_accepted',
                        'battle_id': result['battle_id'],
                        'opponent': {
                            'id': self.user.id,
                            'username': self.user.username,
                        },
                        'timestamp': self._get_timestamp(),
                    },
                )

    @database_sync_to_async
    def _process_invitation_response(self, invitation_id: int, response: str) -> dict:
        """Process invitation accept/decline in database.

        Uses the model's accept()/decline() methods to ensure consistent
        state machine transitions and proper atomic transaction handling.
        """
        from django.core.exceptions import ValidationError

        from core.battles.models import BattleInvitation, InvitationStatus

        try:
            # Fetch invitation (locking happens inside accept/decline methods)
            invitation = BattleInvitation.objects.select_related('battle', 'sender').get(
                id=invitation_id,
                recipient=self.user,
            )
        except BattleInvitation.DoesNotExist:
            return {'error': 'Invitation not found.'}

        # Check status before attempting operation (accept/decline will re-verify with lock)
        if invitation.status != InvitationStatus.PENDING:
            return {'error': 'Invitation has already been responded to.'}

        if invitation.is_expired:
            return {'error': 'Invitation has expired.'}

        battle = invitation.battle

        if response == 'accept':
            try:
                # Use model's accept() method for consistent state machine and atomic transaction
                # For platform invitations, the recipient is already set, so pass self.user
                invitation.accept(accepting_user=self.user)
                battle.refresh_from_db()

                return {
                    'battle_id': battle.id,
                    'challenger_id': invitation.sender.id,
                }
            except ValidationError as e:
                return {'error': str(e.message if hasattr(e, 'message') else e)}
        else:
            try:
                # Use model's decline() method for consistent state machine
                invitation.decline()

                return {
                    'declined': True,
                    'challenger_id': invitation.sender.id,
                }
            except ValidationError as e:
                return {'error': str(e.message if hasattr(e, 'message') else e)}

    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'error',
                    'error': message,
                    'timestamp': self._get_timestamp(),
                }
            )
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return timezone.now().isoformat()
