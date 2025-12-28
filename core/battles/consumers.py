"""
WebSocket Consumers for Prompt Battles

Handles real-time battle communication:
- BattleConsumer: Real-time battle events during a match
- MatchmakingConsumer: Queue management and match finding
"""

import asyncio
import json
import logging
import uuid
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
    MatchSource,
    MatchType,
    PromptBattle,
    PromptChallengePrompt,
)
from core.battles.utils import sanitize_prompt, validate_prompt_for_battle
from core.users.models import User

logger = logging.getLogger(__name__)


def _generate_trace_id() -> str:
    """Generate a short trace ID for request tracing."""
    return uuid.uuid4().hex[:8]


def _log_battle_event(
    trace_id: str,
    event: str,
    battle_id: int | str,
    user_id: int | str | None = None,
    phase: str | None = None,
    extra: dict | None = None,
    level: str = 'info',
) -> None:
    """
    Structured logging for battle events with trace ID.

    Args:
        trace_id: Unique identifier for tracing the request flow
        event: Event name (e.g., 'ws_connect', 'submit_prompt', 'phase_change')
        battle_id: Battle ID
        user_id: User ID (if applicable)
        phase: Current battle phase (if applicable)
        extra: Additional context data
        level: Log level ('debug', 'info', 'warning', 'error')
    """
    log_data = {
        'trace_id': trace_id,
        'event': event,
        'battle_id': battle_id,
    }
    if user_id is not None:
        log_data['user_id'] = user_id
    if phase is not None:
        log_data['phase'] = phase
    if extra:
        log_data.update(extra)

    message = f'[BATTLE:{trace_id}] {event} | battle={battle_id}'
    if user_id:
        message += f' user={user_id}'
    if phase:
        message += f' phase={phase}'
    if extra:
        extra_str = ' '.join(f'{k}={v}' for k, v in extra.items())
        message += f' | {extra_str}'

    log_fn = getattr(logger, level)
    log_fn(message, extra=log_data)


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
        self.trace_id = _generate_trace_id()

        _log_battle_event(
            self.trace_id,
            'ws_connect_start',
            self.battle_id,
            user_id=getattr(self.user, 'id', None),
            extra={'channel': self.channel_name},
        )

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            _log_battle_event(
                self.trace_id,
                'ws_connect_rejected',
                self.battle_id,
                extra={'reason': 'unauthorized_origin', 'origin': origin},
                level='warning',
            )
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            _log_battle_event(
                self.trace_id,
                'ws_connect_rejected',
                self.battle_id,
                extra={'reason': 'unauthenticated'},
                level='warning',
            )
            await self.close(code=4001)
            return

        # Validate battle access
        battle = await self._get_battle()
        if not battle:
            _log_battle_event(
                self.trace_id,
                'ws_connect_rejected',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'battle_not_found'},
                level='warning',
            )
            await self.close(code=4004)
            return

        _log_battle_event(
            self.trace_id,
            'ws_connect_battle_found',
            self.battle_id,
            user_id=self.user.id,
            phase=battle.phase,
            extra={
                'status': battle.status,
                'challenger_id': battle.challenger_id,
                'opponent_id': battle.opponent_id,
                'match_source': battle.match_source,
                'challenger_connected': battle.challenger_connected,
                'opponent_connected': battle.opponent_connected,
            },
        )

        if not await self._user_is_participant(battle):
            _log_battle_event(
                self.trace_id,
                'ws_connect_rejected',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'not_participant'},
                level='warning',
            )
            await self.close(code=4003)
            return

        # Join battle group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Mark user as connected
        await self._set_user_connected(True)

        is_challenger = self.user.id == battle.challenger_id
        _log_battle_event(
            self.trace_id,
            'ws_connect_success',
            self.battle_id,
            user_id=self.user.id,
            phase=battle.phase,
            extra={
                'is_challenger': is_challenger,
                'group': self.group_name,
            },
        )

        # Send initial state
        await self.send_battle_state()

        # Check if both users are now connected
        await self._check_both_connected()

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        _log_battle_event(
            trace_id,
            'ws_disconnect',
            getattr(self, 'battle_id', 'unknown'),
            user_id=getattr(self.user, 'id', None) if hasattr(self, 'user') else None,
            extra={'close_code': close_code},
        )

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

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages from client."""
        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong', 'timestamp': self._get_timestamp()}))
                return

            _log_battle_event(
                trace_id,
                f'ws_receive_{message_type}',
                self.battle_id,
                user_id=getattr(self.user, 'id', None),
                extra={'message_type': message_type},
                level='debug',
            )

            # Verify user is still authenticated for all non-ping messages
            if not self.user or not self.user.is_authenticated:
                _log_battle_event(
                    trace_id,
                    'ws_receive_error',
                    self.battle_id,
                    extra={'reason': 'not_authenticated', 'message_type': message_type},
                    level='warning',
                )
                await self._send_error('Authentication required')
                await self.close(code=4001)
                return

            # Verify user is still a participant in this battle for state-changing actions
            if message_type in ('typing', 'submit_prompt'):
                battle = await self._get_battle()
                if not battle or not await self._user_is_participant(battle):
                    _log_battle_event(
                        trace_id,
                        'ws_receive_error',
                        self.battle_id,
                        user_id=self.user.id,
                        extra={'reason': 'not_authorized', 'message_type': message_type},
                        level='warning',
                    )
                    await self._send_error('Not authorized for this battle')
                    return

            if message_type == 'typing':
                is_typing = data.get('is_typing', False)
                _log_battle_event(
                    trace_id,
                    'typing_indicator',
                    self.battle_id,
                    user_id=self.user.id,
                    extra={'is_typing': is_typing},
                    level='debug',
                )

                # Broadcast typing status to opponent
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'battle_event',
                        'event': 'opponent_status',
                        'user_id': self.user.id,
                        'status': 'typing' if is_typing else 'idle',
                    },
                )

                # For Pip battles: trigger Pip's submission on first typing event
                # This ensures Pip uses the current challenge (after any refreshes)
                # and generates in parallel while user types
                if is_typing:
                    battle = await self._get_battle()
                    if battle:
                        await self._maybe_trigger_pip_submission(battle)

            elif message_type == 'submit_prompt':
                prompt_text = data.get('prompt_text', '').strip()
                _log_battle_event(
                    trace_id,
                    'submit_prompt_received',
                    self.battle_id,
                    user_id=self.user.id,
                    extra={'prompt_length': len(prompt_text)},
                )
                if prompt_text:
                    await self._handle_submission(prompt_text)
                else:
                    _log_battle_event(
                        trace_id,
                        'submit_prompt_error',
                        self.battle_id,
                        user_id=self.user.id,
                        extra={'reason': 'empty_prompt'},
                        level='warning',
                    )

            elif message_type == 'request_state':
                _log_battle_event(
                    trace_id,
                    'request_state',
                    self.battle_id,
                    user_id=self.user.id,
                    level='debug',
                )
                await self.send_battle_state()

        except json.JSONDecodeError:
            _log_battle_event(
                trace_id,
                'ws_receive_error',
                self.battle_id,
                extra={'reason': 'invalid_json'},
                level='warning',
            )
            await self._send_error('Invalid JSON format')
        except Exception as e:
            _log_battle_event(
                trace_id,
                'ws_receive_error',
                self.battle_id,
                user_id=getattr(self.user, 'id', None),
                extra={'reason': 'exception', 'error': str(e)},
                level='error',
            )
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

    async def send_state_to_group(self, event: dict[str, Any]):
        """
        Handler for group broadcast to send updated state to all clients.

        Called when phase changes and all connected clients need updated state.
        Each client gets their own personalized state (e.g., is_my_turn differs).
        """
        await self.send_battle_state()

    async def _handle_submission(self, prompt_text: str):
        """Handle a user submitting their prompt."""
        from core.battles.phase_utils import can_submit_prompt

        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        battle = await self._get_battle()
        if not battle:
            _log_battle_event(
                trace_id,
                'submit_error',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'battle_not_found'},
                level='error',
            )
            await self._send_error('Battle not found')
            return

        _log_battle_event(
            trace_id,
            'submit_validation_start',
            self.battle_id,
            user_id=self.user.id,
            phase=battle.phase,
            extra={
                'prompt_length': len(prompt_text),
                'match_source': battle.match_source,
            },
        )

        # Use centralized submission validation
        can_submit_result = await database_sync_to_async(lambda: can_submit_prompt(battle, self.user))()

        if not can_submit_result:
            _log_battle_event(
                trace_id,
                'submit_validation_failed',
                self.battle_id,
                user_id=self.user.id,
                phase=battle.phase,
                extra={'reason': can_submit_result.error or 'unknown'},
                level='warning',
            )
            await self._send_error(can_submit_result.error or 'Cannot submit')
            return

        # Validation config - use standard defaults
        min_length = 10
        max_length = 2000

        # Sanitize and validate prompt
        sanitized_prompt = sanitize_prompt(prompt_text, max_length=max_length)
        is_valid, error_message = validate_prompt_for_battle(
            sanitized_prompt,
            min_length=min_length,
            max_length=max_length,
            block_injections=True,
        )

        if not is_valid:
            _log_battle_event(
                trace_id,
                'submit_validation_failed',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'prompt_invalid', 'error': error_message},
                level='warning',
            )
            await self._send_error(error_message)
            return

        # Prevent copy-pasting the challenge text exactly
        submitted_normalized = sanitized_prompt.strip().lower()
        challenge_normalized = (battle.challenge_text or '').strip().lower()
        is_copy_paste = submitted_normalized == challenge_normalized

        _log_battle_event(
            trace_id,
            'submit_copy_paste_check',
            self.battle_id,
            user_id=self.user.id,
            extra={'is_copy_paste': is_copy_paste},
            level='debug',
        )

        if is_copy_paste:
            _log_battle_event(
                trace_id,
                'submit_validation_failed',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'copy_paste_detected'},
                level='warning',
            )
            await self._send_error(
                'Come on, be more creative than that! ' 'Write your own unique prompt instead of copying the challenge.'
            )
            return

        # Check if user already submitted
        existing_submission = await self._get_user_submission(battle)
        if existing_submission:
            _log_battle_event(
                trace_id,
                'submit_validation_failed',
                self.battle_id,
                user_id=self.user.id,
                extra={'reason': 'already_submitted', 'existing_submission_id': existing_submission.id},
                level='warning',
            )
            await self._send_error('You have already submitted')
            return

        # Create submission with sanitized prompt
        submission = await self._create_submission(battle, sanitized_prompt)

        _log_battle_event(
            trace_id,
            'submission_created',
            self.battle_id,
            user_id=self.user.id,
            phase=battle.phase,
            extra={
                'submission_id': submission.id,
                'prompt_length': len(sanitized_prompt),
            },
        )

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

        # Use unique task_id to prevent duplicate queueing from multiple code paths
        task_id = f'image_gen_battle_{battle.id}_sub_{submission.id}'
        generate_submission_image_task.apply_async(
            args=[submission.id],
            task_id=task_id,  # Unique ID prevents duplicate tasks
            expires=600,  # Expire after 10 min if not picked up (user likely left)
        )

        _log_battle_event(
            trace_id,
            'image_generation_queued',
            self.battle_id,
            user_id=self.user.id,
            extra={'submission_id': submission.id, 'task_id': task_id},
        )

        # For async turn-based battles, transition to opponent's turn when challenger submits
        if battle.phase == BattlePhase.CHALLENGER_TURN and self.user.id == battle.challenger_id:
            _log_battle_event(
                trace_id,
                'phase_transition_start',
                self.battle_id,
                user_id=self.user.id,
                phase=battle.phase,
                extra={'target_phase': BattlePhase.OPPONENT_TURN},
            )

            await self._transition_phase(BattlePhase.OPPONENT_TURN)

            # Broadcast phase change so opponent knows it's their turn
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'battle_event',
                    'event': 'phase_change',
                    'phase': BattlePhase.OPPONENT_TURN,
                },
            )

            # Send updated state to all connected clients
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'send_state_to_group',
                },
            )

            _log_battle_event(
                trace_id,
                'phase_transition_complete',
                self.battle_id,
                user_id=self.user.id,
                phase=BattlePhase.OPPONENT_TURN,
            )

        # For Pip battles, Pip's submission is already triggered at battle start
        # so we just need to check if both have submitted
        # For PvP battles, check if both users have submitted
        await self._check_both_submitted(battle)

    async def _check_both_connected(self):
        """Check if both users are connected and start countdown if so."""
        trace_id = getattr(self, 'trace_id', _generate_trace_id())
        battle = await self._get_battle()
        if not battle:
            return

        _log_battle_event(
            trace_id,
            'check_both_connected',
            battle.id,
            phase=battle.phase,
            extra={
                'match_source': battle.match_source,
                'challenger_connected': battle.challenger_connected,
                'opponent_connected': battle.opponent_connected,
            },
        )

        # Check if both users are connected
        if not (battle.challenger_connected and battle.opponent_connected):
            _log_battle_event(
                trace_id,
                'check_both_connected_waiting',
                battle.id,
                phase=battle.phase,
                extra={
                    'reason': 'not_both_connected',
                    'challenger_connected': battle.challenger_connected,
                    'opponent_connected': battle.opponent_connected,
                },
                level='debug',
            )
            return

        if battle.phase == BattlePhase.WAITING:
            _log_battle_event(
                trace_id,
                'starting_countdown',
                battle.id,
                phase=battle.phase,
                extra={'countdown_seconds': COUNTDOWN_SECONDS},
            )

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
            _log_battle_event(
                trace_id,
                'restarting_countdown',
                battle.id,
                phase=battle.phase,
                extra={'reason': 'countdown_stuck'},
                level='warning',
            )

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
        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        _log_battle_event(
            trace_id,
            'countdown_start',
            self.battle_id,
            extra={'countdown_seconds': COUNTDOWN_SECONDS},
        )

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

            _log_battle_event(
                trace_id,
                'countdown_complete',
                self.battle_id,
                extra={'transitioning_to': BattlePhase.ACTIVE},
            )

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

            # NOTE: Pip submission is NOT triggered here anymore.
            # It's triggered when the user starts typing (first keystroke).
            # This allows users to refresh the challenge without wasting tokens.

            # Schedule timeout task for when battle duration expires
            if battle:
                from core.battles.tasks import handle_battle_timeout_task

                # Add 30s buffer for network latency
                timeout_seconds = (battle.duration_minutes * 60) + 30

                _log_battle_event(
                    trace_id,
                    'timeout_task_scheduled',
                    self.battle_id,
                    phase=BattlePhase.ACTIVE,
                    extra={
                        'timeout_seconds': timeout_seconds,
                        'duration_minutes': battle.duration_minutes,
                    },
                )

                handle_battle_timeout_task.apply_async(
                    args=[self.battle_id],
                    countdown=timeout_seconds,
                    expires=timeout_seconds + 600,  # Expire 10 min after timeout
                )

        except Exception as e:
            _log_battle_event(
                trace_id,
                'countdown_error',
                self.battle_id,
                extra={'error': str(e)},
                level='error',
            )
            logger.error(f'Error during countdown: {e}', exc_info=True)

    async def _check_both_submitted(self, battle: PromptBattle):
        """Check if both users have submitted and transition to generating phase."""
        from core.battles.tasks import generate_submission_image_task

        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        submissions = await self._get_all_submissions(battle)
        submission_count = len(submissions)

        _log_battle_event(
            trace_id,
            'check_both_submitted',
            battle.id,
            phase=battle.phase,
            extra={
                'submission_count': submission_count,
                'submission_ids': [s.id for s in submissions],
            },
        )

        if submission_count >= 2:
            _log_battle_event(
                trace_id,
                'both_submitted_transitioning',
                battle.id,
                phase=battle.phase,
                extra={
                    'target_phase': BattlePhase.GENERATING,
                    'submission_ids': [s.id for s in submissions],
                },
            )

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
            # Use unique task_id to prevent duplicate queueing from multiple code paths
            for submission in submissions:
                if not submission.generated_output_url:
                    task_id = f'image_gen_battle_{battle.id}_sub_{submission.id}'
                    _log_battle_event(
                        trace_id,
                        'image_generation_queued_fallback',
                        battle.id,
                        extra={
                            'submission_id': submission.id,
                            'user_id': submission.user_id,
                            'reason': 'both_submitted',
                            'task_id': task_id,
                        },
                    )
                    generate_submission_image_task.apply_async(
                        args=[submission.id],
                        task_id=task_id,  # Unique ID prevents duplicate tasks
                        expires=600,  # Expire after 10 min if not picked up
                    )
                else:
                    _log_battle_event(
                        trace_id,
                        'image_generation_already_complete',
                        battle.id,
                        extra={
                            'submission_id': submission.id,
                            'user_id': submission.user_id,
                            'image_url': submission.generated_output_url[:50]
                            if submission.generated_output_url
                            else None,
                        },
                        level='debug',
                    )
        else:
            _log_battle_event(
                trace_id,
                'waiting_for_second_submission',
                battle.id,
                phase=battle.phase,
                extra={'current_submissions': submission_count},
                level='debug',
            )

    @database_sync_to_async
    def _get_battle(self) -> PromptBattle | None:
        """Get the battle instance."""
        try:
            return PromptBattle.objects.select_related('challenger', 'opponent', 'prompt', 'prompt__category').get(
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

    # =========================================================================
    # PIP (AI OPPONENT) METHODS
    #
    # ⚠️  CAUTION: FRAGILE CODE - DO NOT MODIFY WITHOUT CAREFUL TESTING ⚠️
    #
    # The Pip battle flow is complex and involves multiple async tasks,
    # WebSocket events, and database state changes. Modifications can easily
    # break the battle flow in subtle ways that are hard to debug.
    #
    # Before making changes:
    # 1. Run ALL battle tests: `make test-backend`
    # 2. Test manually with a real Pip battle from start to finish
    # 3. Check WebSocket events are firing correctly in browser devtools
    #
    # See also: services.py PipBattleAI, tasks.py create_pip_submission_task
    # =========================================================================

    @database_sync_to_async
    def _is_pip_battle(self, battle: PromptBattle) -> bool:
        """Check if this is a battle against Pip (AI opponent)."""
        return battle.match_source == MatchSource.AI_OPPONENT

    async def _maybe_trigger_pip_submission(self, battle: PromptBattle):
        """Trigger Pip's submission creation if this is a Pip battle and Pip hasn't started yet.

        Called on first typing event to ensure:
        1. Pip uses the current challenge (after any refreshes by user)
        2. Pip generates in parallel while user types (no wait after submit)
        3. Tokens aren't wasted on refreshed challenges
        """
        trace_id = getattr(self, 'trace_id', _generate_trace_id())

        # Only for Pip battles
        is_pip_battle = await self._is_pip_battle(battle)
        if not is_pip_battle:
            _log_battle_event(
                trace_id,
                'pip_submission_skip',
                battle.id,
                phase=battle.phase,
                extra={'reason': 'not_pip_battle', 'match_source': battle.match_source},
                level='debug',
            )
            return

        # Check if Pip already has a submission (don't trigger twice)
        pip_submission_exists = await self._pip_has_submission(battle)
        if pip_submission_exists:
            _log_battle_event(
                trace_id,
                'pip_submission_skip',
                battle.id,
                phase=battle.phase,
                extra={'reason': 'already_exists'},
                level='debug',
            )
            return

        _log_battle_event(
            trace_id,
            'pip_submission_trigger',
            battle.id,
            user_id=self.user.id,
            phase=battle.phase,
            extra={
                'challenge_text_length': len(battle.challenge_text or ''),
                'trigger': 'user_typing',
            },
        )

        # Trigger Pip's submission creation
        from core.battles.tasks import create_pip_submission_task

        create_pip_submission_task.apply_async(
            args=[battle.id],
            expires=600,  # Expire after 10 min if not picked up
        )

        _log_battle_event(
            trace_id,
            'pip_submission_task_queued',
            battle.id,
            user_id=self.user.id,
            phase=battle.phase,
        )

    @database_sync_to_async
    def _pip_has_submission(self, battle: PromptBattle) -> bool:
        """Check if Pip already has a submission for this battle."""
        from core.users.models import User

        pip_user = User.objects.filter(username='pip').first()
        if not pip_user:
            return False
        return BattleSubmission.objects.filter(battle=battle, user=pip_user).exists()

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

        # Get invitation data for invitation battles (friend name, invite URL)
        invite_url = None
        friend_name = None
        if battle.match_source == MatchSource.INVITATION:
            try:
                invitation = BattleInvitation.objects.get(battle=battle)
                invite_url = invitation.invite_url
                friend_name = invitation.recipient_name or None
            except BattleInvitation.DoesNotExist:
                pass

        # Build opponent data (handle null opponent for pending SMS invitations)
        opponent_data = None
        is_challenger = self.user.id == battle.challenger_id
        if opponent:
            # Use friend_name as display_name if set by challenger (and viewer is challenger)
            display_name = opponent.username
            if is_challenger and friend_name:
                display_name = friend_name

            opponent_data = {
                'id': opponent.id,
                'username': display_name,
                'avatar_url': getattr(opponent, 'avatar_url', None),
                'connected': opponent_connected,
                'friend_name': friend_name if is_challenger else None,  # Only show friend_name to challenger
            }
        else:
            # Placeholder for pending invitation - opponent hasn't accepted yet
            # Use friend_name if set, otherwise generic message
            placeholder_name = friend_name if friend_name else 'Waiting for opponent...'
            opponent_data = {
                'id': 0,
                'username': placeholder_name,
                'avatar_url': None,
                'connected': False,
                'friend_name': friend_name,
            }

        # Determine if it's the current user's turn (for async battles)
        is_challenger = self.user.id == battle.challenger_id
        if battle.phase == BattlePhase.CHALLENGER_TURN:
            is_my_turn = is_challenger
        elif battle.phase == BattlePhase.OPPONENT_TURN:
            is_my_turn = not is_challenger
        else:
            # For ACTIVE phase and other phases, both can submit
            is_my_turn = True

        # Calculate points earned for completed battles
        points_earned = 0
        if battle.status == BattleStatus.COMPLETED:
            if battle.winner_id == self.user.id:
                points_earned = 50  # Winner points
            elif self.user.id in [battle.challenger_id, battle.opponent_id]:
                points_earned = 10  # Participation points

        return {
            'id': battle.id,
            'phase': battle.phase,
            'status': battle.status,
            'challenge_text': battle.challenge_text,
            'category': {
                'id': battle.prompt.category.id,
                'name': battle.prompt.category.name,
            }
            if battle.prompt and battle.prompt.category
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
            'is_my_turn': is_my_turn,
            'points_earned': points_earned,
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
                await self._handle_join_queue(match_type)

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

    async def _handle_join_queue(self, match_type: str):
        """Handle user joining the matchmaking queue."""
        # Validate match type
        if match_type not in ['random', 'ai', 'active_user']:
            await self._send_error('Invalid match type')
            return

        # Handle active user matching - find someone who's online now
        if match_type == 'active_user':
            result = await self._find_active_user_match()
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
            battle = await self._create_pip_battle()
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
        match = await self._find_match()
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
        queue_entry = await self._join_queue()
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
    def _join_queue(self) -> BattleMatchmakingQueue | None:
        """Add user to the matchmaking queue."""
        queue_entry, created = BattleMatchmakingQueue.objects.update_or_create(
            user=self.user,
            defaults={
                'match_type': MatchType.RANDOM,
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
    def _find_match_in_db(self) -> dict | None:
        """
        Try to find a match in the queue (DB operations only).

        Uses select_for_update to prevent race conditions where multiple
        users could match with the same queue entry simultaneously.
        """
        from django.db import models, transaction

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

                # Get a random active prompt
                prompt = PromptChallengePrompt.objects.filter(is_active=True).order_by('?').first()

                if not prompt:
                    logger.warning('No active prompts available for matchmaking')
                    return None

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
                    challenge_text=prompt.prompt_text,
                    prompt=prompt,
                    match_source=MatchSource.RANDOM,
                    duration_minutes=3,  # Default duration
                    status=BattleStatus.PENDING,
                    phase=BattlePhase.WAITING,
                )

                # Increment usage counter
                PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=models.F('times_used') + 1)

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

    async def _find_match(self) -> dict | None:
        """Try to find a match and notify the other user."""
        result = await self._find_match_in_db()

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
    def _create_pip_battle(self) -> PromptBattle | None:
        """Create an instant battle against Pip (AI opponent)."""
        from django.db import models

        try:
            from core.users.models import UserRole

            pip = User.objects.get(username='pip', role=UserRole.AGENT)
        except User.DoesNotExist:
            logger.error('Pip user not found')
            return None

        # Get a random active prompt
        prompt = PromptChallengePrompt.objects.filter(is_active=True).order_by('?').first()

        if not prompt:
            logger.error('No active prompts found')
            return None

        # Create battle
        battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=pip,
            challenge_text=prompt.prompt_text,
            prompt=prompt,
            match_source=MatchSource.AI_OPPONENT,
            duration_minutes=3,  # Default duration
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            opponent_connected=True,  # Pip is always "connected"
        )

        # Increment usage counter
        PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=models.F('times_used') + 1)

        return battle

    @database_sync_to_async
    def _find_active_user_in_db(self) -> dict | None:
        """
        Find an active user to match with.

        An active user is:
        - Seen within the last 5 minutes
        - Available for battles (is_available_for_battles=True)
        - Not currently in an active battle
        - Not ourselves
        """
        from django.db import models
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

        # Get a random active prompt
        prompt = PromptChallengePrompt.objects.filter(is_active=True).order_by('?').first()

        if not prompt:
            logger.warning('No active prompts available')
            return None

        # Create the battle (opponent not set yet - will be set when they accept)
        battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=None,  # Set when invitation is accepted
            challenge_text=prompt.prompt_text,
            prompt=prompt,
            match_source=MatchSource.RANDOM,
            duration_minutes=3,  # Default duration
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
        )

        # Increment usage counter
        PromptChallengePrompt.objects.filter(id=prompt.id).update(times_used=models.F('times_used') + 1)

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
            'challenge_preview': battle.challenge_text[:100] if battle.challenge_text else '',
            'opponent': {
                'id': matched_user.id,
                'username': matched_user.username,
                'is_ai': False,
            },
        }

    async def _find_active_user_match(self) -> dict | None:
        """Find an active user and notify them of the match."""
        result = await self._find_active_user_in_db()

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
