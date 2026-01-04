/**
 * BattleSimulation - Animated battle demo for the landing page hero
 *
 * Shows a simplified Image Prompt Battle between two players.
 * Focuses on the visual flow: intro → prompts → images → winner
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { SparklesIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCrown, faStar } from '@fortawesome/free-solid-svg-icons';

// Demo data - shorter, punchier prompts
const demoData = {
  challenge: 'Robot cat chef making pizza',
  player1: {
    name: 'alex_dev',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    prompt: 'Chrome cat, neon kitchen',
    score: 84,
  },
  player2: {
    name: 'maya_creates',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maya',
    prompt: '80s retro robot cat chef',
    score: 71,
  },
  images: {
    player1: '/battle-robot-cat-1.png',
    player2: '/battle-robot-cat-2.png',
  },
};

type Phase =
  | 'intro'           // 0-3s - explain what this is
  | 'challenge'       // 3-4s - show challenge
  | 'prompts'         // 4-6s - both prompts fade in
  | 'generating'      // 6-8s - generating spinner
  | 'images'          // 8-11s - images appear
  | 'winner';         // 11-14s - winner revealed

const phaseTimings: { phase: Phase; duration: number }[] = [
  { phase: 'intro', duration: 5000 },
  { phase: 'challenge', duration: 1000 },
  { phase: 'prompts', duration: 800 },
  { phase: 'generating', duration: 1000 },
  { phase: 'images', duration: 1500 },
  { phase: 'winner', duration: 2500 },
];

export function BattleSimulation() {
  const [currentPhase, setCurrentPhase] = useState<Phase>('intro');

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Phase progression
  useEffect(() => {
    if (prefersReducedMotion) {
      setCurrentPhase('winner');
      return;
    }

    let phaseIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const advancePhase = () => {
      phaseIndex = (phaseIndex + 1) % phaseTimings.length;
      setCurrentPhase(phaseTimings[phaseIndex].phase);
      timeoutId = setTimeout(advancePhase, phaseTimings[phaseIndex].duration);
    };

    timeoutId = setTimeout(advancePhase, phaseTimings[0].duration);
    return () => clearTimeout(timeoutId);
  }, [prefersReducedMotion]);

  const phaseIndex = phaseTimings.findIndex((p) => p.phase === currentPhase);
  const showChallenge = phaseIndex >= 1;
  const showPrompts = phaseIndex >= 2;
  const showGenerating = phaseIndex >= 3;
  const showImages = phaseIndex >= 4;
  const showWinner = phaseIndex >= 5;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-pink-500/10 blur-2xl" />

      {/* Main battle card */}
      <div className="relative w-full max-w-[480px] bg-slate-900/80 backdrop-blur-xl rounded border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-center gap-2">
          <SparklesIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
            Image Prompt Battle
          </span>
        </div>

        {/* Content area */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {/* Intro Phase */}
            {currentPhase === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative py-10 overflow-hidden"
              >
                {/* Floating orbs background */}
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    className="absolute w-32 h-32 rounded-full bg-cyan-500/20 blur-2xl"
                    animate={{
                      x: [0, 30, 0],
                      y: [0, -20, 0],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ top: '10%', left: '10%' }}
                  />
                  <motion.div
                    className="absolute w-24 h-24 rounded-full bg-pink-500/20 blur-2xl"
                    animate={{
                      x: [0, -20, 0],
                      y: [0, 30, 0],
                      scale: [1, 1.3, 1],
                    }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    style={{ bottom: '20%', right: '15%' }}
                  />
                </div>

                {/* Main content */}
                <div className="relative text-center">
                  {/* Player avatars with VS */}
                  <div className="flex items-center justify-center gap-4 mb-5">
                    {/* Player 1 */}
                    <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
                      className="flex flex-col items-center"
                    >
                      <div className="relative">
                        <motion.div
                          className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600 blur-sm"
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <img
                          src={demoData.player1.avatar}
                          alt={demoData.player1.name}
                          className="relative w-16 h-16 rounded-full border-2 border-cyan-400 bg-slate-800"
                        />
                      </div>
                      <span className="mt-2 text-xs text-cyan-400 font-medium">{demoData.player1.name}</span>
                    </motion.div>

                    {/* VS badge */}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                    >
                      <motion.span
                        className="text-lg font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        VS
                      </motion.span>
                    </motion.div>

                    {/* Player 2 */}
                    <motion.div
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
                      className="flex flex-col items-center"
                    >
                      <div className="relative">
                        <motion.div
                          className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-600 blur-sm"
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        />
                        <img
                          src={demoData.player2.avatar}
                          alt={demoData.player2.name}
                          className="relative w-16 h-16 rounded-full border-2 border-pink-400 bg-slate-800"
                        />
                      </div>
                      <span className="mt-2 text-xs text-pink-400 font-medium">{demoData.player2.name}</span>
                    </motion.div>
                  </div>

                  {/* Main headline with stagger */}
                  <div className="overflow-hidden mb-4">
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, type: 'spring', stiffness: 100 }}
                      className="flex items-center justify-center gap-3"
                    >
                      <span className="text-3xl font-bold text-white">2 players</span>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 1, delay: 0.8, repeat: 2 }}
                      >
                        <FontAwesomeIcon icon={faBolt} className="text-2xl text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                      </motion.div>
                      <span className="text-3xl font-bold text-white">1 challenge</span>
                    </motion.div>
                  </div>

                  {/* Subtitle */}
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-slate-300 text-base max-w-[340px] mx-auto leading-relaxed"
                  >
                    Craft your prompt to generate an AI image.<br />
                    <span className="text-cyan-400 font-medium">Most creative result wins!</span>
                  </motion.p>

                  {/* Animated dots/loading indicator */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="mt-6 flex justify-center gap-1.5"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-cyan-400"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 1, 0.3],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Battle Content */}
            {currentPhase !== 'intro' && (
              <motion.div
                key="battle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Challenge */}
                <AnimatePresence>
                  {showChallenge && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center mb-4"
                    >
                      <div className="text-xs text-slate-500 mb-1">Today's Challenge</div>
                      <div className="text-white font-medium">
                        "{demoData.challenge}"
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Two player columns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Player 1 */}
                  <motion.div
                    className={`rounded-lg border overflow-hidden transition-colors duration-300 ${
                      showWinner
                        ? 'border-yellow-400/50 bg-gradient-to-br from-yellow-500/10 to-cyan-500/5'
                        : 'border-cyan-500/30 bg-cyan-500/5'
                    }`}
                    animate={showWinner ? { boxShadow: ['0 0 0px rgba(250,204,21,0)', '0 0 20px rgba(250,204,21,0.3)', '0 0 0px rgba(250,204,21,0)'] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {/* Avatar & name */}
                    <div className="px-3 py-2 border-b border-cyan-500/20 flex items-center gap-2">
                      <img
                        src={demoData.player1.avatar}
                        alt={demoData.player1.name}
                        className="w-6 h-6 rounded-full bg-slate-700"
                      />
                      <span className="text-xs font-medium text-white truncate">
                        {demoData.player1.name}
                      </span>
                      {showWinner && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                          className="ml-auto"
                        >
                          <motion.div
                            animate={{ y: [0, -2, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            <TrophyIcon className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
                          </motion.div>
                        </motion.div>
                      )}
                    </div>

                    {/* Prompt */}
                    <AnimatePresence>
                      {showPrompts && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="px-3 py-2 border-b border-cyan-500/10"
                        >
                          <div className="text-[10px] text-cyan-400/60 mb-0.5">Prompt</div>
                          <div className="text-xs text-white">{demoData.player1.prompt}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Image area */}
                    <div className="p-2">
                      {showGenerating && !showImages && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="aspect-square flex items-center justify-center bg-slate-800/50 rounded"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
                          />
                        </motion.div>
                      )}
                      {!showGenerating && !showImages && (
                        <div className="aspect-square bg-slate-800/30 rounded" />
                      )}
                      {showImages && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded overflow-hidden"
                        >
                          {/* Winner glow effect */}
                          {showWinner && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 rounded-lg blur-md"
                            />
                          )}
                          <div className={`relative ${showWinner ? 'ring-2 ring-yellow-400' : ''}`}>
                            <img
                              src={demoData.images.player1}
                              alt="Generated"
                              className="w-full h-auto rounded"
                            />
                            {/* Shimmer overlay */}
                            {showWinner && (
                              <motion.div
                                initial={{ x: '-100%' }}
                                animate={{ x: '200%' }}
                                transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                              />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Score */}
                    {showWinner && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        className="px-3 pb-2 text-center"
                      >
                        <motion.span
                          className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 0.5, repeat: 2 }}
                        >
                          {demoData.player1.score}
                        </motion.span>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Player 2 */}
                  <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 overflow-hidden">
                    {/* Avatar & name */}
                    <div className="px-3 py-2 border-b border-pink-500/20 flex items-center gap-2">
                      <img
                        src={demoData.player2.avatar}
                        alt={demoData.player2.name}
                        className="w-6 h-6 rounded-full bg-slate-700"
                      />
                      <span className="text-xs font-medium text-white truncate">
                        {demoData.player2.name}
                      </span>
                    </div>

                    {/* Prompt */}
                    <AnimatePresence>
                      {showPrompts && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="px-3 py-2 border-b border-pink-500/10"
                        >
                          <div className="text-[10px] text-pink-400/60 mb-0.5">Prompt</div>
                          <div className="text-xs text-white">{demoData.player2.prompt}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Image area */}
                    <div className="p-2">
                      {showGenerating && !showImages && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="aspect-square flex items-center justify-center bg-slate-800/50 rounded"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 border-2 border-pink-400/30 border-t-pink-400 rounded-full"
                          />
                        </motion.div>
                      )}
                      {!showGenerating && !showImages && (
                        <div className="aspect-square bg-slate-800/30 rounded" />
                      )}
                      {showImages && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="rounded overflow-hidden"
                        >
                          <img
                            src={demoData.images.player2}
                            alt="Generated"
                            className="w-full h-auto"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Score */}
                    {showWinner && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="px-3 pb-2 text-center"
                      >
                        <span className="text-xl font-bold text-slate-400">{demoData.player2.score}</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Winner banner */}
                <AnimatePresence>
                  {showWinner && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="mt-4 text-center relative"
                    >
                      {/* Celebration sparkles */}
                      <div className="absolute inset-0 flex justify-center">
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0, y: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              scale: [0, 1, 0],
                              y: [-20, -40],
                              x: (i - 2.5) * 20,
                            }}
                            transition={{
                              duration: 1,
                              delay: i * 0.1,
                              repeat: Infinity,
                              repeatDelay: 1,
                            }}
                            className="absolute"
                          >
                            <FontAwesomeIcon icon={faStar} className="text-yellow-400 text-xs" />
                          </motion.div>
                        ))}
                      </div>

                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border border-yellow-500/40 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                        animate={{ boxShadow: ['0 0 20px rgba(234,179,8,0.2)', '0 0 30px rgba(234,179,8,0.4)', '0 0 20px rgba(234,179,8,0.2)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <motion.div
                          animate={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                        >
                          <TrophyIcon className="w-5 h-5 text-yellow-400" />
                        </motion.div>
                        <span className="text-sm text-yellow-300 font-bold">
                          {demoData.player1.name} wins!
                        </span>
                        <FontAwesomeIcon icon={faCrown} className="text-yellow-400" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default BattleSimulation;
