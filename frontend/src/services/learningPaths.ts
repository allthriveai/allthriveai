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
 * AI-generated lesson content structure
 * Contains personalized learning material adapted to user's style and level
 */
export interface AILessonContent {
  /** 1-2 sentence hook explaining what the learner will understand */
  summary: string;
  /** List of 3-5 key terms/concepts covered */
  keyConcepts: string[];
  /** Full markdown explanation with formatting, code blocks, diagrams */
  explanation: string;
  /** Practical examples with optional code */
  examples?: Array<{
    title: string;
    description: string;
    code?: string;
  }>;
  /** A question or exercise for the learner to try */
  practicePrompt?: string;
  /** Optional mermaid diagram code for visual learners */
  mermaidDiagram?: string;
}

/**
 * Project info for related projects section
 */
export interface RelatedProject {
  id: string;
  title: string;
  slug: string;
  username: string;
  contentType: string;
  thumbnail: string;
  url: string;
  difficulty: string;
  description: string;
}

/**
 * Curriculum item in a generated learning path
 * Can be either curated content (video, article, etc.) or AI-generated lesson
 */
export interface CurriculumItem {
  order: number;
  type:
    | 'tool'
    | 'video'
    | 'article'
    | 'quiz'
    | 'game'
    | 'code-repo'
    | 'ai_lesson'
    | 'related_projects'
    | 'other';
  title: string;
  // For existing curated content
  projectId?: number;
  toolSlug?: string;
  quizId?: number;
  gameSlug?: string;
  url?: string;
  // For AI-generated lessons
  content?: AILessonContent;
  estimatedMinutes?: number;
  difficulty?: string;
  /** True if this item was AI-generated, false/undefined for curated content */
  generated?: boolean;
  /** For related_projects type - list of project cards to display */
  projects?: RelatedProject[];
}

/**
 * Generated learning path structure (stored in LearnerProfile.generated_path)
 */
export interface GeneratedLearningPath {
  id: string;
  slug: string;
  title: string;
  curriculum: CurriculumItem[];
  toolsCovered: string[];
  topicsCovered: string[];
  difficulty: string;
  estimatedHours: number;
  /** AI-generated cover image URL */
  coverImage?: string | null;
  /** Number of AI-generated lessons in the curriculum */
  aiLessonCount?: number;
  /** Number of curated content items in the curriculum */
  curatedCount?: number;
}

/**
 * Get a generated learning path by username and slug
 */
export async function getLearningPathBySlug(username: string, slug: string): Promise<GeneratedLearningPath> {
  const response = await api.get<GeneratedLearningPath>(`/users/${username}/learning-paths/${slug}/`);
  return response.data;
}

// =============================================================================
// SAVED LEARNING PATHS - Path Library APIs
// =============================================================================

/**
 * Saved learning path from the path library
 * Used for list views - lightweight version without full curriculum
 */
export interface SavedLearningPathListItem {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  estimatedHours: number;
  coverImage: string | null;
  isActive: boolean;
  curriculumCount: number;
  createdAt: string;
}

/**
 * Full saved learning path with curriculum
 */
export interface SavedLearningPath extends SavedLearningPathListItem {
  isArchived: boolean;
  curriculum: CurriculumItem[];
  aiLessonCount: number;
  curatedCount: number;
  updatedAt: string;
}

/**
 * Get all saved learning paths for the current user
 */
export async function getSavedPaths(): Promise<SavedLearningPathListItem[]> {
  const response = await api.get<SavedLearningPathListItem[]>('/me/saved-paths/');
  return response.data;
}

/**
 * Get a specific saved learning path by slug
 */
export async function getSavedPathBySlug(slug: string): Promise<SavedLearningPath> {
  const response = await api.get<SavedLearningPath>(`/me/saved-paths/${slug}/`);
  return response.data;
}

/**
 * Activate a saved learning path (makes it the current active path)
 */
export async function activateSavedPath(slug: string): Promise<SavedLearningPath> {
  const response = await api.post<SavedLearningPath>(`/me/saved-paths/${slug}/activate/`);
  return response.data;
}

/**
 * Delete (archive) a saved learning path
 */
export async function deleteSavedPath(slug: string): Promise<void> {
  await api.delete(`/me/saved-paths/${slug}/`);
}

/**
 * Get or generate an AI illustration for a lesson
 * Returns the image URL on success, null on failure
 */
export async function getLessonImage(pathSlug: string, lessonOrder: number): Promise<string | null> {
  try {
    const response = await api.get<{ imageUrl: string }>(
      `/me/saved-paths/${pathSlug}/lessons/${lessonOrder}/image/`
    );
    return response.data.imageUrl;
  } catch {
    return null;
  }
}
