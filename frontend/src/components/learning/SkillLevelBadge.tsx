/**
 * Skill Level Badge Component
 *
 * Displays the user's skill level with appropriate styling.
 */
import type { LearningPathSkillLevel } from '@/types/models';

interface SkillLevelBadgeProps {
  level: LearningPathSkillLevel;
  levelDisplay?: string;
  size?: 'sm' | 'md' | 'lg';
}

const levelStyles: Record<LearningPathSkillLevel, { bg: string; text: string; border: string }> = {
  beginner: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  intermediate: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  advanced: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  expert: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function SkillLevelBadge({ level, levelDisplay, size = 'md' }: SkillLevelBadgeProps) {
  const styles = levelStyles[level];
  const displayText = levelDisplay || level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${styles.bg} ${styles.text} ${styles.border} ${sizeStyles[size]}`}
    >
      {displayText}
    </span>
  );
}
