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
        battle = await self._get_battle()
        if not battle:
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

    async def _handle_submission(self, prompt_text: str):
        """Handle a user submitting their prompt."""
        battle = await self._get_battle()
        if not battle:
            await self._send_error('Battle not found')
            return

        if battle.phase != BattlePhase.ACTIVE:
            await self._send_error('Cannot submit - battle is not active')
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

        # If this is a Pip battle, trigger Pip's submission with a delay
        is_pip_battle = await self._is_pip_battle(battle)
        if is_pip_battle:
            # Delay 2-5 seconds to simulate Pip "thinking"
            import random

            from core.battles.tasks import create_pip_submission_task

            delay = random.randint(2, 5)  # noqa: S311 - not cryptographic
            create_pip_submission_task.apply_async(args=[battle.id], countdown=delay)
        else:
            # Check if both users have submitted
            await self._check_both_submitted(battle)

    async def _check_both_connected(self):
        """Check if both users are connected and start countdown if so."""
        battle = await self._get_battle()
        if not battle:
            return

        if battle.phase == BattlePhase.WAITING and battle.challenger_connected and battle.opponent_connected:
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
        """Transition battle to a new phase with fresh DB fetch."""
        try:
            battle = PromptBattle.objects.get(id=self.battle_id)
            battle.phase = new_phase
            if new_phase == BattlePhase.ACTIVE:
                battle.status = BattleStatus.ACTIVE
                battle.started_at = timezone.now()
                battle.expires_at = battle.started_at + timedelta(minutes=battle.duration_minutes)
            elif new_phase == BattlePhase.COMPLETE:
                battle.status = BattleStatus.COMPLETED
                battle.completed_at = timezone.now()
            battle.save()
            return battle
        except PromptBattle.DoesNotExist:
            return None

    @database_sync_to_async
    def _build_battle_state(self, battle: PromptBattle) -> dict:
        """Build the battle state dictionary for the client."""
        # Determine opponent
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
        opponent_submission = None
        if battle.phase in [BattlePhase.REVEAL, BattlePhase.COMPLETE]:
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

        # Calculate time remaining
        time_remaining = None
        if battle.status == BattleStatus.ACTIVE and battle.expires_at:
            remaining = (battle.expires_at - timezone.now()).total_seconds()
            time_remaining = max(0, int(remaining))

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
            'opponent': {
                'id': opponent.id,
                'username': opponent.username,
                'avatar_url': getattr(opponent, 'avatar_url', None),
                'connected': opponent_connected,
            },
            'my_submission': my_submission,
            'opponent_submission': opponent_submission,
            'winner_id': battle.winner_id,
            'match_source': battle.match_source,
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
        if match_type not in ['random', 'ai']:
            await self._send_error('Invalid match type')
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
