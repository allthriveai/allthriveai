/**
 * PendingBattleBanner Component
 *
 * Banner displayed below the navigation when the user has a pending battle challenge.
 * Uses localStorage to persist battle data across page navigations.
 * Designed to be placed in DashboardLayout after AvaAdventureBanner.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BoltIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { api } from '@/services/api';
import {
  PENDING_BATTLE_KEY,
  getStoredPendingBattle,
  clearStoredPendingBattle,
  type PendingBattleData,
} from '@/utils/battleStorage';

export function PendingBattleBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingBattle, setPendingBattle] = useState<PendingBattleData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check for pending battle on mount and when location changes
  useEffect(() => {
    const checkPendingBattle = async () => {
      const stored = getStoredPendingBattle();
      if (!stored) {
        setPendingBattle(null);
        return;
      }

      try {
        // Validate that the battle is still pending (no opponent yet)
        const response = await api.get(`/me/battles/${stored.battleId}/`);
        if (response.data.opponent) {
          // Battle already has opponent - clear storage and navigate
          clearStoredPendingBattle();
          setPendingBattle(null);
          navigate(`/play/prompt-battles/${stored.battleId}`);
        } else if (response.data.status === 'cancelled' || response.data.status === 'expired') {
          // Battle was cancelled or expired
          clearStoredPendingBattle();
          setPendingBattle(null);
        } else {
          // Battle is still pending
          setPendingBattle(stored);
          setIsDismissed(false); // Reset dismissed state if battle is still active
        }
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 404) {
          clearStoredPendingBattle();
          setPendingBattle(null);
        } else {
          // Network error - still show the pending battle
          setPendingBattle(stored);
        }
      }
    };

    checkPendingBattle();
  }, [navigate, location.pathname]);

  // Poll for invitation acceptance
  useEffect(() => {
    if (!pendingBattle) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/me/battles/${pendingBattle.battleId}/`);
        if (response.data.opponent) {
          // Battle accepted - navigate to it
          clearInterval(pollInterval);
          clearStoredPendingBattle();
          setPendingBattle(null);
          navigate(`/play/prompt-battles/${pendingBattle.battleId}`);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [pendingBattle, navigate]);

  // Listen for storage changes (in case battle is cleared from another tab or MatchmakingScreen)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PENDING_BATTLE_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as PendingBattleData;
            setPendingBattle(parsed);
            setIsDismissed(false);
          } catch {
            setPendingBattle(null);
          }
        } else {
          setPendingBattle(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleGoToBattle = useCallback(() => {
    navigate('/play/prompt-battles');
  }, [navigate]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const handleCancel = useCallback(() => {
    clearStoredPendingBattle();
    setPendingBattle(null);
  }, []);

  // Don't show banner on battles page (MatchmakingScreen has its own banner)
  // Don't show if no pending battle or dismissed
  if (location.pathname.startsWith('/play/prompt-battles') ||
      location.pathname.startsWith('/battles') || // Legacy route
      !pendingBattle ||
      isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-gradient-to-r from-pink-600 to-purple-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <BoltIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    You have a pending battle challenge
                    {pendingBattle.challengeType && (
                      <span className="hidden sm:inline text-white/80">
                        {' '}• {pendingBattle.challengeType}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-white/70 truncate">
                    Waiting for opponent to accept
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGoToBattle}
                  className="px-4 py-1.5 rounded-lg bg-white text-pink-600 text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition-colors hidden sm:block"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PendingBattleBanner;
