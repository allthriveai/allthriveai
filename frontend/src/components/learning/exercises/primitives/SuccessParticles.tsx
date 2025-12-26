/**
 * SuccessParticles - Celebration effects using react-rewards
 * Provides confetti, emoji bursts, and glow effects for exercise completion
 */

import { useReward } from 'react-rewards';
import { useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type CelebrationType = 'confetti' | 'emoji' | 'balloons';

interface UseSuccessParticlesOptions {
  /** Type of celebration effect */
  type?: CelebrationType;
  /** Custom colors for confetti (defaults to neon theme) */
  colors?: string[];
  /** Number of particles */
  elementCount?: number;
  /** Spread angle */
  spread?: number;
  /** Starting velocity */
  startVelocity?: number;
  /** Particle lifetime in frames */
  lifetime?: number;
}

/** Default neon-themed colors */
const defaultColors = [
  '#4ade80', // green-400
  '#22d3ee', // cyan-400
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
  '#34d399', // emerald-400
];

/** Preset configurations for different celebration levels */
export const celebrationPresets = {
  /** Small celebration for individual correct actions */
  micro: {
    elementCount: 15,
    spread: 40,
    startVelocity: 20,
    lifetime: 100,
  },
  /** Medium celebration for completing steps */
  medium: {
    elementCount: 40,
    spread: 60,
    startVelocity: 25,
    lifetime: 150,
  },
  /** Full celebration for exercise completion */
  full: {
    elementCount: 80,
    spread: 70,
    startVelocity: 30,
    lifetime: 200,
  },
  /** Perfect completion celebration */
  perfect: {
    elementCount: 120,
    spread: 90,
    startVelocity: 35,
    lifetime: 250,
  },
};

/**
 * Hook for triggering celebration effects
 */
export function useSuccessParticles(options: UseSuccessParticlesOptions = {}) {
  const {
    type = 'confetti',
    colors = defaultColors,
    elementCount = celebrationPresets.full.elementCount,
    spread = celebrationPresets.full.spread,
    startVelocity = celebrationPresets.full.startVelocity,
    lifetime = celebrationPresets.full.lifetime,
  } = options;

  const uniqueId = useId();
  const anchorId = `success-particles-${uniqueId.replace(/:/g, '')}`;

  const { reward, isAnimating } = useReward(anchorId, type, {
    colors,
    elementCount,
    spread,
    startVelocity,
    lifetime,
  });

  const celebrate = useCallback(() => {
    if (!isAnimating) {
      reward();
    }
  }, [reward, isAnimating]);

  return {
    /** Trigger the celebration effect */
    celebrate,
    /** Whether animation is currently playing */
    isAnimating,
    /** The anchor element ID (must be rendered in the DOM) */
    anchorId,
    /** Anchor element to render where particles should originate */
    Anchor: () => (
      <span
        id={anchorId}
        className="absolute pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    ),
  };
}

/**
 * SuccessGlow - Animated glow effect for success states
 */
interface SuccessGlowProps {
  /** Whether the glow is visible */
  isVisible: boolean;
  /** Glow color (defaults to green) */
  color?: 'green' | 'cyan' | 'pink' | 'amber';
  /** Size of the glow effect */
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

const glowColorMap = {
  green: 'rgba(74, 222, 128, 0.6)',
  cyan: 'rgba(34, 211, 238, 0.6)',
  pink: 'rgba(251, 55, 255, 0.6)',
  amber: 'rgba(251, 191, 36, 0.6)',
};

const glowSizeMap = {
  sm: '15px',
  md: '25px',
  lg: '40px',
};

export function SuccessGlow({
  isVisible,
  color = 'green',
  size = 'md',
  children,
}: SuccessGlowProps) {
  const glowColor = glowColorMap[color];
  const glowSize = glowSizeMap[size];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            boxShadow: [
              `0 0 0 ${glowColor.replace('0.6', '0')}`,
              `0 0 ${glowSize} ${glowColor}`,
              `0 0 0 ${glowColor.replace('0.6', '0')}`,
            ],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.6,
            boxShadow: {
              duration: 0.6,
              repeat: 0,
            },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * FloatingParticles - Ambient floating particles for background decoration
 */
interface FloatingParticlesProps {
  /** Number of particles */
  count?: number;
  /** Colors for particles */
  colors?: string[];
  /** Whether particles are visible */
  isVisible?: boolean;
}

export function FloatingParticles({
  count = 6,
  colors = ['rgba(74, 222, 128, 0.6)', 'rgba(34, 211, 238, 0.6)'],
  isVisible = true,
}: FloatingParticlesProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: colors[i % colors.length],
            left: `${15 + (i * 15) % 70}%`,
            top: `${5 + (i % 3) * 8}%`,
          }}
          animate={{
            y: [-10, 10, -10],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 3,
            delay: i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * CheckmarkAnimation - Animated checkmark for success states
 */
interface CheckmarkAnimationProps {
  /** Whether the checkmark is visible */
  isVisible: boolean;
  /** Size of the checkmark */
  size?: 'sm' | 'md' | 'lg';
  /** Color of the checkmark */
  color?: string;
}

const checkmarkSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function CheckmarkAnimation({
  isVisible,
  size = 'md',
  color = '#4ade80',
}: CheckmarkAnimationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.svg
          className={checkmarkSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 15,
          }}
        >
          <motion.circle
            cx="12"
            cy="12"
            r="10"
            stroke={color}
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.path
            d="M8 12l2.5 2.5L16 9"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

export default SuccessGlow;
