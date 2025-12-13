"""
Tests for state_machine module.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase

from core.battles.models import BattlePhase
from core.battles.state_machine import (
    VALID_TRANSITIONS,
    TransitionError,
    can_transition_to,
    get_valid_next_phases,
    is_valid_transition,
    transition_phase,
    validate_battle_transition,
    validate_transition,
)


class TransitionErrorTestCase(TestCase):
    """Tests for TransitionError exception."""

    def test_transition_error_attributes(self):
        """Test TransitionError has correct attributes."""
        error = TransitionError('waiting', 'complete', 'Custom message')
        self.assertEqual(error.from_phase, 'waiting')
        self.assertEqual(error.to_phase, 'complete')
        self.assertEqual(error.message, 'Custom message')

    def test_transition_error_default_message(self):
        """Test TransitionError generates default message."""
        error = TransitionError('waiting', 'complete')
        self.assertIn('waiting', error.message)
        self.assertIn('complete', error.message)
        self.assertIn('Invalid transition', error.message)


class ValidTransitionsTestCase(TestCase):
    """Tests for VALID_TRANSITIONS constant."""

    def test_waiting_can_transition_to_countdown(self):
        """Test WAITING can transition to COUNTDOWN."""
        self.assertIn(BattlePhase.COUNTDOWN, VALID_TRANSITIONS[BattlePhase.WAITING])

    def test_waiting_can_transition_to_challenger_turn(self):
        """Test WAITING can transition to CHALLENGER_TURN."""
        self.assertIn(BattlePhase.CHALLENGER_TURN, VALID_TRANSITIONS[BattlePhase.WAITING])

    def test_waiting_can_transition_to_active(self):
        """Test WAITING can transition to ACTIVE."""
        self.assertIn(BattlePhase.ACTIVE, VALID_TRANSITIONS[BattlePhase.WAITING])

    def test_countdown_can_transition_to_active(self):
        """Test COUNTDOWN can transition to ACTIVE."""
        self.assertIn(BattlePhase.ACTIVE, VALID_TRANSITIONS[BattlePhase.COUNTDOWN])

    def test_countdown_can_rollback_to_waiting(self):
        """Test COUNTDOWN can rollback to WAITING."""
        self.assertIn(BattlePhase.WAITING, VALID_TRANSITIONS[BattlePhase.COUNTDOWN])

    def test_active_can_transition_to_generating(self):
        """Test ACTIVE can transition to GENERATING."""
        self.assertIn(BattlePhase.GENERATING, VALID_TRANSITIONS[BattlePhase.ACTIVE])

    def test_challenger_turn_can_transition_to_opponent_turn(self):
        """Test CHALLENGER_TURN can transition to OPPONENT_TURN."""
        self.assertIn(BattlePhase.OPPONENT_TURN, VALID_TRANSITIONS[BattlePhase.CHALLENGER_TURN])

    def test_opponent_turn_can_transition_to_generating(self):
        """Test OPPONENT_TURN can transition to GENERATING."""
        self.assertIn(BattlePhase.GENERATING, VALID_TRANSITIONS[BattlePhase.OPPONENT_TURN])

    def test_generating_can_transition_to_judging(self):
        """Test GENERATING can transition to JUDGING."""
        self.assertIn(BattlePhase.JUDGING, VALID_TRANSITIONS[BattlePhase.GENERATING])

    def test_judging_can_transition_to_reveal(self):
        """Test JUDGING can transition to REVEAL."""
        self.assertIn(BattlePhase.REVEAL, VALID_TRANSITIONS[BattlePhase.JUDGING])

    def test_reveal_can_transition_to_complete(self):
        """Test REVEAL can transition to COMPLETE."""
        self.assertIn(BattlePhase.COMPLETE, VALID_TRANSITIONS[BattlePhase.REVEAL])

    def test_complete_has_no_transitions(self):
        """Test COMPLETE is terminal with no valid transitions."""
        self.assertEqual(len(VALID_TRANSITIONS[BattlePhase.COMPLETE]), 0)

    def test_all_phases_can_reach_complete(self):
        """Test that all non-terminal phases can eventually reach COMPLETE."""
        # This verifies the failure paths exist
        for phase in [
            BattlePhase.ACTIVE,
            BattlePhase.GENERATING,
            BattlePhase.JUDGING,
            BattlePhase.CHALLENGER_TURN,
            BattlePhase.OPPONENT_TURN,
        ]:
            self.assertIn(BattlePhase.COMPLETE, VALID_TRANSITIONS[phase])


class IsValidTransitionTestCase(TestCase):
    """Tests for is_valid_transition function."""

    def test_valid_transition_returns_true(self):
        """Test valid transition returns True."""
        self.assertTrue(is_valid_transition(BattlePhase.WAITING, BattlePhase.COUNTDOWN))

    def test_invalid_transition_returns_false(self):
        """Test invalid transition returns False."""
        self.assertFalse(is_valid_transition(BattlePhase.WAITING, BattlePhase.COMPLETE))

    def test_unknown_phase_returns_false(self):
        """Test unknown phase returns False."""
        self.assertFalse(is_valid_transition('unknown_phase', BattlePhase.ACTIVE))


class ValidateTransitionTestCase(TestCase):
    """Tests for validate_transition function."""

    def test_valid_transition_returns_true(self):
        """Test valid transition returns True."""
        result = validate_transition(BattlePhase.WAITING, BattlePhase.COUNTDOWN)
        self.assertTrue(result)

    def test_invalid_transition_strict_raises(self):
        """Test invalid transition with strict=True raises TransitionError."""
        with self.assertRaises(TransitionError) as context:
            validate_transition(BattlePhase.WAITING, BattlePhase.COMPLETE, strict=True)

        self.assertEqual(context.exception.from_phase, BattlePhase.WAITING)
        self.assertEqual(context.exception.to_phase, BattlePhase.COMPLETE)

    def test_invalid_transition_non_strict_returns_false(self):
        """Test invalid transition with strict=False returns False."""
        result = validate_transition(BattlePhase.WAITING, BattlePhase.COMPLETE, strict=False)
        self.assertFalse(result)

    def test_battle_id_included_in_error(self):
        """Test battle_id is included in error message."""
        with self.assertRaises(TransitionError) as context:
            validate_transition(
                BattlePhase.WAITING,
                BattlePhase.COMPLETE,
                strict=True,
                battle_id=123,
            )

        self.assertIn('123', context.exception.message)


class GetValidNextPhasesTestCase(TestCase):
    """Tests for get_valid_next_phases function."""

    def test_returns_valid_phases(self):
        """Test returns frozenset of valid phases."""
        phases = get_valid_next_phases(BattlePhase.WAITING)
        self.assertIsInstance(phases, frozenset)
        self.assertIn(BattlePhase.COUNTDOWN, phases)

    def test_unknown_phase_returns_empty(self):
        """Test unknown phase returns empty frozenset."""
        phases = get_valid_next_phases('unknown')
        self.assertEqual(len(phases), 0)


class CanTransitionToTestCase(TestCase):
    """Tests for can_transition_to function (alias)."""

    def test_is_alias_for_is_valid_transition(self):
        """Test can_transition_to is an alias for is_valid_transition."""
        self.assertEqual(
            can_transition_to(BattlePhase.WAITING, BattlePhase.COUNTDOWN),
            is_valid_transition(BattlePhase.WAITING, BattlePhase.COUNTDOWN),
        )


class ValidateBattleTransitionTestCase(TestCase):
    """Tests for validate_battle_transition function."""

    def test_extracts_phase_from_battle(self):
        """Test extracts current phase from battle instance."""
        battle = MagicMock()
        battle.phase = BattlePhase.WAITING
        battle.id = 123

        result = validate_battle_transition(battle, BattlePhase.COUNTDOWN)
        self.assertTrue(result)

    def test_invalid_transition_raises_with_battle_id(self):
        """Test invalid transition includes battle_id in error."""
        battle = MagicMock()
        battle.phase = BattlePhase.WAITING
        battle.id = 456

        with self.assertRaises(TransitionError) as context:
            validate_battle_transition(battle, BattlePhase.COMPLETE, strict=True)

        self.assertIn('456', context.exception.message)


class TransitionPhaseTestCase(TestCase):
    """Tests for transition_phase function."""

    def test_calls_set_phase_on_battle(self):
        """Test calls battle.set_phase with correct args."""
        battle = MagicMock()
        battle.phase = BattlePhase.WAITING
        battle.id = 123

        transition_phase(battle, BattlePhase.COUNTDOWN, strict=False, save=True)

        battle.set_phase.assert_called_once_with(BattlePhase.COUNTDOWN, save=True)

    def test_validates_before_transitioning(self):
        """Test validates transition before calling set_phase."""
        battle = MagicMock()
        battle.phase = BattlePhase.WAITING
        battle.id = 123

        with self.assertRaises(TransitionError):
            transition_phase(battle, BattlePhase.COMPLETE, strict=True)

        # set_phase should not be called if validation fails
        battle.set_phase.assert_not_called()

    def test_logs_transition(self):
        """Test logs the transition."""
        battle = MagicMock()
        battle.phase = BattlePhase.WAITING
        battle.id = 123

        with patch('core.battles.state_machine.logger') as mock_logger:
            transition_phase(battle, BattlePhase.COUNTDOWN, strict=False)
            mock_logger.info.assert_called()
