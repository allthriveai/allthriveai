export type QuizDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type QuestionType = 'true_false' | 'multiple_choice' | 'swipe';

export interface Quiz {
  id: string;
  title: string;
  slug: string;
  description: string;
  topic: string;
  difficulty: QuizDifficulty;
  estimated_time: number; // minutes
  question_count: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  user_has_attempted: boolean;
  user_best_score: number | null;
  user_attempt_count: number;
  user_completed: boolean;
  user_latest_score: number | null;
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
  quizId: string;
  userId: string;
  answers: Record<string, QuizAnswer>;
  score: number;
  totalQuestions: number;
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

export interface QuizCompleteResponse {
  score: number;
  totalQuestions: number;
  results: QuizAttempt;
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
  topic?: string[];
  difficulty?: QuizDifficulty[];
  completed?: boolean;
  search?: string;
}
