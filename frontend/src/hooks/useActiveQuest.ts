/**
 * Hook for managing the active quest state
 * Provides the current in-progress quest and methods to interact with the quest tray
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getMySideQuests } from '@/services/thriveCircle';
import type { UserSideQuest } from '@/types/models';

export function useActiveQuest() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [questTrayOpen, setQuestTrayOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<UserSideQuest | null>(null);

  // Fetch user's in-progress quests
  const {
    data: myQuests,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['side-quests', 'my-quests'],
    queryFn: () => getMySideQuests(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Get the first in-progress guided quest as the "active" quest
  const activeQuest = (myQuests || []).find(
    (quest: UserSideQuest) =>
      quest.status === 'in_progress' && quest.sideQuest.isGuided
  ) || null;

  // Open the quest tray with a specific quest
  const openQuestTray = useCallback((quest: UserSideQuest) => {
    setSelectedQuest(quest);
    setQuestTrayOpen(true);
  }, []);

  // Open the quest tray with the active quest
  const openActiveQuestTray = useCallback(() => {
    if (activeQuest) {
      setSelectedQuest(activeQuest);
      setQuestTrayOpen(true);
    }
  }, [activeQuest]);

  // Close the quest tray
  const closeQuestTray = useCallback(() => {
    setQuestTrayOpen(false);
    // Don't clear selectedQuest immediately to allow for close animation
    setTimeout(() => setSelectedQuest(null), 300);
  }, []);

  // Refresh quest data
  const refreshQuest = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['side-quests'] });
  }, [refetch, queryClient]);

  return {
    // Active quest (first in-progress guided quest)
    activeQuest,
    hasActiveQuest: !!activeQuest,

    // All in-progress quests
    inProgressQuests: (myQuests || []).filter(
      (quest: UserSideQuest) => quest.status === 'in_progress'
    ),

    // Quest tray state
    questTrayOpen,
    selectedQuest: selectedQuest || activeQuest,

    // Actions
    openQuestTray,
    openActiveQuestTray,
    closeQuestTray,
    refreshQuest,

    // Loading state
    isLoading,
  };
}
