"""
Tests for Community WebSocket Consumers.

Tests cover:
- Connection authentication and authorization
- Room access validation
- Message sending and rate limiting
- Typing indicators
- Presence tracking
- DM thread participation validation
"""

from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from django.test import TransactionTestCase

from core.community.consumers import CommunityRoomConsumer, DirectMessageConsumer
from core.community.models import DirectMessageThread, Message, Room, RoomMembership
from core.tests.factories import UserFactory


class CommunityRoomConnectionTestCase(TransactionTestCase):
    """Tests for CommunityRoomConsumer connection handling."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory()
        self.other_user = UserFactory()
        self.banned_user = UserFactory()

        # Create a public room
        self.public_room = Room.objects.create(
            name='Public Room',
            slug='public-room',
            description='A public test room',
            room_type='forum',
            visibility='public',
            is_active=True,
        )

        # Create a private room
        self.private_room = Room.objects.create(
            name='Private Room',
            slug='private-room',
            description='A private test room',
            room_type='circle',
            visibility='private',
            is_active=True,
        )

        # Add membership for user in private room
        RoomMembership.objects.create(
            room=self.private_room,
            user=self.user,
            role='member',
            is_active=True,
        )

        # Add banned membership
        RoomMembership.objects.create(
            room=self.private_room,
            user=self.banned_user,
            role='banned',
            is_active=True,
        )

    def _create_communicator(self, user, room_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if room_id is None:
            room_id = self.public_room.id

        communicator = WebsocketCommunicator(
            CommunityRoomConsumer.as_asgi(),
            f'/ws/community/room/{room_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'room_id': str(room_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_unauthenticated_user_rejected(self):
        """Test that unauthenticated users are rejected with code 4001."""
        communicator = self._create_communicator(AnonymousUser())

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_authenticated_user_can_connect_public_room(self):
        """Test that authenticated users can connect to public rooms."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Should receive room state
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'room_state')
        self.assertIn('room', response)
        self.assertIn('messages', response)

        await communicator.disconnect()

    async def test_member_can_connect_private_room(self):
        """Test that room members can connect to private rooms."""
        communicator = self._create_communicator(self.user, self.private_room.id)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.disconnect()

    async def test_non_member_rejected_from_private_room(self):
        """Test that non-members are rejected from private rooms."""
        communicator = self._create_communicator(self.other_user, self.private_room.id)

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_banned_user_rejected(self):
        """Test that banned users are rejected from rooms."""
        communicator = self._create_communicator(self.banned_user, self.private_room.id)

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_invalid_room_rejected(self):
        """Test that connections to non-existent rooms are rejected."""
        # Use a valid UUID format for non-existent room
        fake_uuid = '00000000-0000-0000-0000-000000000000'
        communicator = self._create_communicator(self.user, room_id=fake_uuid)

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()


class CommunityRoomMessagingTestCase(TransactionTestCase):
    """Tests for CommunityRoomConsumer messaging functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory()
        self.muted_user = UserFactory()

        self.room = Room.objects.create(
            name='Messaging Room',
            slug='messaging-room',
            description='A test room for messaging',
            room_type='forum',
            visibility='public',
            is_active=True,
        )

        # Add muted membership
        RoomMembership.objects.create(
            room=self.room,
            user=self.muted_user,
            role='muted',
            is_active=True,
        )

    def _create_communicator(self, user, room_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if room_id is None:
            room_id = self.room.id

        communicator = WebsocketCommunicator(
            CommunityRoomConsumer.as_asgi(),
            f'/ws/community/room/{room_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'room_id': str(room_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_send_message(self):
        """Test that users can send messages."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Receive user_joined event (broadcast to room on connect)
        await communicator.receive_json_from()

        # Send message
        await communicator.send_json_to(
            {
                'type': 'send_message',
                'content': 'Hello, world!',
            }
        )

        # Should receive the message broadcast
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'new_message')
        self.assertIn('message', response)
        self.assertEqual(response['message']['content'], 'Hello, world!')

        await communicator.disconnect()

    async def test_send_empty_message_rejected(self):
        """Test that empty messages are rejected."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Send empty message
        await communicator.send_json_to(
            {
                'type': 'send_message',
                'content': '',
            }
        )

        # Should receive error
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'error')
        self.assertIn('content is required', response['message'])

        await communicator.disconnect()

    async def test_send_long_message_rejected(self):
        """Test that messages exceeding max length are rejected."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Send message that's too long
        await communicator.send_json_to(
            {
                'type': 'send_message',
                'content': 'x' * 5000,  # MAX_MESSAGE_LENGTH is 4000
            }
        )

        # Should receive error
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'error')
        self.assertIn('too long', response['message'])

        await communicator.disconnect()

    async def test_muted_user_cannot_send(self):
        """Test that muted users cannot send messages."""
        communicator = self._create_communicator(self.muted_user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Try to send message
        await communicator.send_json_to(
            {
                'type': 'send_message',
                'content': 'I am muted',
            }
        )

        # Should receive error
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'error')
        self.assertIn('cannot send messages', response['message'])

        await communicator.disconnect()


class CommunityRoomTypingTestCase(TransactionTestCase):
    """Tests for typing indicator functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory()

        self.room = Room.objects.create(
            name='Typing Room',
            slug='typing-room',
            description='A test room for typing',
            room_type='forum',
            visibility='public',
            is_active=True,
        )

    def _create_communicator(self, user, room_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if room_id is None:
            room_id = self.room.id

        communicator = WebsocketCommunicator(
            CommunityRoomConsumer.as_asgi(),
            f'/ws/community/room/{room_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'room_id': str(room_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_typing_indicator_sent(self):
        """Test that typing indicators can be sent."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Receive user_joined event (broadcast to room on connect)
        await communicator.receive_json_from()

        # Send typing indicator
        await communicator.send_json_to(
            {
                'type': 'typing',
                'is_typing': True,
            }
        )

        # Should receive typing event (WebSocket uses camelCase)
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'typing')
        self.assertEqual(response['userId'], str(self.user.id))
        self.assertTrue(response['isTyping'])

        await communicator.disconnect()


class CommunityRoomPingTestCase(TransactionTestCase):
    """Tests for heartbeat/ping functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory()

        self.room = Room.objects.create(
            name='Ping Room',
            slug='ping-room',
            description='A test room for ping',
            room_type='forum',
            visibility='public',
            is_active=True,
        )

    def _create_communicator(self, user, room_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if room_id is None:
            room_id = self.room.id

        communicator = WebsocketCommunicator(
            CommunityRoomConsumer.as_asgi(),
            f'/ws/community/room/{room_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'room_id': str(room_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_ping_returns_pong(self):
        """Test that ping messages receive pong responses."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Send ping
        await communicator.send_json_to({'type': 'ping'})

        # Should receive pong
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'pong')
        self.assertIn('timestamp', response)

        await communicator.disconnect()


class CommunityRoomHistoryTestCase(TransactionTestCase):
    """Tests for message history functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = UserFactory()

        self.room = Room.objects.create(
            name='History Room',
            slug='history-room',
            description='A test room for history',
            room_type='forum',
            visibility='public',
            is_active=True,
        )

        # Create some messages
        for i in range(5):
            Message.objects.create(
                room=self.room,
                author=self.user,
                content=f'Test message {i}',
                message_type='text',
            )

    def _create_communicator(self, user, room_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if room_id is None:
            room_id = self.room.id

        communicator = WebsocketCommunicator(
            CommunityRoomConsumer.as_asgi(),
            f'/ws/community/room/{room_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'room_id': str(room_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_request_history(self):
        """Test that message history can be requested."""
        communicator = self._create_communicator(self.user)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Request history
        await communicator.send_json_to(
            {
                'type': 'request_history',
                'limit': 10,
            }
        )

        # Should receive history
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'message_history')
        self.assertIn('messages', response)
        self.assertEqual(len(response['messages']), 5)

        await communicator.disconnect()


class DirectMessageConnectionTestCase(TransactionTestCase):
    """Tests for DirectMessageConsumer connection handling."""

    def setUp(self):
        """Set up test fixtures."""
        self.user1 = UserFactory()
        self.user2 = UserFactory()
        self.non_participant = UserFactory()

        # Create a DM room
        self.dm_room = Room.objects.create(
            name='DM Room',
            slug='dm-room',
            room_type='dm',
            visibility='private',
            is_active=True,
        )

        # Create a DM thread
        self.dm_thread = DirectMessageThread.objects.create(
            room=self.dm_room,
        )
        self.dm_thread.participants.add(self.user1, self.user2)

    def _create_communicator(self, user, thread_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if thread_id is None:
            thread_id = self.dm_thread.id

        communicator = WebsocketCommunicator(
            DirectMessageConsumer.as_asgi(),
            f'/ws/community/dm/{thread_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'thread_id': str(thread_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_unauthenticated_user_rejected(self):
        """Test that unauthenticated users are rejected."""
        communicator = self._create_communicator(AnonymousUser())

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_participant_can_connect(self):
        """Test that DM participants can connect."""
        communicator = self._create_communicator(self.user1)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.disconnect()

    async def test_non_participant_rejected(self):
        """Test that non-participants are rejected."""
        communicator = self._create_communicator(self.non_participant)

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_invalid_thread_rejected(self):
        """Test that connections to non-existent threads are rejected."""
        # Use a valid UUID format for non-existent thread
        fake_uuid = '00000000-0000-0000-0000-000000000000'
        communicator = self._create_communicator(self.user1, thread_id=fake_uuid)

        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()


class DirectMessageMessagingTestCase(TransactionTestCase):
    """Tests for DirectMessageConsumer messaging functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user1 = UserFactory()
        self.user2 = UserFactory()

        # Create a DM room
        self.dm_room = Room.objects.create(
            name='DM Room',
            slug='dm-room-msg',
            room_type='dm',
            visibility='private',
            is_active=True,
        )

        # Create a DM thread
        self.dm_thread = DirectMessageThread.objects.create(
            room=self.dm_room,
        )
        self.dm_thread.participants.add(self.user1, self.user2)

    def _create_communicator(self, user, thread_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if thread_id is None:
            thread_id = self.dm_thread.id

        communicator = WebsocketCommunicator(
            DirectMessageConsumer.as_asgi(),
            f'/ws/community/dm/{thread_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'thread_id': str(thread_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_send_dm_message(self):
        """Test that DM messages can be sent."""
        communicator = self._create_communicator(self.user1)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Consume initial dm_state event sent on connect
        initial_response = await communicator.receive_json_from()
        self.assertEqual(initial_response['event'], 'dm_state')

        # Send message
        await communicator.send_json_to(
            {
                'type': 'send_message',
                'content': 'Hello in DM!',
            }
        )

        # Should receive the message broadcast
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'new_message')
        self.assertIn('message', response)
        self.assertEqual(response['message']['content'], 'Hello in DM!')

        await communicator.disconnect()

    async def test_dm_ping_returns_pong(self):
        """Test that DM ping messages receive pong responses."""
        communicator = self._create_communicator(self.user1)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Consume initial dm_state event sent on connect
        initial_response = await communicator.receive_json_from()
        self.assertEqual(initial_response['event'], 'dm_state')

        # Send ping
        await communicator.send_json_to({'type': 'ping'})

        # Should receive pong
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'pong')

        await communicator.disconnect()

    async def test_dm_typing_indicator(self):
        """Test that DM typing indicators work."""
        communicator = self._create_communicator(self.user1)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Consume initial dm_state event sent on connect
        initial_response = await communicator.receive_json_from()
        self.assertEqual(initial_response['event'], 'dm_state')

        # Send typing indicator
        await communicator.send_json_to(
            {
                'type': 'typing',
                'is_typing': True,
            }
        )

        # Should receive typing event (WebSocket uses camelCase)
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'typing')
        self.assertTrue(response['isTyping'])

        await communicator.disconnect()
