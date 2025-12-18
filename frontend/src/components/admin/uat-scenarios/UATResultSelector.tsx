/**
 * UATResultSelector - Inline result selector for UAT scenarios
 * Shows Pass/Fail/N/A buttons for quick result selection
 */
import { CheckIcon, XMarkIcon, MinusIcon } from '@heroicons/react/24/outline';
import type { TestResult } from '@/types/uatScenarios';

interface UATResultSelectorProps {
  value: TestResult;
  onChange: (result: TestResult) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function UATResultSelector({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: UATResultSelectorProps) {
  const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const iconClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-1">
      {/* Pass */}
      <button
        onClick={() => onChange(value === 'pass' ? null : 'pass')}
        disabled={disabled}
        className={`${sizeClasses} rounded-lg flex items-center justify-center transition-all ${
          value === 'pass'
            ? 'bg-green-500 text-white shadow-sm'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-green-100 dark:hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Pass"
      >
        <CheckIcon className={iconClasses} />
      </button>

      {/* Fail */}
      <button
        onClick={() => onChange(value === 'fail' ? null : 'fail')}
        disabled={disabled}
        className={`${sizeClasses} rounded-lg flex items-center justify-center transition-all ${
          value === 'fail'
            ? 'bg-red-500 text-white shadow-sm'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Fail"
      >
        <XMarkIcon className={iconClasses} />
      </button>

      {/* N/A */}
      <button
        onClick={() => onChange(value === 'na' ? null : 'na')}
        disabled={disabled}
        className={`${sizeClasses} rounded-lg flex items-center justify-center transition-all ${
          value === 'na'
            ? 'bg-slate-500 text-white shadow-sm'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="N/A"
      >
        <MinusIcon className={iconClasses} />
      </button>
    </div>
  );
}

/**
 * UATResultBadge - Display-only result badge
 */
interface UATResultBadgeProps {
  result: TestResult;
  size?: 'sm' | 'md';
}

export function UATResultBadge({ result, size = 'md' }: UATResultBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  if (!result) {
    return (
      <span className={`${sizeClasses} font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400`}>
        Not Tested
      </span>
    );
  }

  const resultStyles = {
    pass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    fail: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    na: 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300',
  };

  const resultLabels = {
    pass: 'Pass',
    fail: 'Fail',
    na: 'N/A',
  };

  return (
    <span className={`${sizeClasses} font-medium rounded ${resultStyles[result]}`}>
      {resultLabels[result]}
    </span>
  );
}
