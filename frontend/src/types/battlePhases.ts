/**
 * Battle Phases - Unified Phase Definitions
 *
 * This module provides a single source of truth for battle phase types
 * and helper functions. It mirrors the backend phase_utils.py for consistency.
 *
 * All phase-related checks should use these helpers rather than inline logic.
 */

// =============================================================================
// Phase Constants
// =============================================================================

/**
 * All possible battle phases matching backend BattlePhase enum.
 */
export const BATTLE_PHASES = {
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  ACTIVE: 'active',
  CHALLENGER_TURN: 'challenger_turn',
  OPPONENT_TURN: 'opponent_turn',
  GENERATING: 'generating',
  JUDGING: 'judging',
  REVEAL: 'reveal',
  COMPLETE: 'complete',
} as const;

/**
 * Battle phase type - union of all possible phase values.
 */
export type BattlePhase = (typeof BATTLE_PHASES)[keyof typeof BATTLE_PHASES];

// =============================================================================
// Phase Sets
// =============================================================================

/**
 * Phases where prompt submissions are allowed.
 * Matches backend SUBMITTABLE_PHASES.
 */
export const SUBMITTABLE_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.ACTIVE,
  BATTLE_PHASES.CHALLENGER_TURN,
  BATTLE_PHASES.OPPONENT_TURN,
]);

/**
 * Async turn-based phases.
 * Matches backend ASYNC_TURN_PHASES.
 */
export const ASYNC_TURN_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.CHALLENGER_TURN,
  BATTLE_PHASES.OPPONENT_TURN,
]);

/**
 * Terminal phases - battle is effectively over.
 * Matches backend TERMINAL_PHASES.
 */
export const TERMINAL_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.REVEAL,
  BATTLE_PHASES.COMPLETE,
]);

/**
 * Phases where the battle is actively in progress.
 * Matches backend ACTIVE_BATTLE_PHASES.
 */
export const ACTIVE_BATTLE_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.COUNTDOWN,
  BATTLE_PHASES.ACTIVE,
  BATTLE_PHASES.CHALLENGER_TURN,
  BATTLE_PHASES.OPPONENT_TURN,
  BATTLE_PHASES.GENERATING,
  BATTLE_PHASES.JUDGING,
]);

/**
 * Phases that show the battle arena (input UI).
 */
export const ARENA_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.ACTIVE,
  BATTLE_PHASES.CHALLENGER_TURN,
  BATTLE_PHASES.OPPONENT_TURN,
]);

/**
 * Phases that show results.
 * Matches backend RESULTS_PHASES.
 */
export const RESULTS_PHASES: ReadonlySet<BattlePhase> = new Set([
  BATTLE_PHASES.REVEAL,
  BATTLE_PHASES.COMPLETE,
]);

// =============================================================================
// Phase Check Helpers
// =============================================================================

/**
 * Check if the given phase allows prompt submissions.
 */
export function isSubmittablePhase(phase: string): boolean {
  return SUBMITTABLE_PHASES.has(phase as BattlePhase);
}

/**
 * Check if the given phase is an async turn-based phase.
 */
export function isAsyncTurnPhase(phase: string): boolean {
  return ASYNC_TURN_PHASES.has(phase as BattlePhase);
}

/**
 * Check if the battle has reached a terminal state.
 */
export function isTerminalPhase(phase: string): boolean {
  return TERMINAL_PHASES.has(phase as BattlePhase);
}

/**
 * Check if the battle is showing results.
 */
export function isResultsPhase(phase: string): boolean {
  return RESULTS_PHASES.has(phase as BattlePhase);
}

/**
 * Check if the phase should show the battle arena.
 */
export function isArenaPhase(phase: string): boolean {
  return ARENA_PHASES.has(phase as BattlePhase);
}

/**
 * Check if the battle is actively in progress.
 */
export function isActiveBattlePhase(phase: string): boolean {
  return ACTIVE_BATTLE_PHASES.has(phase as BattlePhase);
}

// =============================================================================
// Turn Helpers
// =============================================================================

/**
 * Check if it's the user's turn based on the current phase and role.
 *
 * @param phase - Current battle phase
 * @param isChallenger - True if the user is the challenger, false if opponent
 * @returns True if it's the user's turn to submit
 */
export function isUsersTurn(phase: string, isChallenger: boolean): boolean {
  if (phase === BATTLE_PHASES.ACTIVE) {
    // Sync battles - everyone can submit
    return true;
  }

  if (phase === BATTLE_PHASES.CHALLENGER_TURN) {
    return isChallenger;
  }

  if (phase === BATTLE_PHASES.OPPONENT_TURN) {
    return !isChallenger;
  }

  return false;
}

/**
 * Get a human-readable label for the current phase.
 */
export function getPhaseLabel(phase: string): string {
  switch (phase) {
    case BATTLE_PHASES.WAITING:
      return 'Waiting for opponent';
    case BATTLE_PHASES.COUNTDOWN:
      return 'Get ready!';
    case BATTLE_PHASES.ACTIVE:
      return 'Battle in progress';
    case BATTLE_PHASES.CHALLENGER_TURN:
      return "Challenger's turn";
    case BATTLE_PHASES.OPPONENT_TURN:
      return "Opponent's turn";
    case BATTLE_PHASES.GENERATING:
      return 'Generating images';
    case BATTLE_PHASES.JUDGING:
      return 'Judging submissions';
    case BATTLE_PHASES.REVEAL:
      return 'Revealing results';
    case BATTLE_PHASES.COMPLETE:
      return 'Battle complete';
    default:
      return 'Unknown';
  }
}

/**
 * Get the user-facing turn status message.
 */
export function getTurnStatusMessage(
  phase: string,
  isChallenger: boolean,
  hasSubmitted: boolean
): string {
  if (hasSubmitted) {
    return 'Waiting for opponent to submit';
  }

  if (phase === BATTLE_PHASES.ACTIVE) {
    return 'Submit your prompt!';
  }

  if (phase === BATTLE_PHASES.CHALLENGER_TURN) {
    return isChallenger ? 'Your turn to submit!' : 'Waiting for challenger';
  }

  if (phase === BATTLE_PHASES.OPPONENT_TURN) {
    return isChallenger ? 'Waiting for opponent' : 'Your turn to submit!';
  }

  return '';
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Check if a string is a valid battle phase.
 */
export function isValidPhase(phase: string): phase is BattlePhase {
  return Object.values(BATTLE_PHASES).includes(phase as BattlePhase);
}

/**
 * Parse a phase string, returning undefined if invalid.
 */
export function parsePhase(phase: string): BattlePhase | undefined {
  if (isValidPhase(phase)) {
    return phase;
  }
  return undefined;
}
