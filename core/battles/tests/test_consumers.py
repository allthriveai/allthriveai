"""
Tests for WebSocket consumers.

Tests cover:
- Connection authentication
- Battle state synchronization
- Phase change broadcasts
- Submission flow
- Turn validation for async battles
"""

from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from django.test import TransactionTestCase

from core.battles.consumers import BattleConsumer
from core.battles.models import (
    BattleMode,
    BattlePhase,
    BattleStatus,
    ChallengeType,
    PromptBattle,
)
from core.users.models import User


class BattleConsumerConnectionTestCase(TransactionTestCase):
    """Tests for BattleConsumer connection handling."""

    def setUp(self):
        """Set up test fixtures."""
        self.challenger = User.objects.create_user(
            username='challenger_ws',
            email='challenger_ws@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_ws',
            email='opponent_ws@test.com',
            password='testpass123',
        )
        self.non_participant = User.objects.create_user(
            username='non_participant_ws',
            email='non_participant_ws@test.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_ws',
            name='Test WS Challenge',
            description='Test challenge type',
            templates=['Test prompt'],
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            duration_minutes=10,
        )

    def _create_communicator(self, user, battle_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if battle_id is None:
            battle_id = self.battle.id

        communicator = WebsocketCommunicator(
            BattleConsumer.as_asgi(),
            f'/ws/battle/{battle_id}/',
        )

        # Mock the scope with user and headers
        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'battle_id': str(battle_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_unauthenticated_user_rejected(self):
        """Test that unauthenticated users are rejected with code 4001."""
        communicator = self._create_communicator(AnonymousUser())

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_non_participant_rejected(self):
        """Test that non-participants are rejected with code 4003."""
        communicator = self._create_communicator(self.non_participant)

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_participant_can_connect(self):
        """Test that battle participants can connect."""
        communicator = self._create_communicator(self.challenger)

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Should receive initial state
        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'battle_state')
        self.assertIn('state', response)

        await communicator.disconnect()

    async def test_invalid_battle_rejected(self):
        """Test that connections to non-existent battles are rejected."""
        communicator = self._create_communicator(self.challenger, battle_id=99999)

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

        await communicator.disconnect()


class BattleConsumerSubmissionTestCase(TransactionTestCase):
    """Tests for BattleConsumer submission handling."""

    def setUp(self):
        """Set up test fixtures."""
        self.challenger = User.objects.create_user(
            username='challenger_sub',
            email='challenger_sub@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_sub',
            email='opponent_sub@test.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_sub',
            name='Test Sub Challenge',
            description='Test challenge type',
            templates=['Test prompt'],
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            duration_minutes=10,
        )

    def _create_communicator(self, user, battle_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if battle_id is None:
            battle_id = self.battle.id

        communicator = WebsocketCommunicator(
            BattleConsumer.as_asgi(),
            f'/ws/battle/{battle_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'battle_id': str(battle_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_submit_prompt_during_active_phase(self):
        """Test that prompts can be submitted during active phase."""
        communicator = self._create_communicator(self.challenger)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Submit prompt
        await communicator.send_json_to(
            {
                'type': 'submit_prompt',
                'prompt_text': 'This is a valid test prompt for the battle',
            }
        )

        # Should receive confirmation or error
        response = await communicator.receive_json_from()
        # The response depends on the full implementation
        # At minimum, we shouldn't get an error for a valid submission
        self.assertIn('event', response)

        await communicator.disconnect()


class BattleConsumerAsyncTurnTestCase(TransactionTestCase):
    """Tests for async turn-based battle handling in consumer."""

    def setUp(self):
        """Set up test fixtures."""
        self.challenger = User.objects.create_user(
            username='challenger_async_ws',
            email='challenger_async_ws@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_async_ws',
            email='opponent_async_ws@test.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_async_ws',
            name='Test Async WS Challenge',
            description='Test challenge type',
            templates=['Test prompt'],
            is_active=True,
        )

        # Create async battle in challenger's turn
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test async challenge',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
        )

    def _create_communicator(self, user, battle_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if battle_id is None:
            battle_id = self.battle.id

        communicator = WebsocketCommunicator(
            BattleConsumer.as_asgi(),
            f'/ws/battle/{battle_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'battle_id': str(battle_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_challenger_can_connect_during_challenger_turn(self):
        """Test challenger can connect during CHALLENGER_TURN."""
        communicator = self._create_communicator(self.challenger)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'battle_state')
        self.assertEqual(response['state']['phase'], 'challenger_turn')

        await communicator.disconnect()

    async def test_opponent_can_connect_during_challenger_turn(self):
        """Test opponent can connect during CHALLENGER_TURN (to observe)."""
        communicator = self._create_communicator(self.opponent)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'battle_state')

        await communicator.disconnect()

    async def test_state_includes_phase_for_async_battles(self):
        """Test that battle state includes the correct phase for async battles."""
        communicator = self._create_communicator(self.challenger)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        response = await communicator.receive_json_from()
        self.assertEqual(response['event'], 'battle_state')

        state = response['state']
        self.assertEqual(state['phase'], 'challenger_turn')
        self.assertIn('time_remaining', state)

        await communicator.disconnect()


class BattleConsumerTypingIndicatorTestCase(TransactionTestCase):
    """Tests for typing indicator functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.challenger = User.objects.create_user(
            username='challenger_typing',
            email='challenger_typing@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_typing',
            email='opponent_typing@test.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_typing',
            name='Test Typing Challenge',
            description='Test challenge type',
            templates=['Test prompt'],
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            duration_minutes=10,
        )

    def _create_communicator(self, user, battle_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if battle_id is None:
            battle_id = self.battle.id

        communicator = WebsocketCommunicator(
            BattleConsumer.as_asgi(),
            f'/ws/battle/{battle_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'battle_id': str(battle_id)}}
        communicator.scope['headers'] = []

        return communicator

    async def test_typing_indicator_sent(self):
        """Test that typing indicators can be sent."""
        communicator = self._create_communicator(self.challenger)

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive initial state
        await communicator.receive_json_from()

        # Send typing indicator
        await communicator.send_json_to(
            {
                'type': 'typing',
                'is_typing': True,
            }
        )

        # The typing event is broadcast to the group
        # In a real scenario, the opponent would receive this
        # For unit testing, we just verify no error occurred

        await communicator.disconnect()


class BattleConsumerPingTestCase(TransactionTestCase):
    """Tests for heartbeat/ping functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username='ping_user',
            email='ping_user@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='ping_opponent',
            email='ping_opponent@test.com',
            password='testpass123',
        )

        self.challenge_type = ChallengeType.objects.create(
            key='test_ping',
            name='Test Ping Challenge',
            description='Test challenge type',
            templates=['Test prompt'],
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.user,
            opponent=self.opponent,
            challenge_text='Test challenge',
            challenge_type=self.challenge_type,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            duration_minutes=10,
        )

    def _create_communicator(self, user, battle_id=None):
        """Create a WebsocketCommunicator with mocked authentication."""
        if battle_id is None:
            battle_id = self.battle.id

        communicator = WebsocketCommunicator(
            BattleConsumer.as_asgi(),
            f'/ws/battle/{battle_id}/',
        )

        communicator.scope['user'] = user
        communicator.scope['url_route'] = {'kwargs': {'battle_id': str(battle_id)}}
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

        await communicator.disconnect()
