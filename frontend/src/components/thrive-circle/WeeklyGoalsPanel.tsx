import type { WeeklyGoal } from '@/types/models';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye,
  faFire,
  faHandshake,
  faBook,
  faListCheck
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface WeeklyGoalsPanelProps {
  goals: WeeklyGoal[];
  isLoading?: boolean;
}

const goalIcons: Record<string, { icon: IconDefinition; color: string }> = {
  'activities_3': { icon: faBullseye, color: 'text-primary-500' },
  'streak_7': { icon: faFire, color: 'text-orange-500' },
  'help_5': { icon: faHandshake, color: 'text-accent-500' },
  'topics_2': { icon: faBook, color: 'text-purple-500' },
};

export function WeeklyGoalsPanel({ goals, isLoading }: WeeklyGoalsPanelProps) {
  if (isLoading) {
    return (
      <div className="glass p-6 rounded">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faListCheck} className="text-success-500" />
          Weekly Goals
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <div className="glass p-6 rounded">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faListCheck} className="text-success-500" />
          Weekly Goals
        </h2>
        <p className="text-muted text-center py-8 text-sm">
          No goals available this week.<br />
          Check back on Monday for new weekly goals!
        </p>
      </div>
    );
  }

  return (
    <div className="glass p-6 rounded">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FontAwesomeIcon icon={faListCheck} className="text-success-500" />
          Weekly Goals
        </h2>
        <span className="text-xs text-muted">
          {goals.filter(g => g.isCompleted).length} / {goals.length} completed
        </span>
      </div>

      <div className="space-y-3">
        {goals.map((goal) => {
          const goalIcon = goalIcons[goal.goalType] || { icon: faBullseye, color: 'text-primary-500' };
          const isCompleted = goal.isCompleted;

          return (
            <div
              key={goal.id}
              className={`p-4 rounded border-2 transition-all ${
                isCompleted
                  ? 'bg-success-50 dark:bg-success-900/20 border-success-500 dark:border-success-600'
                  : 'glass-subtle border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-success-100 dark:bg-success-900/40'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <FontAwesomeIcon
                      icon={goalIcon.icon}
                      className={`text-lg ${isCompleted ? 'text-success-600 dark:text-success-400' : goalIcon.color}`}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {goal.goalTypeDisplay}
                    </div>
                    {isCompleted && (
                      <div className="text-xs text-success-600 dark:text-success-400 font-medium">
                        Completed • +{goal.xpReward} XP
                      </div>
                    )}
                  </div>
                </div>

                {!isCompleted && (
                  <div className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                    +{goal.xpReward} XP
                  </div>
                )}
              </div>

              {!isCompleted && (
                <>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>
                      {goal.currentProgress} / {goal.targetProgress}
                    </span>
                    <span>{goal.progressPercentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary transition-all duration-500"
                      style={{ width: `${goal.progressPercentage}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs text-muted text-center">
          Complete goals to earn bonus Points!
        </div>
      </div>
    </div>
  );
}
