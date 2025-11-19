import { api } from './api';
import type {
  Quiz,
  QuizQuestion,
  QuizAttempt,
  QuizAttemptResponse,
  QuizAnswerResponse,
  QuizCompleteResponse,
  QuizStats,
  QuizListResponse,
  QuizFilters,
} from '@/components/quiz/types';

/**
 * Quiz API Service
 * Handles all quiz-related API calls
 */

// Get all published quizzes with optional filters
export async function getQuizzes(filters?: QuizFilters): Promise<QuizListResponse> {
  const params = new URLSearchParams();
  
  if (filters?.topic && filters.topic.length > 0) {
    filters.topic.forEach(t => params.append('topic', t));
  }
  
  if (filters?.difficulty && filters.difficulty.length > 0) {
    filters.difficulty.forEach(d => params.append('difficulty', d));
  }
  
  if (filters?.search) {
    params.append('search', filters.search);
  }
  
  const response = await api.get<QuizListResponse>('/quizzes/', { params });
  return response.data;
}

// Get a single quiz by slug
export async function getQuiz(slug: string): Promise<Quiz> {
  const response = await api.get<Quiz>(`/quizzes/${slug}/`);
  return response.data;
}

// Get questions for a quiz (without correct answers)
export async function getQuizQuestions(slug: string): Promise<{ questions: QuizQuestion[] }> {
  const response = await api.get<{ questions: QuizQuestion[] }>(`/quizzes/${slug}/questions/`);
  return response.data;
}

// Start a new quiz attempt
export async function startQuiz(slug: string): Promise<QuizAttemptResponse> {
  const response = await api.post<QuizAttemptResponse>(`/quizzes/${slug}/start/`);
  return response.data;
}

// Submit an answer for a question
export async function submitAnswer(
  attemptId: string,
  questionId: string,
  answer: string,
  timeSpent: number
): Promise<QuizAnswerResponse> {
  const response = await api.post<QuizAnswerResponse>(
    `/me/quiz-attempts/${attemptId}/answer/`,
    {
      question_id: questionId,
      answer,
      time_spent: timeSpent,
    }
  );
  return response.data;
}

// Complete a quiz attempt
export async function completeQuiz(attemptId: string): Promise<QuizCompleteResponse> {
  const response = await api.post<QuizCompleteResponse>(`/me/quiz-attempts/${attemptId}/complete/`);
  return response.data;
}

// Get a specific quiz attempt
export async function getQuizAttempt(attemptId: string): Promise<QuizAttempt> {
  const response = await api.get<QuizAttempt>(`/me/quiz-attempts/${attemptId}/`);
  return response.data;
}

// Get user's quiz history
export async function getQuizHistory(): Promise<{ attempts: QuizAttempt[] }> {
  const response = await api.get<{ attempts: QuizAttempt[] }>('/me/quiz-attempts/history/');
  return response.data;
}

// Get user's quiz stats
export async function getQuizStats(): Promise<QuizStats> {
  const response = await api.get<QuizStats>('/me/quiz-attempts/stats/');
  return response.data;
}
