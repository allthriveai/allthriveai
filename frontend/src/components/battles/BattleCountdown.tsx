/**
 * BattleCountdown Component
 *
 * Epic countdown animation before battle starts.
 * Features dramatic neon glow effects and scale transitions.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BattleCountdownProps {
  value: number | null;
  onComplete?: () => void;
}

export function BattleCountdown({ value, onComplete }: BattleCountdownProps) {
  const [displayValue, setDisplayValue] = useState<number | string | null>(value);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (value === null) {
      setDisplayValue(null);
      return;
    }

    setDisplayValue(value);

    if (value === 0) {
      // Show "GO!" briefly
      setDisplayValue('GO!');
      const timer = setTimeout(() => {
        setDisplayValue(null);
        onComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [value, onComplete]);

  if (displayValue === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="countdown-label"
      aria-describedby="countdown-status"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={displayValue}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.175, 0.885, 0.32, 1.275],
          }}
          className="relative"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 -m-16 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, rgba(34, 211, 238, 0) 70%)',
            }}
            animate={prefersReducedMotion ? {} : {
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Inner pulsing ring */}
          <motion.div
            className="absolute inset-0 -m-8 rounded-full border-4 border-cyan-400/50"
            animate={prefersReducedMotion ? {} : {
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Main number/text */}
          <div
            className={`
              relative z-10 flex items-center justify-center
              w-40 h-40 rounded-full
              bg-gradient-to-br from-slate-900/90 to-slate-800/90
              border-2 border-cyan-400/50
              shadow-[0_0_60px_rgba(34,211,238,0.5),0_0_120px_rgba(34,211,238,0.3)]
            `}
          >
            <span
              id="countdown-label"
              className={`
                font-bold text-transparent bg-clip-text
                bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400
                drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]
                ${typeof displayValue === 'number' ? 'text-8xl' : 'text-5xl'}
              `}
              role="timer"
              aria-live="assertive"
              aria-atomic="true"
            >
              <span className="sr-only">
                {typeof displayValue === 'number'
                  ? `${displayValue} seconds until battle begins`
                  : 'Battle starting now!'}
              </span>
              <span aria-hidden="true">{displayValue}</span>
            </span>
          </div>

          {/* Sparkle particles - hidden when reduced motion is preferred */}
          {!prefersReducedMotion && [...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-cyan-400"
              style={{
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 4) * 100],
                y: [0, Math.sin((i * Math.PI) / 4) * 100],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Bottom text */}
      <motion.p
        id="countdown-status"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-1/4 text-xl text-slate-400 font-medium tracking-wider"
      >
        {displayValue === 'GO!' ? 'BEGIN BATTLE!' : 'GET READY...'}
      </motion.p>
    </div>
  );
}

export default BattleCountdown;
