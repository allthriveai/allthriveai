/**
 * BattleStatsSection - Display battle statistics for battle bots (Pip)
 */

import { useState, useEffect } from 'react';
import { BoltIcon, TrophyIcon, FireIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import type { BattleStatsSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import { getUserBattles } from '@/services/battles';

interface BattleStatsSectionProps {
  content: BattleStatsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: BattleStatsSectionContent) => void;
}

interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
}

export function BattleStatsSection({ content, user, isEditing, onUpdate }: BattleStatsSectionProps) {
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [loading, setLoading] = useState(true);

  const showWinRate = content?.showWinRate !== false;
  const showStreak = content?.showStreak !== false;
  const showTotalBattles = content?.showTotalBattles !== false;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getUserBattles(user.username);
        setStats({
          totalBattles: data.stats.totalBattles || 0,
          wins: data.stats.wins || 0,
          losses: data.stats.losses || 0,
          draws: data.stats.draws || 0,
          winRate: data.stats.winRate || 0,
          currentStreak: data.stats.currentStreak || 0,
          bestStreak: data.stats.bestStreak || 0,
        });
      } catch (error) {
        console.error('Failed to fetch battle stats:', error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user.username]);

  if (loading) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-2 mb-6">
          <BoltIcon className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Battle Stats
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-6">
        <BoltIcon className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Battle Stats
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Battles */}
        {showTotalBattles && (
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-center gap-2 mb-2">
              <ChartBarIcon className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Total Battles
              </span>
            </div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {stats.totalBattles}
            </div>
          </div>
        )}

        {/* Win Rate */}
        {showWinRate && (
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 rounded-xl border border-green-200 dark:border-green-800/30">
            <div className="flex items-center gap-2 mb-2">
              <TrophyIcon className="w-5 h-5 text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                Win Rate
              </span>
            </div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {Math.round(stats.winRate)}%
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {stats.wins}W - {stats.losses}L - {stats.draws}D
            </div>
          </div>
        )}

        {/* Current Streak */}
        {showStreak && (
          <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 rounded-xl border border-orange-200 dark:border-orange-800/30">
            <div className="flex items-center gap-2 mb-2">
              <FireIcon className="w-5 h-5 text-orange-500" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                Current Streak
              </span>
            </div>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
              {stats.currentStreak}
            </div>
          </div>
        )}

        {/* Best Streak */}
        {showStreak && (
          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 rounded-xl border border-purple-200 dark:border-purple-800/30">
            <div className="flex items-center gap-2 mb-2">
              <TrophyIcon className="w-5 h-5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Best Streak
              </span>
            </div>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
              {stats.bestStreak}
            </div>
          </div>
        )}
      </div>

      {/* Edit controls */}
      {isEditing && onUpdate && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Display Options
          </h4>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showTotalBattles}
                onChange={(e) => onUpdate({ ...content, showTotalBattles: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              Total Battles
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showWinRate}
                onChange={(e) => onUpdate({ ...content, showWinRate: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              Win Rate
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showStreak}
                onChange={(e) => onUpdate({ ...content, showStreak: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              Streaks
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
