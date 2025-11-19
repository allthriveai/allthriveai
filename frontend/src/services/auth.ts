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

export interface UserStatistics {
  totalLogins: number;
  lastLogin: string | null;
  lastLoginDetails: {
    timestamp: string | null;
    ipAddress: string | null;
  } | null;
  accountCreated: string;
  quizScores: any[];
  projectCount: number;
}

export interface ActivityData {
  activities: UserActivity[];
  statistics: UserStatistics;
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
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<ApiResponse<User>>('/auth/me/');
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
