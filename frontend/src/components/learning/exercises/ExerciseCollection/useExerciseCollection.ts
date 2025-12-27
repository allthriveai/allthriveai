/**
 * Hook for managing multiple exercises per lesson
 */

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { LessonExercise, AILessonContent } from '@/services/learningPaths';
import {
  getExercises,
  addExercise as addExerciseApi,
  removeExercise as removeExerciseApi,
  regenerateSpecificExercise as regenerateExerciseApi,
} from '@/services/learningPaths';
import { learningPathKeys } from '@/hooks/useLearningPaths';

export interface ExerciseCollectionState {
  exercises: LessonExercise[];
  isLoading: boolean;
  loadingExerciseId: string | null;
  expandedExerciseId: string | null;
  completedExerciseIds: Set<string>;
}

export interface UseExerciseCollectionProps {
  pathSlug: string;
  lessonOrder: number;
  initialContent: AILessonContent | undefined;
  onExerciseComplete?: (exerciseId: string) => void;
  onContentUpdate?: (exercises: LessonExercise[]) => void;
  /** Username for cache invalidation - required to invalidate the right query */
  username?: string;
}

export interface UseExerciseCollectionReturn {
  exercises: LessonExercise[];
  isLoading: boolean;
  loadingExerciseId: string | null;
  expandedExerciseId: string | null;
  completedExerciseIds: Set<string>;
  canAddMore: boolean;
  addExercise: (exerciseType?: LessonExercise['exerciseType']) => Promise<void>;
  removeExercise: (exerciseId: string) => Promise<void>;
  regenerateExercise: (exerciseId: string, newType?: LessonExercise['exerciseType']) => Promise<void>;
  markCompleted: (exerciseId: string) => void;
  setExpandedExerciseId: (id: string | null) => void;
}

const MAX_EXERCISES = 3;

export function useExerciseCollection({
  pathSlug,
  lessonOrder,
  initialContent,
  onExerciseComplete,
  onContentUpdate,
  username,
}: UseExerciseCollectionProps): UseExerciseCollectionReturn {
  const queryClient = useQueryClient();

  // Initialize state from content
  const [exercises, setExercises] = useState<LessonExercise[]>(() =>
    getExercises(initialContent)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingExerciseId, setLoadingExerciseId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(() =>
    // Auto-expand first exercise if there's only one
    exercises.length === 1 ? exercises[0]?.id || null : null
  );
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());

  // Helper to invalidate the learning path cache so refreshes get updated data
  const invalidatePathCache = useCallback(() => {
    if (username && pathSlug) {
      // Invalidate the specific learning path query
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.bySlug(username, pathSlug),
      });
      // Also invalidate the saved path query (for owner view)
      queryClient.invalidateQueries({
        queryKey: learningPathKeys.savedPath(pathSlug),
      });
    }
  }, [queryClient, username, pathSlug]);

  // Sync exercises when initialContent changes (e.g., after lesson regeneration)
  useEffect(() => {
    const newExercises = getExercises(initialContent);
    setExercises(newExercises);
    // Auto-expand first exercise if there's only one
    if (newExercises.length === 1) {
      setExpandedExerciseId(newExercises[0]?.id || null);
    }
  }, [initialContent]);

  const canAddMore = exercises.length < MAX_EXERCISES;

  // Add a new exercise
  const addExercise = useCallback(async (exerciseType?: LessonExercise['exerciseType']) => {
    if (!canAddMore) {
      toast.error('Maximum 3 exercises per lesson. Remove one to add another.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await addExerciseApi(pathSlug, lessonOrder, {
        exerciseType,
      });

      const newExercise = response.exercise;
      setExercises(prev => {
        const updated = [...prev, newExercise];
        onContentUpdate?.(updated);
        return updated;
      });

      // Expand the new exercise
      setExpandedExerciseId(newExercise.id);

      // Invalidate cache so page refresh shows updated exercises
      invalidatePathCache();

      toast.success('Exercise added!');
    } catch (error) {
      console.error('Failed to add exercise:', error);
      toast.error('Failed to add exercise. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canAddMore, pathSlug, lessonOrder, onContentUpdate, invalidatePathCache]);

  // Remove an exercise
  const removeExercise = useCallback(async (exerciseId: string) => {
    setLoadingExerciseId(exerciseId);
    try {
      await removeExerciseApi(pathSlug, lessonOrder, exerciseId);

      setExercises(prev => {
        const updated = prev.filter(ex => ex.id !== exerciseId);
        onContentUpdate?.(updated);
        return updated;
      });

      // If we were viewing this exercise, collapse it
      if (expandedExerciseId === exerciseId) {
        setExpandedExerciseId(null);
      }

      // Invalidate cache so page refresh shows updated exercises
      invalidatePathCache();

      toast.success('Exercise removed');
    } catch (error) {
      console.error('Failed to remove exercise:', error);
      toast.error('Failed to remove exercise. Please try again.');
    } finally {
      setLoadingExerciseId(null);
    }
  }, [pathSlug, lessonOrder, expandedExerciseId, onContentUpdate, invalidatePathCache]);

  // Regenerate a specific exercise
  const regenerateExercise = useCallback(async (
    exerciseId: string,
    newType?: LessonExercise['exerciseType']
  ) => {
    setLoadingExerciseId(exerciseId);
    try {
      const response = await regenerateExerciseApi(pathSlug, lessonOrder, {
        exerciseId,
        exerciseType: newType,
      });

      const updatedExercise = response.exercise;
      setExercises(prev => {
        const updated = prev.map(ex =>
          ex.id === exerciseId ? { ...updatedExercise, id: exerciseId } : ex
        );
        onContentUpdate?.(updated);
        return updated;
      });

      // Invalidate cache so page refresh shows updated exercises
      invalidatePathCache();

      toast.success('Exercise regenerated!');
    } catch (error) {
      console.error('Failed to regenerate exercise:', error);
      toast.error('Failed to regenerate exercise. Please try again.');
    } finally {
      setLoadingExerciseId(null);
    }
  }, [pathSlug, lessonOrder, onContentUpdate, invalidatePathCache]);

  // Mark an exercise as completed
  const markCompleted = useCallback((exerciseId: string) => {
    setCompletedExerciseIds(prev => {
      const updated = new Set(prev);
      updated.add(exerciseId);
      return updated;
    });
    onExerciseComplete?.(exerciseId);
  }, [onExerciseComplete]);

  return {
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
  };
}

export default useExerciseCollection;
