import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy } from '@fortawesome/free-solid-svg-icons';

interface BattleVideoSceneProps {
  elapsed: number;
  isPlaying: boolean;
}

// Timing within the 6-second combined scene
const TIMING = {
  // Phase 1: Battle intro (0-2.5s)
  headerIn: 0,           // 0ms - Header text appears
  subtext: 300,          // 0.3s - Subtext appears
  player1In: 600,        // 0.6s - Player 1 video slides in
  vsIn: 900,             // 0.9s - VS badge slams in
  player2In: 1200,       // 1.2s - Player 2 video slides in
  challengeIn: 1600,     // 1.6s - Challenge prompt appears

  // Phase 2: Shrink and show results (2.5s+)
  shrinkPlayers: 2800,   // 2.8s - Players shrink
  showResults: 3200,     // 3.2s - Result images appear
  winnerReveal: 3800,    // 3.8s - Winner revealed with trophy + XP
};

/**
 * Video clip component - shows video or placeholder
 */
function VideoClip({
  src,
  label,
  username,
  side,
  isPlaying,
  compact,
  isWinner,
}: {
  src?: string;
  label: string;
  username: string;
  side: 'left' | 'right';
  isPlaying: boolean;
  compact?: boolean;
  isWinner?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Winner gets gold border, otherwise use side-specific colors
  const borderColor = isWinner
    ? 'border-amber-500'
    : side === 'left' ? 'border-cyan-500/50' : 'border-green-500/50';
  const shadowColor = isWinner
    ? 'shadow-amber-500/50'
    : side === 'left' ? 'shadow-cyan-500/30' : 'shadow-green-500/30';
  const textColor = side === 'left' ? 'text-cyan-400' : 'text-green-400';

  const sizeClass = compact ? 'w-20 h-28' : 'w-36 h-52';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <motion.div
          className={`relative ${sizeClass} rounded-xl overflow-hidden border-2 ${borderColor} shadow-lg ${shadowColor}`}
          layout
        >
          {src ? (
            <video
              ref={videoRef}
              src={src}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
              autoPlay
            />
          ) : (
            <div className="w-full h-full bg-slate-800/80 flex flex-col items-center justify-center p-2">
              <div className={`${compact ? 'w-6 h-6' : 'w-12 h-12'} rounded-full bg-slate-700 flex items-center justify-center mb-2`}>
                <svg className={`${compact ? 'w-3 h-3' : 'w-6 h-6'} text-slate-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              {!compact && <div className="text-white/40 text-[10px] text-center">{label}</div>}
            </div>
          )}
        </motion.div>
      </div>
      <span className={`${textColor} font-semibold ${compact ? 'text-[10px]' : 'text-sm'} mt-1`}>{username}</span>
    </div>
  );
}

export function BattleVideoScene({ elapsed, isPlaying }: BattleVideoSceneProps) {
  // Phase 1 states
  const showHeader = elapsed >= TIMING.headerIn;
  const showSubtext = elapsed >= TIMING.subtext;
  const showPlayer1 = elapsed >= TIMING.player1In;
  const showVs = elapsed >= TIMING.vsIn;
  const showPlayer2 = elapsed >= TIMING.player2In;
  const showChallenge = elapsed >= TIMING.challengeIn;

  // Phase 2 states
  const isShrunken = elapsed >= TIMING.shrinkPlayers;
  const showResults = elapsed >= TIMING.showResults;
  const showWinner = elapsed >= TIMING.winnerReveal;

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
      {showWinner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="absolute left-1/4 top-1/3 w-64 h-64 rounded-full blur-3xl bg-amber-500"
        />
      )}

      {/* Content container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
        {/* Header - changes when results shown */}
        <div className="text-center px-6">
          {showHeader && !showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-base font-bold text-white/80 tracking-tight">
                BECOME A BETTER
              </div>
              <div className="text-xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                PROMPT ENGINEER
              </div>
            </motion.div>
          )}

          {showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">
                Battle Results
              </div>
              <div className="text-xl font-black text-white">
                "Design a TV remote guardian creature"
              </div>
            </motion.div>
          )}

          {showSubtext && !showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-white/60 mt-1"
            >
              through player vs player battles
            </motion.div>
          )}
        </div>

        {/* Battle arena */}
        <motion.div
          className={`flex items-center justify-center px-4 ${isShrunken ? 'mt-1' : 'mt-2'}`}
          animate={{
            scale: isShrunken ? 0.45 : 1,
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="flex items-center gap-1">
            {/* Player 1 Video */}
            {showPlayer1 && (
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <VideoClip
                  src="/person-1.mov"
                  label="Player 1 video"
                  username="@nanobanana"
                  side="left"
                  isPlaying={isPlaying}
                  isWinner={showWinner}
                />
              </motion.div>
            )}

            {/* VS Badge */}
            {showVs && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{
                  scale: isShrunken ? 0.8 : 1,
                  rotate: 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="relative z-10 -mx-3"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                  {!isShrunken && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                  <span className="text-base font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                    VS
                  </span>
                </div>
              </motion.div>
            )}

            {/* Player 2 Video */}
            {showPlayer2 && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <VideoClip
                  src="/person-2.mov"
                  label="Player 2 video"
                  username="@promptpro"
                  side="right"
                  isPlaying={isPlaying}
                />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Challenge prompt - fades out when shrinking */}
        {showChallenge && !isShrunken && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="px-6 mt-3"
          >
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50">
              <div className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wide mb-1">
                Challenge
              </div>
              <p className="text-white text-xs leading-snug">
                "Design a TV remote guardian creature"
              </p>
            </div>
          </motion.div>
        )}


        {/* Results section - appears after shrink */}
        {showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center gap-3 px-6 -mt-2"
          >
            {/* Player 1's result - WINNER */}
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
                    className="w-36 h-36 object-cover"
                  />
                  {showWinner && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent"
                    />
                  )}
                </motion.div>

                {/* Winner trophy */}
                {showWinner && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </div>

              <span className="text-cyan-400 font-semibold text-xs mt-2">@nanobanana</span>
              {showWinner && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-amber-400 text-[10px] font-bold"
                >
                  WINNER!
                </motion.span>
              )}
            </motion.div>

            {/* Player 2's result */}
            <div className="flex flex-col items-center">
              <div className={`relative rounded-2xl overflow-hidden border-3 border-green-500/50 shadow-lg shadow-green-500/20 ${
                showWinner ? 'opacity-60' : ''
              }`}>
                <img
                  src="/promo-nanobanana-2.png"
                  alt="Player 2 submission"
                  className="w-36 h-36 object-cover"
                />
              </div>
              <span className="text-green-400 font-semibold text-xs mt-2">@promptpro</span>
            </div>
          </motion.div>
        )}

        {/* XP Reward - shows with winner */}
        {showWinner && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="flex justify-center mt-2"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40">
              <FontAwesomeIcon icon={faTrophy} className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-bold text-sm">+200 XP</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default BattleVideoScene;
