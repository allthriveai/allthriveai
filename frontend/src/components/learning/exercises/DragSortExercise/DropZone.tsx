/**
 * DropZone - Drop target component for match and categorize variants
 */

import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  id: string;
  label: string;
  description?: string;
  isOccupied?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function DropZone({
  id,
  label,
  description,
  isOccupied = false,
  disabled = false,
  children,
}: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled,
  });

  return (
    <motion.div
      ref={setNodeRef}
      className={cn(
        'p-4 rounded-lg border-2 border-dashed transition-all min-h-[60px]',
        isOver
          ? 'bg-cyan-500/10 border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
          : isOccupied
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-white/3 border-white/20 hover:border-white/30',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      animate={isOver ? { scale: 1.02 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn(
            'font-medium text-sm',
            isOccupied ? 'text-emerald-300' : 'text-slate-300'
          )}>
            {label}
          </p>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
        {isOccupied && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0"
          >
            <svg
              className="w-3 h-3 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </div>
      {children}
    </motion.div>
  );
}

export default DropZone;
