/**
 * React Query hooks for Learning Paths
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyLearningPaths,
  getLearningPathDetail,
  getLearningPathRecommendations,
  startLearningPath,
  getUserLearningPaths,
  getAllTopics,
} from '@/services/learningPaths';
import type {
  UserLearningPath,
  LearningPathDetail,
  TopicRecommendation,
  LearningPathTopic,
} from '@/types/models';

// Query keys
export const learningPathKeys = {
  all: ['learningPaths'] as const,
  lists: () => [...learningPathKeys.all, 'list'] as const,
  list: (username?: string) => [...learningPathKeys.lists(), { username }] as const,
  details: () => [...learningPathKeys.all, 'detail'] as const,
  detail: (topic: string) => [...learningPathKeys.details(), topic] as const,
  recommendations: () => [...learningPathKeys.all, 'recommendations'] as const,
  topics: () => [...learningPathKeys.all, 'topics'] as const,
};

/**
 * Get current user's learning paths
 */
export function useMyLearningPaths() {
  return useQuery<UserLearningPath[], Error>({
    queryKey: learningPathKeys.list(),
    queryFn: getMyLearningPaths,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get detailed progress for a specific topic
 */
export function useLearningPathDetail(topic: string, enabled: boolean = true) {
  return useQuery<LearningPathDetail, Error>({
    queryKey: learningPathKeys.detail(topic),
    queryFn: () => getLearningPathDetail(topic),
    enabled: enabled && !!topic,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Get recommended topics for the user
 */
export function useLearningPathRecommendations(limit: number = 5) {
  return useQuery<TopicRecommendation[], Error>({
    queryKey: learningPathKeys.recommendations(),
    queryFn: () => getLearningPathRecommendations(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get learning paths for any user
 */
export function useUserLearningPaths(username: string, enabled: boolean = true) {
  return useQuery<UserLearningPath[], Error>({
    queryKey: learningPathKeys.list(username),
    queryFn: () => getUserLearningPaths(username),
    enabled: enabled && !!username,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get all available topics
 */
export function useAllTopics() {
  return useQuery<LearningPathTopic[], Error>({
    queryKey: learningPathKeys.topics(),
    queryFn: getAllTopics,
    staleTime: 1000 * 60 * 60, // 1 hour - topics rarely change
  });
}

/**
 * Start a new learning path
 */
export function useStartLearningPath() {
  const queryClient = useQueryClient();

  return useMutation<UserLearningPath, Error, string>({
    mutationFn: startLearningPath,
    onSuccess: () => {
      // Invalidate learning paths list
      queryClient.invalidateQueries({ queryKey: learningPathKeys.lists() });
      // Invalidate recommendations
      queryClient.invalidateQueries({ queryKey: learningPathKeys.recommendations() });
    },
  });
}
