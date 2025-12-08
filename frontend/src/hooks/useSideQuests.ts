/**
 * Hook for managing Side Quests
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  getAvailableSideQuests,
  getMySideQuests,
  startSideQuest,
  updateSideQuestProgress,
  completeSideQuest,
  abandonSideQuest,
} from '@/services/thriveCircle';
import type { SideQuest, UserSideQuest } from '@/types/models';

export function useSideQuests() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Fetch available quests
  const {
    data: availableQuests,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['side-quests', 'available'],
    queryFn: () => getAvailableSideQuests(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch user's quests
  const {
    data: myQuests,
    isLoading: isLoadingMyQuests,
    error: myQuestsError,
  } = useQuery({
    queryKey: ['side-quests', 'my-quests'],
    queryFn: () => getMySideQuests(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  });

  // Start quest mutation
  const startQuestMutation = useMutation({
    mutationFn: (questId: string) => startSideQuest(questId),
    onSuccess: () => {
      // Invalidate both available and my quests
      queryClient.invalidateQueries({ queryKey: ['side-quests'] });
    },
    onError: (error) => {
      console.error('Failed to start quest:', error);
    },
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: ({ questId, increment }: { questId: string; increment?: number }) =>
      updateSideQuestProgress(questId, increment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['side-quests', 'my-quests'] });
    },
  });

  // Complete quest mutation
  const completeQuestMutation = useMutation({
    mutationFn: (questId: string) => completeSideQuest(questId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['side-quests'] });
      // Also invalidate Thrive Circle status to update lifetime stats
      queryClient.invalidateQueries({ queryKey: ['thrive-circle'] });
    },
  });

  // Abandon quest mutation
  const abandonQuestMutation = useMutation({
    mutationFn: (questId: string) => abandonSideQuest(questId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['side-quests'] });
    },
    onError: (error) => {
      console.error('Failed to abandon quest:', error);
    },
  });

  return {
    // Available quests
    availableQuests: (availableQuests || []) as SideQuest[],
    isLoading,
    error,

    // My quests
    myQuests: (myQuests || []) as UserSideQuest[],
    isLoadingMyQuests,
    myQuestsError,

    // Mutations
    startQuest: startQuestMutation.mutate,
    startQuestAsync: startQuestMutation.mutateAsync,
    isStartingQuest: startQuestMutation.isPending,
    startQuestSuccess: startQuestMutation.isSuccess,

    updateProgress: updateProgressMutation.mutate,
    isUpdatingProgress: updateProgressMutation.isPending,

    completeQuest: completeQuestMutation.mutate,
    isCompletingQuest: completeQuestMutation.isPending,

    abandonQuest: abandonQuestMutation.mutate,
    abandonQuestAsync: abandonQuestMutation.mutateAsync,
    isAbandoningQuest: abandonQuestMutation.isPending,
  };
}
