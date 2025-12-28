/**
 * ExerciseCollection - Orchestrates multiple exercises per lesson
 *
 * Features:
 * - Nested accordion UI for each exercise
 * - Add/remove/regenerate exercises
 * - Max 3 exercises per lesson
 * - Tracks individual exercise completion
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDumbbell, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';

import { ExerciseAccordion } from './ExerciseAccordion';
import { useExerciseCollection } from './useExerciseCollection';
import { ExerciseRenderer } from '../ExerciseRenderer';
import type { AILessonContent, LessonExercise } from '@/services/learningPaths';
import type { SkillLevel } from '@/services/personalization';
import { cn } from '@/lib/utils';

interface ExerciseCollectionProps {
  pathSlug: string;
  lessonOrder: number;
  content: AILessonContent | undefined;
  skillLevel: SkillLevel;
  onExerciseComplete?: (exerciseId: string) => void;
  onContentUpdate?: (exercises: LessonExercise[]) => void;
  /** Username for cache invalidation on exercise changes */
  username?: string;
}

export function ExerciseCollection({
  pathSlug,
  lessonOrder,
  content,
  skillLevel,
  onExerciseComplete,
  onContentUpdate,
  username,
}: ExerciseCollectionProps) {
  const {
    exercises,
    isLoading,
    loadingExerciseId,
    expandedExerciseId,
    completedExerciseIds,
    canAddMore,
    addExercise,
    removeExercise,
    regenerateExercise,
    markCompleted,
    setExpandedExerciseId,
  } = useExerciseCollection({
    pathSlug,
    lessonOrder,
    initialContent: content,
    onExerciseComplete,
    onContentUpdate,
    username,
  });

  // Check if any exercise is completed (for lesson progress)
  const anyExerciseCompleted = completedExerciseIds.size > 0;
  const existingTypes = exercises.map(ex => ex.exerciseType);

  if (exercises.length === 0 && !isLoading) {
    return (
      <div className={cn(
        'rounded-lg border-2 border-dashed p-6',
        'border-gray-300 dark:border-white/20'
      )}>
        <div className="text-center mb-4">
          <FontAwesomeIcon
            icon={faDumbbell}
            className="text-3xl text-gray-300 dark:text-slate-600 mb-3"
          />
          <p className="text-gray-500 dark:text-slate-400">
            No exercises yet. Add one to practice!
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => addExercise()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 text-purple-400 hover:from-purple-500/30 hover:to-cyan-500/30"
          >
            <span>✨</span> AI Choose
          </button>
          <button
            onClick={() => addExercise('drag_sort')}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            Drag & Sort
          </button>
          <button
            onClick={() => addExercise('connect_nodes')}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20"
          >
            Connect
          </button>
          <button
            onClick={() => addExercise('code_walkthrough')}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
          >
            Walkthrough
          </button>
          <button
            onClick={() => addExercise('timed_challenge')}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20"
          >
            Timed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with completion status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon
            icon={faDumbbell}
            className="text-cyan-500 dark:text-cyan-400"
          />
          <h4 className="font-medium text-gray-800 dark:text-slate-200">
            Exercises ({exercises.length}/3)
          </h4>
          {anyExerciseCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20"
            >
              <FontAwesomeIcon
                icon={faCheck}
                className="text-emerald-500 dark:text-emerald-400 text-xs"
              />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Completed
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {exercises.map((exercise, index) => (
          <ExerciseAccordion
            key={exercise.id}
            exercise={exercise}
            index={index}
            isExpanded={expandedExerciseId === exercise.id}
            isCompleted={completedExerciseIds.has(exercise.id)}
            isLoading={loadingExerciseId === exercise.id}
            onToggle={() => setExpandedExerciseId(
              expandedExerciseId === exercise.id ? null : exercise.id
            )}
            onRemove={() => removeExercise(exercise.id)}
            onRegenerate={() => regenerateExercise(exercise.id)}
          >
            <ExerciseRenderer
              exercise={exercise}
              skillLevel={skillLevel}
              onComplete={() => markCompleted(exercise.id)}
            />
          </ExerciseAccordion>
        ))}
      </div>

      {/* Add exercise - inline pills */}
      {canAddMore && (
        <div className="pt-3 border-t border-gray-200 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Add another exercise:</p>
          <div className="flex flex-wrap gap-2">
            {/* Let AI Choose */}
            <button
              onClick={() => addExercise()}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30',
                'text-purple-400 hover:from-purple-500/30 hover:to-cyan-500/30',
                isLoading && 'opacity-50 cursor-wait'
              )}
            >
              {isLoading ? (
                <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 animate-spin" />
              ) : (
                <span>✨</span>
              )}
              AI Choose
            </button>
            {/* Exercise type pills */}
            {!existingTypes.includes('drag_sort') && (
              <button
                onClick={() => addExercise('drag_sort')}
                disabled={isLoading}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Drag & Sort
              </button>
            )}
            {!existingTypes.includes('connect_nodes') && (
              <button
                onClick={() => addExercise('connect_nodes')}
                disabled={isLoading}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50"
              >
                Connect
              </button>
            )}
            {!existingTypes.includes('code_walkthrough') && (
              <button
                onClick={() => addExercise('code_walkthrough')}
                disabled={isLoading}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                Walkthrough
              </button>
            )}
            {!existingTypes.includes('timed_challenge') && (
              <button
                onClick={() => addExercise('timed_challenge')}
                disabled={isLoading}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 disabled:opacity-50"
              >
                Timed
              </button>
            )}
          </div>
        </div>
      )}

      {/* Max exercises hint */}
      {!canAddMore && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
          Maximum 3 exercises per lesson. Remove one to add another.
        </p>
      )}
    </div>
  );
}

export default ExerciseCollection;
