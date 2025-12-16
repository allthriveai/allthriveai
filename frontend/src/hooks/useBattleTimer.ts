/**
 * useBattleTimer Hook
 *
 * Provides a synchronized battle timer that:
 * - Uses server time as the source of truth
 * - Runs a local countdown for smooth display
 * - Re-syncs when server time updates
 * - Handles timer expiration and warnings
 *
 * This consolidates timer logic that was previously scattered across
 * BattlePage.tsx and PromptEditor.tsx.
 */

import { useState, useEffect, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseBattleTimerOptions {
  /** Server-provided time remaining in seconds */
  serverTimeRemaining: number | null | undefined;

  /** Whether the timer should be running */
  isActive?: boolean;

  /** Callback when timer expires */
  onExpire?: () => void;

  /** Callback when timer enters warning zone (default: 30 seconds) */
  onWarning?: () => void;

  /** Warning threshold in seconds (default: 30) */
  warningThreshold?: number;

  /** Key that changes when timer should be forcibly reset (e.g., after challenge refresh) */
  resetKey?: number;
}

export interface BattleTimerState {
  /** Current time remaining in seconds (for display) */
  timeRemaining: number | null;

  /** Formatted time string (MM:SS) */
  formattedTime: string;

  /** Whether timer is in warning zone */
  isWarning: boolean;

  /** Whether timer is critical (under 10 seconds) */
  isCritical: boolean;

  /** Whether timer has expired */
  isExpired: boolean;

  /** Progress percentage (0-100, for progress bars) */
  progress: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format seconds to MM:SS string.
 */
export function formatTime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '0:00';

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate progress percentage from time remaining and total.
 */
export function calculateProgress(remaining: number | null, total: number): number {
  if (remaining === null || total <= 0) return 0;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useBattleTimer({
  serverTimeRemaining,
  isActive = true,
  onExpire,
  onWarning,
  warningThreshold = 30,
  resetKey,
}: UseBattleTimerOptions): BattleTimerState {
  // Local time state for smooth countdown
  const [localTime, setLocalTime] = useState<number | null>(null);

  // Track whether we've fired the warning callback
  const hasWarnedRef = useRef(false);

  // Track whether we've fired the expire callback
  const hasExpiredRef = useRef(false);

  // Track the last server time to detect updates
  const lastServerTimeRef = useRef<number | null>(null);

  // Track the previous prop value to detect actual changes
  const prevServerTimeRef = useRef<number | null | undefined>(undefined);

  // Track the previous reset key to detect when we need to force reset
  const prevResetKeyRef = useRef<number | undefined>(undefined);

  // Sync with server time when the prop actually changes
  // Note: We only sync when serverTimeRemaining prop changes value, NOT when
  // localTime drifts. This prevents the timer from constantly resetting during
  // normal countdown (which was the bug when localTime was in dependencies).
  useEffect(() => {
    if (serverTimeRemaining === null || serverTimeRemaining === undefined) {
      setLocalTime(null);
      prevServerTimeRef.current = serverTimeRemaining;
      lastServerTimeRef.current = null;
      return;
    }

    // Only sync if the prop actually changed value
    // This handles: initial load, challenge refresh, and backend time updates
    const propChanged = prevServerTimeRef.current !== serverTimeRemaining;
    prevServerTimeRef.current = serverTimeRemaining;

    if (propChanged || lastServerTimeRef.current === null) {
      setLocalTime(serverTimeRemaining);
      lastServerTimeRef.current = serverTimeRemaining;
    }
  }, [serverTimeRemaining]); // Only run when serverTimeRemaining prop changes

  // Force reset timer when resetKey changes
  // This handles the case where serverTimeRemaining value stays the same (e.g., 180 -> 180)
  // but we want to reset the timer (e.g., after clicking "Try a different prompt")
  useEffect(() => {
    if (resetKey === undefined) return;

    const keyChanged = prevResetKeyRef.current !== undefined && prevResetKeyRef.current !== resetKey;
    prevResetKeyRef.current = resetKey;

    if (keyChanged && serverTimeRemaining != null) {
      setLocalTime(serverTimeRemaining);
      lastServerTimeRef.current = serverTimeRemaining;
      // Reset warning/expiration flags since we're starting fresh
      hasWarnedRef.current = false;
      hasExpiredRef.current = false;
    }
  }, [resetKey, serverTimeRemaining]);

  // Note: Periodic re-sync was removed because it caused issues when
  // the challenge is refreshed - the server time becomes a stale snapshot
  // and the periodic sync would keep resetting the timer back to that value.
  // The initial sync effect above handles syncing when server time changes.

  // Local countdown timer
  // Track whether timer should be running as a separate piece of state
  const shouldRun = isActive && localTime !== null && localTime > 0;

  useEffect(() => {
    if (!shouldRun) {
      return;
    }

    const interval = setInterval(() => {
      setLocalTime((prev) => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [shouldRun]);

  // Handle warning threshold
  useEffect(() => {
    if (
      localTime !== null &&
      localTime <= warningThreshold &&
      localTime > 0 &&
      !hasWarnedRef.current
    ) {
      hasWarnedRef.current = true;
      onWarning?.();
    }

    // Reset warning flag if time goes back up (e.g., deadline extension)
    if (localTime !== null && localTime > warningThreshold) {
      hasWarnedRef.current = false;
    }
  }, [localTime, warningThreshold, onWarning]);

  // Handle expiration
  useEffect(() => {
    if (localTime !== null && localTime <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire?.();
    }

    // Reset expiration flag if time is restored
    if (localTime !== null && localTime > 0) {
      hasExpiredRef.current = false;
    }
  }, [localTime, onExpire]);

  // Calculate derived state
  const isWarning = localTime !== null && localTime <= warningThreshold && localTime > 0;
  const isCritical = localTime !== null && localTime <= 10 && localTime > 0;
  const isExpired = localTime !== null && localTime <= 0;

  // Assuming a default total time of 3 minutes (180 seconds) for progress
  // This could be made configurable if needed
  const progress = calculateProgress(localTime, 180);

  return {
    timeRemaining: localTime,
    formattedTime: formatTime(localTime),
    isWarning,
    isCritical,
    isExpired,
    progress,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Simple timer display hook - just formats time and tracks warning state.
 * Use this when you don't need the full timer management.
 */
export function useTimerDisplay(timeRemaining: number | null | undefined) {
  const time = timeRemaining ?? null;

  return {
    formattedTime: formatTime(time),
    isWarning: time !== null && time <= 30 && time > 0,
    isCritical: time !== null && time <= 10 && time > 0,
    isExpired: time !== null && time <= 0,
  };
}

export default useBattleTimer;
