/**
 * Content Engine Schedule Hooks
 * US-006: Schedule API service and hooks
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  getSchedule,
  getCalendarData,
  createScheduledPost,
  updateScheduledPost,
  deleteScheduledPost,
  groupByDay,
  type ScheduleListParams,
  type PaginatedScheduleResponse,
  type ScheduleByDay,
} from '@/services/contentEngine/schedule';
import type {
  ScheduledPost,
  CreateSchedulePayload,
  UpdateSchedulePayload,
} from '@/types/contentEngine';

interface UseScheduleReturn {
  posts: ScheduledPost[];
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
 * Hook to fetch and manage scheduled posts list
 */
export function useSchedule(params?: ScheduleListParams): UseScheduleReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<PaginatedScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getSchedule(params);
      setData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load schedule';
      setError(errorMessage);
      console.error('Failed to load schedule:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, params?.startDate, params?.endDate, params?.platform, params?.status, params?.page, params?.pageSize]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchSchedule();
    }
  }, [isAuthLoading, fetchSchedule]);

  return {
    posts: data?.results ?? [],
    isLoading: isAuthLoading || isLoading,
    error,
    pagination: {
      count: data?.count ?? 0,
      hasNext: !!data?.next,
      hasPrevious: !!data?.previous,
    },
    refetch: fetchSchedule,
  };
}

interface UseScheduleByDayReturn {
  schedule: ScheduleByDay;
  posts: ScheduledPost[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch schedule grouped by day for calendar view
 */
export function useScheduleByDay(startDate: string, endDate: string): UseScheduleByDayReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setPosts([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getCalendarData(startDate, endDate);
      setPosts(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load calendar';
      setError(errorMessage);
      console.error('Failed to load calendar:', err);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, startDate, endDate]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchCalendarData();
    }
  }, [isAuthLoading, fetchCalendarData]);

  const schedule = useMemo(() => groupByDay(posts), [posts]);

  return {
    schedule,
    posts,
    isLoading: isAuthLoading || isLoading,
    error,
    refetch: fetchCalendarData,
  };
}

interface UseCreateScheduleReturn {
  createSchedule: (data: CreateSchedulePayload) => Promise<ScheduledPost>;
  isCreating: boolean;
  error: string | null;
}

/**
 * Hook for creating a scheduled post
 */
export function useCreateSchedule(): UseCreateScheduleReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateSchedulePayload): Promise<ScheduledPost> => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await createScheduledPost(data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create schedule';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createSchedule: create,
    isCreating,
    error,
  };
}

interface UseUpdateScheduleReturn {
  updateSchedule: (id: number, data: UpdateSchedulePayload) => Promise<ScheduledPost>;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Hook for updating a scheduled post
 */
export function useUpdateSchedule(): UseUpdateScheduleReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (id: number, data: UpdateSchedulePayload): Promise<ScheduledPost> => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateScheduledPost(id, data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update schedule';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateSchedule: update,
    isUpdating,
    error,
  };
}

interface UseDeleteScheduleReturn {
  deleteSchedule: (id: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

/**
 * Hook for deleting a scheduled post
 */
export function useDeleteSchedule(): UseDeleteScheduleReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (id: number): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteScheduledPost(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete schedule';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    deleteSchedule: remove,
    isDeleting,
    error,
  };
}
