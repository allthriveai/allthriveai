/**
 * RecentBattlesSection - Display recent battle history for battle bots (Pip)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BoltIcon, TrophyIcon, XMarkIcon as XIcon, MinusIcon } from '@heroicons/react/24/outline';
import type { RecentBattlesSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import { getUserBattles } from '@/services/battles';

interface RecentBattlesSectionProps {
  content: RecentBattlesSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: RecentBattlesSectionContent) => void;
}

interface Battle {
  id: number;
  challenge: {
    id: number;
    title: string;
    slug: string;
  };
  opponent: {
    username: string;
    avatarUrl?: string;
  };
  outcome: 'win' | 'loss' | 'draw' | 'pending';
  createdAt: string;
  votesFor: number;
  votesAgainst: number;
}

export function RecentBattlesSection({ content, user, isEditing, onUpdate }: RecentBattlesSectionProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  const maxBattles = content?.maxBattles || 6;
  const showOutcome = content?.showOutcome !== false;
  const showChallenge = content?.showChallenge !== false;
  const layout = content?.layout || 'grid';

  useEffect(() => {
    const fetchBattles = async () => {
      try {
        const data = await getUserBattles(user.username);
        const battlesList: Battle[] = (data.battles as any)?.slice(0, maxBattles) || [];
        setBattles(battlesList);
      } catch (error) {
        console.error('Failed to fetch battles:', error);
        setBattles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBattles();
  }, [user.username, maxBattles]);

  const getOutcomeStyles = (outcome: string) => {
    switch (outcome) {
      case 'win':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-700 dark:text-green-400',
          icon: TrophyIcon,
          label: 'Won',
        };
      case 'loss':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-700 dark:text-red-400',
          icon: XIcon,
          label: 'Lost',
        };
      case 'draw':
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-gray-700 dark:text-gray-400',
          icon: MinusIcon,
          label: 'Draw',
        };
      default:
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-700 dark:text-yellow-400',
          icon: BoltIcon,
          label: 'Pending',
        };
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-2 mb-6">
          <BoltIcon className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recent Battles
          </h2>
        </div>
        <div className={layout === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3 w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (battles.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-6">
        <BoltIcon className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Recent Battles
        </h2>
      </div>

      {battles.length > 0 ? (
        <div className={layout === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {battles.map((battle) => {
            const outcomeStyle = getOutcomeStyles(battle.outcome);
            const OutcomeIcon = outcomeStyle.icon;

            return (
              <Link
                key={battle.id}
                to={`/battles/${battle.challenge.slug}`}
                className="group block p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Challenge title */}
                    {showChallenge && (
                      <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {battle.challenge.title}
                      </h3>
                    )}

                    {/* Opponent */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">vs</span>
                      <div className="flex items-center gap-1.5">
                        {battle.opponent.avatarUrl && (
                          <img
                            src={battle.opponent.avatarUrl}
                            alt=""
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {battle.opponent.username}
                        </span>
                      </div>
                    </div>

                    {/* Votes */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {battle.votesFor} - {battle.votesAgainst} votes
                    </div>
                  </div>

                  {/* Outcome badge */}
                  {showOutcome && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${outcomeStyle.bg} ${outcomeStyle.text}`}>
                      <OutcomeIcon className="w-3.5 h-3.5" />
                      {outcomeStyle.label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <BoltIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No battles yet
          </p>
        </div>
      )}

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
                checked={showOutcome}
                onChange={(e) => onUpdate({ ...content, showOutcome: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              Show Outcome
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showChallenge}
                onChange={(e) => onUpdate({ ...content, showChallenge: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              Show Challenge
            </label>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Max battles:</span>
              <select
                value={maxBattles}
                onChange={(e) => onUpdate({ ...content, maxBattles: parseInt(e.target.value) })}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
              >
                <option value={3}>3</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
