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
import { faDumbbell, faCheck } from '@fortawesome/free-solid-svg-icons';

import { ExerciseAccordion } from './ExerciseAccordion';
import { AddExerciseButton } from './AddExerciseButton';
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
}

export function ExerciseCollection({
  pathSlug,
  lessonOrder,
  content,
  skillLevel,
  onExerciseComplete,
  onContentUpdate,
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
  });

  // Check if any exercise is completed (for lesson progress)
  const anyExerciseCompleted = completedExerciseIds.size > 0;
  const existingTypes = exercises.map(ex => ex.exerciseType);

  if (exercises.length === 0 && !isLoading) {
    return (
      <div className={cn(
        'rounded-lg border-2 border-dashed p-6 text-center',
        'border-gray-300 dark:border-white/20'
      )}>
        <FontAwesomeIcon
          icon={faDumbbell}
          className="text-3xl text-gray-300 dark:text-slate-600 mb-3"
        />
        <p className="text-gray-500 dark:text-slate-400 mb-4">
          No exercises yet. Add one to practice!
        </p>
        <AddExerciseButton
          onAdd={addExercise}
          isLoading={isLoading}
          existingTypes={existingTypes}
        />
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

      {/* Add exercise button */}
      {canAddMore && (
        <AddExerciseButton
          onAdd={addExercise}
          isLoading={isLoading}
          existingTypes={existingTypes}
        />
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
