/**
 * Content Engine Ideas Hooks
 * US-003: Ideas API service and hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  type IdeasListParams,
  type PaginatedIdeasResponse,
} from '@/services/contentEngine/ideas';
import type {
  ContentIdea,
  CreateIdeaPayload,
  UpdateIdeaPayload,
} from '@/types/contentEngine';

interface UseIdeasReturn {
  ideas: ContentIdea[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    count: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage ideas list
 */
export function useIdeas(params?: IdeasListParams): UseIdeasReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<PaginatedIdeasResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getIdeas(params);
      setData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ideas';
      setError(errorMessage);
      console.error('Failed to load ideas:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, params?.status, params?.platform, params?.search, params?.page, params?.pageSize]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchIdeas();
    }
  }, [isAuthLoading, fetchIdeas]);

  return {
    ideas: data?.results ?? [],
    isLoading: isAuthLoading || isLoading,
    error,
    pagination: {
      count: data?.count ?? 0,
      hasNext: !!data?.next,
      hasPrevious: !!data?.previous,
    },
    refetch: fetchIdeas,
  };
}

interface UseCreateIdeaReturn {
  createIdea: (data: CreateIdeaPayload) => Promise<ContentIdea>;
  isCreating: boolean;
  error: string | null;
}

/**
 * Hook for creating a new idea
 */
export function useCreateIdea(): UseCreateIdeaReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateIdeaPayload): Promise<ContentIdea> => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await createIdea(data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create idea';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createIdea: create,
    isCreating,
    error,
  };
}

interface UseUpdateIdeaReturn {
  updateIdea: (id: number, data: UpdateIdeaPayload) => Promise<ContentIdea>;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Hook for updating an existing idea
 */
export function useUpdateIdea(): UseUpdateIdeaReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (id: number, data: UpdateIdeaPayload): Promise<ContentIdea> => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateIdea(id, data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update idea';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateIdea: update,
    isUpdating,
    error,
  };
}

interface UseDeleteIdeaReturn {
  deleteIdea: (id: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

/**
 * Hook for deleting an idea
 */
export function useDeleteIdea(): UseDeleteIdeaReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (id: number): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteIdea(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete idea';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    deleteIdea: remove,
    isDeleting,
    error,
  };
}
