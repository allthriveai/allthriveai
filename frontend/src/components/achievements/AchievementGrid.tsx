/**
 * Achievement Grid Component
 *
 * Displays achievements in a responsive grid with category filtering
 */

import { useState, useMemo } from 'react';
import { AchievementBadge, type AchievementBadgeProps } from './AchievementBadge';
import { AchievementModal } from './AchievementModal';

const CATEGORY_LABELS = {
  projects: 'Projects',
  battles: 'Battles',
  community: 'Community',
  engagement: 'Engagement',
  streaks: 'Streaks',
} as const;

export interface AchievementGridProps {
  achievements: AchievementBadgeProps['achievement'][];
  userAchievements?: Record<number, AchievementBadgeProps['userAchievement']>;
  title?: string;
  showFilters?: boolean;
}

export function AchievementGrid({
  achievements,
  userAchievements = {},
  title = 'Achievements',
  showFilters = true,
}: AchievementGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<number | null>(null);

  // Filter achievements by category
  const filteredAchievements = useMemo(() => {
    if (!selectedCategory) return achievements;
    return achievements.filter(a => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = achievements.length;
    const unlocked = achievements.filter(a => userAchievements[a.id]?.earnedAt).length;
    const totalPoints = achievements
      .filter(a => userAchievements[a.id]?.earnedAt)
      .reduce((sum, a) => sum + a.points, 0);

    return { total, unlocked, totalPoints };
  }, [achievements, userAchievements]);

  // Group achievements by category for filter
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    achievements.forEach(a => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return counts;
  }, [achievements]);

  const selectedAchievementData = selectedAchievement
    ? achievements.find(a => a.id === selectedAchievement)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">
            {stats.unlocked} / {stats.total} unlocked • {stats.totalPoints.toLocaleString()} total Points
          </p>
        </div>

        {/* Progress ring */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="var(--glass-border)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - stats.unlocked / stats.total)}`}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{
                filter: 'drop-shadow(0 0 4px var(--neon-cyan))',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {Math.round((stats.unlocked / stats.total) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Category filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`
              px-4 py-2 rounded font-medium transition-all
              ${!selectedCategory
                ? 'bg-[var(--neon-cyan)] text-white shadow-[0_0_15px_var(--neon-cyan)]'
                : 'bg-[var(--glass-fill)] text-[var(--text-secondary)] hover:bg-[var(--glass-fill-strong)]'
              }
            `}
            style={{
              border: !selectedCategory ? '1px solid var(--neon-cyan)' : '1px solid var(--glass-border)',
            }}
          >
            All ({achievements.length})
          </button>

          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;

            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`
                  px-4 py-2 rounded font-medium transition-all
                  ${selectedCategory === key
                    ? 'bg-[var(--neon-cyan)] text-white shadow-[0_0_15px_var(--neon-cyan)]'
                    : 'bg-[var(--glass-fill)] text-[var(--text-secondary)] hover:bg-[var(--glass-fill-strong)]'
                  }
                `}
                style={{
                  border: selectedCategory === key ? '1px solid var(--neon-cyan)' : '1px solid var(--glass-border)',
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Achievement grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredAchievements.map(achievement => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            userAchievement={userAchievements[achievement.id]}
            size="medium"
            onClick={() => setSelectedAchievement(achievement.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">
            No achievements in this category yet.
          </p>
        </div>
      )}

      {/* Achievement detail modal */}
      {selectedAchievementData && (
        <AchievementModal
          achievement={selectedAchievementData}
          userAchievement={userAchievements[selectedAchievementData.id]}
          isOpen={!!selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </div>
  );
}
