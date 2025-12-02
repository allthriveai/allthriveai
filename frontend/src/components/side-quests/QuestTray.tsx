import { XMarkIcon, ArrowRightIcon, SparklesIcon, TrophyIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import type { UserSideQuest } from '@/types/models';
import { QuestProgressMap } from './QuestProgressMap';
import { QuestStepCard } from './QuestStepCard';

interface QuestTrayProps {
  isOpen: boolean;
  onClose: () => void;
  activeQuest: UserSideQuest | null;
}

export function QuestTray({ isOpen, onClose, activeQuest }: QuestTrayProps) {
  const navigate = useNavigate();

  const handleNavigateToStep = (url: string) => {
    if (url) {
      onClose();
      navigate(url);
    }
  };

  if (!isOpen || !activeQuest) return null;

  const { sideQuest, stepsProgress, currentStep, isCompleted } = activeQuest;
  const completedStepsCount = stepsProgress?.filter(s => s.isCompleted).length || 0;
  const totalSteps = sideQuest.steps?.length || 0;

  return (
    <div
      className={`fixed right-0 top-0 bottom-0 w-full max-w-md shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{
        backgroundColor: 'rgba(2, 6, 23, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(34, 211, 238, 0.2)',
        boxShadow: '0 0 40px rgba(34, 211, 238, 0.1)',
      }}
    >
      {/* Ambient glow effect */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
        }}
      />

      <div className="flex flex-col h-full relative z-10">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'rgba(34, 211, 238, 0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)',
              }}
            >
              <SparklesIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{
                  background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {sideQuest.title}
              </h2>
              <p className="text-xs text-slate-400">
                {completedStepsCount}/{totalSteps} steps completed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all hover:bg-white/5"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quest Info Bar */}
          <div className="flex items-center justify-between gap-4">
            {/* XP Reward Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
              }}
            >
              <TrophyIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-cyan-400">+{sideQuest.pointsReward} XP</span>
            </div>

            {/* Estimated Time */}
            {sideQuest.estimatedMinutes && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <ClockIcon className="w-4 h-4" />
                <span className="text-sm">~{sideQuest.estimatedMinutes} min</span>
              </div>
            )}
          </div>

          {/* Narrative Intro */}
          {sideQuest.narrativeIntro && !isCompleted && (
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <p className="text-sm text-slate-300 leading-relaxed italic">
                "{sideQuest.narrativeIntro}"
              </p>
            </div>
          )}

          {/* Completion Message */}
          {isCompleted && sideQuest.narrativeComplete && (
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(74, 222, 128, 0.1))',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckIcon className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-cyan-400">Quest Complete!</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {sideQuest.narrativeComplete}
              </p>
            </div>
          )}

          {/* Progress Map */}
          {sideQuest.isGuided && totalSteps > 0 && (
            <div className="py-2">
              <QuestProgressMap stepsProgress={stepsProgress} />
            </div>
          )}

          {/* Steps List */}
          {sideQuest.isGuided && stepsProgress && stepsProgress.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Journey Steps
              </h3>
              <div className="space-y-2">
                {stepsProgress.map((stepProgress, index) => (
                  <QuestStepCard
                    key={stepProgress.step.id || index}
                    stepProgress={stepProgress}
                    stepNumber={index + 1}
                    onNavigate={handleNavigateToStep}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with action */}
        {!isCompleted && currentStep?.destinationUrl && (
          <div
            className="p-4 border-t"
            style={{ borderColor: 'rgba(34, 211, 238, 0.2)' }}
          >
            <button
              onClick={() => handleNavigateToStep(currentStep.destinationUrl!)}
              className="w-full py-3 px-4 rounded-xl font-bold text-slate-900 transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)',
              }}
            >
              <span>Continue Journey</span>
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
