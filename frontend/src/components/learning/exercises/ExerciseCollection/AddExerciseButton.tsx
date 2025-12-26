/**
 * AddExerciseButton - Button with dropdown for adding new exercises
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faWandMagicSparkles,
  faArrowsLeftRightToLine,
  faProjectDiagram,
  faCode,
  faClock,
  faTerminal,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import type { LessonExercise } from '@/services/learningPaths';
import { cn } from '@/lib/utils';

type ExerciseType = LessonExercise['exerciseType'];

interface ExerciseTypeOption {
  type: ExerciseType;
  label: string;
  description: string;
  icon: typeof faPlus;
  color: string;
}

const exerciseTypeOptions: ExerciseTypeOption[] = [
  {
    type: 'drag_sort',
    label: 'Drag & Sort',
    description: 'Reorder items or match concepts',
    icon: faArrowsLeftRightToLine,
    color: 'text-amber-500',
  },
  {
    type: 'connect_nodes',
    label: 'Connect Concepts',
    description: 'Draw connections between related ideas',
    icon: faProjectDiagram,
    color: 'text-violet-500',
  },
  {
    type: 'code_walkthrough',
    label: 'Code Walkthrough',
    description: 'Step through code with explanations',
    icon: faCode,
    color: 'text-cyan-500',
  },
  {
    type: 'timed_challenge',
    label: 'Timed Challenge',
    description: 'Quick-fire quiz with scoring',
    icon: faClock,
    color: 'text-pink-500',
  },
  {
    type: 'terminal',
    label: 'Terminal',
    description: 'Practice commands in a terminal',
    icon: faTerminal,
    color: 'text-emerald-500',
  },
  {
    type: 'code',
    label: 'Code Editor',
    description: 'Write and test code',
    icon: faCode,
    color: 'text-blue-500',
  },
];

interface AddExerciseButtonProps {
  onAdd: (exerciseType?: ExerciseType) => void;
  isLoading: boolean;
  disabled?: boolean;
  existingTypes?: ExerciseType[];
}

export function AddExerciseButton({
  onAdd,
  isLoading,
  disabled = false,
  existingTypes = [],
}: AddExerciseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort options: types not in use first
  const sortedOptions = [...exerciseTypeOptions].sort((a, b) => {
    const aExists = existingTypes.includes(a.type);
    const bExists = existingTypes.includes(b.type);
    if (aExists !== bExists) return aExists ? 1 : -1;
    return 0;
  });

  const handleSelect = (type?: ExerciseType) => {
    setIsOpen(false);
    onAdd(type);
  };

  if (disabled) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed transition-all',
          'border-gray-300 dark:border-white/20 hover:border-cyan-400 dark:hover:border-cyan-500/50',
          'text-gray-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400',
          'hover:bg-cyan-50 dark:hover:bg-cyan-500/5',
          isLoading && 'opacity-60 cursor-wait'
        )}
      >
        {isLoading ? (
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
        ) : (
          <FontAwesomeIcon icon={faPlus} />
        )}
        <span className="text-sm font-medium">Add Exercise</span>
      </button>

      <AnimatePresence>
        {isOpen && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute left-0 mt-2 w-72 z-50',
              'bg-white dark:bg-slate-800 rounded-lg shadow-xl',
              'border border-gray-200 dark:border-white/10',
              'overflow-hidden'
            )}
          >
            {/* Let AI Choose option */}
            <button
              onClick={() => handleSelect()}
              className={cn(
                'w-full flex items-center gap-3 p-3 text-left transition-colors',
                'hover:bg-gradient-to-r hover:from-purple-50 hover:to-cyan-50',
                'dark:hover:from-purple-500/10 dark:hover:to-cyan-500/10',
                'border-b border-gray-100 dark:border-white/10'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-white text-sm" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                  Let AI Choose
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Best exercise type for this lesson
                </p>
              </div>
            </button>

            {/* Exercise type options */}
            <div className="max-h-64 overflow-y-auto">
              {sortedOptions.map(option => {
                const isExisting = existingTypes.includes(option.type);

                return (
                  <button
                    key={option.type}
                    onClick={() => handleSelect(option.type)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 text-left transition-colors',
                      'hover:bg-gray-50 dark:hover:bg-white/5',
                      isExisting && 'opacity-60'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center',
                      option.color
                    )}>
                      <FontAwesomeIcon icon={option.icon} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                        {option.label}
                        {isExisting && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">
                            (in use)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AddExerciseButton;
