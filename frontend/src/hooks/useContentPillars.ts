/**
 * Content Engine Pillars Hook
 * US-017: useContentPillars hook for managing content pillars state
 */

import { useState, useEffect, useCallback } from 'react';
import { getContentPillars } from '@/services/contentEngine/pillars';
import type { ContentPillar } from '@/types/contentEngine';

interface UseContentPillarsReturn {
  pillars: ContentPillar[];
  isLoading: boolean;
  error: string | null;
  activePillar: ContentPillar | null;
  setActivePillar: (pillar: ContentPillar | null) => void;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage content pillars
 * Returns pillars list with active pillar selection state
 */
export function useContentPillars(): UseContentPillarsReturn {
  const [pillars, setPillars] = useState<ContentPillar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePillar, setActivePillar] = useState<ContentPillar | null>(null);

  const fetchPillars = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getContentPillars();
      setPillars(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load content pillars';
      setError(errorMessage);
      setPillars([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPillars();
  }, [fetchPillars]);

  return {
    pillars,
    isLoading,
    error,
    activePillar,
    setActivePillar,
    refetch: fetchPillars,
  };
}
