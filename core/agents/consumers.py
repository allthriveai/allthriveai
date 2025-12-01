"""
WebSocket Consumer for AllThrive AI Chat

Handles real-time chat communication via WebSockets with:
- Redis Pub/Sub for message broadcasting
- Celery async task processing for LangGraph agents
- JWT authentication
- Rate limiting and security
"""

import json
import logging
from typing import Any

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .metrics import MetricsCollector
from .security import RateLimiter
from .tasks import process_chat_message_task

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for chat streaming.

    Architecture:
    1. Client connects via WebSocket
    2. Messages queued to Celery for async processing
    3. LangGraph agent processes message
    4. Results streamed back via Redis Pub/Sub → WebSocket
    """

    async def connect(self):
        """Handle WebSocket connection"""
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.user = self.scope.get('user')
        self.group_name = f'chat_{self.conversation_id}'

        # Validate origin to prevent CSRF attacks
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        # Check if origin is allowed (for development, allow localhost)
        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'WebSocket connection from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated WebSocket connection attempt for conversation {self.conversation_id}')
            await self.close(code=4001)
            return

        # Join Redis channel for this conversation
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,  # Auto-assigned by Channels
        )

        await self.accept()

        logger.info(f'WebSocket connected: user={self.user.id}, conversation={self.conversation_id}')

        # Send connection confirmation
        await self.send(
            text_data=json.dumps(
                {'event': 'connected', 'conversation_id': self.conversation_id, 'timestamp': self._get_timestamp()}
            )
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(f'WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, code={close_code}')

    async def receive(self, text_data: str):
        """
        Handle incoming WebSocket messages from client.

        Queues message to Celery for async processing.
        """
        try:
            data = json.loads(text_data)

            # Handle heartbeat ping
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'event': 'pong', 'timestamp': self._get_timestamp()}))
                return

            message = data.get('message', '').strip()

            if not message:
                await self.send_error('Message cannot be empty')
                return

            # Rate limiting check
            rate_limiter = RateLimiter()
            is_allowed, retry_after = rate_limiter.check_message_rate_limit(self.user.id)
            if not is_allowed:
                minutes = retry_after // 60
                MetricsCollector.record_rate_limit_hit(self.user.id, 'websocket_message')
                await self.send_error(f'Rate limit exceeded. Try again in {minutes} minutes.')
                return

            # Queue message for async processing via Celery
            # Circuit breaker is checked in the Celery task
            task = process_chat_message_task.delay(
                conversation_id=self.conversation_id,
                message=message,
                user_id=self.user.id,
                channel_name=self.group_name,  # Redis group name for broadcasting
            )

            # Send task queued confirmation
            await self.send(
                text_data=json.dumps(
                    {'event': 'task_queued', 'task_id': str(task.id), 'timestamp': self._get_timestamp()}
                )
            )

            logger.debug(f'Message queued: task_id={task.id}, user={self.user.id}')

        except json.JSONDecodeError:
            await self.send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f'Error processing WebSocket message: {e}', exc_info=True)
            await self.send_error('Failed to process message')

    async def chat_message(self, event: dict[str, Any]):
        """
        Receive message from Redis Pub/Sub (sent by Celery task).
        Forward to WebSocket client.
        """
        await self.send(text_data=json.dumps(event))

    async def send_error(self, error_message: str):
        """Send error message to client"""
        await self.send(
            text_data=json.dumps({'event': 'error', 'error': error_message, 'timestamp': self._get_timestamp()})
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime

        return datetime.utcnow().isoformat() + 'Z'
