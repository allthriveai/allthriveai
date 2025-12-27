/**
 * SortableItem - A single item in the sort exercise
 *
 * Features:
 * - Up/down arrow buttons to reorder (disabled at list boundaries)
 * - Position number badge showing current order
 * - Optional code snippet display
 * - Visual feedback for correct/incorrect positions
 * - Compact mode for smaller display (hides reorder buttons)
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown, faCheck, faExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  /** Unique identifier for the item */
  id: string;
  /** Text content to display */
  content: string;
  /** Optional code snippet */
  code?: string;
  /** Language for code highlighting */
  codeLanguage?: string;
  /** When true, disables all interactions */
  disabled?: boolean;
  /** When true, shows warning indicator for wrong position */
  showCorrectIndicator?: boolean;
  /** When true, shows success indicator */
  isCorrect?: boolean;
  /** Compact mode - smaller size, no reorder buttons */
  compact?: boolean;
  /** Current position in the list (0-indexed) */
  index: number;
  /** Total number of items in the list */
  totalItems: number;
  /** Callback when user clicks move up */
  onMoveUp?: () => void;
  /** Callback when user clicks move down */
  onMoveDown?: () => void;
}

export function SortableItem({
  content,
  code,
  disabled = false,
  showCorrectIndicator = false,
  isCorrect = false,
  compact = false,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
}: SortableItemProps) {
  const isFirst = index === 0;
  const isLast = index === totalItems - 1;

  return (
    <div
      className={cn(
        'rounded-lg border',
        compact ? 'px-3 py-1.5' : 'p-3',
        isCorrect
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
          : showCorrectIndicator
            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Up/Down buttons */}
        {!compact && !disabled && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center transition-colors',
                isFirst
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
              )}
              aria-label="Move up"
            >
              <FontAwesomeIcon icon={faChevronUp} className="text-xs" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center transition-colors',
                isLast
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
              )}
              aria-label="Move down"
            >
              <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
            </button>
          </div>
        )}

        {/* Position number */}
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{index + 1}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className="text-slate-700 dark:text-slate-200">{content}</span>
          {code && (
            <pre className={cn(
              'text-xs bg-slate-100 dark:bg-slate-900/50 p-2 rounded overflow-x-auto',
              compact ? 'mt-1' : 'mt-2'
            )}>
              <code className="text-cyan-600 dark:text-cyan-300">{code}</code>
            </pre>
          )}
        </div>

        {/* Status indicator */}
        {isCorrect && (
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-xs" />
          </div>
        )}
        {showCorrectIndicator && !isCorrect && (
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faExclamation} className="text-amber-400 text-xs" />
          </div>
        )}
      </div>
    </div>
  );
}

export default SortableItem;
