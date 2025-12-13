"""
Phase utilities for Prompt Battles.

This module provides centralized phase validation logic, eliminating duplication
across consumers.py, services.py, and views.py.

All phase-related checks should use these helpers rather than inline logic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple

from core.battles.constants import (
    ACTIVE_BATTLE_PHASES,
    ASYNC_TURN_PHASES,
    PHASE_ACTIVE,
    PHASE_CHALLENGER_TURN,
    PHASE_COUNTDOWN,
    PHASE_GENERATING,
    PHASE_JUDGING,
    PHASE_OPPONENT_TURN,
    PHASE_WAITING,
    RESULTS_PHASES,
    SUBMITTABLE_PHASES,
    TERMINAL_PHASES,
)
from core.battles.models import BattleStatus

if TYPE_CHECKING:
    from core.battles.models import PromptBattle
    from core.users.models import User


# =============================================================================
# Re-export constants for backward compatibility
# =============================================================================
# These are now defined in constants.py but re-exported here for existing imports

__all__ = [
    # Constants (re-exported from constants.py)
    'SUBMITTABLE_PHASES',
    'ASYNC_TURN_PHASES',
    'TERMINAL_PHASES',
    'ACTIVE_BATTLE_PHASES',
    'RESULTS_PHASES',
    # Helper functions
    'is_submittable_phase',
    'is_async_turn_phase',
    'is_terminal_phase',
    'is_results_phase',
    # Submission validation
    'SubmissionResult',
    'can_submit_prompt',
    # Turn helpers
    'get_whose_turn',
    'is_users_turn',
]


# =============================================================================
# Phase Check Helpers
# =============================================================================


def is_submittable_phase(phase: str) -> bool:
    """Check if the given phase allows prompt submissions."""
    return phase in SUBMITTABLE_PHASES


def is_async_turn_phase(phase: str) -> bool:
    """Check if the given phase is an async turn-based phase."""
    return phase in ASYNC_TURN_PHASES


def is_terminal_phase(phase: str) -> bool:
    """Check if the battle has reached a terminal state."""
    return phase in TERMINAL_PHASES


def is_results_phase(phase: str) -> bool:
    """Check if the battle is showing results."""
    return phase in RESULTS_PHASES


# =============================================================================
# Submission Validation
# =============================================================================


class SubmissionResult(NamedTuple):
    """Result of a submission validation check.

    Attributes:
        allowed: Whether the submission is allowed.
        error: Error message if not allowed, None otherwise.
    """

    allowed: bool
    error: str | None = None

    def __bool__(self) -> bool:
        return self.allowed


def can_submit_prompt(
    battle: PromptBattle,
    user: User,
    *,
    check_existing: bool = False,
) -> SubmissionResult:
    """
    Check if a user can submit a prompt to the given battle.

    This is the single source of truth for submission validation.
    Use this instead of inline phase/turn checks.

    Args:
        battle: The battle to check.
        user: The user attempting to submit.
        check_existing: If True, also check if user has already submitted.
            Defaults to False for backward compatibility. Set to True for
            complete validation.

    Returns:
        SubmissionResult with allowed=True if submission is allowed,
        or allowed=False with an error message explaining why not.

    Examples:
        >>> result = can_submit_prompt(battle, user)
        >>> if not result:
        ...     return error_response(result.error)

        >>> # Full validation including existing submission check
        >>> result = can_submit_prompt(battle, user, check_existing=True)
    """
    # Check user is a participant
    if user.id not in [battle.challenger_id, battle.opponent_id]:
        return SubmissionResult(False, 'You are not a participant in this battle')

    # Check battle status first
    if battle.status != BattleStatus.ACTIVE:
        return SubmissionResult(False, 'This battle is not active')

    # Check phase allows submissions
    if battle.phase not in SUBMITTABLE_PHASES:
        if battle.phase in TERMINAL_PHASES:
            return SubmissionResult(False, 'This battle has already ended')
        elif battle.phase == PHASE_GENERATING:
            return SubmissionResult(False, 'Images are being generated')
        elif battle.phase == PHASE_JUDGING:
            return SubmissionResult(False, 'The battle is being judged')
        elif battle.phase == PHASE_WAITING:
            return SubmissionResult(False, 'Waiting for opponent to join')
        elif battle.phase == PHASE_COUNTDOWN:
            return SubmissionResult(False, 'Battle is starting soon')
        else:
            return SubmissionResult(False, 'Cannot submit right now')

    # For async turn-based phases, verify it's the user's turn
    if battle.phase == PHASE_CHALLENGER_TURN:
        if user.id != battle.challenger_id:
            return SubmissionResult(False, "It's not your turn yet")
    elif battle.phase == PHASE_OPPONENT_TURN:
        if user.id != battle.opponent_id:
            return SubmissionResult(False, "It's not your turn yet")

    # Optionally check for existing submission
    if check_existing:
        from core.battles.models import BattleSubmission

        if BattleSubmission.objects.filter(battle=battle, user=user).exists():
            return SubmissionResult(False, 'You have already submitted')

    return SubmissionResult(True)


def get_whose_turn(battle: PromptBattle) -> User | None:
    """
    Get the user whose turn it is in an async battle.

    Args:
        battle: The battle to check.

    Returns:
        The user whose turn it is, or None if not in a turn-based phase.
    """
    if battle.phase == PHASE_CHALLENGER_TURN:
        return battle.challenger
    elif battle.phase == PHASE_OPPONENT_TURN:
        return battle.opponent
    return None


def is_users_turn(battle: PromptBattle, user: User) -> bool:
    """
    Check if it's the specified user's turn in an async battle.

    For sync battles (ACTIVE phase), always returns True for participants.

    Args:
        battle: The battle to check.
        user: The user to check.

    Returns:
        True if it's the user's turn (or if battle is sync), False otherwise.
    """
    if battle.phase == PHASE_ACTIVE:
        # Sync battles - any participant can submit
        return user.id in [battle.challenger_id, battle.opponent_id]

    if battle.phase == PHASE_CHALLENGER_TURN:
        return user.id == battle.challenger_id

    if battle.phase == PHASE_OPPONENT_TURN:
        return user.id == battle.opponent_id

    return False
