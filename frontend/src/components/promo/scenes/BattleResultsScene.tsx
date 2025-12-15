import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faTrophy } from '@fortawesome/free-solid-svg-icons';

interface BattleResultsSceneProps {
  elapsed: number;
}

// Timing within the 4-second scene
const TIMING = {
  headerIn: 0,           // 0ms - Header appears
  imagesIn: 300,         // 0.3s - Images slide in
  winnerReveal: 1200,    // 1.2s - Winner revealed with effects
  xpReward: 2000,        // 2s - XP reward appears
  subtextIn: 2800,       // 2.8s - Subtext appears
};

export function BattleResultsScene({ elapsed }: BattleResultsSceneProps) {
  const showHeader = elapsed >= TIMING.headerIn;
  const showImages = elapsed >= TIMING.imagesIn;
  const showWinner = elapsed >= TIMING.winnerReveal;
  const showXpReward = elapsed >= TIMING.xpReward;
  const showSubtext = elapsed >= TIMING.subtextIn;

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background glows */}
      <div className="absolute -left-20 top-1/4 w-64 h-64 rounded-full opacity-30 blur-3xl bg-amber-500" />
      <div className="absolute -right-20 top-1/3 w-64 h-64 rounded-full opacity-25 blur-3xl bg-cyan-500" />

      {/* Content container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Header */}
        {showHeader && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-center px-6 mb-6"
          >
            <div className="text-sm font-bold text-white/60 uppercase tracking-wider mb-1">
              Battle Results
            </div>
            <div className="text-lg font-black text-white">
              "Design a remote guardian creature"
            </div>
          </motion.div>
        )}

        {/* Images - side by side, bigger */}
        {showImages && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="flex justify-center gap-4 px-6"
          >
            {/* Player 1's submission - WINNER */}
            <motion.div
              className="flex flex-col items-center"
              animate={showWinner ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="relative">
                <motion.div
                  className={`relative rounded-2xl overflow-hidden border-3 ${
                    showWinner
                      ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.6)]'
                      : 'border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                  }`}
                >
                  <img
                    src="/promo-nanobanana.png"
                    alt="Player 1 submission"
                    className="w-44 h-44 object-cover"
                  />
                  {showWinner && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent"
                    />
                  )}
                </motion.div>

                {/* Winner crown */}
                {showWinner && (
                  <motion.div
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <FontAwesomeIcon icon={faCrown} className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </div>

              <span className="text-cyan-400 font-semibold text-sm mt-3">@nanobanana</span>
              {showWinner && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-amber-400 text-xs font-bold"
                >
                  WINNER!
                </motion.span>
              )}
            </motion.div>

            {/* Player 2's submission */}
            <div className="flex flex-col items-center">
              <div className={`relative rounded-2xl overflow-hidden border-3 border-green-500/50 shadow-lg shadow-green-500/20 ${
                showWinner ? 'opacity-60' : ''
              }`}>
                <img
                  src="/promo-nanobanana-2.png"
                  alt="Player 2 submission"
                  className="w-44 h-44 object-cover"
                />
              </div>
              <span className="text-green-400 font-semibold text-sm mt-3">@promptpro</span>
            </div>
          </motion.div>
        )}

        {/* XP Reward */}
        {showXpReward && (
          <motion.div
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="flex justify-center mt-6"
          >
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 border border-amber-500/40">
              <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold text-base">+200 XP</span>
            </div>
          </motion.div>
        )}

        {/* Subtext */}
        {showSubtext && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-6 px-6"
          >
            <span className="text-white/50 text-sm">Level up your skills through </span>
            <span className="text-cyan-400 text-sm font-semibold">friendly competition</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default BattleResultsScene;
