"""
WebSocket consumer for the Clip Agent.

Handles real-time clip generation via WebSocket connection.
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
        """Handle clip generation request."""
        prompt = data.get('prompt', '').strip()

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

        # Send processing started
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'processing',
                    'message': 'Generating your clip...',
                }
            )
        )

        try:
            # Import here to avoid circular imports
            from .tasks import generate_clip_task

            # Queue the Celery task
            generate_clip_task.delay(
                session_id=self.session_id,
                prompt=prompt,
                user_id=self.user.id,
                username=self.user.username,
                current_clip=None,
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
        # Forward to WebSocket client
        await self.send(
            text_data=json.dumps(
                {
                    'event': event.get('event'),
                    'clip': event.get('clip'),
                    'message': event.get('message'),
                    'timestamp': event.get('timestamp', datetime.now(UTC).isoformat()),
                }
            )
        )
