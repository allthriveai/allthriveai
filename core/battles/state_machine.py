"""
Battle State Machine - Strict Phase Transition Validation.

This module defines the valid state transitions for prompt battles
and provides validation functions that reject invalid transitions.

The state machine enforces that battles can only transition through
specific valid paths, preventing bugs from inconsistent state.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from core.battles.models import BattlePhase

if TYPE_CHECKING:
    from core.battles.models import PromptBattle

logger = logging.getLogger(__name__)


# =============================================================================
# Public API
# =============================================================================

__all__ = [
    # Exception
    'TransitionError',
    # Constants
    'VALID_TRANSITIONS',
    # Validation functions
    'is_valid_transition',
    'validate_transition',
    'get_valid_next_phases',
    'can_transition_to',
    # Battle-level helpers
    'validate_battle_transition',
    'transition_phase',
]


class TransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, from_phase: str, to_phase: str, message: str | None = None):
        self.from_phase = from_phase
        self.to_phase = to_phase
        self.message = message or f'Invalid transition: {from_phase} -> {to_phase}'
        super().__init__(self.message)


# =============================================================================
# Valid Transitions Adjacency List
# =============================================================================
# Maps each phase to the set of phases it can transition to.
# This is the single source of truth for valid phase transitions.

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    # Initial state - battle created, waiting for players
    BattlePhase.WAITING: frozenset(
        {
            BattlePhase.COUNTDOWN,  # Both players connected (sync)
            BattlePhase.CHALLENGER_TURN,  # Invitation accepted (async)
            BattlePhase.ACTIVE,  # Direct start for some battle types
        }
    ),
    # Sync: Countdown before battle starts
    BattlePhase.COUNTDOWN: frozenset(
        {
            BattlePhase.ACTIVE,  # Countdown complete
            BattlePhase.WAITING,  # Player disconnected (rollback)
        }
    ),
    # Sync: Active real-time battle
    BattlePhase.ACTIVE: frozenset(
        {
            BattlePhase.GENERATING,  # Both players submitted
            BattlePhase.CHALLENGER_TURN,  # Convert to async (player went offline)
            BattlePhase.COMPLETE,  # Timeout/expiration with no submissions
        }
    ),
    # Async: Challenger's turn to submit
    BattlePhase.CHALLENGER_TURN: frozenset(
        {
            BattlePhase.OPPONENT_TURN,  # Challenger submitted
            BattlePhase.COMPLETE,  # Timeout/deadline expired
            BattlePhase.ACTIVE,  # Convert to sync (both players online)
        }
    ),
    # Async: Opponent's turn to submit
    BattlePhase.OPPONENT_TURN: frozenset(
        {
            BattlePhase.GENERATING,  # Opponent submitted (both done)
            BattlePhase.COMPLETE,  # Timeout/deadline expired
            BattlePhase.ACTIVE,  # Convert to sync (both players online)
        }
    ),
    # AI is generating images
    BattlePhase.GENERATING: frozenset(
        {
            BattlePhase.JUDGING,  # All images ready
            BattlePhase.COMPLETE,  # Generation failed
        }
    ),
    # AI is judging submissions
    BattlePhase.JUDGING: frozenset(
        {
            BattlePhase.REVEAL,  # Judging complete
            BattlePhase.COMPLETE,  # Judging failed after retries
        }
    ),
    # Results reveal sequence
    BattlePhase.REVEAL: frozenset(
        {
            BattlePhase.COMPLETE,  # Reveal sequence done
        }
    ),
    # Terminal state - no transitions out
    BattlePhase.COMPLETE: frozenset(),
}


# =============================================================================
# Validation Functions
# =============================================================================


def is_valid_transition(from_phase: str, to_phase: str) -> bool:
    """
    Check if a transition between two phases is valid.

    Args:
        from_phase: Current phase
        to_phase: Target phase

    Returns:
        True if the transition is allowed, False otherwise.
    """
    valid_targets = VALID_TRANSITIONS.get(from_phase, frozenset())
    return to_phase in valid_targets


def validate_transition(
    from_phase: str,
    to_phase: str,
    *,
    strict: bool = True,
    battle_id: int | None = None,
) -> bool:
    """
    Validate a phase transition and optionally raise on invalid.

    Args:
        from_phase: Current phase
        to_phase: Target phase
        strict: If True, raise TransitionError on invalid transition.
                If False, log warning and return False.
        battle_id: Optional battle ID for logging context.

    Returns:
        True if transition is valid.

    Raises:
        TransitionError: If strict=True and transition is invalid.
    """
    if is_valid_transition(from_phase, to_phase):
        return True

    error_msg = f'Invalid transition: {from_phase} -> {to_phase}'
    if battle_id:
        error_msg = f'Battle {battle_id}: {error_msg}'

    if strict:
        logger.error(error_msg)
        raise TransitionError(from_phase, to_phase, error_msg)
    else:
        logger.warning(error_msg)
        return False


def get_valid_next_phases(phase: str) -> frozenset[str]:
    """
    Get all valid phases that can be transitioned to from the given phase.

    Args:
        phase: Current phase

    Returns:
        Frozenset of valid target phases.
    """
    return VALID_TRANSITIONS.get(phase, frozenset())


def can_transition_to(phase: str, target: str) -> bool:
    """
    Check if we can transition from the given phase to the target.

    This is an alias for is_valid_transition with more readable semantics.

    Args:
        phase: Current phase
        target: Desired target phase

    Returns:
        True if transition is valid.
    """
    return is_valid_transition(phase, target)


# =============================================================================
# Battle-Level Transition Helpers
# =============================================================================


def validate_battle_transition(
    battle: PromptBattle,
    to_phase: str,
    *,
    strict: bool = True,
) -> bool:
    """
    Validate a phase transition for a specific battle.

    This is a convenience wrapper that extracts the current phase from
    the battle instance.

    Args:
        battle: The battle instance
        to_phase: Target phase
        strict: If True, raise TransitionError on invalid transition.

    Returns:
        True if transition is valid.

    Raises:
        TransitionError: If strict=True and transition is invalid.
    """
    return validate_transition(
        battle.phase,
        to_phase,
        strict=strict,
        battle_id=battle.id,
    )


def transition_phase(
    battle: PromptBattle,
    to_phase: str,
    *,
    strict: bool = True,
    save: bool = True,
) -> None:
    """
    Transition a battle to a new phase with validation.

    This is the recommended way to change battle phases, as it
    ensures all transitions are validated against the state machine.

    Args:
        battle: The battle to transition
        to_phase: Target phase
        strict: If True, raise TransitionError on invalid transition.
        save: If True, save the battle after updating phase.

    Raises:
        TransitionError: If strict=True and transition is invalid.
    """
    # Capture old phase before transition
    old_phase = battle.phase

    # Validate the transition
    validate_battle_transition(battle, to_phase, strict=strict)

    # Perform the transition using the model's set_phase method
    battle.set_phase(to_phase, save=save)

    logger.info(
        f'Battle {battle.id} transitioned: {old_phase} -> {to_phase}',
        extra={
            'battle_id': battle.id,
            'from_phase': old_phase,
            'to_phase': to_phase,
        },
    )


# =============================================================================
# Phase Flow Documentation
# =============================================================================
"""
Battle Phase Flows:

SYNC (Real-Time) BATTLE:
========================
1. WAITING      - Battle created, waiting for players to connect
2. COUNTDOWN    - Both players connected, 3-2-1 countdown
3. ACTIVE       - Battle timer running, both players crafting prompts
4. GENERATING   - Both submitted, AI generating images
5. JUDGING      - Images ready, AI evaluating submissions
6. REVEAL       - Results animation sequence
7. COMPLETE     - Battle finished, points awarded

   WAITING -> COUNTDOWN -> ACTIVE -> GENERATING -> JUDGING -> REVEAL -> COMPLETE


ASYNC (Turn-Based) BATTLE:
==========================
1. WAITING          - Battle created, invitation pending
2. CHALLENGER_TURN  - Invitation accepted, challenger has 3 min to submit
3. OPPONENT_TURN    - Challenger submitted, opponent has 3 min to submit
4. GENERATING       - Both submitted, AI generating images
5. JUDGING          - Images ready, AI evaluating submissions
6. REVEAL           - Results animation sequence
7. COMPLETE         - Battle finished, points awarded

   WAITING -> CHALLENGER_TURN -> OPPONENT_TURN -> GENERATING -> JUDGING -> REVEAL -> COMPLETE


HYBRID MODE:
============
Can switch between sync and async based on player connectivity:
- ACTIVE -> CHALLENGER_TURN (player went offline)
- CHALLENGER_TURN -> ACTIVE (both players came online)
- OPPONENT_TURN -> ACTIVE (both players came online)


FAILURE/TIMEOUT PATHS:
======================
- Any active phase -> COMPLETE (timeout, failure, or cancellation)
- GENERATING -> COMPLETE (image generation failed)
- JUDGING -> COMPLETE (judging failed after max retries)
"""
