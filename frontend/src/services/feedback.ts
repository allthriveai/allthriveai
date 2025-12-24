/**
 * Feedback API Service
 * Handles all member feedback-related API calls (feature requests, bug reports)
 */

import { api } from './api';

// Types
export interface FeedbackUser {
  id: number;
  username: string;
  avatarUrl?: string;
}

export type FeedbackCategory =
  // Features
  | 'explore'
  | 'games'
  | 'prompt_battles'
  | 'lounge'
  | 'learn'
  // Agents
  | 'ember'
  | 'sage'
  | 'haven'
  | 'guide'
  // General
  | 'ui_ux'
  | 'responsive'
  | 'accessibility'
  | 'account'
  | 'other';

export interface FeedbackItem {
  id: number;
  feedbackType: 'feature' | 'bug';
  category: FeedbackCategory;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'declined';
  voteCount: number;
  hasVoted: boolean;
  commentCount: number;
  adminResponse?: string;
  user: FeedbackUser;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackComment {
  id: number;
  user: FeedbackUser;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackListParams {
  feedbackType?: 'feature' | 'bug';
  status?: string;
  ordering?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CreateFeedbackData {
  feedbackType: 'feature' | 'bug';
  category: FeedbackCategory;
  title: string;
  description: string;
}

export interface AdminUpdateFeedbackData {
  status?: 'open' | 'in_progress' | 'completed' | 'declined';
  adminResponse?: string;
}

export interface VoteResponse {
  voted: boolean;
  voteCount: number;
}

// API Methods

/**
 * Get paginated list of feedback items
 */
export async function getFeedbackItems(
  params?: FeedbackListParams
): Promise<PaginatedResponse<FeedbackItem>> {
  const queryParams = new URLSearchParams();
  if (params?.feedbackType) queryParams.set('feedback_type', params.feedbackType);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.ordering) queryParams.set('ordering', params.ordering);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const response = await api.get(`/feedback/?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get single feedback item by ID
 */
export async function getFeedbackItem(id: number): Promise<FeedbackItem> {
  const response = await api.get(`/feedback/${id}/`);
  return response.data;
}

/**
 * Get current user's feedback submissions
 */
export async function getMyFeedback(
  params?: FeedbackListParams
): Promise<PaginatedResponse<FeedbackItem>> {
  const queryParams = new URLSearchParams();
  if (params?.feedbackType) queryParams.set('feedback_type', params.feedbackType);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.ordering) queryParams.set('ordering', params.ordering);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const response = await api.get(`/me/feedback/?${queryParams.toString()}`);
  return response.data;
}

/**
 * Create new feedback item
 */
export async function createFeedbackItem(data: CreateFeedbackData): Promise<FeedbackItem> {
  const response = await api.post('/feedback/', data);
  return response.data;
}

/**
 * Toggle vote on a feedback item
 */
export async function toggleFeedbackVote(itemId: number): Promise<VoteResponse> {
  const response = await api.post(`/feedback/${itemId}/toggle-vote/`);
  return response.data;
}

/**
 * Get comments for a feedback item
 */
export async function getFeedbackComments(feedbackId: number): Promise<FeedbackComment[]> {
  const response = await api.get(`/feedback/${feedbackId}/comments/`);
  return response.data;
}

/**
 * Add comment to a feedback item
 */
export async function addFeedbackComment(
  feedbackId: number,
  content: string
): Promise<FeedbackComment> {
  const response = await api.post(`/feedback/${feedbackId}/comments/`, { content });
  return response.data;
}

/**
 * Delete a comment from a feedback item
 */
export async function deleteFeedbackComment(
  feedbackId: number,
  commentId: number
): Promise<void> {
  await api.delete(`/feedback/${feedbackId}/comments/${commentId}/`);
}

/**
 * Admin-only: Update feedback status and/or admin response
 */
export async function adminUpdateFeedback(
  itemId: number,
  data: AdminUpdateFeedbackData
): Promise<FeedbackItem> {
  const response = await api.patch(`/feedback/${itemId}/admin-update/`, data);
  return response.data;
}
