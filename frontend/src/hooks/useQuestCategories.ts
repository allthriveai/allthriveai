/**
 * Hook for managing Quest Categories
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  getQuestCategories,
  getQuestCategory,
  getAllCategoryProgress,
  getDailyQuests,
} from '@/services/thriveCircle';
import type { QuestCategory, QuestCategoryProgress, SideQuest } from '@/types/models';

export function useQuestCategories() {
  const { isAuthenticated } = useAuth();

  // Fetch all categories
  const {
    data: categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery({
    queryKey: ['quest-categories'],
    queryFn: getQuestCategories,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch progress for all categories
  const {
    data: categoryProgress,
    isLoading: isLoadingProgress,
    error: progressError,
  } = useQuery({
    queryKey: ['quest-categories', 'progress'],
    queryFn: getAllCategoryProgress,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  });

  // Fetch daily quests
  const {
    data: dailyQuests,
    isLoading: isLoadingDaily,
    error: dailyError,
  } = useQuery({
    queryKey: ['quest-categories', 'daily'],
    queryFn: getDailyQuests,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  });

  // Merge categories with their progress
  const categoriesWithProgress = (categories || []).map((category) => ({
    ...category,
    progress: categoryProgress?.[category.slug] || null,
  }));

  // Get featured categories
  const featuredCategories = categoriesWithProgress.filter((c) => c.isFeatured);

  return {
    categories: categoriesWithProgress as (QuestCategory & { progress: QuestCategoryProgress | null })[],
    featuredCategories,
    dailyQuests: (dailyQuests || []) as SideQuest[],
    isLoading: isLoadingCategories || isLoadingProgress,
    isLoadingDaily,
    error: categoriesError || progressError,
    dailyError,
  };
}

export function useQuestCategory(slug: string) {
  const { isAuthenticated } = useAuth();

  const {
    data: category,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['quest-categories', slug],
    queryFn: () => getQuestCategory(slug),
    enabled: isAuthenticated && !!slug,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  return {
    category: category as QuestCategory | undefined,
    isLoading,
    error,
  };
}
