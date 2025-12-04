/**
 * Achievement Badge Component
 *
 * Video game-style achievement badge with neon glass design
 * Features:
 * - Category-based jewel colors
 * - Rarity levels (common, rare, epic, legendary)
 * - Locked/unlocked states
 * - Progress tracking
 * - Glow effects and animations
 */

import { useState } from 'react';
import { getCategoryColors } from '@/utils/categoryColors';
import * as Icons from '@heroicons/react/24/solid';

// Achievement category to jewel color mapping
const CATEGORY_COLORS = {
  projects: 'jade',      // Developer & Coding
  battles: 'ruby',       // Games & Interactive
  community: 'rose-quartz', // Chatbots & Conversation
  engagement: 'sapphire',   // Audio & Multimodal
  streaks: 'topaz',      // Images & Video
} as const;

// Rarity configurations
const RARITY_STYLES = {
  common: {
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.3)]',
    border: 'border-slate-400/30',
    text: 'text-slate-300',
    particles: 1,
  },
  rare: {
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
    border: 'border-blue-400/40',
    text: 'text-blue-300',
    particles: 2,
  },
  epic: {
    glow: 'shadow-[0_0_25px_rgba(168,85,247,0.5)]',
    border: 'border-purple-400/50',
    text: 'text-purple-300',
    particles: 3,
  },
  legendary: {
    glow: 'shadow-[0_0_30px_rgba(251,191,36,0.6)]',
    border: 'border-amber-400/60',
    text: 'text-amber-300',
    particles: 4,
  },
} as const;

export interface AchievementBadgeProps {
  achievement: {
    id: number;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: keyof typeof CATEGORY_COLORS;
    rarity: keyof typeof RARITY_STYLES;
    points: number;
    isSecret: boolean;
  };
  userAchievement?: {
    id: number;
    earnedAt: string;
    progress: number;
    total: number;
  };
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export function AchievementBadge({
  achievement,
  userAchievement,
  size = 'medium',
  onClick
}: AchievementBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isUnlocked = !!userAchievement?.earnedAt;
  const progress = userAchievement?.progress || 0;
  const total = userAchievement?.total || 100;
  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  // Get jewel colors for this achievement category
  const categoryColor = CATEGORY_COLORS[achievement.category];
  const colors = getCategoryColors(categoryColor);

  // Get rarity styling
  const rarityStyle = RARITY_STYLES[achievement.rarity];

  // Size configurations
  const sizeClasses = {
    small: {
      container: 'w-24 h-32',
      icon: 'w-8 h-8',
      name: 'text-xs',
      points: 'text-[10px]',
    },
    medium: {
      container: 'w-32 h-44',
      icon: 'w-12 h-12',
      name: 'text-sm',
      points: 'text-xs',
    },
    large: {
      container: 'w-40 h-52',
      icon: 'w-16 h-16',
      name: 'text-base',
      points: 'text-sm',
    },
  }[size];

  // Icon mapping (default to trophy if not found)
  const IconComponent = (Icons as any)[achievement.icon] || Icons.TrophyIcon;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative ${sizeClasses.container} rounded
        transition-all duration-300 ease-out
        ${isUnlocked ? 'cursor-pointer hover:scale-110 active:scale-105' : 'cursor-default'}
        ${isUnlocked ? rarityStyle.glow : ''}
        group
      `}
      style={{
        background: isUnlocked
          ? 'var(--glass-fill)'
          : 'var(--glass-fill-subtle)',
        border: `2px solid ${isUnlocked ? 'var(--glass-border)' : 'var(--glass-border-subtle)'}`,
      }}
    >
      {/* Gradient background based on category */}
      {isUnlocked && (
        <div
          className="absolute inset-0 rounded opacity-10"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
          }}
        />
      )}

      {/* Rarity glow effect */}
      {isUnlocked && (
        <div
          className={`absolute inset-0 rounded blur-xl opacity-20 ${rarityStyle.border}`}
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-between p-3">
        {/* Icon container with jewel color */}
        <div
          className={`
            relative flex items-center justify-center rounded-full
            ${sizeClasses.icon} p-2 mt-1
            ${isUnlocked ? '' : 'opacity-30 grayscale'}
            transition-all duration-300
          `}
          style={{
            background: isUnlocked
              ? `linear-gradient(135deg, ${colors.from}20, ${colors.to}20)`
              : 'var(--glass-fill-subtle)',
          }}
        >
          <IconComponent
            className={`${sizeClasses.icon} transition-all duration-300`}
            style={{
              color: isUnlocked ? colors.from : 'var(--text-muted)',
              filter: isUnlocked && isHovered ? 'drop-shadow(0 0 8px currentColor)' : 'none',
            }}
          />

          {/* Locked overlay */}
          {!isUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icons.LockClosedIcon className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          )}
        </div>

        {/* Achievement name */}
        <div className="text-center space-y-0.5 flex-1 flex flex-col justify-center px-1">
          <h3
            className={`
              ${sizeClasses.name} font-semibold line-clamp-3
              ${isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
            `}
          >
            {isUnlocked || !achievement.isSecret ? achievement.name : '???'}
          </h3>

          {/* Rarity indicator */}
          {isUnlocked && (
            <span className={`${sizeClasses.points} ${rarityStyle.text} uppercase tracking-wide`}>
              {achievement.rarity}
            </span>
          )}
        </div>

        {/* Progress bar for incomplete achievements */}
        {!isUnlocked && progressPercent > 0 && (
          <div className="w-full space-y-1 mb-1">
            <div className="h-1.5 bg-[var(--glass-fill-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              {progress}/{total}
            </p>
          </div>
        )}

        {/* Points badge */}
        {isUnlocked && (
          <div
            className={`
              ${sizeClasses.points} px-2 py-0.5 rounded-full font-medium
              bg-[var(--glass-fill-strong)] text-[var(--text-secondary)] mb-1
            `}
          >
            +{achievement.points} XP
          </div>
        )}
      </div>

      {/* Shine effect on hover */}
      {isUnlocked && isHovered && (
        <div className="absolute inset-0 rounded overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
          />
        </div>
      )}

      {/* Sparkle animations on hover */}
      {isUnlocked && isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[
            { top: '15%', left: '15%', delay: '0s', size: 'w-3 h-3' },
            { top: '20%', right: '15%', delay: '0.2s', size: 'w-2.5 h-2.5' },
            { bottom: '25%', left: '20%', delay: '0.4s', size: 'w-3 h-3' },
            { bottom: '20%', right: '20%', delay: '0.6s', size: 'w-2.5 h-2.5' },
          ].map((sparkle, i) => (
            <Icons.SparklesIcon
              key={i}
              className={`absolute ${sparkle.size} animate-ping`}
              style={{
                top: sparkle.top,
                left: sparkle.left,
                right: sparkle.right,
                bottom: sparkle.bottom,
                animationDelay: sparkle.delay,
                animationDuration: '1.5s',
                color: colors.from,
                filter: 'drop-shadow(0 0 4px currentColor)',
              }}
            />
          ))}
        </div>
      )}

      {/* Legendary particle effects */}
      {isUnlocked && achievement.rarity === 'legendary' && isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full animate-ping"
              style={{
                top: `${20 + i * 20}%`,
                left: `${10 + i * 20}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.5s',
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
