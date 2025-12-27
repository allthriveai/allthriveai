/**
 * SortableItem - Draggable item component for DragSortExercise
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faCheck, faExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  id: string;
  content: string;
  code?: string;
  codeLanguage?: string;
  disabled?: boolean;
  showCorrectIndicator?: boolean;
  isCorrect?: boolean;
  compact?: boolean;
}

export function SortableItem({
  id,
  content,
  code,
  disabled = false,
  showCorrectIndicator = false,
  isCorrect = false,
  compact = false,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg border',
        compact ? 'px-3 py-1.5' : 'p-3',
        isDragging
          ? 'z-50 shadow-lg bg-cyan-100 dark:bg-cyan-500/30 border-cyan-400 dark:border-cyan-400/50'
          : isCorrect
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
            : showCorrectIndicator
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600',
        disabled ? 'cursor-default opacity-60' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        {!compact && (
          <FontAwesomeIcon
            icon={faGripVertical}
            className={cn(
              'text-slate-400 dark:text-slate-500',
              !disabled && 'hover:text-slate-500 dark:hover:text-slate-400'
            )}
          />
        )}

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
