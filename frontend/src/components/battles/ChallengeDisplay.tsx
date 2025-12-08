/**
 * ChallengeDisplay Component
 *
 * Shows the battle challenge prompt in an epic,
 * attention-grabbing format.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { BoltIcon, FireIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface ChallengeDisplayProps {
  challengeText: string;
  challengeType?: {
    key: string;
    name: string;
  } | null;
  /** Callback to refresh the challenge (only for Pip battles) */
  onRefresh?: () => Promise<void>;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Whether the refresh button should be shown */
  canRefresh?: boolean;
}

export function ChallengeDisplay({
  challengeText,
  challengeType,
  onRefresh,
  isRefreshing = false,
  canRefresh = false,
}: ChallengeDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Challenge type badge */}
      {challengeType && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-4"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                       bg-gradient-to-r from-amber-500/20 to-orange-500/20
                       border border-amber-500/30"
          >
            <FireIcon className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">{challengeType.name}</span>
          </div>
        </motion.div>
      )}

      {/* Main challenge card */}
      <div
        className="relative p-4 md:p-8 rounded-2xl md:rounded-3xl overflow-hidden
                   bg-gradient-to-br from-slate-800/80 to-slate-900/80
                   border border-cyan-500/30
                   shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      >
        {/* Background glow effect */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Corner accents - hidden on mobile */}
        <div className="hidden md:block absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-400/50 rounded-tl-3xl" />
        <div className="hidden md:block absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-cyan-400/50 rounded-br-3xl" />

        {/* Label */}
        <div className="relative flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-4">
          <BoltIcon className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
          <span className="text-xs md:text-sm font-semibold tracking-wider text-cyan-400 uppercase">
            Today's Challenge
          </span>
          <BoltIcon className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
        </div>

        {/* Challenge text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={challengeText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="relative text-lg md:text-2xl lg:text-3xl font-bold text-center text-white leading-relaxed"
          >
            "{challengeText}"
          </motion.p>
        </AnimatePresence>

        {/* Decorative line */}
        <div className="mt-4 md:mt-6 flex justify-center">
          <div className="w-16 md:w-24 h-0.5 md:h-1 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        </div>

        {/* Refresh button (only for Pip battles) */}
        {canRefresh && onRefresh && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 flex justify-center"
          >
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-slate-300 hover:text-white
                       bg-slate-700/50 hover:bg-slate-700
                       rounded-full border border-slate-600/50 hover:border-cyan-500/50
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              {isRefreshing ? 'Getting new prompt...' : 'Try a different prompt'}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default ChallengeDisplay;
