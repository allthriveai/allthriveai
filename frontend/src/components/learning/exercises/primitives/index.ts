/**
 * Exercise Primitives - Reusable components and hooks for interactive exercises
 */

// Components
export { AnimatedContainer, AnimatedCard } from './AnimatedContainer';
export type { ContainerVariant, GlowColor } from './AnimatedContainer';

export {
  SuccessGlow,
  FloatingParticles,
  CheckmarkAnimation,
  useSuccessParticles,
  celebrationPresets,
} from './SuccessParticles';
export type { CelebrationType } from './SuccessParticles';

// Hooks
export {
  useExerciseState,
  useExerciseTimer,
  useStreakCounter,
} from './useExerciseState';
