/**
 * OnboardingProgress - Step indicator for Echo onboarding flow
 * US-007: OnboardingProgress shows 5 steps with filled/empty dots
 *
 * Features:
 * - Shows 5 steps: intro, goals, platforms, topics, tasks
 * - Current step highlighted in cyan
 * - Completed steps shown as filled
 * - Progress bar only visible during onboarding (phase !== 'complete')
 */

import type { OnboardingPhase } from '@/hooks/useEchoProfile';

// The 5 onboarding phases in order
const ONBOARDING_STEPS: OnboardingPhase[] = [
  'intro',
  'goals',
  'platforms',
  'topics',
  'tasks',
];

// Human-readable labels for each step
const STEP_LABELS: Record<OnboardingPhase, string> = {
  intro: 'Welcome',
  goals: 'Goals',
  platforms: 'Platforms',
  topics: 'Topics',
  tasks: 'Tasks',
  complete: 'Complete',
};

interface OnboardingProgressProps {
  /**
   * Current onboarding phase
   */
  phase: OnboardingPhase;
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Get the step index for a phase (0-4), defaults to 0 for invalid phases
 */
function getStepIndex(phase: OnboardingPhase): number {
  const index = ONBOARDING_STEPS.indexOf(phase);
  return index >= 0 ? index : 0;
}

export function OnboardingProgress({ phase, className = '' }: OnboardingProgressProps) {
  // Don't render if onboarding is complete
  if (phase === 'complete') {
    return null;
  }

  const currentStepIndex = getStepIndex(phase);
  const currentLabel = STEP_LABELS[phase] || STEP_LABELS.intro;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 ${className}`}
      role="progressbar"
      aria-valuenow={currentStepIndex + 1}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-label={`Onboarding progress: Step ${currentStepIndex + 1} of 5, ${currentLabel}`}
    >
      {/* Step dots */}
      <div className="flex gap-1.5" role="list" aria-label="Onboarding steps">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const label = STEP_LABELS[step];

          return (
            <div
              key={step}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${label}: ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
              className={`
                w-2 h-2 rounded-full transition-colors
                ${isCompleted ? 'bg-cyan-500' : ''}
                ${isCurrent ? 'bg-cyan-400 ring-2 ring-cyan-400/30' : ''}
                ${!isCompleted && !isCurrent ? 'bg-slate-700' : ''}
              `}
            />
          );
        })}
      </div>

      {/* Step label */}
      <span className="text-xs text-slate-400">
        Step {currentStepIndex + 1} of 5: {currentLabel}
      </span>
    </div>
  );
}
