/**
 * AsyncBattleBanner Component
 *
 * Banner displayed on all pages when user has an async battle where it's their turn.
 * Shows most urgent battle with countdown and quick action to start turn.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BoltIcon, XMarkIcon, PlayIcon } from '@heroicons/react/24/solid';
import { useAsyncBattles } from '@/contexts/AsyncBattleContext';
import { BattleDeadlineCountdown } from './BattleDeadlineCountdown';
import { useAuth } from '@/hooks/useAuth';

// Dismiss state persists for 30 minutes
const DISMISS_DURATION_MS = 30 * 60 * 1000;
const DISMISS_STORAGE_KEY = 'async_battle_banner_dismissed';

function getDismissedState(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!dismissed) return false;
    const dismissedAt = parseInt(dismissed, 10);
    if (isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export function AsyncBattleBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasUrgentBattle, mostUrgentBattle, urgentBattles, startTurn } = useAsyncBattles();

  const [isDismissed, setIsDismissed] = useState(getDismissedState);
  const [isStarting, setIsStarting] = useState(false);

  // Reset dismiss state when urgent battles change (new battle appeared)
  useEffect(() => {
    if (hasUrgentBattle && mostUrgentBattle) {
      // Check if the dismissed timestamp is older than when this battle became urgent
      // For now, just reset if user has urgent battles and dismiss expired
      if (!getDismissedState()) {
        setIsDismissed(false);
      }
    }
  }, [hasUrgentBattle, mostUrgentBattle?.id]);

  const handleStartTurn = useCallback(async () => {
    if (!mostUrgentBattle) return;

    setIsStarting(true);
    const result = await startTurn(mostUrgentBattle.id);
    if (result.success) {
      navigate(`/play/prompt-battles/${mostUrgentBattle.id}`);
      // Don't reset isStarting - component will unmount on navigation
      return;
    }
    setIsStarting(false);
  }, [mostUrgentBattle, startTurn, navigate]);

  const handleViewBattles = useCallback(() => {
    // Navigate to profile page My Battles tab
    if (user?.username) {
      navigate(`/${user.username}?tab=my-battles`);
    }
  }, [navigate, user?.username]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage not available
    }
  }, []);

  // Don't show banner on battles pages (they have their own UI)
  // Don't show if no urgent battles or dismissed
  if (
    location.pathname.startsWith('/play/prompt-battles') ||
    location.pathname.startsWith('/battles') || // Legacy route
    !hasUrgentBattle ||
    !mostUrgentBattle ||
    isDismissed
  ) {
    return null;
  }

  const battleCount = urgentBattles.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Icon and message */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                  <BoltIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {battleCount === 1
                      ? `It's your turn vs ${mostUrgentBattle.opponent?.username || 'Unknown'}!`
                      : `You have ${battleCount} battles waiting for your turn!`}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="hidden sm:inline">
                      {mostUrgentBattle.challengeType?.name || mostUrgentBattle.challengeText}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1">
                      Deadline:
                      <BattleDeadlineCountdown
                        targetDate={mostUrgentBattle.deadline}
                        variant="deadline"
                        size="sm"
                        showIcon={false}
                        className="!bg-transparent !p-0 !text-white/90"
                      />
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleStartTurn}
                  disabled={isStarting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-pink-600 text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  {isStarting ? 'Starting...' : 'Start Turn'}
                </button>

                {battleCount > 1 && (
                  <button
                    type="button"
                    onClick={handleViewBattles}
                    className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition-colors hidden sm:block"
                  >
                    View All ({battleCount})
                  </button>
                )}

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

export default AsyncBattleBanner;
