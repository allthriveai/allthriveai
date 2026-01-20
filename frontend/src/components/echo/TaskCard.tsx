/**
 * TaskCard - Individual task item for Echo workspace
 * US-008: TaskCard shows checkbox, title, due date, overdue indicator
 *
 * Features:
 * - Checkbox for task completion
 * - Title with optional description
 * - Due date display
 * - Overdue indicator (red) when past due
 * - Accessible checkbox with label
 */

import { useCallback, useMemo } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

export interface EchoTask {
  id: string | number;
  title: string;
  description?: string;
  dueDate?: string | null;
  isCompleted: boolean;
  source?: 'asana' | 'manual' | 'echo';
}

interface TaskCardProps {
  /**
   * Task data
   */
  task: EchoTask;
  /**
   * Callback when task completion is toggled
   */
  onToggleComplete?: (taskId: string | number, isCompleted: boolean) => void;
  /**
   * Whether toggle is in progress
   */
  isToggling?: boolean;
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Format a date string for display
 */
function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueDay = new Date(date);
  dueDay.setHours(0, 0, 0, 0);

  // Check if today
  if (dueDay.getTime() === today.getTime()) {
    return 'Today';
  }

  // Check if tomorrow
  if (dueDay.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  // Check if within this week
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  if (dueDay < weekFromNow) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Otherwise show month/day
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Check if a date is overdue (past today)
 */
function isOverdue(dateStr: string, isCompleted: boolean): boolean {
  if (isCompleted) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function TaskCard({
  task,
  onToggleComplete,
  isToggling = false,
  className = '',
}: TaskCardProps) {
  const overdue = useMemo(() => {
    return task.dueDate ? isOverdue(task.dueDate, task.isCompleted) : false;
  }, [task.dueDate, task.isCompleted]);

  const formattedDueDate = useMemo(() => {
    return task.dueDate ? formatDueDate(task.dueDate) : null;
  }, [task.dueDate]);

  const handleToggle = useCallback(() => {
    if (onToggleComplete && !isToggling) {
      onToggleComplete(task.id, !task.isCompleted);
    }
  }, [onToggleComplete, isToggling, task.id, task.isCompleted]);

  const checkboxId = `task-${task.id}`;

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg
        hover:bg-slate-800/30 transition-colors
        ${task.isCompleted ? 'opacity-60' : ''}
        ${className}
      `}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.isCompleted}
        aria-labelledby={`${checkboxId}-label`}
        onClick={handleToggle}
        disabled={isToggling}
        className={`
          flex-shrink-0 mt-0.5 w-5 h-5 rounded-full
          transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50
          ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        `}
      >
        {task.isCompleted ? (
          <CheckCircleSolidIcon className="w-5 h-5 text-cyan-400" />
        ) : (
          <CheckCircleIcon
            className={`w-5 h-5 ${overdue ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
          />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <label
          id={`${checkboxId}-label`}
          htmlFor={checkboxId}
          className={`
            text-sm font-medium block truncate cursor-pointer
            ${task.isCompleted ? 'text-slate-400 line-through' : 'text-white'}
          `}
        >
          {task.title}
        </label>

        {/* Description (if present) */}
        {task.description && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Due date */}
        {formattedDueDate && (
          <div
            className={`
              flex items-center gap-1 mt-1.5 text-xs
              ${overdue ? 'text-red-400' : 'text-slate-400'}
            `}
          >
            {overdue ? (
              <ExclamationCircleIcon className="w-3.5 h-3.5" />
            ) : (
              <ClockIcon className="w-3.5 h-3.5" />
            )}
            <span>{formattedDueDate}</span>
            {overdue && <span className="font-medium">(Overdue)</span>}
          </div>
        )}
      </div>

      {/* Source indicator */}
      {task.source === 'asana' && (
        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-500/20 text-orange-300">
          Asana
        </span>
      )}
    </div>
  );
}
