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
  getLearnerProfile,
  updateLearnerProfile,
  getLearningStats,
  getConcepts,
  getConceptMastery,
  getStructuredPath,
  completeLearningSetup,
  resetLearningSetup,
  getLearningPathBySlug,
} from '@/services/learningPaths';
import type { GeneratedLearningPath } from '@/services/learningPaths';
import type {
  UserLearningPath,
  LearningPathDetail,
  TopicRecommendation,
  LearningPathTopic,
  LearnerProfile,
  Concept,
  UserConceptMastery,
  LearningStats,
  StructuredPath,
  LearningGoal,
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
  // New learning system keys
  learnerProfile: () => [...learningPathKeys.all, 'learnerProfile'] as const,
  learningStats: (days?: number) => [...learningPathKeys.all, 'stats', { days }] as const,
  concepts: (topic?: string) => [...learningPathKeys.all, 'concepts', { topic }] as const,
  conceptMastery: (topic?: string) => [...learningPathKeys.all, 'mastery', { topic }] as const,
  // Structured path keys
  structuredPath: () => [...learningPathKeys.all, 'structuredPath'] as const,
  // Generated learning path by slug
  bySlug: (slug: string) => [...learningPathKeys.all, 'bySlug', slug] as const,
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

// =============================================================================
// NEW LEARNING SYSTEM HOOKS
// =============================================================================

/**
 * Get current user's learner profile
 */
export function useLearnerProfile(enabled: boolean = true) {
  return useQuery<LearnerProfile, Error>({
    queryKey: learningPathKeys.learnerProfile(),
    queryFn: getLearnerProfile,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update learner profile
 */
export function useUpdateLearnerProfile() {
  const queryClient = useQueryClient();

  return useMutation<LearnerProfile, Error, Partial<LearnerProfile>>({
    mutationFn: updateLearnerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningPathKeys.learnerProfile() });
    },
  });
}

/**
 * Get learning stats for the current user
 */
export function useLearningStats(days: number = 30, enabled: boolean = true) {
  return useQuery<LearningStats, Error>({
    queryKey: learningPathKeys.learningStats(days),
    queryFn: () => getLearningStats(days),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get all available concepts
 */
export function useConcepts(topic?: string, enabled: boolean = true) {
  return useQuery<Concept[], Error>({
    queryKey: learningPathKeys.concepts(topic),
    queryFn: () => getConcepts(topic),
    enabled,
    staleTime: 1000 * 60 * 30, // 30 minutes - concepts rarely change
  });
}

/**
 * Get user's concept mastery
 */
export function useConceptMastery(topic?: string, enabled: boolean = true) {
  return useQuery<UserConceptMastery[], Error>({
    queryKey: learningPathKeys.conceptMastery(topic),
    queryFn: () => getConceptMastery(topic),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes - mastery changes more frequently
  });
}

// =============================================================================
// STRUCTURED LEARNING PATH HOOKS
// =============================================================================

/**
 * Get user's personalized structured learning path with progress
 */
export function useStructuredPath(enabled: boolean = true) {
  return useQuery<StructuredPath, Error>({
    queryKey: learningPathKeys.structuredPath(),
    queryFn: getStructuredPath,
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Complete learning setup (cold-start) with a learning goal
 */
export function useCompleteLearningSetup() {
  const queryClient = useQueryClient();

  return useMutation<StructuredPath, Error, LearningGoal>({
    mutationFn: completeLearningSetup,
    onSuccess: () => {
      // Invalidate structured path to get the newly generated path
      queryClient.invalidateQueries({ queryKey: learningPathKeys.structuredPath() });
      // Also invalidate learner profile as it may have been updated
      queryClient.invalidateQueries({ queryKey: learningPathKeys.learnerProfile() });
    },
  });
}

/**
 * Reset learning setup to allow re-selecting a learning goal
 */
export function useResetLearningSetup() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: resetLearningSetup,
    onSuccess: () => {
      // Invalidate structured path to reflect reset state
      queryClient.invalidateQueries({ queryKey: learningPathKeys.structuredPath() });
      // Also invalidate learner profile
      queryClient.invalidateQueries({ queryKey: learningPathKeys.learnerProfile() });
    },
  });
}

// =============================================================================
// GENERATED LEARNING PATH BY SLUG
// =============================================================================

/**
 * Get a generated learning path by its slug
 */
export function useLearningPathBySlug(slug: string, enabled: boolean = true) {
  return useQuery<GeneratedLearningPath, Error>({
    queryKey: learningPathKeys.bySlug(slug),
    queryFn: () => getLearningPathBySlug(slug),
    enabled: enabled && !!slug,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
