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

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

# Import avatar task for avatar generation requests
from core.avatars.tasks import process_avatar_generation_task
from core.projects.models import Project

from .metrics import MetricsCollector
from .security import RateLimiter
from .tasks import _get_user_friendly_error, process_chat_message_task

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
        self._rate_limiter = RateLimiter()

        # Validate origin to prevent CSRF attacks
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()
        host = headers.get(b'host', b'').decode()

        # Check if origin is allowed (for development, allow localhost)
        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])

        # Debug logging for production troubleshooting
        logger.info(
            f'WebSocket connect attempt: origin={origin!r}, host={host!r}, '
            f'allowed_origins={allowed_origins}, user={getattr(self.user, "id", "anonymous")}'
        )

        if origin and origin not in allowed_origins:
            logger.warning(
                f'WebSocket rejected - unauthorized origin: origin={origin!r}, '
                f'allowed={allowed_origins}, host={host!r}'
            )
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated WebSocket connection attempt for conversation {self.conversation_id}')
            await self.close(code=4001)
            return

        # Check connection rate limit (prevent rapid reconnection attacks)
        is_allowed, retry_after = self._rate_limiter.check_connection_rate_limit(self.user.id)
        if not is_allowed:
            logger.warning(f'WebSocket connection rate limit exceeded for user {self.user.id}')
            await self.close(code=4029)  # Too many requests
            return

        # Check concurrent connection limit
        is_allowed, error_msg = self._rate_limiter.check_websocket_connection_limit(self.user.id)
        if not is_allowed:
            logger.warning(f'WebSocket connection limit exceeded for user {self.user.id}: {error_msg}')
            await self.close(code=4029)  # Too many requests
            return

        # Validate conversation access authorization
        # For project-{id} conversations, verify the user owns the project
        # Note: Frontend uses Date.now() for temp conversation IDs (13+ digits)
        # Actual project IDs are much smaller (typically < 1 billion)
        # Supports patterns: project-{id} and project-{id}-{context} (e.g., project-123-architecture)
        if self.conversation_id.startswith('project-'):
            try:
                # Extract project ID from conversation ID
                # Handles: project-123, project-123-architecture, etc.
                parts = self.conversation_id.replace('project-', '').split('-')
                project_id = int(parts[0])
                # Only check authorization for reasonable project IDs
                # Date.now() produces 13-digit numbers (> 1 trillion), skip those
                if project_id < 1_000_000_000:  # Less than 1 billion = real project ID
                    has_access = await self._check_project_access(project_id)
                    if not has_access:
                        logger.warning(
                            f'Unauthorized project access attempt: user={self.user.id}, project={project_id}'
                        )
                        await self.close(code=4003)
                        return
                # else: timestamp-based temp ID, allow connection
            except (ValueError, TypeError):
                logger.warning(f'Invalid project conversation ID format: {self.conversation_id}')
                await self.close(code=4003)
                return

        # Join Redis channel for this conversation
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,  # Auto-assigned by Channels
        )

        await self.accept()

        # Track connection for concurrent connection limiting
        self._rate_limiter.increment_websocket_connection(self.user.id)

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

        # Decrement connection count for rate limiting
        if hasattr(self, '_rate_limiter') and hasattr(self, 'user') and self.user and self.user.is_authenticated:
            self._rate_limiter.decrement_websocket_connection(self.user.id)

        logger.info(f'WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, code={close_code}')

    async def receive(self, text_data: str):
        """
        Handle incoming WebSocket messages from client.

        Queues message to Celery for async processing.
        """
        try:
            # Validate message size before parsing
            is_valid, size_error = self._rate_limiter.validate_message_size(text_data)
            if not is_valid:
                await self.send_error(size_error)
                return

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
            rate_limiter = self._rate_limiter
            is_allowed, retry_after = rate_limiter.check_message_rate_limit(self.user.id)
            if not is_allowed:
                minutes = retry_after // 60
                MetricsCollector.record_rate_limit_hit(self.user.id, 'websocket_message')
                await self.send_error(f'Rate limit exceeded. Try again in {minutes} minutes.')
                return

            # Check if this is an avatar generation request
            if self.conversation_id.startswith('avatar-'):
                # Handle avatar generation via dedicated task
                session_id = data.get('session_id')
                reference_image_url = data.get('reference_image_url')

                # Debug logging
                logger.info(f'Avatar WS message: session_id={session_id}, reference_image_url={reference_image_url}')

                if not session_id:
                    await self.send_error('session_id is required for avatar generation')
                    return

                task = process_avatar_generation_task.delay(
                    session_id=session_id,
                    prompt=message,
                    user_id=self.user.id,
                    channel_name=self.group_name,
                    reference_image_url=reference_image_url,
                )

                await self.send(
                    text_data=json.dumps(
                        {'event': 'avatar_task_queued', 'task_id': str(task.id), 'timestamp': self._get_timestamp()}
                    )
                )
                logger.debug(f'Avatar generation queued: task_id={task.id}, session_id={session_id}')
            else:
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
            await self.send_error('Invalid message format. Please try again.')
        except Exception as e:
            logger.error(f'Error processing WebSocket message: {e}', exc_info=True)
            await self.send_error(_get_user_friendly_error(e))

    async def chat_message(self, event: dict[str, Any]):
        """
        Receive message from Redis Pub/Sub (sent by Celery task).
        Forward to WebSocket client.
        """
        event_type = event.get('event')
        logger.info(f'[WS_SEND] Forwarding to client: event={event_type}, conversation={event.get("conversation_id")}')

        # Send to WebSocket client
        json_data = json.dumps(event)
        await self.send(text_data=json_data)
        logger.info(f'[WS_SENT] Successfully sent to client: event={event_type}, bytes={len(json_data)}')

    async def send_error(self, error_message: str):
        """Send error message to client"""
        await self.send(
            text_data=json.dumps({'event': 'error', 'error': error_message, 'timestamp': self._get_timestamp()})
        )

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime

        return datetime.utcnow().isoformat() + 'Z'

    @database_sync_to_async
    def _check_project_access(self, project_id: int) -> bool:
        """
        Check if the current user has access to the specified project.

        Returns True if:
        - User is the project owner
        - User is a collaborator on the project

        Args:
            project_id: The project ID to check access for

        Returns:
            bool: True if user has access, False otherwise
        """
        try:
            project = Project.objects.get(id=project_id)
            # Check if user is owner
            if project.user_id == self.user.id:
                return True
            # Check if user is a collaborator (if collaborators field exists)
            if hasattr(project, 'collaborators') and project.collaborators.filter(id=self.user.id).exists():
                return True
            return False
        except Project.DoesNotExist:
            # Project doesn't exist - allow connection for creation flow
            # The user will create this project during the conversation
            return True
