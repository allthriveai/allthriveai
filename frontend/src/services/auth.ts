import { api, ensureCsrfToken } from './api';
import type { User, LoginCredentials } from '@/types/models';
import type { ApiResponse } from '@/types/api';

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

// Refresh authentication token
export async function refreshToken(): Promise<void> {
  await api.post('/auth/refresh/');
}
