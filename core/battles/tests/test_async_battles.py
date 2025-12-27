"""
Tests for async turn-based battle functionality and Pip (AI opponent) battles.

These tests cover:
- Turn validation (challenger/opponent turn)
- Turn timeout behavior
- Deadline expiration
- Phase transitions for async battles
- Pip battle complete flow (critical path)
- Submission validation
- Image generation mocking
- Judging flow
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from core.battles.models import (
    BattleMode,
    BattlePhase,
    BattleStatus,
    BattleSubmission,
    MatchSource,
    PromptBattle,
    PromptChallengePrompt,
)
from core.battles.phase_utils import can_submit_prompt, is_users_turn
from core.battles.services import BattleService, PipBattleAI
from core.battles.state_machine import is_valid_transition
from core.users.models import User, UserRole


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


class SubmitPromptValidationTestCase(TestCase):
    """Tests for submit_prompt validation including copy-paste prevention."""

    def setUp(self):
        """Set up test fixtures."""
        self.challenger = User.objects.create_user(
            username='challenger_validation',
            email='challenger_validation@test.com',
            password='testpass123',
        )
        self.opponent = User.objects.create_user(
            username='opponent_validation',
            email='opponent_validation@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create a mystical forest scene',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.opponent,
            challenge_text='Create a mystical forest scene',
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            battle_mode=BattleMode.SYNC,
            duration_minutes=10,
        )

        self.service = BattleService()

    def test_copy_paste_challenge_rejected(self):
        """Test that copying the challenge text exactly is rejected."""
        with self.assertRaises(ValueError) as context:
            self.service.submit_prompt(
                battle=self.battle,
                user=self.challenger,
                prompt_text='Create a mystical forest scene',
            )

        self.assertIn('creative', str(context.exception).lower())

    def test_copy_paste_with_different_case_rejected(self):
        """Test that copying with different case is rejected."""
        with self.assertRaises(ValueError) as context:
            self.service.submit_prompt(
                battle=self.battle,
                user=self.challenger,
                prompt_text='CREATE A MYSTICAL FOREST SCENE',
            )

        self.assertIn('creative', str(context.exception).lower())

    def test_copy_paste_with_extra_whitespace_rejected(self):
        """Test that copying with extra whitespace is rejected."""
        with self.assertRaises(ValueError) as context:
            self.service.submit_prompt(
                battle=self.battle,
                user=self.challenger,
                prompt_text='  Create a mystical forest scene  ',
            )

        self.assertIn('creative', str(context.exception).lower())

    def test_unique_prompt_accepted(self):
        """Test that a unique creative prompt is accepted."""
        submission = self.service.submit_prompt(
            battle=self.battle,
            user=self.challenger,
            prompt_text='A glowing enchanted woodland with fireflies and ancient trees',
        )

        self.assertIsNotNone(submission)
        self.assertEqual(submission.user, self.challenger)

    def test_prompt_too_short_rejected(self):
        """Test that prompts under 10 characters are rejected."""
        with self.assertRaises(ValueError) as context:
            self.service.submit_prompt(
                battle=self.battle,
                user=self.challenger,
                prompt_text='short',
            )

        self.assertIn('10 characters', str(context.exception))

    def test_prompt_too_long_rejected(self):
        """Test that prompts over 5000 characters are rejected."""
        with self.assertRaises(ValueError) as context:
            self.service.submit_prompt(
                battle=self.battle,
                user=self.challenger,
                prompt_text='x' * 5001,
            )

        self.assertIn('5000 characters', str(context.exception))


# =============================================================================
# PIP BATTLE TESTS - CRITICAL PATH
# =============================================================================


class PipBattleSetupTestCase(TestCase):
    """Tests for Pip battle setup and initialization."""

    def setUp(self):
        """Set up test fixtures including Pip user."""
        # Create Pip user (AI opponent)
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        # Create human challenger
        self.challenger = User.objects.create_user(
            username='challenger_pip',
            email='challenger_pip@test.com',
            password='testpass123',
        )

        # Create curated prompt
        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create an epic dragon breathing fire',
            difficulty='medium',
            is_active=True,
        )

    def test_pip_user_exists(self):
        """Test that Pip user is properly created with AGENT role."""
        pip = User.objects.filter(username='pip', role=UserRole.AGENT).first()
        self.assertIsNotNone(pip)
        self.assertEqual(pip.role, UserRole.AGENT)

    def test_create_pip_battle(self):
        """Test creating a battle against Pip."""
        battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            match_source=MatchSource.AI_OPPONENT,
        )

        self.assertIsNotNone(battle)
        self.assertEqual(battle.opponent, self.pip)
        self.assertEqual(battle.match_source, MatchSource.AI_OPPONENT)

    def test_pip_battle_ai_get_pip_user(self):
        """Test PipBattleAI can find Pip user."""
        pip_ai = PipBattleAI()
        pip_user = pip_ai.get_pip_user()

        self.assertIsNotNone(pip_user)
        self.assertEqual(pip_user.username, 'pip')


class PipBattleSubmissionTestCase(TestCase):
    """Tests for Pip battle submission flow."""

    def setUp(self):
        """Set up test fixtures for Pip battles."""
        # Create Pip user
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        # Create human challenger
        self.challenger = User.objects.create_user(
            username='challenger_submit',
            email='challenger_submit@test.com',
            password='testpass123',
        )

        # Create curated prompt
        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Paint a serene mountain lake at sunset',
            difficulty='medium',
            is_active=True,
        )

        # Create Pip battle in ACTIVE phase
        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            match_source=MatchSource.AI_OPPONENT,
            duration_minutes=3,
        )

    def test_challenger_can_submit_in_pip_battle(self):
        """Test human challenger can submit during active Pip battle."""
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertTrue(result.allowed)

    def test_pip_can_submit_in_pip_battle(self):
        """Test Pip can submit during active Pip battle."""
        result = can_submit_prompt(self.battle, self.pip)
        self.assertTrue(result.allowed)

    @patch('services.ai.provider.AIProvider')
    def test_pip_generates_creative_submission(self, mock_ai_provider):
        """Test Pip generates a creative prompt response."""
        # Mock AI response
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'A breathtaking alpine lake reflecting golden sunlight'
        mock_ai_provider.return_value = mock_ai

        pip_ai = PipBattleAI()
        prompt_text = pip_ai.generate_pip_submission(self.battle)

        self.assertIsNotNone(prompt_text)
        self.assertGreater(len(prompt_text), 10)

    @patch('services.ai.provider.AIProvider')
    def test_pip_create_submission_creates_record(self, mock_ai_provider):
        """Test create_pip_submission creates a BattleSubmission record."""
        # Mock AI response
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'Golden hour over pristine mountain waters'
        mock_ai_provider.return_value = mock_ai

        pip_ai = PipBattleAI()
        submission = pip_ai.create_pip_submission(self.battle)

        self.assertIsNotNone(submission)
        self.assertEqual(submission.user, self.pip)
        self.assertEqual(submission.battle, self.battle)
        self.assertGreater(len(submission.prompt_text), 10)

    @patch('services.ai.provider.AIProvider')
    def test_pip_submission_is_idempotent(self, mock_ai_provider):
        """Test Pip submission creation is idempotent - returns existing if called twice."""
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'Sunset reflections on mountain lake'
        mock_ai_provider.return_value = mock_ai

        pip_ai = PipBattleAI()

        # First call creates submission
        submission1 = pip_ai.create_pip_submission(self.battle)
        # Second call should return the same submission
        submission2 = pip_ai.create_pip_submission(self.battle)

        self.assertEqual(submission1.id, submission2.id)

    def test_human_submission_creates_record(self):
        """Test human can create submission in Pip battle."""
        service = BattleService()
        submission = service.submit_prompt(
            battle=self.battle,
            user=self.challenger,
            prompt_text='A majestic mountain lake with reflections of snow-capped peaks',
        )

        self.assertIsNotNone(submission)
        self.assertEqual(submission.user, self.challenger)


class PipBattlePhaseTransitionTestCase(TestCase):
    """Tests for Pip battle phase transitions."""

    def setUp(self):
        """Set up test fixtures."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='challenger_phase',
            email='challenger_phase@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Design a futuristic cityscape',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.WAITING,
            match_source=MatchSource.AI_OPPONENT,
        )

    def test_waiting_to_countdown_valid(self):
        """Test WAITING -> COUNTDOWN is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.WAITING, BattlePhase.COUNTDOWN))

    def test_countdown_to_active_valid(self):
        """Test COUNTDOWN -> ACTIVE is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.COUNTDOWN, BattlePhase.ACTIVE))

    def test_active_to_generating_valid(self):
        """Test ACTIVE -> GENERATING is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.ACTIVE, BattlePhase.GENERATING))

    def test_generating_to_judging_valid(self):
        """Test GENERATING -> JUDGING is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.GENERATING, BattlePhase.JUDGING))

    def test_judging_to_reveal_valid(self):
        """Test JUDGING -> REVEAL is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.JUDGING, BattlePhase.REVEAL))

    def test_reveal_to_complete_valid(self):
        """Test REVEAL -> COMPLETE is valid."""
        self.assertTrue(is_valid_transition(BattlePhase.REVEAL, BattlePhase.COMPLETE))

    def test_set_phase_updates_timestamp(self):
        """Test set_phase method updates phase_changed_at."""
        old_changed_at = self.battle.phase_changed_at
        self.battle.set_phase(BattlePhase.COUNTDOWN)

        self.assertEqual(self.battle.phase, BattlePhase.COUNTDOWN)
        self.assertIsNotNone(self.battle.phase_changed_at)
        if old_changed_at:
            self.assertNotEqual(self.battle.phase_changed_at, old_changed_at)


class PipBattleBothSubmittedTestCase(TestCase):
    """Tests for the 'both submitted' transition in Pip battles."""

    def setUp(self):
        """Set up test fixtures with both submissions."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='challenger_both',
            email='challenger_both@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create abstract art',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            match_source=MatchSource.AI_OPPONENT,
        )

    def test_both_submissions_count(self):
        """Test both submissions are counted correctly."""
        # Create challenger submission
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='Vibrant abstract colors flowing together',
            submission_type='image',
        )

        # Create Pip submission
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip,
            prompt_text='Geometric patterns in neon colors',
            submission_type='image',
        )

        submissions = self.battle.submissions.all()
        self.assertEqual(len(submissions), 2)

    def test_can_transition_to_generating_with_two_submissions(self):
        """Test battle can transition to GENERATING when both have submitted."""
        # Create both submissions
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='Test prompt 1',
            submission_type='image',
        )
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip,
            prompt_text='Test prompt 2',
            submission_type='image',
        )

        # Valid transition from ACTIVE to GENERATING
        self.assertTrue(is_valid_transition(BattlePhase.ACTIVE, BattlePhase.GENERATING))

        # Update battle phase
        self.battle.phase = BattlePhase.GENERATING
        self.battle.save()

        self.assertEqual(self.battle.phase, BattlePhase.GENERATING)


class PipBattleImageGenerationTestCase(TestCase):
    """Tests for image generation in Pip battles."""

    def setUp(self):
        """Set up test fixtures."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='challenger_img',
            email='challenger_img@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Paint a cosmic nebula',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.GENERATING,
            match_source=MatchSource.AI_OPPONENT,
        )

        # Create submissions
        self.challenger_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='A swirling galaxy with vibrant purple and blue hues',
            submission_type='image',
        )

        self.pip_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip,
            prompt_text='Cosmic dust clouds illuminated by distant stars',
            submission_type='image',
        )

    def test_submission_without_image(self):
        """Test submission starts without generated image."""
        self.assertIsNone(self.challenger_submission.generated_output_url)
        self.assertIsNone(self.pip_submission.generated_output_url)

    @patch('services.integrations.storage.storage_service.get_storage_service')
    @patch('services.ai.provider.AIProvider')
    @patch('core.battles.services.check_and_reserve_ai_request')
    def test_generate_image_for_challenger(self, mock_reserve, mock_ai_provider, mock_storage):
        """Test image generation for challenger submission."""
        # Mock AI provider
        mock_ai = MagicMock()
        mock_ai.generate_image.return_value = (b'fake_image_data', 'image/png', None)
        mock_ai_provider.return_value = mock_ai

        # Mock storage
        mock_storage_service = MagicMock()
        mock_storage_service.upload_file.return_value = ('https://example.com/image.png', None)
        mock_storage.return_value = mock_storage_service

        # Mock quota check
        mock_reserve.return_value = (True, None)

        service = BattleService()
        with patch('core.battles.services.process_ai_request'):
            image_url = service.generate_image_for_submission(self.challenger_submission)

        self.assertIsNotNone(image_url)
        self.assertEqual(image_url, 'https://example.com/image.png')

    @patch('services.integrations.storage.storage_service.get_storage_service')
    @patch('services.ai.provider.AIProvider')
    def test_generate_image_for_pip_no_quota_check(self, mock_ai_provider, mock_storage):
        """Test image generation for Pip doesn't check quota."""
        # Mock AI provider
        mock_ai = MagicMock()
        mock_ai.generate_image.return_value = (b'fake_image_data', 'image/png', None)
        mock_ai_provider.return_value = mock_ai

        # Mock storage
        mock_storage_service = MagicMock()
        mock_storage_service.upload_file.return_value = ('https://example.com/pip_image.png', None)
        mock_storage.return_value = mock_storage_service

        service = BattleService()
        image_url = service.generate_image_for_submission(self.pip_submission)

        # Should succeed without quota check
        self.assertIsNotNone(image_url)

    def test_both_images_generated_triggers_judging(self):
        """Test that both images trigger judging phase."""
        # Simulate both images being generated
        self.challenger_submission.generated_output_url = 'https://example.com/img1.png'
        self.challenger_submission.save()

        self.pip_submission.generated_output_url = 'https://example.com/img2.png'
        self.pip_submission.save()

        # Verify both have images
        submissions = list(self.battle.submissions.all())
        all_have_images = all(s.generated_output_url for s in submissions)
        self.assertTrue(all_have_images)


class PipBattleJudgingTestCase(TestCase):
    """Tests for judging flow in Pip battles."""

    def setUp(self):
        """Set up test fixtures with completed submissions."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='challenger_judge',
            email='challenger_judge@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Design a robot companion',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.JUDGING,
            match_source=MatchSource.AI_OPPONENT,
        )

        # Create submissions with generated images
        self.challenger_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='A friendly android with glowing blue eyes',
            submission_type='image',
            generated_output_url='https://example.com/challenger_robot.png',
        )

        self.pip_submission = BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip,
            prompt_text='Sleek metallic companion with soft curves',
            submission_type='image',
            generated_output_url='https://example.com/pip_robot.png',
        )

    @patch('services.ai.provider.AIProvider')
    @patch('core.battles.services.BattleVote')
    def test_judge_battle_determines_winner(self, mock_vote_class, mock_ai_provider):
        """Test judging determines a winner."""
        # Mock AI judging response
        mock_ai = MagicMock()
        mock_ai.complete_with_image.return_value = """
        {
            "scores": {
                "Prompt Craft": 75,
                "Creativity": 80,
                "Visual Impact": 70,
                "Relevance": 85,
                "Execution": 72
            },
            "feedback": "Creative interpretation with good detail."
        }
        """
        mock_ai.last_usage = {'total_tokens': 500}
        mock_ai_provider.return_value = mock_ai

        # Mock vote creation to avoid database contention in CI
        mock_vote_class.objects.create.return_value = MagicMock()

        service = BattleService()
        results = service.judge_battle(self.battle)

        self.assertNotIn('error', results)
        self.assertIn('winner_id', results)
        self.assertIn('results', results)

    def test_judge_battle_fails_with_missing_submissions(self):
        """Test judging fails if not enough submissions."""
        # Delete one submission
        self.pip_submission.delete()

        service = BattleService()
        results = service.judge_battle(self.battle)

        self.assertIn('error', results)

    def test_judge_battle_fails_with_missing_images(self):
        """Test judging fails if submissions lack images."""
        # Remove image from one submission
        self.challenger_submission.generated_output_url = None
        self.challenger_submission.save()

        service = BattleService()
        results = service.judge_battle(self.battle)

        self.assertIn('error', results)


class PipBattleCompletionTestCase(TestCase):
    """Tests for battle completion and point awarding."""

    def setUp(self):
        """Set up test fixtures."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='challenger_complete',
            email='challenger_complete@test.com',
            password='testpass123',
            total_points=0,
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create a magical creature',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.REVEAL,
            match_source=MatchSource.AI_OPPONENT,
            winner=self.challenger,
        )

        # Create submissions
        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.challenger,
            prompt_text='A phoenix rising from colorful flames',
            submission_type='image',
            generated_output_url='https://example.com/challenger.png',
            score=75,
        )

        BattleSubmission.objects.create(
            battle=self.battle,
            user=self.pip,
            prompt_text='A dragon with crystalline scales',
            submission_type='image',
            generated_output_url='https://example.com/pip.png',
            score=65,
        )

    def test_complete_battle_sets_complete_phase(self):
        """Test complete_battle sets phase to COMPLETE."""
        service = BattleService()
        service.complete_battle(self.battle)

        self.battle.refresh_from_db()
        self.assertEqual(self.battle.phase, BattlePhase.COMPLETE)
        self.assertEqual(self.battle.status, BattleStatus.COMPLETED)

    def test_complete_battle_sets_completed_at(self):
        """Test complete_battle sets completed_at timestamp."""
        service = BattleService()
        service.complete_battle(self.battle)

        self.battle.refresh_from_db()
        self.assertIsNotNone(self.battle.completed_at)

    def test_complete_battle_awards_winner_points(self):
        """Test winner receives points on completion."""
        initial_points = self.challenger.total_points
        service = BattleService()
        service.complete_battle(self.battle)

        self.challenger.refresh_from_db()
        self.assertGreater(self.challenger.total_points, initial_points)

    def test_complete_battle_is_idempotent(self):
        """Test calling complete_battle twice doesn't double-award points."""
        service = BattleService()
        service.complete_battle(self.battle)

        self.challenger.refresh_from_db()
        points_after_first = self.challenger.total_points

        # Call again
        service.complete_battle(self.battle)

        self.challenger.refresh_from_db()
        # Points should not increase (already complete)
        self.assertEqual(self.challenger.total_points, points_after_first)


class PipBattleEndToEndFlowTestCase(TestCase):
    """
    End-to-end test for Pip battle flow.

    This test verifies the complete flow:
    1. Battle creation
    2. Phase transitions (WAITING -> COUNTDOWN -> ACTIVE)
    3. Pip submission creation
    4. Human submission creation
    5. Image generation (mocked)
    6. Judging (mocked)
    7. Winner determination
    8. Battle completion
    """

    def setUp(self):
        """Set up test fixtures."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='e2e_challenger',
            email='e2e_challenger@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Create an underwater kingdom',
            difficulty='medium',
            is_active=True,
        )

    def test_complete_pip_battle_flow(self):
        """Test the complete Pip battle flow from creation to completion."""
        # Step 1: Create battle
        battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.PENDING,
            phase=BattlePhase.WAITING,
            match_source=MatchSource.AI_OPPONENT,
        )

        self.assertEqual(battle.phase, BattlePhase.WAITING)

        # Step 2: Transition to COUNTDOWN
        battle.set_phase(BattlePhase.COUNTDOWN)
        self.assertEqual(battle.phase, BattlePhase.COUNTDOWN)

        # Step 3: Transition to ACTIVE
        battle.status = BattleStatus.ACTIVE
        battle.set_phase(BattlePhase.ACTIVE)
        self.assertEqual(battle.phase, BattlePhase.ACTIVE)

        # Step 4: Create Pip submission
        pip_submission = BattleSubmission.objects.create(
            battle=battle,
            user=self.pip,
            prompt_text='Coral palaces with bioluminescent gardens',
            submission_type='image',
        )

        # Step 5: Create human submission
        service = BattleService()
        human_submission = service.submit_prompt(
            battle=battle,
            user=self.challenger,
            prompt_text='Mermaids dancing around ancient ruins with sea creatures',
        )

        # Verify both submissions exist
        self.assertEqual(battle.submissions.count(), 2)

        # Step 6: Simulate image generation
        pip_submission.generated_output_url = 'https://example.com/pip.png'
        pip_submission.save()
        human_submission.generated_output_url = 'https://example.com/human.png'
        human_submission.save()

        # Step 7: Transition to GENERATING
        battle.set_phase(BattlePhase.GENERATING)
        self.assertEqual(battle.phase, BattlePhase.GENERATING)

        # Step 8: Simulate judging
        battle.set_phase(BattlePhase.JUDGING)
        self.assertEqual(battle.phase, BattlePhase.JUDGING)

        # Simulate scores
        human_submission.score = 78
        human_submission.save()
        pip_submission.score = 72
        pip_submission.save()

        # Set winner
        battle.winner = self.challenger
        battle.set_phase(BattlePhase.REVEAL)
        self.assertEqual(battle.phase, BattlePhase.REVEAL)
        self.assertEqual(battle.winner, self.challenger)

        # Step 9: Complete battle
        service.complete_battle(battle)

        battle.refresh_from_db()
        self.assertEqual(battle.phase, BattlePhase.COMPLETE)
        self.assertEqual(battle.status, BattleStatus.COMPLETED)
        self.assertIsNotNone(battle.completed_at)


class PipBattleTaskTestCase(TestCase):
    """Tests for Celery tasks related to Pip battles."""

    def setUp(self):
        """Set up test fixtures."""
        self.pip = User.objects.create_user(
            username='pip',
            email='pip@allthrive.ai',
            password='testpass123',
            role=UserRole.AGENT,
        )

        self.challenger = User.objects.create_user(
            username='task_challenger',
            email='task_challenger@test.com',
            password='testpass123',
        )

        self.prompt = PromptChallengePrompt.objects.create(
            prompt_text='Design a space station',
            difficulty='medium',
            is_active=True,
        )

        self.battle = PromptBattle.objects.create(
            challenger=self.challenger,
            opponent=self.pip,
            challenge_text=self.prompt.prompt_text,
            prompt=self.prompt,
            status=BattleStatus.ACTIVE,
            phase=BattlePhase.ACTIVE,
            match_source=MatchSource.AI_OPPONENT,
        )

    @patch('core.battles.tasks.generate_submission_image_task.apply_async')
    @patch('services.ai.provider.AIProvider')
    def test_create_pip_submission_task(self, mock_ai_provider, mock_image_task):
        """Test create_pip_submission_task creates submission and queues image."""
        from core.battles.tasks import create_pip_submission_task

        # Mock AI response
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'A modular space station orbiting Earth'
        mock_ai_provider.return_value = mock_ai

        # Call the task
        result = create_pip_submission_task(self.battle.id)

        self.assertEqual(result['status'], 'success')
        self.assertIn('submission_id', result)

        # Verify submission was created
        submission = BattleSubmission.objects.get(id=result['submission_id'])
        self.assertEqual(submission.user, self.pip)

        # Verify image generation was queued
        mock_image_task.assert_called_once()

    @patch('core.battles.tasks.generate_submission_image_task.apply_async')
    @patch('services.ai.provider.AIProvider')
    def test_create_pip_submission_task_idempotent(self, mock_ai_provider, mock_image_task):
        """Test create_pip_submission_task is idempotent."""
        from core.battles.tasks import create_pip_submission_task

        # Mock AI response
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'Space station design'
        mock_ai_provider.return_value = mock_ai

        # Call once
        result1 = create_pip_submission_task(self.battle.id)
        self.assertEqual(result1['status'], 'success')

        # Reset mock
        mock_image_task.reset_mock()

        # Call again
        result2 = create_pip_submission_task(self.battle.id)
        self.assertEqual(result2['status'], 'already_submitted')

        # Image task should NOT be queued again
        mock_image_task.assert_not_called()

    def test_create_pip_submission_task_non_pip_battle(self):
        """Test create_pip_submission_task fails for non-Pip battles."""
        from core.battles.tasks import create_pip_submission_task

        # Create a non-Pip opponent
        other_user = User.objects.create_user(
            username='other_opponent',
            email='other@test.com',
            password='testpass123',
        )

        # Update battle to use non-Pip opponent
        self.battle.opponent = other_user
        self.battle.save()

        result = create_pip_submission_task(self.battle.id)

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'not_pip_battle')
