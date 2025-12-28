/**
 * useGameScore - Hook for submitting game scores and tracking points earned
 *
 * Handles score submission with automatic points calculation and optional celebration.
 */

import { useState, useCallback } from 'react';
import { submitGameScore, type GameType, type PointsAwarded, type GameScoreMetadata } from '@/services/games';
import { usePointsNotificationOptional } from '@/context/PointsNotificationContext';

interface UseGameScoreOptions {
  game: GameType;
  isAuthenticated: boolean;
  /** Called when points are awarded (for showing a celebration) */
  onPointsAwarded?: (points: PointsAwarded) => void;
}

interface UseGameScoreResult {
  /** Submit a score to the server */
  submitScore: (score: number, metadata?: GameScoreMetadata) => Promise<PointsAwarded | null>;
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Last points awarded (or null if no submission yet) */
  lastPointsAwarded: PointsAwarded | null;
  /** Any error from the last submission */
  error: string | null;
}

// Map game types to friendly display names
const gameDisplayNames: Record<GameType, string> = {
  context_snake: 'Context Snake',
  ethics_defender: 'Ethics Defender',
};

export function useGameScore({
  game,
  isAuthenticated,
  onPointsAwarded,
}: UseGameScoreOptions): UseGameScoreResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPointsAwarded, setLastPointsAwarded] = useState<PointsAwarded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pointsNotification = usePointsNotificationOptional();

  const submitScore = useCallback(
    async (score: number, metadata?: GameScoreMetadata): Promise<PointsAwarded | null> => {
      if (!isAuthenticated) {
        setError('Must be logged in to submit scores');
        return null;
      }

      if (isSubmitting) {
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await submitGameScore({
          game,
          score,
          metadata,
        });

        const points = result.pointsAwarded;
        setLastPointsAwarded(points);

        // Show points notification toast (for 10+ points)
        if (pointsNotification && points.total >= 10) {
          pointsNotification.showPointsNotification({
            points: points.total,
            title: 'Great Game!',
            message: `Score: ${score} in ${gameDisplayNames[game] || game}`,
            activityType: 'game_score',
          });
        }

        // Trigger celebration callback
        if (onPointsAwarded && points.total > 0) {
          onPointsAwarded(points);
        }

        return points;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit score';
        setError(message);
        console.error('Failed to submit game score:', err);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [game, isAuthenticated, isSubmitting, onPointsAwarded, pointsNotification]
  );

  return {
    submitScore,
    isSubmitting,
    lastPointsAwarded,
    error,
  };
}
