/**
 * Admin Circle Management Service
 *
 * API functions for admin management of Thrive Circles
 */

import { api } from './api';

// Types
export interface Circle {
  id: string;
  name: string;
  tier: string;
  tierDisplay: string;
  weekStart: string;
  weekEnd: string;
  memberCount: number;
  activeMemberCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CircleUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  tier: string;
  tierDisplay: string;
  totalPoints: number;
  currentCircle: {
    id: string;
    name: string;
    tier: string;
    tierDisplay: string;
    memberCount: number;
  } | null;
  currentMembership: {
    id: string;
    joinedAt: string;
    pointsEarnedInCircle: number;
    wasActive: boolean;
  } | null;
}

export interface CircleMembership {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    tier: string;
    level: number;
    totalPoints: number;
  };
  isActive: boolean;
  joinedAt: string;
  pointsEarnedInCircle: number;
  wasActive: boolean;
}

// API Response types
interface ListCirclesResponse {
  circles: Circle[];
  total: number;
}

interface ListUsersResponse {
  users: CircleUser[];
  total: number;
}

interface AssignResponse {
  success: boolean;
  membership: CircleMembership;
}

interface RemoveResponse {
  success: boolean;
  message: string;
}

interface MoveResponse {
  success: boolean;
  oldCircle: Circle | null;
  newCircle: Circle;
  membership: CircleMembership;
}

// Query params
export interface ListCirclesParams {
  tier?: string;
  weekStart?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
}

export interface ListUsersParams {
  search?: string;
  tier?: string;
  hasCircle?: boolean;
  limit?: number;
}

/**
 * List all circles with optional filters
 */
export async function listCircles(params?: ListCirclesParams): Promise<ListCirclesResponse> {
  const queryParams = new URLSearchParams();

  if (params?.tier) queryParams.set('tier', params.tier);
  if (params?.weekStart) queryParams.set('week_start', params.weekStart);
  if (params?.isActive !== undefined) queryParams.set('is_active', String(params.isActive));
  if (params?.search) queryParams.set('search', params.search);
  if (params?.limit) queryParams.set('limit', String(params.limit));

  const query = queryParams.toString();
  const url = `/admin/circles/${query ? `?${query}` : ''}`;

  const response = await api.get<ListCirclesResponse>(url);
  return response.data;
}

/**
 * Search users and their circle memberships
 */
export async function listCircleUsers(params?: ListUsersParams): Promise<ListUsersResponse> {
  const queryParams = new URLSearchParams();

  if (params?.search) queryParams.set('search', params.search);
  if (params?.tier) queryParams.set('tier', params.tier);
  if (params?.hasCircle !== undefined) queryParams.set('has_circle', String(params.hasCircle));
  if (params?.limit) queryParams.set('limit', String(params.limit));

  const query = queryParams.toString();
  const url = `/admin/circles/users/${query ? `?${query}` : ''}`;

  const response = await api.get<ListUsersResponse>(url);
  return response.data;
}

/**
 * Assign a user to a circle
 */
export async function assignUserToCircle(
  userId: string,
  circleId: string
): Promise<AssignResponse> {
  const response = await api.post<AssignResponse>('/admin/circles/assign/', {
    user_id: userId,
    circle_id: circleId,
  });
  return response.data;
}

/**
 * Remove a user from their current circle
 */
export async function removeUserFromCircle(userId: string): Promise<RemoveResponse> {
  const response = await api.post<RemoveResponse>('/admin/circles/remove/', {
    user_id: userId,
  });
  return response.data;
}

/**
 * Move a user to a different circle
 */
export async function moveUserToCircle(
  userId: string,
  targetCircleId: string
): Promise<MoveResponse> {
  const response = await api.post<MoveResponse>('/admin/circles/move/', {
    user_id: userId,
    target_circle_id: targetCircleId,
  });
  return response.data;
}

// Tier options for dropdowns
export const TIER_OPTIONS = [
  { value: 'seedling', label: 'Seedling' },
  { value: 'sprout', label: 'Sprout' },
  { value: 'blossom', label: 'Blossom' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'evergreen', label: 'Evergreen' },
] as const;
