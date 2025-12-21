/**
 * Learning Paths API Service
 */
import { api } from './api';
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

/**
 * Get all learning paths for the current user
 */
export async function getMyLearningPaths(): Promise<UserLearningPath[]> {
  const response = await api.get<UserLearningPath[]>('/me/learning-paths/');
  return response.data;
}

/**
 * Get detailed progress for a specific topic
 */
export async function getLearningPathDetail(topic: string): Promise<LearningPathDetail> {
  const response = await api.get<LearningPathDetail>(`/me/learning-paths/${topic}/`);
  return response.data;
}

/**
 * Get recommended topics for the user to explore
 */
export async function getLearningPathRecommendations(
  limit: number = 5
): Promise<TopicRecommendation[]> {
  const response = await api.get<TopicRecommendation[]>(
    '/me/learning-paths/recommendations/',
    { params: { limit } }
  );
  return response.data;
}

/**
 * Start a new learning path for a topic
 */
export async function startLearningPath(topic: string): Promise<UserLearningPath> {
  const response = await api.post<UserLearningPath>(
    `/me/learning-paths/${topic}/start/`
  );
  return response.data;
}

/**
 * Get learning paths for any user by username
 */
export async function getUserLearningPaths(username: string): Promise<UserLearningPath[]> {
  const response = await api.get<UserLearningPath[]>(
    `/users/${username}/learning-paths/`
  );
  return response.data;
}

/**
 * Get all available learning path topics
 */
export async function getAllTopics(): Promise<LearningPathTopic[]> {
  const response = await api.get<LearningPathTopic[]>('/learning-paths/topics/');
  return response.data;
}

// =============================================================================
// NEW LEARNING SYSTEM APIs
// =============================================================================

/**
 * Get the current user's learner profile
 */
export async function getLearnerProfile(): Promise<LearnerProfile> {
  const response = await api.get<LearnerProfile>('/me/learner-profile/');
  return response.data;
}

/**
 * Update the current user's learner profile
 */
export async function updateLearnerProfile(
  data: Partial<LearnerProfile>
): Promise<LearnerProfile> {
  const response = await api.patch<LearnerProfile>('/me/learner-profile/', data);
  return response.data;
}

/**
 * Get learning stats for the current user
 */
export async function getLearningStats(days: number = 30): Promise<LearningStats> {
  const response = await api.get<LearningStats>('/me/learning-stats/', {
    params: { days },
  });
  return response.data;
}

/**
 * Get all available concepts
 */
export async function getConcepts(topic?: string): Promise<Concept[]> {
  const response = await api.get<Concept[]>('/concepts/', {
    params: topic ? { topic } : {},
  });
  return response.data;
}

/**
 * Get user's concept mastery data
 */
export async function getConceptMastery(topic?: string): Promise<UserConceptMastery[]> {
  const response = await api.get<UserConceptMastery[]>('/me/concept-mastery/', {
    params: topic ? { topic } : {},
  });
  return response.data;
}

/**
 * Response types for specialized endpoints
 * These are exported for use in other components
 */
export interface DueReviewsResponse {
  reviewCount: number;
  reviews: Array<{
    concept: string;
    conceptSlug: string;
    topic: string;
    masteryLevel: string;
    daysOverdue: number;
    lastPracticed: string | null;
  }>;
  message: string;
}

export interface KnowledgeGapsResponse {
  gapCount: number;
  gaps: Array<{
    concept: string;
    conceptSlug: string;
    topic: string;
    masteryLevel: string;
    masteryScore: number;
    timesPracticed: number;
    accuracyPercentage: number;
    suggestion: string;
  }>;
  message: string;
}

// =============================================================================
// STRUCTURED LEARNING PATH APIs
// =============================================================================

/**
 * Get the user's personalized structured learning path with progress
 */
export async function getStructuredPath(): Promise<StructuredPath> {
  const response = await api.get<StructuredPath>('/me/structured-path/');
  return response.data;
}

/**
 * Complete the cold-start learning setup with a learning goal
 */
export async function completeLearningSetup(learningGoal: LearningGoal): Promise<StructuredPath> {
  const response = await api.post<StructuredPath>('/me/learning-setup/', {
    learning_goal: learningGoal,
  });
  return response.data;
}

/**
 * Reset the learning setup to allow re-selecting a learning goal
 */
export async function resetLearningSetup(): Promise<void> {
  await api.delete('/me/learning-setup/');
}

// =============================================================================
// GENERATED LEARNING PATH BY SLUG
// =============================================================================

/**
 * Curriculum item in a generated learning path
 */
export interface CurriculumItem {
  order: number;
  type: 'tool' | 'video' | 'article' | 'quiz' | 'game' | 'code-repo' | 'other';
  title: string;
  project_id?: number;
  tool_slug?: string;
  quiz_id?: number;
  game_slug?: string;
  url?: string;
}

/**
 * Generated learning path structure (stored in LearnerProfile.generated_path)
 */
export interface GeneratedLearningPath {
  id: string;
  slug: string;
  title: string;
  curriculum: CurriculumItem[];
  tools_covered: string[];
  topics_covered: string[];
  difficulty: string;
  estimated_hours: number;
}

/**
 * Get a generated learning path by its slug
 */
export async function getLearningPathBySlug(slug: string): Promise<GeneratedLearningPath> {
  const response = await api.get<GeneratedLearningPath>(`/learning-paths/${slug}/`);
  return response.data;
}
