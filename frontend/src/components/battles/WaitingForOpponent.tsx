/**
 * WaitingForOpponent Component
 *
 * Shown when waiting for opponent to connect to the battle.
 */

import { motion } from 'framer-motion';
import { UserGroupIcon, ClockIcon } from '@heroicons/react/24/solid';

interface WaitingForOpponentProps {
  opponentUsername: string;
  opponentIsAi?: boolean;
}

export function WaitingForOpponent({
  opponentUsername,
  opponentIsAi = false,
}: WaitingForOpponentProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background pulse */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 glass-card p-6 md:p-12 text-center max-w-md mx-4 md:mx-0"
      >
        {/* Animated icon */}
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 rounded-xl md:rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"
        >
          <UserGroupIcon className="w-8 h-8 md:w-12 md:h-12 text-cyan-400" />
        </motion.div>

        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          Waiting for {opponentUsername}
        </h2>

        <p className="text-sm md:text-base text-slate-400 mb-4 md:mb-6">
          {opponentIsAi
            ? 'Pip is preparing for battle...'
            : 'Your opponent is connecting to the battle...'}
        </p>

        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <ClockIcon className="w-4 h-4" />
          <span className="text-sm">Usually takes a few seconds</span>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-cyan-400"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default WaitingForOpponent;
