import { api, ensureCsrfToken } from './api';
import type { User, LoginCredentials } from '@/types/models';
import type { ApiResponse } from '@/types/api';

export interface UserActivity {
  id: number;
  action: string;
  actionType: string;
  timestamp: string;
  ipAddress: string | null;
  success: boolean;
  details: Record<string, any>;
}

export interface QuizScore {
  id: string;
  quizTitle: string;
  quizSlug: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  completedAt: string | null;
  topic: string;
  difficulty: string;
}

export interface PointsHistory {
  id: string;
  activityType: string;
  activityDisplay: string;
  pointsAwarded: number;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface UserStatistics {
  totalLogins: number;
  lastLogin: string | null;
  lastLoginDetails: {
    timestamp: string | null;
    ipAddress: string | null;
  } | null;
  accountCreated: string;
  quizScores: QuizScore[];
  projectCount: number;
  totalPoints: number;
  level: number;
  currentStreak: number;
}

export interface ActivityData {
  activities: UserActivity[];
  statistics: UserStatistics;
  pointsFeed: PointsHistory[];
}

// Activity Insights Types
export interface ToolEngagement {
  id: number;
  name: string;
  slug: string;
  logoUrl: string;
  category: string;
  categoryDisplay: string;
  usageCount: number;
}

export interface SideQuestCompleted {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  difficultyDisplay: string;
  pointsAwarded: number;
  completedAt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryIcon: string | null;
  categoryColorFrom: string | null;
  categoryColorTo: string | null;
}

export interface TopicInterest {
  topic: string;
  topicDisplay: string;
  quizCount: number;
  projectCount: number;
  engagementScore: number;
}

export interface ActivityTrend {
  date: string;
  activityCount: number;
  points: number;
}

export interface PointsCategory {
  activityType: string;
  displayName: string;
  totalPoints: number;
  count: number;
  color: string;
}

export interface PersonalizedInsight {
  type: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface StatsSummary {
  quizzesCompleted: number;
  projectsCount: number;
  totalPoints: number;
  sideQuestsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  battlesCount?: number; // Optional for now, will be added to backend
}

export interface ActivityInsights {
  toolEngagement: ToolEngagement[];
  topicInterests: TopicInterest[];
  activityTrends: ActivityTrend[];
  pointsByCategory: PointsCategory[];
  insights: PersonalizedInsight[];
  statsSummary: StatsSummary;
}

// Login user
export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await api.post<ApiResponse<User>>('/auth/login/', credentials);
  return response.data.data;
}

// Logout user
export async function logout(): Promise<void> {
  // Ensure we have a CSRF token before logout
  await ensureCsrfToken();
  await api.post('/auth/logout/');
}

// Get current authenticated user
// Uses X-Skip-Auth-Redirect to prevent 401 from triggering redirect to /auth
// This is used on initial auth check - we just want to know if user is logged in
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<ApiResponse<User>>('/auth/me/', {
    headers: { 'X-Skip-Auth-Redirect': 'true' },
  });
  return response.data.data;
}

// Get public user profile by username (no authentication required)
export async function getUserByUsername(username: string): Promise<User> {
  const response = await api.get<ApiResponse<User>>(`/users/${username}/`);
  return response.data.data;
}

// Refresh authentication token
export async function refreshToken(): Promise<void> {
  await api.post('/auth/refresh/');
}

// Get user activity and statistics
export async function getUserActivity(): Promise<ActivityData> {
  const response = await api.get<ApiResponse<ActivityData>>('/me/activity/');
  return response.data.data;
}

// Get comprehensive activity insights
export async function getActivityInsights(): Promise<ActivityInsights> {
  const response = await api.get<ApiResponse<ActivityInsights>>('/me/activity/insights/');
  return response.data.data;
}

// Update user profile
export async function updateProfile(data: Partial<User>): Promise<User> {
  const response = await api.patch<ApiResponse<User>>('/auth/me/', data);
  return response.data.data;
}

// Account Management
export interface DeactivateAccountResponse {
  success: boolean;
  message: string;
  subscriptionCanceled?: boolean;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  userId: number;
  email: string;
}

/**
 * Deactivate user account (soft delete)
 * - Marks account as inactive
 * - Cancels subscription at period end
 * - Data is retained for reactivation
 */
export async function deactivateAccount(): Promise<DeactivateAccountResponse> {
  const response = await api.post<DeactivateAccountResponse>('/me/account/deactivate/');
  return response.data;
}

/**
 * Permanently delete user account
 * WARNING: This is irreversible
 * - Cancels subscription immediately
 * - Deletes Stripe customer
 * - Permanently deletes all user data
 *
 * @param confirmation - Must be exactly "DELETE MY ACCOUNT"
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  const response = await api.post<DeleteAccountResponse>('/me/account/delete/', {
    confirm: confirmation,
  });
  return response.data;
}
