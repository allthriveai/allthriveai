/**
 * Path Progress Bar Component
 *
 * Displays progress through a learning path with skill level indicators.
 */
import type { LearningPathSkillLevel } from '@/types/models';

interface PathProgressBarProps {
  currentLevel: LearningPathSkillLevel;
  topicPoints: number;
  pointsToNextLevel: number;
  progressPercentage: number;
}

const SKILL_THRESHOLDS = {
  beginner: 0,
  intermediate: 200,
  advanced: 500,
  master: 1000,
};

const levelColors: Record<LearningPathSkillLevel, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-blue-500',
  advanced: 'bg-purple-500',
  master: 'bg-amber-500',
};

export function PathProgressBar({
  currentLevel,
  topicPoints,
  pointsToNextLevel,
  progressPercentage,
}: PathProgressBarProps) {
  // Calculate progress within current level
  const levels: LearningPathSkillLevel[] = ['beginner', 'intermediate', 'advanced', 'master'];
  const currentLevelIndex = levels.indexOf(currentLevel);
  const currentThreshold = SKILL_THRESHOLDS[currentLevel];
  const nextLevel = levels[currentLevelIndex + 1] as LearningPathSkillLevel | undefined;
  const nextThreshold = nextLevel ? SKILL_THRESHOLDS[nextLevel] : SKILL_THRESHOLDS.master;

  const pointsInCurrentLevel = topicPoints - currentThreshold;
  const pointsNeededForLevel = nextThreshold - currentThreshold;
  const levelProgress = nextLevel
    ? Math.min(100, (pointsInCurrentLevel / pointsNeededForLevel) * 100)
    : 100;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${levelColors[currentLevel]} transition-all duration-500 ease-out`}
          style={{ width: `${levelProgress}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {topicPoints} points
        </span>
        {nextLevel ? (
          <span className="text-gray-500 dark:text-gray-400">
            {pointsToNextLevel} to {nextLevel}
          </span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Mastered!
          </span>
        )}
      </div>

      {/* Level markers */}
      <div className="flex justify-between mt-1">
        {levels.map((level, index) => {
          const isReached = index <= currentLevelIndex;
          const isCurrent = level === currentLevel;
          return (
            <div
              key={level}
              className={`flex flex-col items-center ${
                index === 0 ? 'items-start' : index === levels.length - 1 ? 'items-end' : ''
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isReached
                    ? levelColors[level]
                    : 'bg-gray-300 dark:bg-gray-600'
                } ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''}`}
                style={{ ringColor: isCurrent ? levelColors[level].replace('bg-', '') : undefined }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
