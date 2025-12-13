"""
Battle Constants - Shared constants to avoid circular imports.

This module contains phase-related constants that are used by both
models.py and phase_utils.py. By keeping them here, we avoid circular
import issues.
"""

from __future__ import annotations

# Import the enum values - models.py defines BattlePhase, we reference the string values
# to avoid importing from models.py (which would cause circular imports when models.py
# imports from here)

# =============================================================================
# Phase String Constants
# =============================================================================
# These match BattlePhase enum values in models.py

PHASE_WAITING = 'waiting'
PHASE_COUNTDOWN = 'countdown'
PHASE_ACTIVE = 'active'
PHASE_GENERATING = 'generating'
PHASE_JUDGING = 'judging'
PHASE_REVEAL = 'reveal'
PHASE_COMPLETE = 'complete'
PHASE_CHALLENGER_TURN = 'challenger_turn'
PHASE_OPPONENT_TURN = 'opponent_turn'


# =============================================================================
# Phase Sets - Single Source of Truth
# =============================================================================

# Phases where prompt submissions are allowed
SUBMITTABLE_PHASES: frozenset[str] = frozenset(
    {
        PHASE_ACTIVE,  # Sync real-time battles
        PHASE_CHALLENGER_TURN,  # Async: challenger's turn
        PHASE_OPPONENT_TURN,  # Async: opponent's turn
    }
)

# Async turn-based phases
ASYNC_TURN_PHASES: frozenset[str] = frozenset(
    {
        PHASE_CHALLENGER_TURN,
        PHASE_OPPONENT_TURN,
    }
)

# Terminal phases - battle is effectively over
TERMINAL_PHASES: frozenset[str] = frozenset(
    {
        PHASE_REVEAL,
        PHASE_COMPLETE,
    }
)

# Phases where the battle is actively in progress
ACTIVE_BATTLE_PHASES: frozenset[str] = frozenset(
    {
        PHASE_COUNTDOWN,
        PHASE_ACTIVE,
        PHASE_CHALLENGER_TURN,
        PHASE_OPPONENT_TURN,
        PHASE_GENERATING,
        PHASE_JUDGING,
    }
)

# Phases that show results
RESULTS_PHASES: frozenset[str] = frozenset(
    {
        PHASE_REVEAL,
        PHASE_COMPLETE,
    }
)


# =============================================================================
# Timer Type Constants
# =============================================================================

TIMER_TYPE_AUTO = 'auto'
TIMER_TYPE_TURN = 'turn'
TIMER_TYPE_BATTLE = 'battle'
TIMER_TYPE_DEADLINE = 'deadline'

VALID_TIMER_TYPES: frozenset[str] = frozenset(
    {
        TIMER_TYPE_AUTO,
        TIMER_TYPE_TURN,
        TIMER_TYPE_BATTLE,
        TIMER_TYPE_DEADLINE,
    }
)


# =============================================================================
# Public API
# =============================================================================

__all__ = [
    # Phase constants
    'PHASE_WAITING',
    'PHASE_COUNTDOWN',
    'PHASE_ACTIVE',
    'PHASE_GENERATING',
    'PHASE_JUDGING',
    'PHASE_REVEAL',
    'PHASE_COMPLETE',
    'PHASE_CHALLENGER_TURN',
    'PHASE_OPPONENT_TURN',
    # Phase sets
    'SUBMITTABLE_PHASES',
    'ASYNC_TURN_PHASES',
    'TERMINAL_PHASES',
    'ACTIVE_BATTLE_PHASES',
    'RESULTS_PHASES',
    # Timer constants
    'TIMER_TYPE_AUTO',
    'TIMER_TYPE_TURN',
    'TIMER_TYPE_BATTLE',
    'TIMER_TYPE_DEADLINE',
    'VALID_TIMER_TYPES',
]
