/**
 * Learning Paths API Service
 */
import { api } from './api';
import type {
  UserLearningPath,
  LearningPathDetail,
  TopicRecommendation,
  LearningPathTopic,
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
