/**
 * useExerciseState - Shared state management hook for all exercise types
 * Provides common state patterns for tracking attempts, hints, completion, etc.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { SkillLevel } from '@/services/personalization';
import type { ExerciseStats, ExerciseFeedback } from '../types';
import { getSkillConfig } from '../types';

interface UseExerciseStateOptions {
  /** User's skill level for adaptive behavior */
  skillLevel: SkillLevel;
  /** Available hints for this exercise */
  hints?: string[];
  /** Callback when exercise is completed */
  onComplete?: (stats: ExerciseStats) => void;
}

interface ExerciseState {
  /** Number of attempts made */
  attempts: number;
  /** Current hint index (number of hints revealed) */
  currentHintIndex: number;
  /** Whether the exercise is completed */
  isCompleted: boolean;
  /** Whether to show confetti celebration */
  showConfetti: boolean;
  /** Current feedback to display */
  feedback: ExerciseFeedback | null;
  /** Whether currently validating */
  isValidating: boolean;
}

export function useExerciseState({
  skillLevel,
  hints = [],
  onComplete,
}: UseExerciseStateOptions) {
  // Get skill level configuration
  const config = useMemo(() => getSkillConfig(skillLevel), [skillLevel]);

  // Start time for tracking duration
  const startTime = useRef(Date.now());

  // Exercise state
  const [state, setState] = useState<ExerciseState>({
    attempts: 0,
    currentHintIndex: 0,
    isCompleted: false,
    showConfetti: false,
    feedback: null,
    isValidating: false,
  });

  // Additional stats tracked separately
  const statsRef = useRef<Partial<ExerciseStats>>({});

  /** Maximum hints allowed based on skill level */
  const maxHints = Math.min(config.maxHints, hints.length);

  /** Get currently revealed hints */
  const revealedHints = hints.slice(0, state.currentHintIndex);

  /** Whether more hints are available */
  const hasMoreHints = state.currentHintIndex < maxHints;

  /** Increment attempts counter */
  const incrementAttempts = useCallback(() => {
    setState(prev => ({ ...prev, attempts: prev.attempts + 1 }));
  }, []);

  /** Reveal the next hint */
  const revealNextHint = useCallback(() => {
    if (state.currentHintIndex < maxHints) {
      setState(prev => ({ ...prev, currentHintIndex: prev.currentHintIndex + 1 }));
    }
  }, [maxHints, state.currentHintIndex]);

  /** Set feedback message */
  const setFeedback = useCallback((feedback: ExerciseFeedback | null) => {
    setState(prev => ({ ...prev, feedback }));
  }, []);

  /** Set validating state */
  const setIsValidating = useCallback((isValidating: boolean) => {
    setState(prev => ({ ...prev, isValidating }));
  }, []);

  /** Update additional stats */
  const updateStats = useCallback((stats: Partial<ExerciseStats>) => {
    statsRef.current = { ...statsRef.current, ...stats };
  }, []);

  /** Mark exercise as completed with success */
  const markCompleted = useCallback((additionalStats?: Partial<ExerciseStats>) => {
    const timeSpentMs = Date.now() - startTime.current;
    const isPerfect = state.attempts === 0 && state.currentHintIndex === 0;

    setState(prev => ({
      ...prev,
      isCompleted: true,
      showConfetti: config.showConfetti,
      feedback: {
        isCorrect: true,
        message: 'Great job!',
        showCelebration: config.showConfetti,
        celebrationType: isPerfect ? 'confetti' : 'glow',
      },
    }));

    // Build final stats
    const finalStats: ExerciseStats = {
      attempts: state.attempts + 1, // Include this attempt
      hintsUsed: state.currentHintIndex,
      timeSpentMs,
      perfectCompletion: isPerfect,
      ...statsRef.current,
      ...additionalStats,
    };

    // Callback to parent
    onComplete?.(finalStats);

    // Hide confetti after delay
    if (config.showConfetti) {
      setTimeout(() => {
        setState(prev => ({ ...prev, showConfetti: false }));
      }, 5000);
    }
  }, [state.attempts, state.currentHintIndex, config.showConfetti, onComplete]);

  /** Reset exercise to initial state */
  const reset = useCallback(() => {
    startTime.current = Date.now();
    statsRef.current = {};
    setState({
      attempts: 0,
      currentHintIndex: 0,
      isCompleted: false,
      showConfetti: false,
      feedback: null,
      isValidating: false,
    });
  }, []);

  /** Show wrong answer feedback */
  const showWrongFeedback = useCallback((message: string, explanation?: string) => {
    setFeedback({
      isCorrect: false,
      message,
      explanation,
      showCelebration: false,
      celebrationType: 'none',
    });
  }, [setFeedback]);

  /** Show success feedback without marking complete (for partial progress) */
  const showPartialSuccess = useCallback((message: string) => {
    setFeedback({
      isCorrect: true,
      message,
      showCelebration: false,
      celebrationType: 'glow',
    });
  }, [setFeedback]);

  return {
    // State
    ...state,
    revealedHints,
    hasMoreHints,
    maxHints,
    config,

    // Actions
    incrementAttempts,
    revealNextHint,
    setFeedback,
    setIsValidating,
    updateStats,
    markCompleted,
    reset,
    showWrongFeedback,
    showPartialSuccess,
  };
}

/**
 * useExerciseTimer - Timer hook for timed exercises
 */
interface UseExerciseTimerOptions {
  /** Total time in seconds */
  totalSeconds: number;
  /** Callback when time runs out */
  onTimeUp?: () => void;
  /** Whether to auto-start */
  autoStart?: boolean;
}

export function useExerciseTimer({
  totalSeconds,
  onTimeUp,
  autoStart = false,
}: UseExerciseTimerOptions) {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  // Keep callback ref up to date
  onTimeUpRef.current = onTimeUp;

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;

    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Clear interval directly to avoid stale closure
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    stop();
    setTimeRemaining(totalSeconds);
  }, [stop, totalSeconds]);

  const pause = useCallback(() => {
    stop();
  }, [stop]);

  const resume = useCallback(() => {
    if (timeRemaining > 0) {
      start();
    }
  }, [start, timeRemaining]);

  // Format time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Urgency level based on remaining time
  const urgencyLevel = useMemo(() => {
    const percentage = timeRemaining / totalSeconds;
    if (percentage <= 0.1) return 'critical';
    if (percentage <= 0.25) return 'high';
    if (percentage <= 0.5) return 'medium';
    return 'low';
  }, [timeRemaining, totalSeconds]);

  return {
    timeRemaining,
    formattedTime,
    isRunning,
    urgencyLevel,
    start,
    stop,
    reset,
    pause,
    resume,
  };
}

/**
 * useStreakCounter - Track correct answer streaks for game challenges
 */
export function useStreakCounter() {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);

  const incrementStreak = useCallback(() => {
    setCurrentStreak(prev => {
      const newStreak = prev + 1;
      setMaxStreak(max => Math.max(max, newStreak));

      // Update multiplier based on streak
      if (newStreak >= 10) setMultiplier(3);
      else if (newStreak >= 5) setMultiplier(2);
      else if (newStreak >= 3) setMultiplier(1.5);

      return newStreak;
    });
  }, []);

  const resetStreak = useCallback(() => {
    setCurrentStreak(0);
    setMultiplier(1);
  }, []);

  const reset = useCallback(() => {
    setCurrentStreak(0);
    setMaxStreak(0);
    setMultiplier(1);
  }, []);

  return {
    currentStreak,
    maxStreak,
    multiplier,
    incrementStreak,
    resetStreak,
    reset,
  };
}

export default useExerciseState;
