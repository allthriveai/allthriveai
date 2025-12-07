/**
 * Achievement Unlock Toast
 *
 * Beautiful animated toast notification for achievement unlocks
 * Features:
 * - Slide-in animation with spring physics
 * - Confetti/sparkle particle effects
 * - Rarity-based styling and glow
 * - Sound effect support (optional)
 * - Auto-dismiss with progress indicator
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrophy,
  faFire,
  faRocket,
  faStar,
  faHeart,
  faBolt,
  faGem,
  faAward,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Achievement } from '@/types/achievements';

const ICON_MAP: Record<string, IconDefinition> = {
  faRocket: faRocket,
  faFire: faFire,
  faTrophy: faTrophy,
  faStar: faStar,
  faHeart: faHeart,
  faBolt: faBolt,
  faGem: faGem,
  faAward: faAward,
};

const RARITY_CONFIG = {
  common: {
    gradient: 'from-slate-500 to-slate-600',
    glow: 'shadow-[0_0_30px_rgba(148,163,184,0.5)]',
    text: 'text-slate-300',
    particle: '#94a3b8',
  },
  rare: {
    gradient: 'from-blue-500 to-blue-600',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.6)]',
    text: 'text-blue-300',
    particle: '#3b82f6',
  },
  epic: {
    gradient: 'from-purple-500 to-purple-600',
    glow: 'shadow-[0_0_50px_rgba(168,85,247,0.7)]',
    text: 'text-purple-300',
    particle: '#a855f7',
  },
  legendary: {
    gradient: 'from-amber-400 to-amber-600',
    glow: 'shadow-[0_0_60px_rgba(251,191,36,0.8)]',
    text: 'text-amber-300',
    particle: '#fbbf24',
  },
} as const;

// Sparkle particle component
function Sparkle({ color, delay, x, y }: { color: string; delay: number; x: number; y: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1, 0],
        x: x,
        y: y,
      }}
      transition={{
        duration: 1,
        delay: delay,
        ease: 'easeOut',
      }}
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: color, left: '50%', top: '50%' }}
    />
  );
}

interface AchievementUnlockToastProps {
  achievement: Achievement;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function AchievementUnlockToast({
  achievement,
  isVisible,
  onClose,
  duration = 5000,
}: AchievementUnlockToastProps) {
  const [progress, setProgress] = useState(100);
  const rarity = achievement.rarity as keyof typeof RARITY_CONFIG;
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const icon = ICON_MAP[achievement.icon] || faTrophy;

  // Auto-dismiss timer with progress
  useEffect(() => {
    if (!isVisible) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, duration, onClose]);

  // Reset progress when toast appears
  useEffect(() => {
    if (isVisible) {
      setProgress(100);
    }
  }, [isVisible]);

  // Generate random sparkle positions
  const sparkles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 150,
    delay: Math.random() * 0.5,
  }));

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div
            className={`
              relative overflow-hidden
              bg-gradient-to-br ${config.gradient}
              ${config.glow}
              rounded-2xl p-1
            `}
          >
            {/* Inner content */}
            <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-xl p-4 min-w-[320px]">
              {/* Sparkle effects */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {sparkles.map((sparkle) => (
                  <Sparkle
                    key={sparkle.id}
                    color={config.particle}
                    delay={sparkle.delay}
                    x={sparkle.x}
                    y={sparkle.y}
                  />
                ))}
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} className="w-3 h-3 text-gray-400" />
              </button>

              {/* Content */}
              <div className="flex items-center gap-4 relative z-10">
                {/* Icon with glow */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 15,
                    delay: 0.2,
                  }}
                  className={`
                    relative w-16 h-16 rounded-xl
                    bg-gradient-to-br ${config.gradient}
                    flex items-center justify-center
                    ${config.glow}
                  `}
                >
                  <FontAwesomeIcon
                    icon={icon}
                    className="text-white text-2xl drop-shadow-lg"
                  />

                  {/* Rotating ring for legendary */}
                  {rarity === 'legendary' && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="absolute inset-0 rounded-xl border-2 border-amber-400/30 border-t-amber-400"
                    />
                  )}
                </motion.div>

                {/* Text */}
                <div className="flex-1 pr-6">
                  <motion.p
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1"
                  >
                    Achievement Unlocked!
                  </motion.p>
                  <motion.h3
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg font-bold text-white mb-1"
                  >
                    {achievement.name}
                  </motion.h3>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-2"
                  >
                    <span className={`text-sm font-medium ${config.text} uppercase`}>
                      {achievement.rarity}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-sm font-semibold text-teal-400">
                      +{achievement.points} XP
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden"
              >
                <motion.div
                  className={`h-full bg-gradient-to-r ${config.gradient}`}
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.05 }}
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage achievement toast notifications
 */
interface ToastAchievement extends Achievement {
  id: number;
}

export function useAchievementToast() {
  const [queue, setQueue] = useState<ToastAchievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<ToastAchievement | null>(null);

  const showAchievement = useCallback((achievement: ToastAchievement) => {
    setQueue((prev) => [...prev, achievement]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setCurrentAchievement(null);
  }, []);

  // Process queue
  useEffect(() => {
    if (!currentAchievement && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentAchievement(next);
      setQueue(rest);
    }
  }, [currentAchievement, queue]);

  return {
    currentAchievement,
    showAchievement,
    dismissCurrent,
    hasQueue: queue.length > 0,
  };
}

/**
 * Provider component for global achievement toasts
 */
interface AchievementToastProviderProps {
  children: React.ReactNode;
}

export function AchievementToastProvider({ children }: AchievementToastProviderProps) {
  const { currentAchievement, dismissCurrent } = useAchievementToast();

  return (
    <>
      {children}
      {currentAchievement && (
        <AchievementUnlockToast
          achievement={currentAchievement}
          isVisible={!!currentAchievement}
          onClose={dismissCurrent}
        />
      )}
    </>
  );
}
