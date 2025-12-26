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
import type { SkillLevel } from './personalization';

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

/**
 * Exercise content adapted to different skill levels
 */
export interface ExerciseContentByLevel {
  instructions: string;
  commandHint?: string;
  hints: string[];
}

/**
 * Interactive exercise for "Try It Yourself" sections
 */
export interface LessonExercise {
  exerciseType:
    | 'terminal'
    | 'git'
    | 'ai_prompt'
    | 'code_review'
    | 'code'
    // New interactive exercise types
    | 'drag_sort'
    | 'connect_nodes'
    | 'code_walkthrough'
    | 'timed_challenge';
  scenario: string;
  expectedInputs: string[]; // Regex patterns for validation (terminal/git)
  expectedPatterns?: string[]; // Regex patterns for code exercises
  successMessage: string;
  expectedOutput: string;
  /** Language for code exercises */
  language?: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
  /** Starter code for code exercises */
  starterCode?: string;
  contentByLevel: Record<SkillLevel, ExerciseContentByLevel>;

  // New interactive exercise data (only one populated based on exerciseType)
  /** Data for drag_sort exercise type */
  dragSortData?: DragSortExerciseData;
  /** Data for connect_nodes exercise type */
  connectNodesData?: ConnectNodesExerciseData;
  /** Data for code_walkthrough exercise type */
  codeWalkthroughData?: CodeWalkthroughExerciseData;
  /** Data for timed_challenge exercise type */
  timedChallengeData?: TimedChallengeExerciseData;
}

// =============================================================================
// NEW INTERACTIVE EXERCISE DATA TYPES
// =============================================================================

/** Drag and sort exercise data */
export interface DragSortExerciseData {
  variant: 'sequence' | 'match' | 'categorize';
  items: Array<{
    id: string;
    content: string;
    code?: string;
    codeLanguage?: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
    category?: string;
  }>;
  correctOrder?: string[];
  correctMatches?: Record<string, string>;
  categories?: Array<{ id: string; label: string; description?: string }>;
  correctCategories?: Record<string, string>;
  showImmediateFeedback?: boolean;
}

/** Connect nodes exercise data */
export interface ConnectNodesExerciseData {
  nodes: Array<{
    id: string;
    label: string;
    position: { x: number; y: number };
    nodeType: 'concept' | 'action' | 'data' | 'decision' | 'start' | 'end';
    isFixed?: boolean;
    side?: 'left' | 'right' | 'any';
  }>;
  expectedConnections: Array<{ fromId: string; toId: string; label?: string }>;
  presetConnections?: Array<{ fromId: string; toId: string; label?: string }>;
  showConnectionHints?: boolean;
  oneToOne?: boolean;
}

/** Code walkthrough exercise data */
export interface CodeWalkthroughExerciseData {
  code: string;
  language: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
  steps: Array<{
    stepNumber: number;
    highlightLines: number[];
    explanation: string;
    annotation?: {
      line: number;
      text: string;
      type: 'info' | 'important' | 'warning';
    };
    question?: {
      prompt: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    };
  }>;
  autoAdvanceMs?: number;
  showVariablePanel?: boolean;
  variableStates?: Record<number, Record<string, string>>;
}

/** Timed challenge exercise data */
export interface TimedChallengeExerciseData {
  questions: Array<{
    id: string;
    question: string;
    code?: string;
    codeLanguage?: 'python' | 'javascript' | 'typescript';
    options: string[];
    correctAnswer: string;
    points: number;
    timeLimitSeconds?: number;
    explanation?: string;
  }>;
  totalTimeSeconds?: number;
  defaultTimePerQuestion?: number;
  passingScore: number;
  maxScore: number;
  lives?: number;
  showCorrectOnWrong?: boolean;
  enableStreakMultiplier?: boolean;
}

/**
 * Single quiz question for knowledge check
 */
export interface QuizQuestion {
  id: string;
  question: string;
  questionType: 'multiple_choice' | 'true_false';
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  hint?: string;
}

/**
 * Inline quiz for checking understanding at the end of a lesson
 */
export interface LessonQuiz {
  questions: QuizQuestion[];
  passingScore: number;
  encouragementMessage: string;
  retryMessage: string;
}

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
  /** Interactive exercise for hands-on practice */
  exercise?: LessonExercise;
  /** Inline quiz to check understanding */
  quiz?: LessonQuiz;
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
  isPublished: boolean;
  curriculumCount: number;
  createdAt: string;
}

/**
 * Full saved learning path with curriculum
 */
export interface SavedLearningPath extends SavedLearningPathListItem {
  isArchived: boolean;
  publishedAt: string | null;
  curriculum: CurriculumItem[];
  topicsCovered: string[];
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
 * Publish a saved learning path to the explore feed
 */
export async function publishSavedPath(slug: string): Promise<SavedLearningPath> {
  const response = await api.post<SavedLearningPath>(`/me/saved-paths/${slug}/publish/`);
  return response.data;
}

/**
 * Unpublish a saved learning path from the explore feed
 */
export async function unpublishSavedPath(slug: string): Promise<SavedLearningPath> {
  const response = await api.delete<SavedLearningPath>(`/me/saved-paths/${slug}/publish/`);
  return response.data;
}

// =============================================================================
// EXPLORE LEARNING PATHS - Public APIs
// =============================================================================

/**
 * Public learning path for explore feed
 */
/**
 * Curriculum item preview (title and type only, for explore feed)
 */
export interface CurriculumPreviewItem {
  title: string;
  type: string;
}

export interface PublicLearningPath {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  estimatedHours: number;
  coverImage: string | null;
  curriculumCount: number;
  curriculumPreview: CurriculumPreviewItem[];
  topicsCovered: string[];
  username: string;
  userFullName: string;
  userAvatarUrl: string | null;
  publishedAt: string;
  createdAt: string;
}

/**
 * Paginated response for explore endpoint
 */
export interface ExploreLearningPathsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PublicLearningPath[];
}

/**
 * Get published learning paths for the explore feed
 */
export async function getExploreLearningPaths(params?: {
  page?: number;
  difficulty?: string;
  search?: string;
}): Promise<ExploreLearningPathsResponse> {
  const response = await api.get<ExploreLearningPathsResponse>(
    '/explore/learning-paths/',
    { params }
  );
  return response.data;
}

// =============================================================================
// EXPLORE LESSONS - Public APIs for individual AI lessons
// =============================================================================

/**
 * Public lesson for explore feed
 * Individual AI-generated lessons from published learning paths
 */
export interface PublicLesson {
  id: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  difficulty: string;
  estimatedMinutes: number;
  lessonType: string;
  pathId: number;
  pathSlug: string;
  pathTitle: string;
  pathUsername: string;  // Actual path owner for URL navigation
  username: string;      // Display username (Sage for AI lessons)
  userFullName: string;
  userAvatarUrl: string | null;
  lessonOrder: number;
  lessonSlug: string;
  publishedAt: string;
}

/**
 * Paginated response for explore lessons endpoint
 */
export interface ExploreLessonsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PublicLesson[];
}

/**
 * Get published AI lessons for the explore feed
 */
export async function getExploreLessons(params?: {
  page?: number;
  search?: string;
}): Promise<ExploreLessonsResponse> {
  const response = await api.get<ExploreLessonsResponse>(
    '/explore/lessons/',
    { params }
  );
  return response.data;
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

// =============================================================================
// ADMIN LEARNING PATH MANAGEMENT
// =============================================================================

export interface AddProjectResponse {
  status: string;
  project: {
    id: number;
    title: string;
    slug: string;
    description: string;
    thumbnailUrl: string;
    username: string;
    userAvatarUrl: string;
    category: string;
    viewCount: number;
    likeCount: number;
  };
  totalProjects: number;
}

/**
 * Admin: Add a project to a learning path's community section
 */
export async function adminAddProjectToPath(
  pathId: number,
  projectId: number
): Promise<AddProjectResponse> {
  const response = await api.post<AddProjectResponse>(
    `/admin/learning-paths/${pathId}/add-project/`,
    { projectId }
  );
  return response.data;
}

/**
 * Admin: Remove a project from a learning path's community section
 */
export async function adminRemoveProjectFromPath(
  pathId: number,
  projectId: number
): Promise<{ status: string; projectId: number; totalProjects: number }> {
  const response = await api.delete(
    `/admin/learning-paths/${pathId}/add-project/`,
    { data: { projectId } }
  );
  return response.data;
}

// =============================================================================
// LESSON PROGRESS TRACKING APIs
// =============================================================================

/**
 * Individual lesson progress info
 */
export interface LessonProgressInfo {
  lessonOrder: number;
  title: string;
  isCompleted: boolean;
  exerciseCompleted: boolean;
  quizCompleted: boolean;
  completedAt: string | null;
}

/**
 * Overall progress for a learning path
 */
export interface PathProgress {
  pathId: number;
  pathTitle: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  lessons: LessonProgressInfo[];
}

/**
 * Response from completing an exercise or quiz
 */
export interface CompletionResponse {
  lessonOrder: number;
  lessonTitle: string;
  isCompleted: boolean;
  exerciseCompleted: boolean;
  quizCompleted: boolean;
  quizScore?: number;
  completedAt: string | null;
  justCompleted: boolean;
  overallProgress: {
    completedCount: number;
    totalCount: number;
    percentage: number;
  };
}

/**
 * Get progress for all lessons in a learning path
 */
export async function getLessonProgress(pathId: number): Promise<PathProgress> {
  const response = await api.get<PathProgress>(`/learning-paths/${pathId}/progress/`);
  return response.data;
}

/**
 * Mark a lesson's exercise as completed
 */
export async function completeExercise(pathId: number, lessonOrder: number): Promise<CompletionResponse> {
  const response = await api.post<CompletionResponse>(
    `/learning-paths/${pathId}/lessons/${lessonOrder}/complete-exercise/`
  );
  return response.data;
}

/**
 * Mark a lesson's quiz as completed
 */
export async function completeQuiz(
  pathId: number,
  lessonOrder: number,
  score?: number
): Promise<CompletionResponse> {
  const response = await api.post<CompletionResponse>(
    `/learning-paths/${pathId}/lessons/${lessonOrder}/complete-quiz/`,
    score !== undefined ? { score } : {}
  );
  return response.data;
}

// =============================================================================
// LESSON & EXERCISE REGENERATION APIs
// =============================================================================

/**
 * Request body for regenerating a lesson
 */
export interface RegenerateLessonRequest {
  focus?: string; // "I want more hands-on examples"
  reason?: string; // "The current explanation is too abstract"
}

/**
 * Request body for regenerating an exercise
 */
export interface RegenerateExerciseRequest {
  exerciseType: 'terminal' | 'code' | 'ai_prompt';
}

/**
 * Response from lesson regeneration
 */
export interface RegenerateLessonResponse {
  success: boolean;
  lesson: {
    order: number;
    title: string;
    content: AILessonContent;
  };
}

/**
 * Response from exercise regeneration
 */
export interface RegenerateExerciseResponse {
  success: boolean;
  exercise: LessonExercise;
}

// =============================================================================
// CODE VALIDATION APIs
// =============================================================================

/**
 * Code languages supported by the code editor exercise
 */
export type CodeLanguage = 'python' | 'javascript' | 'typescript' | 'html' | 'css';

/**
 * Single issue from code validation
 */
export interface CodeFeedbackIssue {
  type: 'error' | 'warning' | 'suggestion';
  line?: number;
  message: string;
  explanation?: string;
  hint?: string;
}

/**
 * Request body for code validation
 */
export interface ValidateCodeRequest {
  code: string;
  language: CodeLanguage;
  expectedPatterns: string[];
  skillLevel: SkillLevel;
  exerciseId?: string;
}

/**
 * Response from code validation endpoint
 */
export interface ValidateCodeResponse {
  isCorrect: boolean;
  status: 'correct' | 'almost_there' | 'needs_work' | 'major_issues';
  issues: CodeFeedbackIssue[];
  positives?: string[];
  nextStep?: string;
  aiUsed: boolean;
  patternResults?: Array<{
    pattern: string;
    found: boolean;
    line?: number;
  }>;
}

/**
 * Validate code for a code exercise
 * Uses tiered validation: regex patterns (Tier 2) and optionally AI (Tier 3)
 */
export async function validateCode(request: ValidateCodeRequest): Promise<ValidateCodeResponse> {
  const response = await api.post<ValidateCodeResponse>('/code/validate/', {
    code: request.code,
    language: request.language,
    expected_patterns: request.expectedPatterns,
    skill_level: request.skillLevel,
    exercise_id: request.exerciseId,
  });
  return response.data;
}

/**
 * Regenerate an AI lesson with optional user guidance
 */
export async function regenerateLesson(
  slug: string,
  lessonOrder: number,
  data?: RegenerateLessonRequest
): Promise<RegenerateLessonResponse> {
  const response = await api.post<RegenerateLessonResponse>(
    `/me/saved-paths/${slug}/lessons/${lessonOrder}/regenerate/`,
    data || {}
  );
  return response.data;
}

/**
 * Regenerate an exercise with a different exercise type
 */
export async function regenerateExercise(
  slug: string,
  lessonOrder: number,
  data: RegenerateExerciseRequest
): Promise<RegenerateExerciseResponse> {
  const response = await api.post<RegenerateExerciseResponse>(
    `/me/saved-paths/${slug}/lessons/${lessonOrder}/regenerate-exercise/`,
    data
  );
  return response.data;
}
