/**
 * Hook for managing the active quest state
 * Provides the current in-progress quest and methods to interact with the quest tray
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getMySideQuests, abandonSideQuest, getQuestCategories } from '@/services/thriveCircle';
import { tailwindColorToHex, DEFAULT_QUEST_COLORS } from '@/utils/colors';
import type { UserSideQuest, QuestCategory } from '@/types/models';

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

  // Fetch categories for color lookup
  const { data: categories } = useQuery({
    queryKey: ['quest-categories'],
    queryFn: getQuestCategories,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Build a map of category slug to colors (converting Tailwind names to hex)
  const categoryColorMap = useMemo(() => {
    const map: Record<string, { colorFrom: string; colorTo: string }> = {};
    (categories || []).forEach((cat: QuestCategory) => {
      map[cat.slug] = {
        colorFrom: tailwindColorToHex(cat.colorFrom),
        colorTo: tailwindColorToHex(cat.colorTo)
      };
    });
    return map;
  }, [categories]);

  // Helper to get colors for a quest
  const getQuestColors = useCallback((quest: UserSideQuest | null) => {
    if (!quest?.sideQuest.categorySlug) {
      return DEFAULT_QUEST_COLORS;
    }
    return categoryColorMap[quest.sideQuest.categorySlug] || DEFAULT_QUEST_COLORS;
  }, [categoryColorMap]);

  // Get category info for a quest
  const getQuestCategory = useCallback((quest: UserSideQuest | null) => {
    if (!quest?.sideQuest.categorySlug) return null;
    return (categories || []).find((cat: QuestCategory) => cat.slug === quest.sideQuest.categorySlug) || null;
  }, [categories]);

  // Get the first in-progress guided quest as the "active" quest
  const activeQuest = (myQuests || []).find(
    (quest: UserSideQuest) =>
      quest.status === 'in_progress' && quest.sideQuest.isGuided
  ) || null;

  // Get colors and category for the active quest
  const activeQuestColors = useMemo(() => getQuestColors(activeQuest), [activeQuest, getQuestColors]);
  const activeQuestCategory = useMemo(() => getQuestCategory(activeQuest), [activeQuest, getQuestCategory]);

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

  // Abandon quest mutation
  const abandonQuestMutation = useMutation({
    mutationFn: (questId: string) => abandonSideQuest(questId),
    onSuccess: () => {
      // Close the tray and clear selection
      setQuestTrayOpen(false);
      setSelectedQuest(null);
      // Invalidate quest data
      queryClient.invalidateQueries({ queryKey: ['side-quests'] });
    },
    onError: (error) => {
      console.error('Failed to abandon quest:', error);
    },
  });

  // Abandon quest handler
  const abandonQuest = useCallback((questId: string) => {
    abandonQuestMutation.mutate(questId);
  }, [abandonQuestMutation]);

  return {
    // Active quest (first in-progress guided quest)
    activeQuest,
    hasActiveQuest: !!activeQuest,
    activeQuestColors,
    activeQuestCategory,

    // All in-progress quests
    inProgressQuests: (myQuests || []).filter(
      (quest: UserSideQuest) => quest.status === 'in_progress'
    ),

    // Quest tray state
    questTrayOpen,
    selectedQuest: selectedQuest || activeQuest,

    // Color helpers
    getQuestColors,
    getQuestCategory,
    categoryColorMap,

    // Actions
    openQuestTray,
    openActiveQuestTray,
    closeQuestTray,
    refreshQuest,
    abandonQuest,

    // Loading state
    isLoading,
    isAbandoningQuest: abandonQuestMutation.isPending,
  };
}
