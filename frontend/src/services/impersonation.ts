/**
 * Admin Impersonation API Service
 *
 * Provides functions for admin user impersonation (masquerade) feature.
 * Allows admins to log in as other users for support and testing purposes.
 */

import { api } from './api';

export interface ImpersonatableUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  role: string;
  date_joined: string;
  is_guest: boolean;
}

export interface ImpersonationSession {
  isImpersonating: boolean;
  originalUser?: {
    id: number;
    username: string;
  };
  targetUser?: {
    id: number;
    username: string;
  };
  sessionId?: number;
  startedAt?: string;
}

export interface ImpersonationLog {
  id: number;
  admin_user: {
    id: number;
    username: string;
  };
  target_user: {
    id: number;
    username: string;
  };
  started_at: string;
  ended_at: string | null;
  reason: string;
  ip_address: string;
}

export interface StartImpersonationResponse {
  success: boolean;
  message: string;
  user: any; // Full user object
  impersonation: {
    is_impersonating: boolean;
    original_user: string;
    target_user: string;
    session_id: number;
  };
}

export interface StopImpersonationResponse {
  success: boolean;
  message: string;
  user: any; // Full user object (original admin)
  impersonation: {
    is_impersonating: boolean;
  };
}

/**
 * Get list of users that can be impersonated (non-admin, active users)
 */
export async function getImpersonatableUsers(params?: {
  search?: string;
  limit?: number;
}): Promise<ImpersonatableUser[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/admin/impersonate/users/${queryString ? `?${queryString}` : ''}`;

  const response = await api.get(url);
  return response.data.users;
}

/**
 * Get current impersonation status
 */
export async function getImpersonationStatus(): Promise<ImpersonationSession> {
  const response = await api.get('/admin/impersonate/status/');
  return response.data;
}

/**
 * Start impersonating a user
 */
export async function startImpersonation(params: {
  user_id?: number;
  username?: string;
  reason?: string;
}): Promise<StartImpersonationResponse> {
  const response = await api.post('/admin/impersonate/start/', params);
  return response.data;
}

/**
 * Stop impersonating and return to admin account
 */
export async function stopImpersonation(): Promise<StopImpersonationResponse> {
  const response = await api.post('/admin/impersonate/stop/');
  return response.data;
}

/**
 * Get impersonation audit logs (admin only)
 */
export async function getImpersonationLogs(params?: {
  admin_id?: number;
  target_id?: number;
  limit?: number;
}): Promise<ImpersonationLog[]> {
  const searchParams = new URLSearchParams();
  if (params?.admin_id) searchParams.append('admin_id', params.admin_id.toString());
  if (params?.target_id) searchParams.append('target_id', params.target_id.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/admin/impersonate/logs/${queryString ? `?${queryString}` : ''}`;

  const response = await api.get(url);
  return response.data.logs;
}
