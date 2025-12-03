import { useState, useEffect } from 'react';
import { getMyAchievementProgress } from '@/services/achievements';
import { useAuth } from './useAuth';
import type { AchievementProgressData } from '@/types/achievements';

interface UseAchievementsReturn {
  achievementsByCategory: AchievementProgressData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user's achievement progress data
 * Only fetches when user is authenticated
 */
export function useAchievements(): UseAchievementsReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [achievementsByCategory, setAchievementsByCategory] = useState<AchievementProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setAchievementsByCategory(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getMyAchievementProgress();
      setAchievementsByCategory(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load achievements';
      setError(errorMessage);
      console.error('Failed to load achievements:', err);
      setAchievementsByCategory(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before deciding to fetch
    if (!isAuthLoading) {
      fetchAchievements();
    }
  }, [isAuthenticated, isAuthLoading]);

  return {
    achievementsByCategory,
    isLoading: isAuthLoading || isLoading,
    error,
    refetch: fetchAchievements,
  };
}
