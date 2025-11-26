import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircle,
  faClock,
  faTrophy,
  faFire,
  faStar,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { UserSideQuest } from '@/types/models';

interface MySideQuestsPanelProps {
  quests: UserSideQuest[];
}

const statusConfig = {
  not_started: {
    color: 'text-slate-400',
    icon: faCircle,
    label: 'Not Started',
  },
  in_progress: {
    color: 'text-blue-500',
    icon: faClock,
    label: 'In Progress',
  },
  completed: {
    color: 'text-green-500',
    icon: faCheckCircle,
    label: 'Completed',
  },
  expired: {
    color: 'text-red-500',
    icon: faClock,
    label: 'Expired',
  },
};

const difficultyIcons = {
  easy: faStar,
  medium: faBolt,
  hard: faFire,
  epic: faTrophy,
};

export function MySideQuestsPanel({ quests }: MySideQuestsPanelProps) {
  const inProgressQuests = quests.filter(q => q.status === 'in_progress');
  const completedQuests = quests.filter(q => q.status === 'completed');

  return (
    <div className="space-y-8">
      {/* In Progress */}
      {inProgressQuests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faClock} className="text-blue-500" />
            In Progress ({inProgressQuests.length})
          </h2>
          <div className="space-y-4">
            {inProgressQuests.map((userQuest) => (
              <QuestProgressCard key={userQuest.id} userQuest={userQuest} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedQuests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
            Completed ({completedQuests.length})
          </h2>
          <div className="space-y-4">
            {completedQuests.map((userQuest) => (
              <QuestProgressCard key={userQuest.id} userQuest={userQuest} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestProgressCard({ userQuest }: { userQuest: UserSideQuest }) {
  const { sideQuest, status, currentProgress, targetProgress, progressPercentage, xpAwarded, completedAt } = userQuest;
  const statusInfo = statusConfig[status];
  const difficultyIcon = difficultyIcons[sideQuest.difficulty];

  return (
    <div className="glass rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{sideQuest.title}</h3>
            <FontAwesomeIcon
              icon={statusInfo.icon}
              className={`${statusInfo.color} text-sm`}
              title={statusInfo.label}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-muted">
              <FontAwesomeIcon icon={difficultyIcon} className="text-xs" />
              {sideQuest.difficultyDisplay}
            </span>
            {status === 'completed' && xpAwarded > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                <FontAwesomeIcon icon={faTrophy} className="text-xs" />
                +{xpAwarded} XP Earned
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted mb-4">
        {sideQuest.description}
      </p>

      {/* Progress Bar */}
      {status !== 'completed' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Progress</span>
            <span className="font-medium">
              {currentProgress} / {targetProgress}
            </span>
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-muted text-right">
            {progressPercentage}% complete
          </div>
        </div>
      )}

      {/* Completion info */}
      {status === 'completed' && completedAt && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-300">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCheckCircle} />
            <span>Completed on {new Date(completedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
