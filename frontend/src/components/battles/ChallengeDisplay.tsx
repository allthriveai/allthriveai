/**
 * ChallengeDisplay Component
 *
 * Shows the battle challenge prompt in an epic,
 * attention-grabbing format.
 */

import { motion } from 'framer-motion';
import { BoltIcon, FireIcon } from '@heroicons/react/24/solid';

interface ChallengeDisplayProps {
  challengeText: string;
  challengeType?: {
    key: string;
    name: string;
  } | null;
}

export function ChallengeDisplay({ challengeText, challengeType }: ChallengeDisplayProps) {
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
        className="relative p-8 rounded-3xl overflow-hidden
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

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-400/50 rounded-tl-3xl" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-cyan-400/50 rounded-br-3xl" />

        {/* Label */}
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <BoltIcon className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold tracking-wider text-cyan-400 uppercase">
            Today's Challenge
          </span>
          <BoltIcon className="w-5 h-5 text-cyan-400" />
        </div>

        {/* Challenge text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative text-2xl md:text-3xl font-bold text-center text-white leading-relaxed"
        >
          "{challengeText}"
        </motion.p>

        {/* Decorative line */}
        <div className="mt-6 flex justify-center">
          <div className="w-24 h-1 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}

export default ChallengeDisplay;
