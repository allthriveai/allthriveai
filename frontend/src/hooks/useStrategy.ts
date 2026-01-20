/**
 * Content Engine Strategy Hook
 * Fetches and caches user's content strategy for Echo coaching
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getStrategy, updateStrategy } from '@/services/contentEngine/strategy';
import type { Strategy, UpdateStrategyPayload } from '@/types/contentEngine';

interface UseStrategyReturn {
  strategy: Strategy | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch user's strategy
 * Returns null strategy if API fails (not authenticated or no strategy)
 */
export function useStrategy(): UseStrategyReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setStrategy(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getStrategy();
      setStrategy(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load strategy';
      setError(errorMessage);
      setStrategy(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchStrategy();
    }
  }, [isAuthLoading, fetchStrategy]);

  return {
    strategy,
    isLoading: isAuthLoading || isLoading,
    error,
    refetch: fetchStrategy,
  };
}

interface UseUpdateStrategyReturn {
  updateStrategy: (data: UpdateStrategyPayload) => Promise<Strategy>;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Hook for updating user's strategy
 */
export function useUpdateStrategy(): UseUpdateStrategyReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (data: UpdateStrategyPayload): Promise<Strategy> => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateStrategy(data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update strategy';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateStrategy: update,
    isUpdating,
    error,
  };
}
