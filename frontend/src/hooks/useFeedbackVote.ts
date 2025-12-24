/**
 * useFeedbackVote - Hook for managing feedback vote state and actions
 *
 * Encapsulates all vote-related logic including optimistic updates and API calls.
 */

import { useState, useCallback, useEffect } from 'react';
import { toggleFeedbackVote } from '@/services/feedback';

interface UseFeedbackVoteOptions {
  itemId: number;
  initialVoted: boolean;
  initialCount: number;
  isAuthenticated: boolean;
}

interface UseFeedbackVoteResult {
  voted: boolean;
  voteCount: number;
  isVoting: boolean;
  toggleVote: () => Promise<void>;
}

export function useFeedbackVote({
  itemId,
  initialVoted,
  initialCount,
  isAuthenticated,
}: UseFeedbackVoteOptions): UseFeedbackVoteResult {
  const [voted, setVoted] = useState(initialVoted);
  const [voteCount, setVoteCount] = useState(initialCount);
  const [isVoting, setIsVoting] = useState(false);

  // Sync state when props change (e.g., after refetch)
  useEffect(() => {
    setVoted(initialVoted);
    setVoteCount(initialCount);
  }, [initialVoted, initialCount]);

  const toggleVote = useCallback(async () => {
    // Guard: require auth, prevent double-clicks, and require valid ID
    if (!isAuthenticated || isVoting || !itemId || itemId <= 0) return;

    setIsVoting(true);

    // Optimistic update
    const wasVoted = voted;
    setVoted(!wasVoted);
    setVoteCount((prev) => (wasVoted ? prev - 1 : prev + 1));

    try {
      const result = await toggleFeedbackVote(itemId);
      setVoted(result.voted);
      setVoteCount(result.voteCount);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle vote:', error);
      setVoted(wasVoted);
      setVoteCount((prev) => (wasVoted ? prev + 1 : prev - 1));
    } finally {
      setIsVoting(false);
    }
  }, [itemId, voted, isVoting, isAuthenticated]);

  return { voted, voteCount, isVoting, toggleVote };
}
