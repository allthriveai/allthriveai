/**
 * Achievement Modal Component
 *
 * Full-screen modal showing detailed achievement information
 * Features:
 * - Rarity-based styling
 * - Progress tracking
 * - Unlock requirements
 * - Related achievements
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as Icons from '@heroicons/react/24/solid';
import { getCategoryColors } from '@/utils/categoryColors';
import { format } from 'date-fns';

const CATEGORY_COLORS = {
  projects: 'jade',
  battles: 'ruby',
  community: 'rose-quartz',
  engagement: 'sapphire',
  streaks: 'topaz',
} as const;

const RARITY_STYLES = {
  common: {
    glow: 'shadow-[0_0_20px_rgba(148,163,184,0.4)]',
    text: 'text-slate-300',
    border: 'border-slate-400/30',
  },
  rare: {
    glow: 'shadow-[0_0_25px_rgba(59,130,246,0.5)]',
    text: 'text-blue-300',
    border: 'border-blue-400/40',
  },
  epic: {
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]',
    text: 'text-purple-300',
    border: 'border-purple-400/50',
  },
  legendary: {
    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.7)]',
    text: 'text-amber-300',
    border: 'border-amber-400/60',
  },
} as const;

const CATEGORY_LABELS = {
  projects: 'Projects',
  battles: 'Battles',
  community: 'Community',
  engagement: 'Engagement',
  streaks: 'Streaks',
} as const;

export interface AchievementModalProps {
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
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementModal({
  achievement,
  userAchievement,
  isOpen,
  onClose,
}: AchievementModalProps) {
  const isUnlocked = !!userAchievement?.earnedAt;
  const progress = userAchievement?.progress || 0;
  const total = userAchievement?.total || 100;
  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  const categoryColor = CATEGORY_COLORS[achievement.category];
  const colors = getCategoryColors(categoryColor);
  const rarityStyle = RARITY_STYLES[achievement.rarity];

  const IconComponent = (Icons as any)[achievement.icon] || Icons.TrophyIcon;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`
                  w-full max-w-2xl transform overflow-hidden rounded
                  text-left align-middle shadow-2xl transition-all
                  ${isUnlocked ? rarityStyle.glow : ''}
                `}
                style={{
                  background: 'var(--glass-fill)',
                  border: `2px solid ${isUnlocked ? 'var(--glass-border)' : 'var(--glass-border-subtle)'}`,
                }}
              >
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded hover:bg-[var(--glass-fill-strong)] transition-all"
                >
                  <XMarkIcon className="w-6 h-6 text-[var(--text-secondary)]" />
                </button>

                {/* Header with icon */}
                <div className="relative pt-12 pb-8 px-8">
                  {/* Background gradient */}
                  {isUnlocked && (
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                      }}
                    />
                  )}

                  {/* Legendary particles */}
                  {isUnlocked && achievement.rarity === 'legendary' && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"
                          style={{
                            top: `${10 + (i % 4) * 25}%`,
                            left: `${5 + Math.floor(i / 4) * 80 + (i % 3) * 5}%`,
                            animationDelay: `${i * 0.3}s`,
                            animationDuration: '2s',
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col items-center space-y-4">
                    {/* Icon */}
                    <div
                      className={`
                        relative flex items-center justify-center
                        w-32 h-32 rounded-full
                        ${isUnlocked ? '' : 'opacity-30 grayscale'}
                      `}
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${colors.from}20, ${colors.to}20)`
                          : 'var(--glass-fill-subtle)',
                      }}
                    >
                      <IconComponent
                        className="w-20 h-20"
                        style={{
                          color: isUnlocked ? colors.from : 'var(--text-muted)',
                          filter: isUnlocked ? 'drop-shadow(0 0 12px currentColor)' : 'none',
                        }}
                      />

                      {/* Locked overlay */}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icons.LockClosedIcon className="w-8 h-8 text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="text-center space-y-2">
                      <Dialog.Title
                        as="h3"
                        className={`
                          text-3xl font-bold
                          ${isUnlocked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
                        `}
                      >
                        {isUnlocked || !achievement.isSecret ? achievement.name : '???'}
                      </Dialog.Title>

                      {/* Rarity badge */}
                      <div className="flex items-center justify-center gap-3">
                        <span
                          className={`
                            px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide
                            ${rarityStyle.text}
                          `}
                          style={{
                            background: 'var(--glass-fill-strong)',
                            border: `1px solid ${isUnlocked ? rarityStyle.border : 'var(--glass-border-subtle)'}`,
                          }}
                        >
                          {achievement.rarity}
                        </span>

                        <span
                          className="px-4 py-1.5 rounded-full text-sm font-medium text-[var(--text-secondary)]"
                          style={{
                            background: 'var(--glass-fill-strong)',
                            border: '1px solid var(--glass-border)',
                          }}
                        >
                          {CATEGORY_LABELS[achievement.category]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-8 pb-8 space-y-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                      Description
                    </h4>
                    <p className="text-[var(--text-primary)] leading-relaxed">
                      {isUnlocked || !achievement.isSecret
                        ? achievement.description
                        : 'This is a secret achievement. Complete certain actions to unlock it!'}
                    </p>
                  </div>

                  {/* Progress section */}
                  {!isUnlocked && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                          Progress
                        </h4>
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                          {progress} / {total}
                        </span>
                      </div>

                      <div className="h-3 bg-[var(--glass-fill-subtle)] rounded overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded"
                          style={{
                            width: `${progressPercent}%`,
                            background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                          }}
                        />
                      </div>

                      <p className="text-xs text-[var(--text-muted)]">
                        {progressPercent > 0
                          ? `${Math.round(progressPercent)}% complete`
                          : 'Start working toward this achievement!'}
                      </p>
                    </div>
                  )}

                  {/* Earned info */}
                  {isUnlocked && userAchievement?.earnedAt && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                        Unlocked
                      </h4>
                      <p className="text-[var(--text-primary)]">
                        {format(new Date(userAchievement.earnedAt), 'MMMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  )}

                  {/* Rewards section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                      Rewards
                    </h4>
                    <div className="flex items-center gap-2">
                      <div
                        className="px-4 py-2 rounded font-semibold text-lg"
                        style={{
                          background: `linear-gradient(135deg, ${colors.from}20, ${colors.to}20)`,
                          border: `1px solid ${colors.from}40`,
                          color: colors.from,
                        }}
                      >
                        +{achievement.points} XP
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <div className="pt-4">
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-3 rounded font-semibold text-white transition-all"
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${colors.from}, ${colors.to})`
                          : 'var(--glass-fill-strong)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
