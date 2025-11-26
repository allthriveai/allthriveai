import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faStar,
  faBolt,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import type { SideQuest } from '@/types/models';

interface SideQuestCardProps {
  quest: SideQuest;
  onStart: () => void;
  isStarting: boolean;
}

const difficultyConfig = {
  easy: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: faStar,
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: faBolt,
  },
  hard: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: faFire,
  },
  epic: {
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: faTrophy,
  },
};

export function SideQuestCard({ quest, onStart, isStarting }: SideQuestCardProps) {
  const config = difficultyConfig[quest.difficulty];

  return (
    <div className="glass rounded-lg p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">{quest.title}</h3>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${config.bgColor} ${config.color}`}>
              <FontAwesomeIcon icon={config.icon} className="text-xs" />
              {quest.difficultyDisplay}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              <FontAwesomeIcon icon={faTrophy} className="text-xs" />
              {quest.xpReward} XP
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted text-sm mb-4 line-clamp-3">
        {quest.description}
      </p>

      {/* Requirements */}
      {quest.requirements && Object.keys(quest.requirements).length > 0 && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded text-sm">
          <div className="font-medium mb-1 text-muted">Requirements:</div>
          <ul className="space-y-1 text-xs text-muted">
            {Object.entries(quest.requirements).map(([key, value]) => (
              <li key={key}>
                {key === 'target' ? `Complete ${value} times` : `${key}: ${value}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onStart}
        disabled={isStarting || !quest.isAvailable}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isStarting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Starting...
          </span>
        ) : quest.isAvailable ? (
          'Accept Quest'
        ) : (
          'Unavailable'
        )}
      </button>

      {/* Time info */}
      {(quest.startsAt || quest.expiresAt) && (
        <div className="mt-3 text-xs text-muted space-y-1">
          {quest.startsAt && (
            <div>Starts: {new Date(quest.startsAt).toLocaleDateString()}</div>
          )}
          {quest.expiresAt && (
            <div>Expires: {new Date(quest.expiresAt).toLocaleDateString()}</div>
          )}
        </div>
      )}
    </div>
  );
}
