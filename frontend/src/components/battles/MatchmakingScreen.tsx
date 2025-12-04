/**
 * MatchmakingScreen Component
 *
 * Pre-battle screen for finding opponents.
 * Offers quick match with Pip (AI) or random matchmaking.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoltIcon,
  UserGroupIcon,
  CpuChipIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';

interface QueueStatus {
  inQueue: boolean;
  position: number;
  expiresAt: string | null;
}

interface MatchmakingScreenProps {
  isSearching: boolean;
  queueStatus: QueueStatus;
  isConnecting: boolean;
  onMatchWithPip: () => void;
  onFindRandomMatch: () => void;
  onLeaveQueue: () => void;
}

export function MatchmakingScreen({
  isSearching,
  queueStatus,
  isConnecting,
  onMatchWithPip,
  onFindRandomMatch,
  onLeaveQueue,
}: MatchmakingScreenProps) {
  const [selectedMode, setSelectedMode] = useState<'ai' | 'random' | null>(null);

  const handleModeSelect = (mode: 'ai' | 'random') => {
    setSelectedMode(mode);
    if (mode === 'ai') {
      onMatchWithPip();
    } else {
      onFindRandomMatch();
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4 pb-16">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0) 70%)',
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 p-0.5">
              <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
                <BoltIcon className="w-10 h-10 text-cyan-400" />
              </div>
            </div>
          </motion.div>

          <h1 className="text-4xl font-bold text-white mb-2">
            Prompt <span className="text-gradient-cyan">Battles</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Challenge others to an AI image generation duel!
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {isSearching ? (
            /* Searching state */
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-8 text-center"
            >
              {/* Animated radar */}
              <div className="relative w-32 h-32 mx-auto mb-6">
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  >
                    <MagnifyingGlassIcon className="w-12 h-12 text-cyan-400" />
                  </motion.div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {selectedMode === 'ai' ? 'Connecting to Pip...' : 'Finding Opponent...'}
              </h2>

              {queueStatus.position > 0 && (
                <p className="text-slate-400 mb-4">
                  Position in queue: <span className="text-cyan-400 font-semibold">{queueStatus.position}</span>
                </p>
              )}

              <p className="text-slate-500 text-sm mb-6">
                {selectedMode === 'ai'
                  ? 'Pip is warming up for battle!'
                  : 'Looking for a worthy challenger...'}
              </p>

              <button
                onClick={onLeaveQueue}
                className="btn-secondary flex items-center gap-2 mx-auto"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </motion.div>
          ) : (
            /* Mode selection */
            <motion.div
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Battle Pip */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleModeSelect('ai')}
                disabled={isConnecting}
                className="glass-card p-8 text-left group cursor-pointer hover:border-violet-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-shadow">
                  <CpuChipIcon className="w-8 h-8 text-violet-400" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
                  Battle Pip
                </h3>

                <p className="text-slate-400 text-sm mb-4">
                  Challenge our AI companion to a friendly duel. Perfect for practice!
                </p>

                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <SparklesIcon className="w-4 h-4" />
                  <span>Instant Match</span>
                </div>
              </motion.button>

              {/* Random Match */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleModeSelect('random')}
                disabled={isConnecting}
                className="glass-card p-8 text-left group cursor-pointer hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-shadow">
                  <UserGroupIcon className="w-8 h-8 text-cyan-400" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  Random Match
                </h3>

                <p className="text-slate-400 text-sm mb-4">
                  Face off against another player in real-time. May the best prompt win!
                </p>

                <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                  <BoltIcon className="w-4 h-4" />
                  <span>Live PvP</span>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works */}
        {!isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <h3 className="text-center text-slate-500 text-sm font-medium mb-6 tracking-wider uppercase">
              How It Works
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Match', desc: 'Find an opponent' },
                { step: '2', title: 'Create', desc: 'Write your prompt' },
                { step: '3', title: 'Battle', desc: 'AI judges the winner' },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-cyan-400 font-bold">{item.step}</span>
                  </div>
                  <h4 className="text-white font-medium text-sm">{item.title}</h4>
                  <p className="text-slate-500 text-xs">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default MatchmakingScreen;
