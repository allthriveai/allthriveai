/**
 * ExerciseRenderer - Central router for all exercise types
 * Routes to the appropriate exercise component based on exerciseType
 */

import { lazy, Suspense } from 'react';
import type { SkillLevel } from '@/services/personalization';
import type { LessonExercise } from '@/services/learningPaths';
import type { ExerciseStats } from './types';

// Lazy load exercise components for code splitting
const SortExercise = lazy(() => import('./SortExercise'));
const ConnectNodesExercise = lazy(() => import('./ConnectNodesExercise'));
const CodeWalkthroughExercise = lazy(() => import('./CodeWalkthroughExercise'));
const TimedChallengeExercise = lazy(() => import('./TimedChallengeExercise'));

// Import existing exercise components
import { SimulatedTerminal } from '../SimulatedTerminal';
import { CodeEditorExercise } from '../CodeEditorExercise';

interface ExerciseRendererProps {
  /** The exercise data */
  exercise: LessonExercise;
  /** User's current skill level for adaptive content */
  skillLevel: SkillLevel;
  /** Optional lesson identifier */
  lessonId?: string;
  /** Optional path slug for context */
  pathSlug?: string;
  /** Callback when exercise is completed */
  onComplete?: (stats: ExerciseStats) => void;
  /** Callback when user requests help from Sage */
  onAskForHelp?: () => void;
}

/** Loading fallback for lazy-loaded exercise components */
function ExerciseLoadingFallback() {
  return (
    <div className="p-6 rounded-lg bg-white/5 border border-white/10 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20" />
        <div className="h-5 w-32 bg-white/10 rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full bg-white/10 rounded" />
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="h-32 w-full bg-white/5 rounded-lg mt-4" />
      </div>
    </div>
  );
}

/**
 * ExerciseRenderer - Routes to the appropriate exercise component
 *
 * Handles both legacy exercise types (terminal, git, code, etc.) and
 * new interactive types (drag_sort, connect_nodes, code_walkthrough, timed_challenge)
 */
export function ExerciseRenderer({
  exercise,
  skillLevel,
  lessonId,
  pathSlug,
  onComplete,
  onAskForHelp,
}: ExerciseRendererProps) {
  // Common props for all exercise components
  const commonProps = {
    skillLevel,
    lessonId,
    pathSlug,
    onComplete,
    onAskForHelp,
  };

  // Route based on exercise type
  switch (exercise.exerciseType) {
    // =========================================================================
    // EXISTING EXERCISE TYPES
    // =========================================================================
    case 'terminal':
    case 'git':
    case 'ai_prompt':
    case 'code_review':
      return (
        <SimulatedTerminal
          // @ts-expect-error - Type mismatch between extended LessonExercise and legacy Exercise type
          exercise={exercise}
          {...commonProps}
        />
      );

    case 'code':
      return (
        <CodeEditorExercise
          // @ts-expect-error - Type mismatch between extended LessonExercise and legacy CodeExercise type
          exercise={exercise}
          {...commonProps}
        />
      );

    // =========================================================================
    // NEW INTERACTIVE EXERCISE TYPES
    // =========================================================================
    case 'drag_sort':
      if (!exercise.dragSortData) {
        console.error('SortExercise missing dragSortData');
        return <ExerciseMissingData type="drag_sort" />;
      }
      return (
        <Suspense fallback={<ExerciseLoadingFallback />}>
          <SortExercise
            // @ts-expect-error - exercise has dragSortData checked above
            exercise={exercise}
            {...commonProps}
          />
        </Suspense>
      );

    case 'connect_nodes':
      if (!exercise.connectNodesData) {
        console.error('ConnectNodesExercise missing connectNodesData');
        return <ExerciseMissingData type="connect_nodes" />;
      }
      return (
        <Suspense fallback={<ExerciseLoadingFallback />}>
          <ConnectNodesExercise
            // @ts-expect-error - exercise has connectNodesData checked above
            exercise={exercise}
            {...commonProps}
          />
        </Suspense>
      );

    case 'code_walkthrough':
      if (!exercise.codeWalkthroughData) {
        console.error('CodeWalkthroughExercise missing codeWalkthroughData');
        return <ExerciseMissingData type="code_walkthrough" />;
      }
      return (
        <Suspense fallback={<ExerciseLoadingFallback />}>
          <CodeWalkthroughExercise
            // @ts-expect-error - exercise has codeWalkthroughData checked above
            exercise={exercise}
            {...commonProps}
          />
        </Suspense>
      );

    case 'timed_challenge':
      if (!exercise.timedChallengeData) {
        console.error('TimedChallengeExercise missing timedChallengeData');
        return <ExerciseMissingData type="timed_challenge" />;
      }
      return (
        <Suspense fallback={<ExerciseLoadingFallback />}>
          <TimedChallengeExercise
            // @ts-expect-error - exercise has timedChallengeData checked above
            exercise={exercise}
            {...commonProps}
          />
        </Suspense>
      );

    // =========================================================================
    // FALLBACK
    // =========================================================================
    default: {
      const _exhaustiveCheck: never = exercise.exerciseType;
      console.warn(`Unknown exercise type: ${_exhaustiveCheck}`);
      return <ExerciseUnknownType type={String(_exhaustiveCheck)} />;
    }
  }
}

/** Error state for missing exercise data */
function ExerciseMissingData({ type }: { type: string }) {
  return (
    <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-center gap-3 text-amber-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-medium">Exercise data missing</span>
      </div>
      <p className="mt-2 text-sm text-amber-200/70">
        The {type} exercise is missing required data. Please try regenerating the lesson.
      </p>
    </div>
  );
}

/** Error state for unknown exercise type */
function ExerciseUnknownType({ type }: { type: string }) {
  return (
    <div className="p-6 rounded-lg bg-slate-500/10 border border-slate-500/30">
      <div className="flex items-center gap-3 text-slate-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">Unknown exercise type</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Exercise type "{type}" is not supported. This may be a newer exercise type that requires an app update.
      </p>
    </div>
  );
}

export default ExerciseRenderer;
