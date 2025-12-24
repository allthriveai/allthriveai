/**
 * Learning Path Card Component
 *
 * Displays a single learning path with progress and stats.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen,
  faFlag,
  faArrowRight,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { SkillLevelBadge } from './SkillLevelBadge';
import { PathProgressBar } from './PathProgressBar';
import type { UserLearningPath } from '@/types/models';

interface LearningPathCardProps {
  path: UserLearningPath;
  onClick?: () => void;
}

export function LearningPathCard({ path, onClick }: LearningPathCardProps) {
  const hasActivity = path.quizzesCompleted > 0 || path.sideQuestsCompleted > 0;

  return (
    <div
      className={`bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg' : ''
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {path.topicDisplay}
          </h3>
          <div className="mt-1">
            <SkillLevelBadge level={path.currentSkillLevel} levelDisplay={path.skillLevelDisplay} size="sm" />
          </div>
        </div>
        {onClick && (
          <FontAwesomeIcon
            icon={faArrowRight}
            className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0"
          />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <PathProgressBar
          currentLevel={path.currentSkillLevel}
          topicPoints={path.topicPoints}
          pointsToNextLevel={path.pointsToNextLevel}
          progressPercentage={path.progressPercentage}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Quizzes */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FontAwesomeIcon icon={faBookOpen} className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {path.quizzesCompleted}/{path.quizzesTotal}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Quizzes</div>
          </div>
        </div>

        {/* Side Quests */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <FontAwesomeIcon icon={faFlag} className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {path.sideQuestsCompleted}/{path.sideQuestsTotal}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Side Quests</div>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      {hasActivity && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
            <span>
              Last activity: {new Date(path.lastActivityAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
