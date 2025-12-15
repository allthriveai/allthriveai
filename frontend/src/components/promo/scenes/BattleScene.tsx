import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faTrophy, faCrown } from '@fortawesome/free-solid-svg-icons';

interface BattleSceneProps {
  progress: number; // 0-1 progress through scene
  elapsed: number;  // ms since scene started
}

// Timing breakpoints within the 8-second scene
const TIMING = {
  textBattle: 0,        // 0ms - "BECOME A BETTER" appears
  textToLearn: 500,     // 500ms - "PROMPT ENGINEER" slides in
  subtext: 1000,        // 1s - "through player vs player battles"
  player1: 1500,        // 1.5s - Player 1 slides in
  vsBadge: 2000,        // 2s - VS badge slams in
  player2: 2500,        // 2.5s - Player 2 slides in
  showPrompt: 3000,     // 3s - Show the challenge/prompt
  showImages: 4500,     // 4.5s - Show battle images
  winner: 6000,         // 6s - Winner revealed
  xpReward: 7000,       // 7s - XP reward flies up
};

// DiceBear avatar URLs for fictional players
const AVATARS = {
  player1: 'https://api.dicebear.com/9.x/lorelei/svg?seed=nanobanana&backgroundColor=0d9488',
  player2: 'https://api.dicebear.com/9.x/lorelei/svg?seed=promptpro&backgroundColor=6366f1',
};

export function BattleScene({ progress: _progress, elapsed }: BattleSceneProps) {
  const showBattle = elapsed >= TIMING.textBattle;
  const showToLearn = elapsed >= TIMING.textToLearn;
  const showSubtext = elapsed >= TIMING.subtext;
  const showPlayer1 = elapsed >= TIMING.player1;
  const showVsBadge = elapsed >= TIMING.vsBadge;
  const showPlayer2 = elapsed >= TIMING.player2;
  const showPrompt = elapsed >= TIMING.showPrompt;
  const showImages = elapsed >= TIMING.showImages;
  const showWinner = elapsed >= TIMING.winner;
  const showXpReward = elapsed >= TIMING.xpReward;

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background glows */}
      <div className="absolute -left-20 top-1/4 w-64 h-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
      <div className="absolute -right-20 top-1/3 w-64 h-64 rounded-full opacity-25 blur-3xl bg-green-500" />

      {/* Safe zone container - all content goes here */}
      <div
        className="absolute inset-x-0 flex flex-col"
        style={{
          top: '18%',
          bottom: '30%',
        }}
      >
        {/* Header text */}
        <div className="text-center px-6">
          {showBattle && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="text-lg font-bold text-white/80 tracking-tight"
            >
              BECOME A BETTER
            </motion.div>
          )}

          {showToLearn && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent"
            >
              PROMPT ENGINEER
            </motion.div>
          )}

          {showSubtext && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-white/60 mt-1"
            >
              through player vs player battles
            </motion.div>
          )}
        </div>

        {/* Battle arena - centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Player avatars row */}
          <div className="flex items-center justify-center gap-3 w-full max-w-sm mb-3">
            {/* Player 1 */}
            {showPlayer1 && (
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <img
                    src={AVATARS.player1}
                    alt="Player 1"
                    className="w-14 h-14 rounded-full object-cover border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/40 bg-slate-700"
                  />
                  {showWinner && (
                    <motion.div
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className="absolute -top-2 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <FontAwesomeIcon icon={faCrown} className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </div>
                <span className="text-white font-semibold text-[10px] mt-1">@nanobanana</span>
                {showWinner && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-amber-400 text-[9px] font-bold mt-0.5"
                  >
                    WINNER!
                  </motion.span>
                )}
              </motion.div>
            )}

            {/* VS Badge */}
            {showVsBadge && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="relative"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-base font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                    VS
                  </span>
                </div>
              </motion.div>
            )}

            {/* Player 2 */}
            {showPlayer2 && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="flex flex-col items-center"
              >
                <img
                  src={AVATARS.player2}
                  alt="Player 2"
                  className="w-14 h-14 rounded-full object-cover border-2 border-green-500/50 shadow-lg shadow-green-500/40 bg-slate-700"
                />
                <span className="text-white font-semibold text-[10px] mt-1">@promptpro</span>
              </motion.div>
            )}
          </div>

          {/* Prompt/Challenge Description */}
          {showPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-full max-w-xs px-4 mb-3"
            >
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50">
                <div className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wide mb-1">
                  Challenge
                </div>
                <p className="text-white text-sm leading-snug">
                  "Design a creature that only exists because the universe needed something to guard the TV remote"
                </p>
              </div>
            </motion.div>
          )}

          {/* Battle images side by side */}
          {showImages && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="flex gap-2 px-4"
            >
              {/* Player 1's submission */}
              <motion.div
                className={`relative rounded-lg overflow-hidden border-2 ${showWinner ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'border-cyan-500/30'}`}
                animate={showWinner ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                <img
                  src="/promo-nanobanana.png"
                  alt="Player 1 submission"
                  className="w-28 h-28 object-cover"
                />
                {showWinner && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent"
                  />
                )}
              </motion.div>

              {/* Player 2's submission */}
              <div className="relative rounded-lg overflow-hidden border-2 border-green-500/30">
                <img
                  src="/promo-nanobanana-2.png"
                  alt="Player 2 submission"
                  className="w-28 h-28 object-cover"
                />
              </div>
            </motion.div>
          )}

          {/* XP Reward */}
          {showXpReward && (
            <motion.div
              initial={{ scale: 0, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30"
            >
              <FontAwesomeIcon icon={faTrophy} className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-bold text-xs">+200 XP</span>
            </motion.div>
          )}
        </div>

        {/* Live Battle badge */}
        {showSubtext && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30">
              <FontAwesomeIcon icon={faBolt} className="w-3 h-3 text-rose-400" />
              <span className="text-xs font-semibold text-rose-300 uppercase tracking-wide">Live Battle</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default BattleScene;
