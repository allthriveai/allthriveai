/**
 * GeneratingPhase Component
 *
 * Shown while AI is generating images for both players.
 * Features dramatic loading animation with rotating status messages.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, CpuChipIcon } from '@heroicons/react/24/solid';
import { useState, useEffect } from 'react';

// Rotating messages shown during image generation
const GENERATING_MESSAGES = [
  'Analyzing your creative prompt...',
  'AI is interpreting your vision...',
  'Rendering pixels with imagination...',
  'Adding artistic flourishes...',
  'Blending colors and concepts...',
  'Crafting your masterpiece...',
  'Neural networks working their magic...',
  'Bringing your idea to life...',
];

// Rotating messages shown during AI judging
const JUDGING_MESSAGES = [
  'AI judges are reviewing the submissions...',
  'Analyzing creativity and originality...',
  'Evaluating visual composition...',
  'Scoring prompt relevance...',
  'Comparing artistic techniques...',
  'Calculating final scores...',
  'The judges are deliberating...',
  'Almost ready to reveal the winner...',
];

interface GeneratingPhaseProps {
  myImageGenerating: boolean;
  opponentImageGenerating: boolean;
  myImageUrl?: string;
  opponentUsername: string;
  isJudging?: boolean;
}

export function GeneratingPhase({
  myImageGenerating,
  opponentImageGenerating,
  myImageUrl,
  opponentUsername,
  isJudging = false,
}: GeneratingPhaseProps) {
  const bothGenerating = myImageGenerating && opponentImageGenerating;
  const myDone = !myImageGenerating && myImageUrl;

  // Select message array based on phase
  const messages = isJudging ? JUDGING_MESSAGES : GENERATING_MESSAGES;

  // Rotating message state
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate through messages every 3 seconds
  useEffect(() => {
    // Always rotate in judging phase, or while generating
    if (isJudging || !myDone) {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [myDone, isJudging, messages.length]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 30% 50%, rgba(34, 211, 238, 0.1) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(251, 55, 255, 0.1) 0%, transparent 50%)',
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-cyan-500/30 flex items-center justify-center">
              <CpuChipIcon className="w-10 h-10 text-cyan-400" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isJudging ? 'Judging in Progress' : 'AI is Creating Magic'}
          </h1>
          <p className="text-slate-400">
            {isJudging
              ? 'Our AI panel is carefully evaluating both submissions...'
              : 'Generating images from your creative prompts...'}
          </p>
        </motion.div>

        {/* Progress cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Your image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-medium">
                You
              </div>
              {myDone ? (
                <span className="text-emerald-400 text-sm">Complete!</span>
              ) : (
                <span className="text-slate-400 text-sm">Generating...</span>
              )}
            </div>

            <div className="aspect-square rounded-xl overflow-hidden bg-slate-800/50 relative">
              {myDone && myImageUrl ? (
                <motion.img
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={myImageUrl}
                  alt="Your creation"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {/* Animated sparkles */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <SparklesIcon className="w-16 h-16 text-cyan-400/50" />
                  </motion.div>

                  {/* Progress dots */}
                  <div className="flex gap-2 mt-4">
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
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Opponent's image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-400 text-sm font-medium">
                {opponentUsername}
              </div>
              <span className="text-slate-400 text-sm">
                {opponentImageGenerating ? 'Generating...' : 'Complete!'}
              </span>
            </div>

            <div className="aspect-square rounded-xl overflow-hidden bg-slate-800/50 relative">
              {/* Always show mystery for opponent */}
              <div className="w-full h-full flex flex-col items-center justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="text-6xl"
                >
                  🎭
                </motion.div>
                <p className="text-slate-500 text-sm mt-4">Hidden until reveal</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Status message with rotating text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          {/* Rotating status messages with smooth transitions */}
          <div className="h-8 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={isJudging ? `judging-${messageIndex}` : myDone ? 'done' : messageIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="text-slate-400 text-sm absolute inset-x-0"
              >
                {isJudging
                  ? messages[messageIndex]
                  : myDone
                  ? "Your image is ready! Waiting for opponent's image..."
                  : messages[messageIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress indicator */}
          {(isJudging || !myDone) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex justify-center gap-1.5 mt-4"
            >
              {messages.map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    i === messageIndex ? 'bg-cyan-400' : 'bg-slate-600'
                  }`}
                  animate={
                    i === messageIndex
                      ? { scale: [1, 1.3, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.5 }}
                />
              ))}
            </motion.div>
          )}

          {/* Fun fact */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-slate-500 text-xs mt-4"
          >
            Fun fact: The AI analyzes your prompt for creativity, visual impact, and relevance!
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

export default GeneratingPhase;
