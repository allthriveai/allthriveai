/**
 * Mini Achievement Badge for Profile Sidebar
 *
 * Compact achievement display with Framer Motion animations
 * Features:
 * - Rarity-based glow effects
 * - Staggered entrance animations
 * - Hover tooltip with achievement name
 * - Shimmer effect on hover
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  faMedal,
  faCrown,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { AchievementProgressItem } from '@/types/achievements';

// Map achievement icon strings to FontAwesome icons
const ICON_MAP: Record<string, IconDefinition> = {
  faRocket: faRocket,
  faFire: faFire,
  faTrophy: faTrophy,
  faStar: faStar,
  faHeart: faHeart,
  faBolt: faBolt,
  faGem: faGem,
  faAward: faAward,
  faMedal: faMedal,
  faCrown: faCrown,
};

// Rarity-based styling
const RARITY_CONFIG = {
  common: {
    glow: 'shadow-[0_0_8px_rgba(148,163,184,0.4)]',
    gradient: 'from-slate-400 to-slate-500',
    ring: 'ring-slate-400/30',
    shimmer: 'rgba(148,163,184,0.3)',
  },
  rare: {
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    gradient: 'from-blue-400 to-blue-600',
    ring: 'ring-blue-400/40',
    shimmer: 'rgba(59,130,246,0.4)',
  },
  epic: {
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    gradient: 'from-purple-400 to-purple-600',
    ring: 'ring-purple-400/50',
    shimmer: 'rgba(168,85,247,0.4)',
  },
  legendary: {
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.7)]',
    gradient: 'from-amber-400 to-amber-600',
    ring: 'ring-amber-400/60',
    shimmer: 'rgba(251,191,36,0.5)',
  },
} as const;

interface ProfileAchievementMiniProps {
  achievement: AchievementProgressItem;
  index?: number;
  onClick?: () => void;
}

export function ProfileAchievementMini({
  achievement,
  index = 0,
  onClick
}: ProfileAchievementMiniProps) {
  const [isHovered, setIsHovered] = useState(false);

  const rarity = achievement.rarity as keyof typeof RARITY_CONFIG;
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const icon = ICON_MAP[achievement.icon] || faTrophy;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        type: 'spring',
        stiffness: 300,
        damping: 20
      }}
      whileHover={{
        scale: 1.15,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative w-10 h-10 rounded-lg
        bg-gradient-to-br ${config.gradient}
        ${config.glow}
        ring-1 ${config.ring}
        flex items-center justify-center
        cursor-pointer
        overflow-hidden
        group
      `}
      aria-label={achievement.name}
    >
      {/* Icon */}
      <FontAwesomeIcon
        icon={icon}
        className="text-white text-sm z-10 drop-shadow-sm"
      />

      {/* Shimmer effect on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: isHovered ? '100%' : '-100%' }}
        transition={{ duration: 0.5 }}
      />

      {/* Sparkle for legendary */}
      {rarity === 'legendary' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />
          <div className="absolute bottom-1 left-0.5 w-0.5 h-0.5 bg-white rounded-full" />
        </motion.div>
      )}

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 5, scale: 0.9 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? 0 : 5,
          scale: isHovered ? 1 : 0.9
        }}
        transition={{ duration: 0.15 }}
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 pointer-events-none"
      >
        <div className="px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg">
          {achievement.name}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45" />
        </div>
      </motion.div>
    </motion.button>
  );
}

/**
 * Container component for staggered animation of multiple badges
 */
interface ProfileAchievementGridProps {
  achievements: AchievementProgressItem[];
  onAchievementClick?: (achievement: AchievementProgressItem) => void;
  maxDisplay?: number;
}

export function ProfileAchievementGrid({
  achievements,
  onAchievementClick,
  maxDisplay = 6
}: ProfileAchievementGridProps) {
  const displayedAchievements = achievements.slice(0, maxDisplay);
  const remainingCount = achievements.length - maxDisplay;

  return (
    <motion.div
      className="grid grid-cols-3 gap-2"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08 }
        }
      }}
    >
      {displayedAchievements.map((achievement, index) => (
        <ProfileAchievementMini
          key={achievement.id}
          achievement={achievement}
          index={index}
          onClick={() => onAchievementClick?.(achievement)}
        />
      ))}

      {/* Show +N more indicator */}
      {remainingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: displayedAchievements.length * 0.08 }}
          className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          +{remainingCount}
        </motion.div>
      )}
    </motion.div>
  );
}
