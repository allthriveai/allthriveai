/**
 * Interactive Exercises - Export all exercise components and types
 */

// Main router component
export { ExerciseRenderer } from './ExerciseRenderer';

// Multiple exercises per lesson
export { ExerciseCollection } from './ExerciseCollection';
export { useExerciseCollection } from './ExerciseCollection/useExerciseCollection';
export { AddExerciseButton } from './ExerciseCollection/AddExerciseButton';

// Types
export * from './types';

// Primitives
export * from './primitives';

// Individual exercise components (lazy loaded in ExerciseRenderer)
// These are exported for direct use if needed
export { default as SortExercise } from './SortExercise';
export { default as ConnectNodesExercise } from './ConnectNodesExercise';
export { default as CodeWalkthroughExercise } from './CodeWalkthroughExercise';
export { default as TimedChallengeExercise } from './TimedChallengeExercise';
