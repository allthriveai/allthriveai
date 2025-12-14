import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faTrophy, faCheck } from '@fortawesome/free-solid-svg-icons';

interface BattleSceneProps {
  progress: number; // 0-1 progress through scene
  elapsed: number;  // ms since scene started
}

// Timing breakpoints within the 8-second scene
const TIMING = {
  textBattle: 0,        // 0ms - "BATTLE" crashes in
  textToLearn: 500,     // 500ms - "TO LEARN" slides in
  splitLine: 1000,      // 1s - screen splits
  player1: 1500,        // 1.5s - Player 1 slides in
  vsBadge: 2000,        // 2s - VS badge slams in
  player2: 2500,        // 2.5s - Player 2 slides in
  challenge: 3500,      // 3.5s - Challenge text types
  typing: 5000,         // 5s - Typing indicators
  submitted: 6000,      // 6s - Submitted checkmarks
  xpReward: 6500,       // 6.5s - XP reward flies up
};

function TypewriterText({ text, isVisible, duration = 1500 }: { text: string; isVisible: boolean; duration?: number }) {
  if (!isVisible) return null;

  return (
    <motion.span
      initial={{ width: 0 }}
      animate={{ width: 'auto' }}
      transition={{ duration: duration / 1000, ease: 'linear' }}
      className="overflow-hidden whitespace-nowrap inline-block"
    >
      {text}
    </motion.span>
  );
}

export function BattleScene({ progress: _progress, elapsed }: BattleSceneProps) {
  const showBattle = elapsed >= TIMING.textBattle;
  const showToLearn = elapsed >= TIMING.textToLearn;
  const showSplitLine = elapsed >= TIMING.splitLine;
  const showPlayer1 = elapsed >= TIMING.player1;
  const showVsBadge = elapsed >= TIMING.vsBadge;
  const showPlayer2 = elapsed >= TIMING.player2;
  const showChallenge = elapsed >= TIMING.challenge;
  const showTyping = elapsed >= TIMING.typing;
  const showSubmitted = elapsed >= TIMING.submitted;
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

      {/* Split line - centered in full screen */}
      {showSplitLine && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute left-1/2 top-[30%] bottom-[40%] w-[2px] -translate-x-1/2 origin-center"
          style={{
            background: 'linear-gradient(to bottom, transparent, #22D3EE, #34D399, transparent)',
          }}
        />
      )}

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

          {showSplitLine && (
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
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex items-center justify-center gap-3 w-full max-w-sm">
            {/* Player 1 */}
            {showPlayer1 && (
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/40">
                  AD
                </div>
                <span className="text-white font-semibold text-xs mt-1">@aidesigner</span>
                {showTyping && !showSubmitted && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-cyan-400 text-[10px] mt-0.5"
                  >
                    Typing...
                  </motion.span>
                )}
                {showSubmitted && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className="text-green-400 text-[10px] mt-0.5 flex items-center gap-0.5"
                  >
                    <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" />
                    Done!
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
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
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
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-green-500/40">
                  PP
                </div>
                <span className="text-white font-semibold text-xs mt-1">@promptpro</span>
                {showTyping && !showSubmitted && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                    className="text-green-400 text-[10px] mt-0.5"
                  >
                    Typing...
                  </motion.span>
                )}
                {showSubmitted && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, delay: 0.2 }}
                    className="text-green-400 text-[10px] mt-0.5 flex items-center gap-0.5"
                  >
                    <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" />
                    Done!
                  </motion.span>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Challenge card - at bottom of safe zone */}
        {showChallenge && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="px-4"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30">
                  <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5 text-rose-400" />
                  <span className="text-[10px] font-semibold text-rose-300 uppercase tracking-wide">Live Battle</span>
                </div>
                {showXpReward && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30"
                  >
                    <FontAwesomeIcon icon={faTrophy} className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-bold text-xs">+200 XP</span>
                  </motion.div>
                )}
              </div>

              <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wide mb-1">Challenge</div>
              <p className="text-white text-xs font-medium leading-relaxed">
                <TypewriterText
                  text="Create a surreal dreamscape with floating islands"
                  isVisible={showChallenge}
                  duration={1200}
                />
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default BattleScene;
