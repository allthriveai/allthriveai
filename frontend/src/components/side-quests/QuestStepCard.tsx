import { CheckIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import {
  BookOpenIcon,
  AcademicCapIcon,
  SparklesIcon,
  MapIcon,
  TrophyIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type { QuestStepProgress } from '@/types/models';

interface QuestStepCardProps {
  stepProgress: QuestStepProgress;
  stepNumber: number;
  onNavigate: (url: string) => void;
}

// Map icon names to Heroicons
const iconMap: Record<string, React.ElementType> = {
  book: BookOpenIcon,
  compass: MapIcon,
  sparkles: SparklesIcon,
  trophy: TrophyIcon,
  star: StarIcon,
  academic: AcademicCapIcon,
};

export function QuestStepCard({ stepProgress, stepNumber, onNavigate }: QuestStepCardProps) {
  const { step, isCompleted, isCurrent } = stepProgress;
  const IconComponent = iconMap[step.icon] || SparklesIcon;

  const handleClick = () => {
    if (isCurrent && step.destinationUrl) {
      onNavigate(step.destinationUrl);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        p-4 rounded-xl transition-all duration-200
        ${isCurrent ? 'cursor-pointer' : ''}
      `}
      style={{
        background: isCompleted
          ? 'rgba(34, 211, 238, 0.08)'
          : isCurrent
            ? 'rgba(34, 211, 238, 0.12)'
            : 'rgba(255, 255, 255, 0.03)',
        border: isCompleted
          ? '1px solid rgba(34, 211, 238, 0.2)'
          : isCurrent
            ? '1px solid rgba(34, 211, 238, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isCurrent ? '0 0 15px rgba(34, 211, 238, 0.15)' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          `}
          style={{
            background: isCompleted
              ? 'linear-gradient(135deg, #22d3ee, #4ade80)'
              : isCurrent
                ? 'rgba(34, 211, 238, 0.2)'
                : 'rgba(255, 255, 255, 0.08)',
            boxShadow: isCompleted
              ? '0 0 10px rgba(34, 211, 238, 0.4)'
              : 'none',
          }}
        >
          {isCompleted ? (
            <CheckIcon className="w-4 h-4 text-slate-900" />
          ) : (
            <IconComponent
              className={`w-4 h-4 ${isCurrent ? 'text-cyan-400' : 'text-slate-500'}`}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium ${
                isCompleted
                  ? 'text-cyan-400'
                  : isCurrent
                    ? 'text-cyan-400'
                    : 'text-slate-500'
              }`}
            >
              Step {stepNumber}
            </span>
            {isCompleted && (
              <span className="text-[10px] text-slate-500">
                Completed
              </span>
            )}
          </div>
          <h4
            className={`text-sm font-semibold mb-1 ${
              isCompleted
                ? 'text-slate-300'
                : isCurrent
                  ? 'text-white'
                  : 'text-slate-400'
            }`}
          >
            {step.title}
          </h4>
          <p
            className={`text-xs leading-relaxed ${
              isCompleted ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {step.description}
          </p>
        </div>

        {/* Action Button for current step */}
        {isCurrent && step.destinationUrl && (
          <button
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
              boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)',
            }}
          >
            <ArrowRightIcon className="w-4 h-4 text-slate-900" />
          </button>
        )}
      </div>
    </div>
  );
}
