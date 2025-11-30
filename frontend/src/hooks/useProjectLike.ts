/**
 * useProjectLike - Hook for managing project like state and actions
 *
 * Encapsulates all like-related logic including optimistic updates,
 * API calls, and celebration animations.
 */

import { useState, useCallback } from 'react';
import { useReward } from 'react-rewards';
import { toggleProjectLike } from '@/services/projects';

interface UseProjectLikeOptions {
  projectId: number;
  initialIsLiked: boolean;
  initialHeartCount: number;
  isAuthenticated: boolean;
  /** ID of the element to attach the reward animation to */
  rewardElementId?: string;
}

interface UseProjectLikeResult {
  isLiked: boolean;
  heartCount: number;
  isLiking: boolean;
  toggleLike: () => Promise<void>;
  /** The reward element ID for the like animation */
  rewardId: string;
}

export function useProjectLike({
  projectId,
  initialIsLiked,
  initialHeartCount,
  isAuthenticated,
  rewardElementId = 'likeReward',
}: UseProjectLikeOptions): UseProjectLikeResult {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [heartCount, setHeartCount] = useState(initialHeartCount);
  const [isLiking, setIsLiking] = useState(false);

  // Heart emoji celebration animation
  const { reward } = useReward(rewardElementId, 'emoji', {
    emoji: ['💗'],
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
  });

  const toggleLike = useCallback(async () => {
    if (!isAuthenticated || isLiking) return;

    setIsLiking(true);

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setHeartCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      const result = await toggleProjectLike(projectId);

      // Update with actual server values
      setIsLiked(result.liked);
      setHeartCount(result.heartCount);

      // Trigger celebration when liked
      if (result.liked) {
        reward();
      }
    } catch (error) {
      // Revert optimistic update on error
      console.error('Failed to toggle like:', error);
      setIsLiked(wasLiked);
      setHeartCount(prev => wasLiked ? prev + 1 : prev - 1);
    } finally {
      setIsLiking(false);
    }
  }, [projectId, isAuthenticated, isLiking, isLiked, reward]);

  return {
    isLiked,
    heartCount,
    isLiking,
    toggleLike,
    rewardId: rewardElementId,
  };
}
