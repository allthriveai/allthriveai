/**
 * BattlePage State Components
 *
 * Extracted sub-components for various BattlePage states:
 * - Loading states
 * - Error states
 * - Time expired
 * - Connection lost
 *
 * These reduce the main BattlePage component size and improve maintainability.
 */

import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/solid';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

// =============================================================================
// Loading States
// =============================================================================

interface BattlePageLoadingProps {
  message?: string;
}

/**
 * Loading spinner shown while connecting to battle or fetching data.
 */
export function BattlePageLoading({ message = 'Loading battle...' }: BattlePageLoadingProps) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-cyan-500/30 border-t-cyan-500"
          />
          <p className="text-slate-400">{message}</p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

// =============================================================================
// Error States
// =============================================================================

interface BattlePageErrorProps {
  title?: string;
  message: string;
  onBack: () => void;
  backLabel?: string;
}

/**
 * Error state shown when battle fails to load or is not found.
 */
export function BattlePageError({
  title = 'Failed to Load Battle',
  message,
  onBack,
  backLabel = 'Back to Battles',
}: BattlePageErrorProps) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-8 max-w-md">
          <ExclamationTriangleIcon className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400 mb-4">{message}</p>
          <button onClick={onBack} className="btn-primary">
            {backLabel}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface InvalidBattleProps {
  onBack: () => void;
}

/**
 * Shown when battle ID is missing or invalid.
 */
export function InvalidBattle({ onBack }: InvalidBattleProps) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid Battle</h2>
          <p className="text-slate-400 mb-4">No battle ID provided.</p>
          <button onClick={onBack} className="btn-primary">
            Find a Battle
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

// =============================================================================
// Time Expired State
// =============================================================================

interface BattleTimeExpiredProps {
  onBack: () => void;
}

/**
 * Shown when the battle time has expired.
 */
export function BattleTimeExpired({ onBack }: BattleTimeExpiredProps) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-8 max-w-md">
          <ClockIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Time's Up!</h2>
          <p className="text-slate-400 mb-4">
            The battle time has expired. Your submission has been recorded.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onBack} className="btn-secondary">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Battles
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// =============================================================================
// Connection Lost State
// =============================================================================

interface BattleConnectionLostProps {
  onLeave: () => void;
}

/**
 * Shown when WebSocket connection is temporarily disconnected during a battle.
 * Uses friendly messaging since this often happens when users switch tabs.
 */
export function BattleConnectionLost({ onLeave }: BattleConnectionLostProps) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-8 max-w-md">
          {/* Reconnecting spinner instead of warning icon */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-cyan-500/30 border-t-cyan-500"
          />
          <h2 className="text-xl font-bold text-white mb-2">Reconnecting...</h2>
          <p className="text-slate-400 mb-4">
            Hold tight! We're getting you back into the battle.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onLeave} className="btn-secondary">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Leave Battle
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
