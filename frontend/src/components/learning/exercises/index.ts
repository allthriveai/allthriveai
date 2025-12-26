/**
 * Interactive Exercises - Export all exercise components and types
 */

// Main router component
export { ExerciseRenderer } from './ExerciseRenderer';

// Types
export * from './types';

// Primitives
export * from './primitives';

// Individual exercise components (lazy loaded in ExerciseRenderer)
// These are exported for direct use if needed
export { default as DragSortExercise } from './DragSortExercise';
export { default as ConnectNodesExercise } from './ConnectNodesExercise';
export { default as CodeWalkthroughExercise } from './CodeWalkthroughExercise';
export { default as TimedChallengeExercise } from './TimedChallengeExercise';
