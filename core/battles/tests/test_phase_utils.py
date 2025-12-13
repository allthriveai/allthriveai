"""
Tests for phase_utils module.
"""

from unittest.mock import MagicMock

from django.test import TestCase

from core.battles.constants import (
    PHASE_ACTIVE,
    PHASE_CHALLENGER_TURN,
    PHASE_COMPLETE,
    PHASE_COUNTDOWN,
    PHASE_GENERATING,
    PHASE_JUDGING,
    PHASE_OPPONENT_TURN,
    PHASE_REVEAL,
    PHASE_WAITING,
)
from core.battles.models import BattleStatus
from core.battles.phase_utils import (
    SubmissionResult,
    can_submit_prompt,
    get_whose_turn,
    is_async_turn_phase,
    is_results_phase,
    is_submittable_phase,
    is_terminal_phase,
    is_users_turn,
)


class SubmissionResultTestCase(TestCase):
    """Tests for SubmissionResult NamedTuple."""

    def test_submission_result_allowed(self):
        """Test that allowed=True returns truthy."""
        result = SubmissionResult(allowed=True)
        self.assertTrue(result)
        self.assertTrue(result.allowed)
        self.assertIsNone(result.error)

    def test_submission_result_not_allowed(self):
        """Test that allowed=False returns falsy with error."""
        result = SubmissionResult(allowed=False, error='Test error')
        self.assertFalse(result)
        self.assertFalse(result.allowed)
        self.assertEqual(result.error, 'Test error')

    def test_submission_result_is_namedtuple(self):
        """Test that SubmissionResult is immutable."""
        result = SubmissionResult(allowed=True)
        with self.assertRaises(AttributeError):
            result.allowed = False  # type: ignore


class PhaseCheckHelpersTestCase(TestCase):
    """Tests for phase check helper functions."""

    def test_is_submittable_phase_active(self):
        """Test ACTIVE phase is submittable."""
        self.assertTrue(is_submittable_phase(PHASE_ACTIVE))

    def test_is_submittable_phase_challenger_turn(self):
        """Test CHALLENGER_TURN phase is submittable."""
        self.assertTrue(is_submittable_phase(PHASE_CHALLENGER_TURN))

    def test_is_submittable_phase_opponent_turn(self):
        """Test OPPONENT_TURN phase is submittable."""
        self.assertTrue(is_submittable_phase(PHASE_OPPONENT_TURN))

    def test_is_submittable_phase_waiting_not_submittable(self):
        """Test WAITING phase is not submittable."""
        self.assertFalse(is_submittable_phase(PHASE_WAITING))

    def test_is_submittable_phase_generating_not_submittable(self):
        """Test GENERATING phase is not submittable."""
        self.assertFalse(is_submittable_phase(PHASE_GENERATING))

    def test_is_async_turn_phase(self):
        """Test async turn phase detection."""
        self.assertTrue(is_async_turn_phase(PHASE_CHALLENGER_TURN))
        self.assertTrue(is_async_turn_phase(PHASE_OPPONENT_TURN))
        self.assertFalse(is_async_turn_phase(PHASE_ACTIVE))

    def test_is_terminal_phase(self):
        """Test terminal phase detection."""
        self.assertTrue(is_terminal_phase(PHASE_REVEAL))
        self.assertTrue(is_terminal_phase(PHASE_COMPLETE))
        self.assertFalse(is_terminal_phase(PHASE_ACTIVE))

    def test_is_results_phase(self):
        """Test results phase detection."""
        self.assertTrue(is_results_phase(PHASE_REVEAL))
        self.assertTrue(is_results_phase(PHASE_COMPLETE))
        self.assertFalse(is_results_phase(PHASE_JUDGING))


class CanSubmitPromptTestCase(TestCase):
    """Tests for can_submit_prompt function."""

    def setUp(self):
        """Set up mock battle and users."""
        self.challenger = MagicMock()
        self.challenger.id = 1

        self.opponent = MagicMock()
        self.opponent.id = 2

        self.non_participant = MagicMock()
        self.non_participant.id = 999

        self.battle = MagicMock()
        self.battle.challenger_id = 1
        self.battle.opponent_id = 2
        self.battle.challenger = self.challenger
        self.battle.opponent = self.opponent
        self.battle.status = BattleStatus.ACTIVE
        self.battle.phase = PHASE_ACTIVE

    def test_non_participant_cannot_submit(self):
        """Test that non-participants cannot submit."""
        result = can_submit_prompt(self.battle, self.non_participant)
        self.assertFalse(result)
        self.assertIn('not a participant', result.error)

    def test_inactive_battle_cannot_submit(self):
        """Test that inactive battles don't allow submissions."""
        self.battle.status = BattleStatus.PENDING
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('not active', result.error)

    def test_waiting_phase_cannot_submit(self):
        """Test that WAITING phase doesn't allow submissions."""
        self.battle.phase = PHASE_WAITING
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('opponent', result.error.lower())

    def test_countdown_phase_cannot_submit(self):
        """Test that COUNTDOWN phase doesn't allow submissions."""
        self.battle.phase = PHASE_COUNTDOWN
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('starting soon', result.error)

    def test_generating_phase_cannot_submit(self):
        """Test that GENERATING phase doesn't allow submissions."""
        self.battle.phase = PHASE_GENERATING
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('generated', result.error.lower())

    def test_judging_phase_cannot_submit(self):
        """Test that JUDGING phase doesn't allow submissions."""
        self.battle.phase = PHASE_JUDGING
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('judged', result.error.lower())

    def test_terminal_phase_cannot_submit(self):
        """Test that terminal phases don't allow submissions."""
        self.battle.phase = PHASE_COMPLETE
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('ended', result.error.lower())

    def test_active_phase_allows_submission(self):
        """Test that ACTIVE phase allows submissions for participants."""
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertTrue(result)
        self.assertIsNone(result.error)

    def test_challenger_turn_allows_challenger(self):
        """Test that CHALLENGER_TURN allows challenger to submit."""
        self.battle.phase = PHASE_CHALLENGER_TURN
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertTrue(result)

    def test_challenger_turn_blocks_opponent(self):
        """Test that CHALLENGER_TURN blocks opponent from submitting."""
        self.battle.phase = PHASE_CHALLENGER_TURN
        result = can_submit_prompt(self.battle, self.opponent)
        self.assertFalse(result)
        self.assertIn('not your turn', result.error.lower())

    def test_opponent_turn_allows_opponent(self):
        """Test that OPPONENT_TURN allows opponent to submit."""
        self.battle.phase = PHASE_OPPONENT_TURN
        result = can_submit_prompt(self.battle, self.opponent)
        self.assertTrue(result)

    def test_opponent_turn_blocks_challenger(self):
        """Test that OPPONENT_TURN blocks challenger from submitting."""
        self.battle.phase = PHASE_OPPONENT_TURN
        result = can_submit_prompt(self.battle, self.challenger)
        self.assertFalse(result)
        self.assertIn('not your turn', result.error.lower())


class GetWhoseTurnTestCase(TestCase):
    """Tests for get_whose_turn function."""

    def test_challenger_turn_returns_challenger(self):
        """Test that CHALLENGER_TURN returns challenger."""
        battle = MagicMock()
        battle.phase = PHASE_CHALLENGER_TURN
        battle.challenger = MagicMock()
        battle.opponent = MagicMock()

        result = get_whose_turn(battle)
        self.assertEqual(result, battle.challenger)

    def test_opponent_turn_returns_opponent(self):
        """Test that OPPONENT_TURN returns opponent."""
        battle = MagicMock()
        battle.phase = PHASE_OPPONENT_TURN
        battle.challenger = MagicMock()
        battle.opponent = MagicMock()

        result = get_whose_turn(battle)
        self.assertEqual(result, battle.opponent)

    def test_active_phase_returns_none(self):
        """Test that ACTIVE phase returns None."""
        battle = MagicMock()
        battle.phase = PHASE_ACTIVE

        result = get_whose_turn(battle)
        self.assertIsNone(result)


class IsUsersTurnTestCase(TestCase):
    """Tests for is_users_turn function."""

    def setUp(self):
        """Set up mock battle and users."""
        self.challenger = MagicMock()
        self.challenger.id = 1

        self.opponent = MagicMock()
        self.opponent.id = 2

        self.battle = MagicMock()
        self.battle.challenger_id = 1
        self.battle.opponent_id = 2

    def test_active_phase_returns_true_for_participants(self):
        """Test that ACTIVE phase returns True for any participant."""
        self.battle.phase = PHASE_ACTIVE

        self.assertTrue(is_users_turn(self.battle, self.challenger))
        self.assertTrue(is_users_turn(self.battle, self.opponent))

    def test_challenger_turn_returns_true_for_challenger(self):
        """Test that CHALLENGER_TURN returns True for challenger."""
        self.battle.phase = PHASE_CHALLENGER_TURN
        self.assertTrue(is_users_turn(self.battle, self.challenger))

    def test_challenger_turn_returns_false_for_opponent(self):
        """Test that CHALLENGER_TURN returns False for opponent."""
        self.battle.phase = PHASE_CHALLENGER_TURN
        self.assertFalse(is_users_turn(self.battle, self.opponent))

    def test_opponent_turn_returns_true_for_opponent(self):
        """Test that OPPONENT_TURN returns True for opponent."""
        self.battle.phase = PHASE_OPPONENT_TURN
        self.assertTrue(is_users_turn(self.battle, self.opponent))

    def test_opponent_turn_returns_false_for_challenger(self):
        """Test that OPPONENT_TURN returns False for challenger."""
        self.battle.phase = PHASE_OPPONENT_TURN
        self.assertFalse(is_users_turn(self.battle, self.challenger))

    def test_non_submittable_phase_returns_false(self):
        """Test that non-submittable phases return False."""
        self.battle.phase = PHASE_GENERATING
        self.assertFalse(is_users_turn(self.battle, self.challenger))
        self.assertFalse(is_users_turn(self.battle, self.opponent))
