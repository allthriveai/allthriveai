"""
WebSocket Consumers for Community Messaging

Handles real-time community communication:
- CommunityRoomConsumer: Forum and circle chat messages
- DirectMessageConsumer: Private messaging
- CommunityPresenceConsumer: Online status tracking

Key differences from Ember AI chat:
- No Celery processing (direct consumer handling)
- Redis key prefix: community: (not chat_)
- Human-to-human only (no AI responses)
"""

import json
import logging
from datetime import datetime
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.db.models import F
from django.utils import timezone

from core.community.models import Message, Room, RoomMembership

logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGE_LENGTH = 4000
RATE_LIMIT_MESSAGES_PER_MINUTE = 10


class CommunityRoomConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for community room messaging.

    Handles:
    - Connection with authentication
    - Real-time message broadcast
    - Typing indicators
    - Presence tracking
    - Rate limiting

    URL: ws/community/room/<room_id>/
    """

    async def connect(self):
        """Handle WebSocket connection to a room."""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.user = self.scope.get('user')
        # Use dots instead of colons - channels doesn't allow colons in group names
        self.group_name = f'community.room.{self.room_id}'

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'Community WebSocket from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated community WebSocket attempt for room {self.room_id}')
            await self.close(code=4001)
            return

        # Validate room access
        room = await self._get_room()
        if not room:
            logger.warning(f'Room {self.room_id} not found')
            await self.close(code=4004)
            return

        if not await self._user_can_access_room(room):
            logger.warning(f'User {self.user.id} cannot access room {self.room_id}')
            await self.close(code=4003)
            return

        # Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Track presence
        await self._set_user_online(True)

        logger.info(f'Community WebSocket connected: user={self.user.id}, room={self.room_id}')

        # Send initial state
        await self._send_room_state()

        # Broadcast user joined
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'room_event',
                'event': 'user_joined',
                'userId': str(self.user.id),
                'username': self.user.username,
                'avatarUrl': getattr(self.user, 'avatar_url', None),
            },
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if hasattr(self, 'room_id') and hasattr(self, 'user') and self.user.is_authenticated:
            await self._set_user_online(False)

            # Broadcast user left
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'room_event',
                    'event': 'user_left',
                    'userId': str(self.user.id),
                },
            )

        logger.info(
            f'Community WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, '
            f'room={getattr(self, "room_id", "unknown")}, code={close_code}'
        )

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages from client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            # Heartbeat - always respond
            if message_type == 'ping':
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'pong',
                            'timestamp': datetime.now().isoformat(),
                        }
                    )
                )
                return

            # Verify user is still authenticated
            if not self.user or not self.user.is_authenticated:
                await self._send_error('Authentication required')
                await self.close(code=4001)
                return

            # Handle message types
            if message_type == 'send_message':
                await self._handle_send_message(data)
            elif message_type == 'typing':
                await self._handle_typing(data)
            elif message_type == 'read_receipt':
                await self._handle_read_receipt(data)
            elif message_type == 'request_history':
                await self._handle_request_history(data)
            else:
                await self._send_error(f'Unknown message type: {message_type}')

        except json.JSONDecodeError:
            await self._send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f'Error processing community WebSocket message: {e}', exc_info=True)
            await self._send_error('Failed to process message')

    async def room_event(self, event: dict[str, Any]):
        """Receive room event from channel layer and forward to WebSocket."""
        # Remove internal 'type' field before sending to client
        client_event = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(client_event))

    async def _handle_send_message(self, data: dict):
        """Handle sending a new message."""
        content = data.get('content', '').strip()

        if not content:
            await self._send_error('Message content is required')
            return

        if len(content) > MAX_MESSAGE_LENGTH:
            await self._send_error(f'Message too long (max {MAX_MESSAGE_LENGTH} characters)')
            return

        # Rate limiting
        if not await self._check_rate_limit():
            await self._send_error('Rate limit exceeded. Please slow down.')
            return

        # Check room permissions
        room = await self._get_room()
        if not room:
            await self._send_error('Room not found')
            return

        membership = await self._get_membership(room)
        if membership and membership.role in ('muted', 'banned'):
            await self._send_error('You cannot send messages in this room')
            return

        # Create message
        message = await self._create_message(
            room=room,
            content=content,
            reply_to_id=data.get('reply_to_id'),
            attachments=data.get('attachments', []),
        )

        # Broadcast to room
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'room_event',
                'event': 'new_message',
                'message': await self._serialize_message(message),
            },
        )

    async def _handle_typing(self, data: dict):
        """Handle typing indicator."""
        is_typing = data.get('is_typing', False)

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'room_event',
                'event': 'typing',
                'userId': str(self.user.id),
                'username': self.user.username,
                'isTyping': is_typing,
            },
        )

    async def _handle_read_receipt(self, data: dict):
        """Handle read receipt update."""
        message_id = data.get('message_id')
        if message_id:
            await self._update_last_read(message_id)

    async def _handle_request_history(self, data: dict):
        """Handle request for message history."""
        cursor = data.get('cursor')
        limit = min(data.get('limit', 50), 100)

        messages = await self._get_message_history(cursor=cursor, limit=limit)

        await self.send(
            text_data=json.dumps(
                {
                    'event': 'message_history',
                    'messages': messages,
                    'hasMore': len(messages) == limit,
                    'cursor': messages[-1]['id'] if messages else None,
                }
            )
        )

    async def _send_room_state(self):
        """Send initial room state to client."""
        room = await self._get_room()
        if not room:
            return

        # Get recent messages
        messages = await self._get_message_history(limit=50)

        # Get online users
        online_users = await self._get_online_users()

        await self.send(
            text_data=json.dumps(
                {
                    'event': 'room_state',
                    'room': {
                        'id': str(room.id),
                        'name': room.name,
                        'description': room.description,
                        'icon': room.icon,
                        'roomType': room.room_type,
                        'memberCount': room.member_count,
                    },
                    'messages': messages,
                    'onlineUsers': online_users,
                }
            )
        )

    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'error',
                    'message': message,
                }
            )
        )

    # Database operations

    @database_sync_to_async
    def _get_room(self) -> Room | None:
        """Get room by ID."""
        try:
            return Room.objects.get(id=self.room_id, is_active=True)
        except Room.DoesNotExist:
            return None

    @database_sync_to_async
    def _user_can_access_room(self, room: Room) -> bool:
        """Check if user can access the room."""
        # Public rooms are accessible to all
        if room.visibility == 'public':
            return True

        # Check membership for private/unlisted rooms
        return (
            RoomMembership.objects.filter(
                room=room,
                user=self.user,
                is_active=True,
            )
            .exclude(role='banned')
            .exists()
        )

    @database_sync_to_async
    def _get_membership(self, room: Room) -> RoomMembership | None:
        """Get user's membership in room."""
        try:
            return RoomMembership.objects.get(room=room, user=self.user)
        except RoomMembership.DoesNotExist:
            return None

    @database_sync_to_async
    def _create_message(
        self,
        room: Room,
        content: str,
        reply_to_id: str | None = None,
        attachments: list | None = None,
    ) -> Message:
        """Create a new message in the room."""
        reply_to = None
        if reply_to_id:
            try:
                reply_to = Message.objects.get(id=reply_to_id, room=room)
            except Message.DoesNotExist:
                logger.debug(f'Reply target message not found: {reply_to_id}')

        message = Message.objects.create(
            room=room,
            author=self.user,
            content=content,
            message_type='text',
            reply_to=reply_to,
            attachments=attachments or [],
        )

        # Update room stats
        room.last_message_at = timezone.now()
        room.message_count = room.message_count + 1
        room.save(update_fields=['last_message_at', 'message_count', 'updated_at'])

        # Update membership stats
        RoomMembership.objects.filter(room=room, user=self.user).update(messages_sent=F('messages_sent') + 1)

        return message

    @database_sync_to_async
    def _serialize_message(self, message: Message) -> dict:
        """Serialize message for WebSocket transmission (uses camelCase for frontend)."""
        return {
            'id': str(message.id),
            'roomId': str(message.room_id),
            'author': {
                'id': str(message.author.id) if message.author else None,
                'username': message.author.username if message.author else 'Unknown',
                'avatarUrl': getattr(message.author, 'avatar_url', None) if message.author else None,
            },
            'content': message.content,
            'messageType': message.message_type,
            'attachments': message.attachments,
            'mentions': message.mentions,
            'replyToId': str(message.reply_to_id) if message.reply_to_id else None,
            'reactionCounts': message.reaction_counts,
            'isEdited': message.is_edited,
            'isPinned': message.is_pinned,
            'createdAt': message.created_at.isoformat(),
        }

    @database_sync_to_async
    def _get_message_history(self, cursor: str | None = None, limit: int = 50) -> list[dict]:
        """Get message history with cursor-based pagination."""
        queryset = (
            Message.objects.filter(
                room_id=self.room_id,
                is_hidden=False,
            )
            .select_related('author')
            .order_by('-created_at')
        )

        if cursor:
            try:
                cursor_message = Message.objects.get(id=cursor)
                queryset = queryset.filter(created_at__lt=cursor_message.created_at)
            except Message.DoesNotExist:
                logger.debug(f'Cursor message not found, resetting pagination: {cursor}')

        messages = list(queryset[:limit])

        return [
            {
                'id': str(msg.id),
                'roomId': str(msg.room_id),
                'author': {
                    'id': str(msg.author.id) if msg.author else None,
                    'username': msg.author.username if msg.author else 'Unknown',
                    'avatarUrl': getattr(msg.author, 'avatar_url', None) if msg.author else None,
                },
                'content': msg.content,
                'messageType': msg.message_type,
                'attachments': msg.attachments,
                'mentions': msg.mentions,
                'replyToId': str(msg.reply_to_id) if msg.reply_to_id else None,
                'reactionCounts': msg.reaction_counts,
                'isEdited': msg.is_edited,
                'isPinned': msg.is_pinned,
                'createdAt': msg.created_at.isoformat(),
            }
            for msg in reversed(messages)  # Reverse to get chronological order
        ]

    @database_sync_to_async
    def _update_last_read(self, message_id: str):
        """Update user's last read timestamp."""
        try:
            message = Message.objects.get(id=message_id)
            RoomMembership.objects.filter(
                room_id=self.room_id,
                user=self.user,
            ).update(last_read_at=message.created_at)
        except Message.DoesNotExist:
            logger.debug(f'Message not found for read receipt: {message_id}')

    # Redis operations for presence and rate limiting

    async def _set_user_online(self, is_online: bool):
        """Set user online status in Redis."""
        from django.core.cache import cache

        key = f'community:presence:{self.room_id}'
        if is_online:
            # Add user to presence set with TTL
            # Using Django cache as a simple Redis interface
            presence = cache.get(key, {})
            presence[str(self.user.id)] = {
                'username': self.user.username,
                'timestamp': datetime.now().isoformat(),
            }
            cache.set(key, presence, timeout=120)  # 2 min TTL
        else:
            presence = cache.get(key, {})
            presence.pop(str(self.user.id), None)
            cache.set(key, presence, timeout=120)

    async def _get_online_users(self) -> list[dict]:
        """Get list of online users in room."""
        from django.core.cache import cache

        key = f'community:presence:{self.room_id}'
        presence = cache.get(key, {})
        return [{'userId': user_id, 'username': data['username']} for user_id, data in presence.items()]

    async def _check_rate_limit(self) -> bool:
        """Check if user is within rate limits."""
        from django.core.cache import cache

        key = f'rate_limit:community:{self.user.id}'
        current = cache.get(key, 0)

        if current >= RATE_LIMIT_MESSAGES_PER_MINUTE:
            return False

        cache.set(key, current + 1, timeout=60)
        return True


class DirectMessageConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for direct messages.

    URL: ws/community/dm/<thread_id>/
    """

    async def connect(self):
        """Handle WebSocket connection to a DM thread."""
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.user = self.scope.get('user')
        # Use dots instead of colons - channels doesn't allow colons in group names
        self.group_name = f'community.dm.{self.thread_id}'

        # Validate origin
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()

        from django.conf import settings

        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            logger.warning(f'DM WebSocket from unauthorized origin: {origin}')
            await self.close(code=4003)
            return

        # Reject unauthenticated users
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            logger.warning(f'Unauthenticated DM WebSocket attempt for thread {self.thread_id}')
            await self.close(code=4001)
            return

        # Validate thread access
        if not await self._user_is_participant():
            logger.warning(f'User {self.user.id} is not a participant in DM {self.thread_id}')
            await self.close(code=4003)
            return

        # Join DM group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(f'DM WebSocket connected: user={self.user.id}, thread={self.thread_id}')

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(
            f'DM WebSocket disconnected: user={getattr(self.user, "id", "unknown")}, '
            f'thread={getattr(self, "thread_id", "unknown")}, code={close_code}'
        )

    async def receive(self, text_data: str):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self.send(
                    text_data=json.dumps(
                        {
                            'event': 'pong',
                            'timestamp': datetime.now().isoformat(),
                        }
                    )
                )
                return

            if not self.user or not self.user.is_authenticated:
                await self._send_error('Authentication required')
                await self.close(code=4001)
                return

            if message_type == 'send_message':
                await self._handle_send_message(data)
            elif message_type == 'typing':
                await self._handle_typing(data)
            else:
                await self._send_error(f'Unknown message type: {message_type}')

        except json.JSONDecodeError:
            await self._send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f'Error processing DM WebSocket message: {e}', exc_info=True)
            await self._send_error('Failed to process message')

    async def dm_event(self, event: dict[str, Any]):
        """Receive DM event from channel layer and forward to WebSocket."""
        client_event = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(client_event))

    async def _handle_send_message(self, data: dict):
        """Handle sending a DM."""
        content = data.get('content', '').strip()

        if not content:
            await self._send_error('Message content is required')
            return

        if len(content) > MAX_MESSAGE_LENGTH:
            await self._send_error(f'Message too long (max {MAX_MESSAGE_LENGTH} characters)')
            return

        # Create message
        message = await self._create_dm_message(content)

        # Broadcast to thread
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'dm_event',
                'event': 'new_message',
                'message': await self._serialize_message(message),
            },
        )

    async def _handle_typing(self, data: dict):
        """Handle typing indicator."""
        is_typing = data.get('is_typing', False)

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'dm_event',
                'event': 'typing',
                'userId': str(self.user.id),
                'username': self.user.username,
                'isTyping': is_typing,
            },
        )

    async def _send_error(self, message: str):
        """Send error message to client."""
        await self.send(
            text_data=json.dumps(
                {
                    'event': 'error',
                    'message': message,
                }
            )
        )

    @database_sync_to_async
    def _user_is_participant(self) -> bool:
        """Check if user is a participant in the DM thread."""
        from core.community.models import DirectMessageThread

        return DirectMessageThread.objects.filter(
            id=self.thread_id,
            participants=self.user,
        ).exists()

    @database_sync_to_async
    def _create_dm_message(self, content: str) -> Message:
        """Create a new DM message."""
        from core.community.models import DirectMessageThread

        thread = DirectMessageThread.objects.get(id=self.thread_id)

        message = Message.objects.create(
            room=thread.room,
            author=self.user,
            content=content,
            message_type='text',
        )

        # Update thread
        thread.last_message_at = timezone.now()
        thread.save(update_fields=['last_message_at', 'updated_at'])

        return message

    @database_sync_to_async
    def _serialize_message(self, message: Message) -> dict:
        """Serialize message for WebSocket transmission (uses camelCase for frontend)."""
        return {
            'id': str(message.id),
            'author': {
                'id': str(message.author.id) if message.author else None,
                'username': message.author.username if message.author else 'Unknown',
                'avatarUrl': getattr(message.author, 'avatar_url', None) if message.author else None,
            },
            'content': message.content,
            'messageType': message.message_type,
            'attachments': message.attachments,
            'mentions': message.mentions,
            'replyToId': str(message.reply_to_id) if message.reply_to_id else None,
            'reactionCounts': message.reaction_counts,
            'isEdited': message.is_edited,
            'isPinned': message.is_pinned,
            'createdAt': message.created_at.isoformat(),
        }
