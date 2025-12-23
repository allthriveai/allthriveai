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

// =============================================================================
// ADMIN LESSON MANAGEMENT APIs
// =============================================================================

/**
 * Lesson metadata for admin management
 */
export interface LessonMetadata {
  id: number;
  projectId: number;
  projectTitle: string;
  projectSlug: string;
  authorUsername: string;
  isLesson: boolean;
  isLearningEligible: boolean;
  learningQualityScore: number | null;
  complexityLevel: string;
  learningSummary: string;
  keyTechniques: string[];
  positiveRatings: number;
  negativeRatings: number;
  ratingQualityScore: number;
  timesUsedForLearning: number;
}

/**
 * Lesson rating from a user
 */
export interface LessonRating {
  id: number;
  projectId: number;
  rating: 'helpful' | 'not_helpful';
  feedback: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated response for admin endpoints
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Get all lesson metadata for admin (paginated)
 */
export async function getAdminLessons(params?: {
  page?: number;
  pageSize?: number;
  isLesson?: boolean;
  search?: string;
  ordering?: string;
}): Promise<PaginatedResponse<LessonMetadata>> {
  const response = await api.get<PaginatedResponse<LessonMetadata>>(
    '/admin/learning/lessons/',
    { params }
  );
  return response.data;
}

/**
 * Update lesson metadata (mark/unmark as lesson)
 */
export async function updateLessonMetadata(
  metadataId: number,
  data: Partial<Pick<LessonMetadata, 'isLesson' | 'complexityLevel' | 'learningSummary'>>
): Promise<LessonMetadata> {
  const response = await api.patch<LessonMetadata>(
    `/admin/learning/lessons/${metadataId}/`,
    data
  );
  return response.data;
}

/**
 * Bulk mark projects as lessons
 */
export async function bulkMarkAsLessons(metadataIds: number[]): Promise<{ updated: number }> {
  const response = await api.post<{ updated: number }>(
    '/admin/learning/lessons/bulk-mark/',
    { ids: metadataIds }
  );
  return response.data;
}

/**
 * Bulk unmark projects as lessons
 */
export async function bulkUnmarkAsLessons(metadataIds: number[]): Promise<{ updated: number }> {
  const response = await api.post<{ updated: number }>(
    '/admin/learning/lessons/bulk-unmark/',
    { ids: metadataIds }
  );
  return response.data;
}

/**
 * Get lesson ratings for a specific lesson
 */
export async function getLessonRatings(projectId: number): Promise<LessonRating[]> {
  const response = await api.get<LessonRating[]>(
    `/admin/learning/lessons/${projectId}/ratings/`
  );
  return response.data;
}

/**
 * Get lesson library stats
 */
export interface LessonStats {
  totalLessons: number;
  aiGeneratedLessons: number;
  curatedLessons: number;
  totalRatings: number;
  averageRating: number;
  topRatedLessons: LessonMetadata[];
}

export async function getLessonStats(): Promise<LessonStats> {
  const response = await api.get<LessonStats>('/admin/learning/lessons/stats/');
  return response.data;
}

/**
 * AI Lesson from saved learning path (for admin view)
 */
export interface AILessonMetadata {
  id: string;
  pathId: number;
  pathSlug: string;
  pathTitle: string;
  order: number;
  title: string;
  summary: string;
  keyConcepts: string[];
  difficulty: string;
  estimatedMinutes: number;
  username: string;
  createdAt: string;
  hasExamples: boolean;
  hasDiagram: boolean;
  hasPracticePrompt: boolean;
}

/**
 * Get all AI-generated lessons from saved learning paths (admin only)
 */
export async function getAdminAILessons(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResponse<AILessonMetadata>> {
  const response = await api.get<PaginatedResponse<AILessonMetadata>>(
    '/admin/learning/lessons/ai-lessons/',
    { params }
  );
  return response.data;
}

/**
 * Full AI lesson content for editing
 */
export interface AILessonFullContent {
  id: string;
  pathId: number;
  pathSlug: string;
  pathTitle: string;
  order: number;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  username: string;
  createdAt: string;
  summary: string;
  keyConcepts: string[];
  explanation: string;
  practicePrompt?: string;
  mermaidDiagram?: string;
  examples?: Array<{
    title: string;
    description: string;
    code?: string;
  }>;
}

/**
 * Get a single AI lesson with full content for editing (admin only)
 */
export async function getAdminAILessonDetail(pathId: number, order: number): Promise<AILessonFullContent> {
  const response = await api.get<AILessonFullContent>(
    `/admin/learning/lessons/ai-lessons/${pathId}/${order}/detail/`
  );
  return response.data;
}

/**
 * Update an AI lesson (admin only)
 */
export async function updateAdminAILesson(
  pathId: number,
  order: number,
  data: Partial<{
    title: string;
    difficulty: string;
    estimatedMinutes: number;
    summary: string;
    keyConcepts: string[];
    explanation: string;
    practicePrompt: string;
    mermaidDiagram: string;
    examples: Array<{ title: string; description: string; code?: string }>;
  }>
): Promise<AILessonMetadata> {
  const response = await api.patch<AILessonMetadata>(
    `/admin/learning/lessons/ai-lessons/${pathId}/${order}/`,
    data
  );
  return response.data;
}

// =============================================================================
// LESSON RATING APIs (User-facing)
// =============================================================================

/**
 * Rate a lesson as helpful or not helpful
 */
export async function rateLesson(
  projectId: number,
  rating: 'helpful' | 'not_helpful',
  feedback?: string
): Promise<LessonRating> {
  const response = await api.post<LessonRating>(`/lessons/${projectId}/rate/`, {
    rating,
    feedback: feedback || '',
  });
  return response.data;
}

/**
 * Get the current user's rating for a lesson (if any)
 */
export async function getMyLessonRating(projectId: number): Promise<LessonRating | null> {
  try {
    const response = await api.get<LessonRating>(`/lessons/${projectId}/rate/`);
    return response.data;
  } catch {
    return null;
  }
}
