/**
 * BattleSimulation - Animated battle demo for the landing page hero
 *
 * A 15-second looping animation showing a Image Prompt Battle between two players.
 * Phases:
 * - 0-2s: Player cards slide in, VS badge pulses
 * - 2-3s: Challenge text fades up
 * - 3-7s: Both players typing (prompt text appears)
 * - 7-8s: Both show "Submitted" checkmarks
 * - 8-10s: "Generating..." shimmer
 * - 10-12s: Images fade in
 * - 12-14s: Scores reveal
 * - 14-15s: Winner crown, then reset
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { CheckIcon, SparklesIcon, TrophyIcon } from '@heroicons/react/24/solid';

// Demo data for the battle simulation
const demoData = {
  challenge: 'A robot cat chef cooking pizza in a futuristic kitchen',
  player1: {
    name: 'alex_dev',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    prompt: 'A sleek chrome robot cat with chef\'s hat, tossing pizza dough in a neon-lit kitchen',
    score: 8.4,
    feedback: 'Great detail on lighting and composition!',
  },
  player2: {
    name: 'maya_creates',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maya',
    prompt: 'Cyberpunk feline robot making pizza with laser precision',
    score: 7.1,
    feedback: 'Try adding more specific details about the scene.',
  },
  images: {
    player1: '/battle-robot-cat-1.png',
    player2: '/battle-robot-cat-2.png',
  },
  winReason: 'alex_dev won with stronger visual details and composition!',
};

type Phase =
  | 'players-enter'    // 0-2s
  | 'challenge'        // 2-3s
  | 'typing'           // 3-7s
  | 'submitted'        // 7-8s
  | 'generating'       // 8-10s
  | 'images'           // 10-12s
  | 'scores'           // 12-13s
  | 'feedback'         // 13-16s - show why winner won
  | 'winner';          // 16-17s

const phaseTimings: { phase: Phase; duration: number }[] = [
  { phase: 'players-enter', duration: 2000 },
  { phase: 'challenge', duration: 1000 },
  { phase: 'typing', duration: 4000 },
  { phase: 'submitted', duration: 1000 },
  { phase: 'generating', duration: 2000 },
  { phase: 'images', duration: 2000 },
  { phase: 'scores', duration: 1000 },
  { phase: 'feedback', duration: 3000 },
  { phase: 'winner', duration: 1000 },
];

interface BattleSimulationProps {
  compact?: boolean; // For mobile - smaller layout
}

export function BattleSimulation({ compact = false }: BattleSimulationProps) {
  const [currentPhase, setCurrentPhase] = useState<Phase>('players-enter');
  const [typingProgress, setTypingProgress] = useState({ player1: 0, player2: 0 });

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Phase progression
  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip to final state for reduced motion
      setCurrentPhase('winner');
      setTypingProgress({ player1: 1, player2: 1 });
      return;
    }

    let phaseIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const advancePhase = () => {
      phaseIndex = (phaseIndex + 1) % phaseTimings.length;
      setCurrentPhase(phaseTimings[phaseIndex].phase);

      // Reset typing progress when starting new loop
      if (phaseIndex === 0) {
        setTypingProgress({ player1: 0, player2: 0 });
      }

      timeoutId = setTimeout(advancePhase, phaseTimings[phaseIndex].duration);
    };

    timeoutId = setTimeout(advancePhase, phaseTimings[0].duration);

    return () => clearTimeout(timeoutId);
  }, [prefersReducedMotion]);

  // Typing animation - jagged/realistic timing
  useEffect(() => {
    if (currentPhase !== 'typing' || prefersReducedMotion) return;

    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      setTypingProgress((prev) => {
        // Random increments - sometimes fast, sometimes slow, sometimes pause
        const p1Increment = Math.random() < 0.15 ? 0 : (Math.random() * 0.08 + 0.02); // 15% chance to pause
        const p2Increment = Math.random() < 0.2 ? 0 : (Math.random() * 0.06 + 0.01); // 20% chance to pause, slower overall

        return {
          player1: Math.min(prev.player1 + p1Increment, 1),
          player2: Math.min(prev.player2 + p2Increment, 1),
        };
      });

      // Random interval between ticks (80-200ms)
      const nextDelay = Math.random() * 120 + 80;
      timeoutId = setTimeout(tick, nextDelay);
    };

    // Player 2 starts slightly later
    const startDelay = setTimeout(() => {
      tick();
    }, 300);

    return () => {
      clearTimeout(startDelay);
      clearTimeout(timeoutId);
    };
  }, [currentPhase, prefersReducedMotion]);

  const phaseIndex = phaseTimings.findIndex((p) => p.phase === currentPhase);
  const showChallenge = phaseIndex >= 1;
  const showTyping = phaseIndex >= 2;
  const showSubmitted = phaseIndex >= 3;
  const showGenerating = phaseIndex >= 4;
  const showImages = phaseIndex >= 5;
  const showScores = phaseIndex >= 6;
  const showFeedback = phaseIndex >= 7;
  const showWinner = phaseIndex >= 8;

  if (compact) {
    return <CompactBattleSimulation currentPhase={currentPhase} />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-pink-500/10 blur-2xl" />

      {/* Main battle card */}
      <div className="relative w-full max-w-[400px] max-h-full bg-slate-900/80 backdrop-blur-xl rounded border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-center gap-2">
          <SparklesIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
            Image Prompt Battle
          </span>
        </div>

        {/* Players row */}
        <div className="px-3 py-3 flex items-center justify-between">
          {/* Player 1 */}
          <AnimatePresence>
            {phaseIndex >= 0 && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="flex items-center gap-2"
              >
                <img
                  src={demoData.player1.avatar}
                  alt={demoData.player1.name}
                  className="w-8 h-8 rounded-full bg-slate-700"
                />
                <div className="text-left">
                  <div className="text-sm font-medium text-white flex items-center gap-1">
                    {demoData.player1.name}
                    {showScores && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <TrophyIcon className="w-4 h-4 text-yellow-500" />
                      </motion.div>
                    )}
                  </div>
                  {showScores && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className="text-lg font-bold text-emerald-400"
                    >
                      {demoData.player1.score}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VS Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="relative"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.3)]">
              {/* Animated ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-cyan-400/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
                VS
              </span>
            </div>
          </motion.div>

          {/* Player 2 */}
          <AnimatePresence>
            {phaseIndex >= 0 && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="flex items-center gap-2"
              >
                <div className="text-right">
                  <div className="text-sm font-medium text-white">{demoData.player2.name}</div>
                  {showScores && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      className="text-lg font-bold text-slate-400"
                    >
                      {demoData.player2.score}
                    </motion.div>
                  )}
                </div>
                <img
                  src={demoData.player2.avatar}
                  alt={demoData.player2.name}
                  className="w-8 h-8 rounded-full bg-slate-700"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Challenge */}
        <AnimatePresence>
          {showChallenge && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-3 pb-2"
            >
              <div className="text-[10px] text-slate-400 mb-0.5">Challenge:</div>
              <div className="text-xs text-white font-medium leading-snug">
                {demoData.challenge}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing / Submitted / Generating states */}
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Player 1 prompt area */}
            <div className="bg-slate-800/50 rounded p-2 min-h-[60px]">
              {showTyping && !showSubmitted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-slate-300 leading-relaxed"
                >
                  {demoData.player1.prompt.slice(
                    0,
                    Math.floor(demoData.player1.prompt.length * typingProgress.player1)
                  )}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-cyan-400"
                  >
                    |
                  </motion.span>
                </motion.div>
              )}
              {showSubmitted && !showImages && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center justify-center h-full gap-1"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-emerald-400">Submitted</span>
                </motion.div>
              )}
              {showGenerating && !showImages && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full gap-1"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
                  />
                  <span className="text-xs text-cyan-400">Generating...</span>
                </motion.div>
              )}
              {showImages && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative"
                >
                  {/* Gold gradient glow behind winner */}
                  {showScores && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute -inset-1 rounded-lg bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 blur-sm"
                    />
                  )}
                  <div className={`relative rounded overflow-hidden ${showScores ? 'ring-2 ring-yellow-400' : ''}`}>
                    <img
                      src={demoData.images.player1}
                      alt="Generated image"
                      className="w-full h-auto relative z-10"
                    />
                    {/* Gold shimmer overlay */}
                    {showScores && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-gradient-to-tr from-yellow-500/20 via-transparent to-amber-500/20 z-20"
                      />
                    )}
                  </div>
                </motion.div>
              )}
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[10px] text-emerald-400 leading-tight"
                >
                  {demoData.player1.feedback}
                </motion.div>
              )}
            </div>

            {/* Player 2 prompt area */}
            <div className="bg-slate-800/50 rounded p-2 min-h-[60px]">
              {showTyping && !showSubmitted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-slate-300 leading-relaxed"
                >
                  {demoData.player2.prompt.slice(
                    0,
                    Math.floor(demoData.player2.prompt.length * typingProgress.player2)
                  )}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-pink-400"
                  >
                    |
                  </motion.span>
                </motion.div>
              )}
              {showSubmitted && !showImages && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center justify-center h-full gap-1"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-emerald-400">Submitted</span>
                </motion.div>
              )}
              {showGenerating && !showImages && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center justify-center h-full gap-1"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-pink-400/30 border-t-pink-400 rounded-full"
                  />
                  <span className="text-xs text-pink-400">Generating...</span>
                </motion.div>
              )}
              {showImages && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="relative rounded overflow-hidden"
                >
                  <img
                    src={demoData.images.player2}
                    alt="Generated image"
                    className="w-full h-auto"
                  />
                </motion.div>
              )}
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 text-[10px] text-slate-400 leading-tight"
                >
                  {demoData.player2.feedback}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Winner reason banner */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-3 pb-3"
            >
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1.5 text-center">
                <span className="text-[10px] text-yellow-400">{demoData.winReason}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Compact version for mobile (currently unused - mobile uses full version)
function CompactBattleSimulation({ currentPhase }: { currentPhase: Phase }) {
  const phaseIndex = phaseTimings.findIndex((p) => p.phase === currentPhase);
  const showImages = phaseIndex >= 5;
  const showScores = phaseIndex >= 6;
  const _showFeedback = phaseIndex >= 7;
  const _showWinner = phaseIndex >= 8;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="absolute inset-0 rounded bg-gradient-to-br from-cyan-500/10 to-pink-500/10 blur-xl" />

      <div className="relative w-full bg-slate-900/80 backdrop-blur-xl rounded border border-white/10 p-3">
        {/* Compact header */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <SparklesIcon className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">
            Image Prompt Battle
          </span>
        </div>

        {/* Player avatars with VS */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <img
              src={demoData.player1.avatar}
              alt={demoData.player1.name}
              className="w-8 h-8 rounded-full bg-slate-700"
            />
            {showWinner && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center"
              >
                <TrophyIcon className="w-2.5 h-2.5 text-yellow-900" />
              </motion.div>
            )}
          </motion.div>

          <div className="w-6 h-6 rounded-full bg-slate-800 border border-cyan-500/50 flex items-center justify-center">
            <span className="text-[8px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
              VS
            </span>
          </div>

          <motion.img
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            src={demoData.player2.avatar}
            alt={demoData.player2.name}
            className="w-8 h-8 rounded-full bg-slate-700"
          />
        </div>

        {/* Images side by side (when visible) */}
        {showImages && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={demoData.images.player1}
              alt="Player 1"
              className="w-full h-auto rounded"
            />
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={demoData.images.player2}
              alt="Player 2"
              className="w-full h-auto rounded"
            />
          </div>
        )}

        {/* Scores */}
        {showScores && (
          <div className="flex justify-between px-4">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-sm font-bold text-emerald-400"
            >
              {demoData.player1.score}
            </motion.span>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-sm font-bold text-slate-400"
            >
              {demoData.player2.score}
            </motion.span>
          </div>
        )}

        {/* Status indicator when not showing images */}
        {!showImages && (
          <div className="text-center">
            <motion.div
              key={currentPhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-slate-400"
            >
              {currentPhase === 'players-enter' && 'Players joining...'}
              {currentPhase === 'challenge' && 'Challenge revealed!'}
              {currentPhase === 'typing' && 'Writing prompts...'}
              {currentPhase === 'submitted' && 'Submitted!'}
              {currentPhase === 'generating' && 'Generating images...'}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BattleSimulation;
