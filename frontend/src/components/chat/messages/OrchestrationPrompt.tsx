/**
 * OrchestrationPrompt - Confirmation dialog for Ember's orchestration actions
 *
 * When Ember wants to perform an action that requires user confirmation
 * (navigate, highlight, open tray, etc.), this component shows a prompt.
 *
 * Features:
 * - Description of the action Ember wants to perform
 * - Yes/Cancel buttons
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import type { OrchestrationPromptProps } from '../core/types';

export function OrchestrationPrompt({
  action,
  onConfirm,
  onCancel,
  variant = 'default',
}: OrchestrationPromptProps) {
  const isNeon = variant === 'neon';

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="mx-4 mb-2 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <SparklesIcon className="w-5 h-5 text-cyan-bright" />
          <p className="text-sm font-medium text-cyan-bright">Confirm action</p>
        </div>
        <p className="text-slate-300 text-sm mb-4">{action.description}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="btn-primary flex-1 text-sm py-2"
          >
            Yes
          </button>
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 text-sm py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Ember wants to perform an action
          </p>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {action.description}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
          >
            Yes, do it
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
