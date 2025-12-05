import { api } from './api';

export interface QuizOption {
  value: string;
  label: string;
  icon: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multi_choice';
  options: QuizOption[];
  maxSelections?: number;
}

export interface QuizData {
  title: string;
  description: string;
  questions: QuizQuestion[];
  totalQuestions: number;
}

export interface ToolRecommendation {
  tool: {
    id: number;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    logoUrl: string;
    category: string;
    categoryDisplay: string;
    pricingModel: string;
    pricingDisplay: string;
    hasFreeTier: boolean;
    startingPrice: string;
    websiteUrl: string;
    isFeatured: boolean;
    isVerified: boolean;
  };
  matchScore: number;
  matchReasons: string[];
}

export interface QuizAnswers {
  [questionId: string]: string | string[];
}

export interface RecommendationResult {
  recommendations: ToolRecommendation[];
  total: number;
  answersReceived: QuizAnswers;
}

/**
 * Fetch the tool recommendation quiz questions
 */
export async function getRecommendationQuizQuestions(): Promise<QuizData> {
  const response = await api.get('/tools/recommendation-quiz/questions/');
  return response.data;
}

/**
 * Submit quiz answers and get tool recommendations
 */
export async function submitRecommendationQuiz(
  answers: QuizAnswers,
  limit: number = 5
): Promise<RecommendationResult> {
  const response = await api.post('/tools/recommendation-quiz/submit/', {
    answers,
    limit,
  });
  return response.data;
}
