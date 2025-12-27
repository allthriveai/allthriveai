/**
 * ExerciseAccordion - Nested accordion wrapper for individual exercises
 * Includes expand/collapse, remove button, and loading states
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faCheck,
  faTrash,
  faRotateRight,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import type { LessonExercise } from '@/services/learningPaths';
import { cn } from '@/lib/utils';

// Exercise type display names
const exerciseTypeLabels: Record<LessonExercise['exerciseType'], string> = {
  terminal: 'Terminal',
  git: 'Git',
  ai_prompt: 'AI Prompt',
  code_review: 'Code Review',
  code: 'Code',
  drag_sort: 'Drag & Sort',
  connect_nodes: 'Connect Concepts',
  code_walkthrough: 'Code Walkthrough',
  timed_challenge: 'Timed Challenge',
};

// Exercise type icons/colors
const exerciseTypeColors: Record<LessonExercise['exerciseType'], string> = {
  terminal: 'bg-emerald-500',
  git: 'bg-orange-500',
  ai_prompt: 'bg-purple-500',
  code_review: 'bg-blue-500',
  code: 'bg-cyan-500',
  drag_sort: 'bg-amber-500',
  connect_nodes: 'bg-violet-500',
  code_walkthrough: 'bg-cyan-600',
  timed_challenge: 'bg-pink-500',
};

interface ExerciseAccordionProps {
  exercise: LessonExercise;
  index: number;
  isExpanded: boolean;
  isCompleted: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  children: React.ReactNode;
}

export function ExerciseAccordion({
  exercise,
  index,
  isExpanded,
  isCompleted,
  isLoading,
  onToggle,
  onRemove,
  onRegenerate,
  children,
}: ExerciseAccordionProps) {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const typeLabel = exerciseTypeLabels[exercise.exerciseType] || exercise.exerciseType;
  const typeColor = exerciseTypeColors[exercise.exerciseType] || 'bg-gray-500';

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmRemove(true);
  };

  const handleConfirmRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmRemove(false);
    onRemove();
  };

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmRemove(false);
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRegenerate();
  };

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      isExpanded
        ? 'border-cyan-500/30 dark:border-cyan-400/30 bg-gray-50 dark:bg-white/5'
        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/3',
      isCompleted && 'border-emerald-300 dark:border-emerald-500/30'
    )}>
      {/* Accordion Header */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left transition-colors',
          'hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg',
          isLoading && 'opacity-60 cursor-wait'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Exercise type badge */}
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white',
            typeColor
          )}>
            {typeLabel}
          </span>

          {/* Exercise title/index */}
          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Exercise {index + 1}
          </span>

          {/* Completed checkmark */}
          {isCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"
            >
              <FontAwesomeIcon
                icon={faCheck}
                className="text-emerald-500 dark:text-emerald-400 text-xs"
              />
            </motion.div>
          )}

          {/* Loading spinner */}
          {isLoading && (
            <FontAwesomeIcon
              icon={faSpinner}
              className="text-cyan-500 animate-spin"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons (only show when expanded) */}
          {isExpanded && !showConfirmRemove && (
            <div className="flex items-center gap-1">
              {/* Regenerate button */}
              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                title="Regenerate exercise"
              >
                <FontAwesomeIcon icon={faRotateRight} className="text-sm" />
              </button>

              {/* Remove button */}
              <button
                onClick={handleRemoveClick}
                disabled={isLoading}
                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                title="Remove exercise"
              >
                <FontAwesomeIcon icon={faTrash} className="text-sm" />
              </button>
            </div>
          )}

          {/* Confirm remove dialog */}
          {showConfirmRemove && (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <span className="text-xs text-gray-500 dark:text-slate-400">Remove?</span>
              <button
                onClick={handleConfirmRemove}
                className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
              >
                Yes
              </button>
              <button
                onClick={handleCancelRemove}
                className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded"
              >
                No
              </button>
            </div>
          )}

          {/* Expand/collapse chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <FontAwesomeIcon
              icon={faChevronDown}
              className="text-gray-400 dark:text-slate-500 text-sm"
            />
          </motion.div>
        </div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExerciseAccordion;
