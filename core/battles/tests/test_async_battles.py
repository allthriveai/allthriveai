"""
Tests for async turn-based battle functionality.

These tests cover the async battle flow including:
- Turn validation (challenger/opponent turn)
- Turn timeout behavior
- Deadline expiration
- Phase transitions for async battles
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.battles.models import (
    BattleMode,
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    PromptBattle,
    PromptChallengePrompt,
)
from core.battles.phase_utils import can_submit_prompt, is_users_turn
from core.battles.state_machine import is_valid_transition
from core.users.models import User


class AsyncBattleTurnValidationTestCase(TestCase):
    """Tests for async battle turn validation."""

    def setUp(self):
        """Set up test users and battle."""
        self.challenger = User.objects.create_user(
            username='challenger_async',
            email='challenger_async@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_async',
            email='opponent_async@test.com',
            password='testpass123',
        )

        # Create curated prompt
        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        # Create async battle
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
        )

    def test_challenger_can_submit_on_challenger_turn(self):
        """Test challenger can submit during CHALLENGER_TURN phase."""
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.save()

        result = can_submit_prompt(self.battle, self.challenger)
        self.assertTrue(result.allowed)

    def test_opponent_cannot_submit_on_challenger_turn(self):
        """Test opponent cannot submit during CHALLENGER_TURN phase."""
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.save()

        result = can_submit_prompt(self.battle, self.opponent)
        self.assertFalse(result.allowed)
        self.assertIn('not your turn', result.error.lower())

    def test_opponent_can_submit_on_opponent_turn(self):
        """Test opponent can submit during OPPONENT_TURN phase."""
        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.save()

        result = can_submit_prompt(self.battle, self.opponent)
        self.assertTrue(result.allowed)

    def test_challenger_cannot_submit_on_opponent_turn(self):
        """Test challenger cannot submit during OPPONENT_TURN phase."""
        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.save()

        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result.allowed)
        self.assertIn('not your turn', result.error.lower())

    def test_both_can_submit_on_active_phase(self):
        """Test both players can submit during ACTIVE (sync) phase."""
        self.battle.phase = BattlePhase.ACTIVE
        self.battle.save()

        result_challenger = can_submit_prompt(self.battle, self.challenger)
        result_opponent = can_submit_prompt(self.battle, self.opponent)

        self.assertTrue(result_challenger.allowed)
        self.assertTrue(result_opponent.allowed)

    def test_is_users_turn_challenger_turn(self):
        """Test is_users_turn during CHALLENGER_TURN."""
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.save()

        self.assertTrue(is_users_turn(self.battle, self.challenger))
        self.assertFalse(is_users_turn(self.battle, self.opponent))

    def test_is_users_turn_opponent_turn(self):
        """Test is_users_turn during OPPONENT_TURN."""
        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.save()

        self.assertFalse(is_users_turn(self.battle, self.challenger))
        self.assertTrue(is_users_turn(self.battle, self.opponent))

    def test_is_users_turn_active_phase(self):
        """Test is_users_turn during ACTIVE phase (both can submit)."""
        self.battle.phase = BattlePhase.ACTIVE
        self.battle.save()

        self.assertTrue(is_users_turn(self.battle, self.challenger))
        self.assertTrue(is_users_turn(self.battle, self.opponent))


class AsyncBattlePhaseTransitionTestCase(TestCase):
    """Tests for async battle phase transitions."""

    def test_waiting_to_challenger_turn_valid(self):
        """Test WAITING -> CHALLENGER_TURN is valid for async battles."""
        self.assertTrue(is_valid_transition(BattlePhase.WAITING, BattlePhase.CHALLENGER_TURN))

    def test_challenger_turn_to_opponent_turn_valid(self):
        """Test CHALLENGER_TURN -> OPPONENT_TURN is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.OPPONENT_TURN))

    def test_opponent_turn_to_generating_valid(self):
        """Test OPPONENT_TURN -> GENERATING is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.OPPONENT_TURN, BattlePhase.GENERATING))

    def test_challenger_turn_to_complete_valid(self):
        """Test CHALLENGER_TURN -> COMPLETE is valid (timeout)."""
        self.assertTrue(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.COMPLETE))

    def test_opponent_turn_to_complete_valid(self):
        """Test OPPONENT_TURN -> COMPLETE is valid (timeout)."""
        self.assertTrue(is_valid_transition(BattlePhase.OPPONENT_TURN, BattlePhase.COMPLETE))

    def test_challenger_turn_to_active_valid(self):
        """Test CHALLENGER_TURN -> ACTIVE is valid (hybrid mode)."""
        self.assertTrue(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.ACTIVE))

    def test_opponent_turn_to_active_valid(self):
        """Test OPPONENT_TURN -> ACTIVE is valid (hybrid mode)."""
        self.assertTrue(is_valid_transition(BattlePhase.OPPONENT_TURN, BattlePhase.ACTIVE))

    def test_invalid_challenger_turn_to_generating(self):
        """Test CHALLENGER_TURN -> GENERATING is invalid (must go through OPPONENT_TURN)."""
        self.assertFalse(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.GENERATING))

    def test_invalid_waiting_to_opponent_turn(self):
        """Test WAITING -> OPPONENT_TURN is invalid (must start with challenger)."""
        self.assertFalse(is_valid_transition(BattlePhase.WAITING, BattlePhase.OPPONENT_TURN))


class AsyncBattleTimeRemainingTestCase(TestCase):
    """Tests for async battle time remaining calculations."""

    def setUp(self):
        """Set up test users and battle."""
        self.challenger = User.objects.create_user(
            username='challenger_time',
            email='challenger_time@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_time',
            email='opponent_time@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
        )

    def test_turn_time_remaining_during_turn_phase(self):
        """Test turn time remaining is returned during turn phases."""
        # Set up turn expiration
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.current_turn_expires_at = timezone.now() + timedelta(minutes=2)
        self.battle.save()

        remaining = self.battle.get_time_remaining_seconds()
        self.assertIsNotNone(remaining)
        self.assertGreater(remaining, 0)
        self.assertLessEqual(remaining, 120)  # 2 minutes

    def test_battle_time_remaining_during_active_phase(self):
        """Test battle expiration time is returned during ACTIVE phase."""
        self.battle.phase = BattlePhase.ACTIVE
        self.battle.expires_at = timezone.now() + timedelta(minutes=5)
        self.battle.save()

        remaining = self.battle.get_time_remaining_seconds()
        self.assertIsNotNone(remaining)
        self.assertGreater(remaining, 0)
        self.assertLessEqual(remaining, 300)  # 5 minutes

    def test_get_turn_time_explicitly(self):
        """Test explicitly getting turn time."""
        self.battle.current_turn_expires_at = timezone.now() + timedelta(minutes=1)
        self.battle.save()

        remaining = self.battle.get_time_remaining_seconds('turn')
        self.assertIsNotNone(remaining)
        self.assertLessEqual(remaining, 60)

    def test_get_deadline_time_explicitly(self):
        """Test explicitly getting deadline time."""
        self.battle.async_deadline = timezone.now() + timedelta(days=2)
        self.battle.save()

        remaining = self.battle.get_time_remaining_seconds('deadline')
        self.assertIsNotNone(remaining)
        self.assertGreater(remaining, 0)

    def test_invalid_timer_type_raises(self):
        """Test invalid timer type raises ValueError."""
        with self.assertRaises(ValueError) as context:
            self.battle.get_time_remaining_seconds('invalid_type')

        self.assertIn('invalid_type', str(context.exception))


class AsyncBattleSubmissionFlowTestCase(TestCase):
    """Tests for the complete async battle submission flow."""

    def setUp(self):
        """Set up test users and battle."""
        self.challenger = User.objects.create_user(
            username='challenger_flow',
            email='challenger_flow@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_flow',
            email='opponent_flow@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
        )

    def test_challenger_submits_first(self):
        """Test challenger can submit first in async battle."""
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertTrue(result.allowed)

        # Create submission
        submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='Test prompt from challenger',
            submission_type='image',
        )

        self.assertIsNotNone(submission.id)

    def test_existing_submission_blocks_resubmit(self):
        """Test user cannot submit twice."""
        # Create first submission
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='First submission',
            submission_type='image',
        )

        # Try to submit again with check_existing=True
        result = can_submit_prompt(self.battle, self.challenger, check_existing=True)
        self.assertFalse(result.allowed)
        self.assertIn('already submitted', result.error.lower())

    def test_opponent_blocked_until_challenger_submits(self):
        """Test opponent cannot submit during CHALLENGER_TURN."""
        self.battle.phase = BattlePhase.CHALLENGER_TURN
        self.battle.save()

        result = can_submit_prompt(self.battle, self.opponent)
        self.assertFalse(result.allowed)

    def test_transition_to_opponent_turn_after_challenger_submits(self):
        """Test valid transition after challenger submits."""
        # Simulate transition
        self.assertTrue(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.OPPONENT_TURN))

        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.save()

        # Now opponent can submit
        result = can_submit_prompt(self.battle, self.opponent)
        self.assertTrue(result.allowed)


class AsyncBattleDeadlineTestCase(TestCase):
    """Tests for async battle deadline handling."""

    def setUp(self):
        """Set up test battle with deadline."""
        self.challenger = User.objects.create_user(
            username='challenger_deadline',
            email='challenger_deadline@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_deadline',
            email='opponent_deadline@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
            async_deadline=timezone.now() + timedelta(days=3),
        )

    def test_deadline_time_remaining(self):
        """Test deadline time remaining calculation."""
        remaining = self.battle.get_time_remaining_seconds('deadline')
        self.assertIsNotNone(remaining)
        # Should be close to 3 days (259200 seconds)
        self.assertGreater(remaining, 259000)

    def test_expired_deadline_returns_zero(self):
        """Test expired deadline returns 0."""
        self.battle.async_deadline = timezone.now() - timedelta(hours=1)
        self.battle.save()

        remaining = self.battle.get_time_remaining_seconds('deadline')
        self.assertEqual(remaining, 0)

    def test_extend_deadline(self):
        """Test extending the deadline."""
        original_deadline = self.battle.async_deadline

        # Extend by 1 day
        success = self.battle.extend_deadline(self.challenger, days=1)

        self.assertTrue(success)
        self.battle.refresh_from_db()
        self.assertGreater(self.battle.async_deadline, original_deadline)
        self.assertEqual(self.battle.extension_count, 1)

    def test_max_extension_limit(self):
        """Test maximum extension limit is enforced."""
        # Use up both extensions
        self.battle.extension_count = 2
        self.battle.save()

        success = self.battle.extend_deadline(self.challenger, days=1)
        self.assertFalse(success)


class AsyncBattleHybridModeTestCase(TestCase):
    """Tests for async/sync hybrid mode transitions."""

    def test_active_to_challenger_turn_valid(self):
        """Test ACTIVE -> CHALLENGER_TURN is valid (player went offline)."""
        self.assertTrue(is_valid_transition(BattlePhase.ACTIVE, BattlePhase.CHALLENGER_TURN))

    def test_challenger_turn_to_active_valid(self):
        """Test CHALLENGER_TURN -> ACTIVE is valid (both players online)."""
        self.assertTrue(is_valid_transition(BattlePhase.CHALLENGER_TURN, BattlePhase.ACTIVE))

    def test_opponent_turn_to_active_valid(self):
        """Test OPPONENT_TURN -> ACTIVE is valid (both players online)."""
        self.assertTrue(is_valid_transition(BattlePhase.OPPONENT_TURN, BattlePhase.ACTIVE))


class AsyncBattleSerializerTestCase(TestCase):
    """Tests for serializer can_submit with async battles."""

    def setUp(self):
        """Set up test users and battle."""
        self.challenger = User.objects.create_user(
            username='challenger_serial',
            email='challenger_serial@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_serial',
            email='opponent_serial@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Test challenge',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Test challenge',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.CHALLENGER_TURN,
            battle_mode=BattleMode.ASYNC,
            duration_minutes=10,
        )

    def test_serializer_can_submit_challenger_turn(self):
        """Test serializer returns correct can_submit for challenger turn."""
        from rest_framework.test import APIRequestFactory

        from core.battles.serializers import PromptBattleSerializer

        factory = APIRequestFactory()

        # Test challenger can submit
        request = factory.get('/')
        request.user = self.challenger
        serializer = PromptBattleSerializer(self.battle, context={'request': request})
        self.assertTrue(serializer.data['can_submit'])

        # Test opponent cannot submit
        request.user = self.opponent
        serializer = PromptBattleSerializer(self.battle, context={'request': request})
        self.assertFalse(serializer.data['can_submit'])

    def test_serializer_can_submit_opponent_turn(self):
        """Test serializer returns correct can_submit for opponent turn."""
        from rest_framework.test import APIRequestFactory

        from core.battles.serializers import PromptBattleSerializer

        self.battle.phase = BattlePhase.OPPONENT_TURN
        self.battle.save()

        factory = APIRequestFactory()

        # Test opponent can submit
        request = factory.get('/')
        request.user = self.opponent
        serializer = PromptBattleSerializer(self.battle, context={'request': request})
        self.assertTrue(serializer.data['can_submit'])

        # Test challenger cannot submit
        request.user = self.challenger
        serializer = PromptBattleSerializer(self.battle, context={'request': request})
        self.assertFalse(serializer.data['can_submit'])
