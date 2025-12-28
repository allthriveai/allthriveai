/**
 * React Query hooks for Admin Topics Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminTopicsService } from '@/services/adminTopics';
import type {
  Topic,
  TopicQueryParams,
  CreateTopicPayload,
  UpdateTopicPayload,
  BulkToggleActivePayload,
} from '@/types/adminTopics';

// Query keys
const QUERY_KEYS = {
  topics: ['admin-topics'] as const,
  topic: (id: number) => ['admin-topics', id] as const,
  stats: ['admin-topics-stats'] as const,
};

/**
 * Hook to fetch all topics with optional filters
 */
export function useTopics(params: TopicQueryParams = {}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.topics, params],
    queryFn: () => adminTopicsService.getTopics(params),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single topic by ID
 */
export function useTopic(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.topic(id),
    queryFn: () => adminTopicsService.getTopic(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch topic statistics
 */
export function useTopicStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats,
    queryFn: () => adminTopicsService.getStats(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to create a new topic
 */
export function useCreateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTopicPayload) => adminTopicsService.createTopic(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topics });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

/**
 * Hook to update a topic
 */
export function useUpdateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTopicPayload }) =>
      adminTopicsService.updateTopic(id, payload),
    onSuccess: (updatedTopic: Topic) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topics });
      queryClient.setQueryData(QUERY_KEYS.topic(updatedTopic.id), updatedTopic);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

/**
 * Hook to delete a topic
 */
export function useDeleteTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminTopicsService.deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topics });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

/**
 * Hook to bulk toggle active status for multiple topics
 */
export function useBulkToggleActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkToggleActivePayload) => adminTopicsService.bulkToggleActive(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topics });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}
