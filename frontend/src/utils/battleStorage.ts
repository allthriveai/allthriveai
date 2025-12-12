/**
 * Battle Storage Utilities
 *
 * Shared localStorage helpers for pending battle data.
 * Used by MatchmakingScreen and PendingBattleBanner.
 */

export const PENDING_BATTLE_KEY = 'pending_battle_invite';

export interface PendingBattleData {
  battleId: number;
  link: string;
  challengeType: string | null;
  createdAt: number;
}

/**
 * Get stored pending battle from localStorage
 * Returns null if no data, expired (24 hours), or invalid
 */
export function getStoredPendingBattle(): PendingBattleData | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(PENDING_BATTLE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as PendingBattleData;
    // Check if expired (24 hours)
    if (Date.now() - parsed.createdAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_BATTLE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Store pending battle data in localStorage
 */
export function setStoredPendingBattle(data: PendingBattleData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_BATTLE_KEY, JSON.stringify(data));
  } catch {
    // localStorage not available
  }
}

/**
 * Clear pending battle from localStorage
 */
export function clearStoredPendingBattle(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_BATTLE_KEY);
  } catch {
    // localStorage not available
  }
}
