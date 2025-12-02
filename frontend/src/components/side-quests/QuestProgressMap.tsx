import { CheckIcon } from '@heroicons/react/24/solid';
import type { QuestStepProgress } from '@/types/models';

interface QuestProgressMapProps {
  stepsProgress: QuestStepProgress[];
}

export function QuestProgressMap({ stepsProgress }: QuestProgressMapProps) {
  if (!stepsProgress || stepsProgress.length === 0) return null;

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex items-center justify-between">
        {stepsProgress.map((stepProgress, index) => {
          const isCompleted = stepProgress.isCompleted;
          const isCurrent = stepProgress.isCurrent;
          const isLast = index === stepsProgress.length - 1;

          return (
            <div key={stepProgress.step.id || index} className="flex items-center flex-1">
              {/* Step Node */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isCurrent ? 'animate-pulse' : ''}
                  `}
                  style={{
                    background: isCompleted
                      ? 'linear-gradient(135deg, #22d3ee, #4ade80)'
                      : isCurrent
                        ? 'rgba(34, 211, 238, 0.3)'
                        : 'rgba(255, 255, 255, 0.1)',
                    border: isCompleted
                      ? 'none'
                      : isCurrent
                        ? '2px solid #22d3ee'
                        : '2px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: isCompleted
                      ? '0 0 15px rgba(34, 211, 238, 0.5)'
                      : isCurrent
                        ? '0 0 20px rgba(34, 211, 238, 0.4)'
                        : 'none',
                  }}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4 text-slate-900" />
                  ) : (
                    <span
                      className={`text-xs font-bold ${
                        isCurrent ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                {/* Step Label */}
                <span
                  className={`mt-2 text-[10px] font-medium text-center max-w-[60px] line-clamp-2 ${
                    isCompleted
                      ? 'text-cyan-400'
                      : isCurrent
                        ? 'text-white'
                        : 'text-slate-500'
                  }`}
                >
                  {stepProgress.step.title}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className="flex-1 h-0.5 mx-2"
                  style={{
                    background: isCompleted
                      ? 'linear-gradient(90deg, #22d3ee, #4ade80)'
                      : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isCompleted
                      ? '0 0 8px rgba(34, 211, 238, 0.3)'
                      : 'none',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
