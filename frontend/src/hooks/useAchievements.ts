import { useState, useEffect } from 'react';
import { getMyAchievementProgress } from '@/services/achievements';
import type { AchievementProgressData } from '@/types/achievements';

interface UseAchievementsReturn {
  achievementsByCategory: AchievementProgressData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user's achievement progress data
 */
export function useAchievements(): UseAchievementsReturn {
  const [achievementsByCategory, setAchievementsByCategory] = useState<AchievementProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = async () => {
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
    fetchAchievements();
  }, []);

  return {
    achievementsByCategory,
    isLoading,
    error,
    refetch: fetchAchievements,
  };
}
