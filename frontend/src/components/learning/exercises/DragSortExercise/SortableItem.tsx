/**
 * SortableItem - Draggable item component for DragSortExercise
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg border transition-all select-none',
        compact ? 'px-3 py-1.5' : 'p-3',
        isDragging
          ? 'bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)] z-50'
          : isCorrect
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : showCorrectIndicator
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-white/5 border-white/10 hover:border-white/20',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      animate={isDragging ? { scale: 1.05, y: -4 } : { scale: 1, y: 0 }}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        {!compact && (
          <FontAwesomeIcon
            icon={faGripVertical}
            className={cn(
              'text-slate-500',
              !disabled && 'hover:text-slate-400'
            )}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className="text-slate-200">{content}</span>
          {code && (
            <pre className={cn(
              'text-xs bg-black/30 p-2 rounded overflow-x-auto',
              compact ? 'mt-1' : 'mt-2'
            )}>
              <code className="text-cyan-300">{code}</code>
            </pre>
          )}
        </div>

        {/* Status indicator */}
        {isCorrect && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-xs" />
          </motion.div>
        )}
        {showCorrectIndicator && !isCorrect && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faExclamation} className="text-amber-400 text-xs" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default SortableItem;
