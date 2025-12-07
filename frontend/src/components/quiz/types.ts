export type QuizDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type QuestionType = 'true_false' | 'multiple_choice' | 'swipe';

export interface Tool {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logoUrl?: string;
  websiteUrl: string;
  category: string;
  categoryDisplay: string;
}

export interface Taxonomy {
  id: number;
  name: string;
  slug: string;
  description: string;
  taxonomyType: 'category' | 'tool' | 'topic';
  color?: string;
}

export interface Quiz {
  id: string;
  title: string;
  slug: string;
  description: string;
  topic: string; // legacy field
  topics: string[]; // array of topic tags
  tools: Tool[]; // AI tools covered in quiz
  categories: Taxonomy[]; // taxonomy categories
  difficulty: QuizDifficulty;
  estimatedTime: number; // minutes
  questionCount: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  userHasAttempted: boolean;
  userBestScore: number | null;
  userAttemptCount: number;
  userCompleted: boolean;
  userLatestScore: number | null;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  type: QuestionType;
  correctAnswer: string | string[];
  options?: string[]; // for multiple choice
  explanation: string;
  hint?: string;
  order: number;
  imageUrl?: string;
}

export interface QuizAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // seconds
}

export interface QuizAttempt {
  id: string;
  quiz: Quiz;
  quizId?: string;
  userId?: string;
  answers: Record<string, QuizAnswer>;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface QuizAttemptResponse {
  attemptId: string;
  questions: QuizQuestion[];
}

export interface QuizAnswerResponse {
  correct: boolean;
  explanation: string;
  correctAnswer?: string | string[];
}

export interface CompletedQuestInfo {
  id: string;
  title: string;
  description: string;
  pointsAwarded: number;
  categoryName: string | null;
}

export interface QuizCompleteResponse {
  score: number;
  totalQuestions: number;
  results: QuizAttempt;
  pointsEarned?: number;
  completedQuests?: CompletedQuestInfo[];
}

export interface QuizStats {
  totalAttempts: number;
  averageScore: number;
  topicBreakdown: Record<string, {
    attempts: number;
    averageScore: number;
  }>;
}

export interface QuizListResponse {
  results: Quiz[];
  count: number;
  next?: string;
  previous?: string;
}

// Filter types for QuizListPage
export interface QuizFilters {
  topic?: string[];  // legacy topic field
  topics?: string[]; // topics array field
  tools?: number[];  // tool IDs
  categories?: number[];  // category IDs
  difficulty?: QuizDifficulty[];
  completed?: boolean;
  search?: string;
}
