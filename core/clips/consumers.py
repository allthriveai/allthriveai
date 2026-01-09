"""
WebSocket consumer for the Clip Agent.

Handles real-time clip generation via WebSocket connection with
conversational story-building flow.
"""

import json
import logging
from datetime import UTC, datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)

# Constants
MAX_PROMPT_LENGTH = 2000


class ClipAgentConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for clip generation.

    Frontend connects to: ws://host/ws/clip/<session_id>/?connection_token=xxx

    Authentication is handled by JWTAuthMiddlewareStack which populates
    self.scope['user'] with the authenticated user.

    Message types:
    - generate: Start a new clip conversation
    - message: Continue the conversation (answer questions, provide feedback)
    - approve: Approve transcript and generate the final clip
    - edit: Edit an existing clip
    - ping: Keepalive
    """

    async def connect(self):
        """Handle WebSocket connection."""
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'clip.session.{self.session_id}'

        # User is populated by JWTAuthMiddlewareStack
        self.user = self.scope.get('user')

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated clip WebSocket attempt for session {self.session_id}')
            await self.close(code=4001)
            return

        # Initialize conversation state (stored per connection)
        self.conversation_phase = 'discovery'
        self.story_transcript = []
        self.user_preferences = {}
        self.current_clip = None
        self.brand_voice_id = None  # Optional brand voice for personalization

        # Join the session group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(f'Clip WebSocket connected: user={self.user.id}, session={self.session_id}')

        # Send connection confirmation
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'connected',
                    'sessionId': self.session_id,
                    'phase': self.conversation_phase,
                    'timestamp': datetime.now(UTC).isoformat(),
                }
            )
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f'Clip WebSocket disconnected: session={getattr(self, "session_id", "unknown")}, code={close_code}')

    async def receive(self, text_data: str):
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'generate':
                await self._handle_generate(data)
            elif message_type == 'message':
                await self._handle_message(data)
            elif message_type == 'approve':
                await self._handle_approve(data)
            elif message_type == 'edit':
                await self._handle_edit(data)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong'}))
            else:
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'error',
                            'error': f'Unknown message type: {message_type}',
                        }
                    )
                )
        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Invalid JSON',
                    }
                )
            )
        except Exception as e:
            logger.error(f'Clip consumer error: {e}', exc_info=True)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Internal error processing message',
                    }
                )
            )

    async def _handle_generate(self, data: dict):
        """Handle clip generation request - starts a new conversation."""
        prompt = data.get('prompt', '').strip()
        brand_voice_id = data.get('brandVoiceId')  # Optional brand voice selection

        if not prompt:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'No prompt provided',
                    }
                )
            )
            return

        if len(prompt) > MAX_PROMPT_LENGTH:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': f'Prompt too long. Maximum {MAX_PROMPT_LENGTH} characters allowed.',
                    }
                )
            )
            return

        # Reset conversation state for new clip
        self.conversation_phase = 'discovery'
        self.story_transcript = []
        self.user_preferences = {}
        self.current_clip = None
        self.brand_voice_id = brand_voice_id  # Store for subsequent messages

        # Send processing started
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'processing',
                    'message': 'Starting your clip...',
                }
            )
        )

        try:
            from .tasks import generate_clip_task

            # Queue the Celery task with conversation state
            generate_clip_task.delay(
                session_id=self.session_id,
                prompt=prompt,
                user_id=self.user.id,
                username=self.user.username,
                current_clip=None,
                conversation_phase=self.conversation_phase,
                story_transcript=self.story_transcript,
                user_preferences=self.user_preferences,
                should_generate=False,
                brand_voice_id=self.brand_voice_id,
            )

        except Exception as e:
            logger.error(f'Failed to queue clip generation: {e}', exc_info=True)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Failed to start clip generation',
                    }
                )
            )

    async def _handle_message(self, data: dict):
        """Handle conversation message - continue building the story."""
        prompt = data.get('prompt', '').strip()

        if not prompt:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'No message provided',
                    }
                )
            )
            return

        # Send processing indicator
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'processing',
                    'message': 'Thinking...',
                }
            )
        )

        try:
            from .tasks import generate_clip_task

            # Continue conversation with current state
            generate_clip_task.delay(
                session_id=self.session_id,
                prompt=prompt,
                user_id=self.user.id,
                username=self.user.username,
                current_clip=self.current_clip,
                conversation_phase=self.conversation_phase,
                story_transcript=self.story_transcript,
                user_preferences=self.user_preferences,
                should_generate=False,
                brand_voice_id=self.brand_voice_id,
            )

        except Exception as e:
            logger.error(f'Failed to queue conversation message: {e}', exc_info=True)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Failed to process message',
                    }
                )
            )

    async def _handle_approve(self, data: dict):
        """Handle transcript approval - generate the final clip."""
        # Send processing indicator
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'processing',
                    'message': 'Generating your video...',
                }
            )
        )

        try:
            from .tasks import generate_clip_task

            # Generate clip from approved transcript
            generate_clip_task.delay(
                session_id=self.session_id,
                prompt='Generate the clip from the approved transcript',
                user_id=self.user.id,
                username=self.user.username,
                current_clip=self.current_clip,
                conversation_phase='ready_to_generate',
                story_transcript=self.story_transcript,
                user_preferences=self.user_preferences,
                should_generate=True,
                brand_voice_id=self.brand_voice_id,
            )

        except Exception as e:
            logger.error(f'Failed to queue clip approval: {e}', exc_info=True)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Failed to generate clip',
                    }
                )
            )

    async def _handle_edit(self, data: dict):
        """Handle clip edit request."""
        prompt = data.get('prompt', '').strip()
        current_clip = data.get('currentClip')

        if not prompt:
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'No edit prompt provided',
                    }
                )
            )
            return

        # Store current clip for editing
        self.current_clip = current_clip

        # Send processing started
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'processing',
                    'message': 'Updating your clip...',
                }
            )
        )

        try:
            from .tasks import generate_clip_task

            # Queue the Celery task with current clip for editing
            generate_clip_task.delay(
                session_id=self.session_id,
                prompt=prompt,
                user_id=self.user.id,
                username=self.user.username,
                current_clip=current_clip,
                conversation_phase=self.conversation_phase,
                story_transcript=self.story_transcript,
                user_preferences=self.user_preferences,
                should_generate=True,  # Regenerate clip with edits
                brand_voice_id=self.brand_voice_id,
            )

        except Exception as e:
            logger.error(f'Failed to queue clip edit: {e}', exc_info=True)
            await self.send(
                text_data=json.dumps(
                    {
                        'event': 'error',
                        'error': 'Failed to start clip editing',
                    }
                )
            )

    async def clip_message(self, event: dict):
        """
        Receive message from channel layer (from Celery task).

        This is called when the task broadcasts results via:
        channel_layer.group_send(group_name, {'type': 'clip.message', ...})
        """
        # Update local conversation state from task results
        if 'phase' in event:
            self.conversation_phase = event['phase']
        if 'transcript' in event:
            self.story_transcript = event['transcript']
        if 'preferences' in event:
            self.user_preferences = event['preferences']
        if 'clip' in event and event['clip']:
            self.current_clip = event['clip']

        # Build response for frontend
        response = {
            'event': event.get('event'),
            'message': event.get('message'),
            'timestamp': event.get('timestamp', datetime.now(UTC).isoformat()),
        }

        # Include conversation state
        if 'phase' in event:
            response['phase'] = event['phase']
        if 'transcript' in event:
            response['transcript'] = event['transcript']
        if 'preferences' in event:
            response['preferences'] = event['preferences']
        if 'options' in event:
            response['options'] = event['options']

        # Include clip if generated
        if 'clip' in event and event['clip']:
            response['clip'] = event['clip']

        # Forward to WebSocket client
        await self.send(text_data=json.dumps(response))
