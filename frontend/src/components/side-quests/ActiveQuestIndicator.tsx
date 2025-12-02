import { SparklesIcon } from '@heroicons/react/24/outline';
import type { UserSideQuest } from '@/types/models';

interface ActiveQuestIndicatorProps {
  activeQuest: UserSideQuest | null;
  onClick: () => void;
}

export function ActiveQuestIndicator({ activeQuest, onClick }: ActiveQuestIndicatorProps) {
  if (!activeQuest || activeQuest.isCompleted) return null;

  const { sideQuest, stepsProgress } = activeQuest;
  const completedStepsCount = stepsProgress?.filter(s => s.isCompleted).length || 0;
  const totalSteps = sideQuest.steps?.length || 0;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105"
      style={{
        background: 'rgba(34, 211, 238, 0.1)',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
      }}
      title={`Active Quest: ${sideQuest.title}`}
    >
      {/* Pulsing icon */}
      <div className="relative">
        <SparklesIcon className="w-4 h-4 text-cyan-400" />
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: 'rgba(34, 211, 238, 0.4)',
          }}
        />
      </div>

      {/* Step count badge */}
      {sideQuest.isGuided && totalSteps > 0 && (
        <span className="text-xs font-bold text-cyan-400">
          {completedStepsCount}/{totalSteps}
        </span>
      )}
    </button>
  );
}
