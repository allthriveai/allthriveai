/**
 * API service for Admin Topics Management.
 * All endpoints require admin authentication.
 */

import { api } from './api';
import type {
  Topic,
  TopicQueryParams,
  CreateTopicPayload,
  UpdateTopicPayload,
  TopicStats,
  BulkToggleActivePayload,
} from '@/types/adminTopics';

const BASE_URL = '/admin/topics';

// Helper to build query string from params
function buildQueryString(params: TopicQueryParams): string {
  const searchParams = new URLSearchParams();
  if (params.isActive !== undefined) searchParams.set('is_active', params.isActive);
  if (params.search) searchParams.set('search', params.search);
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortDir) searchParams.set('sort_dir', params.sortDir);
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const adminTopicsService = {
  /**
   * Get all topics with optional filters
   */
  async getTopics(params: TopicQueryParams = {}): Promise<Topic[]> {
    const queryString = buildQueryString(params);
    const response = await api.get<Topic[] | { results: Topic[] }>(`${BASE_URL}/${queryString}`);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  /**
   * Get a single topic by ID
   */
  async getTopic(id: number): Promise<Topic> {
    const response = await api.get<Topic>(`${BASE_URL}/${id}/`);
    return response.data;
  },

  /**
   * Create a new topic
   */
  async createTopic(payload: CreateTopicPayload): Promise<Topic> {
    const response = await api.post<Topic>(`${BASE_URL}/`, payload);
    return response.data;
  },

  /**
   * Update a topic
   */
  async updateTopic(id: number, payload: UpdateTopicPayload): Promise<Topic> {
    const response = await api.patch<Topic>(`${BASE_URL}/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a topic
   */
  async deleteTopic(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/${id}/`);
  },

  /**
   * Get topic statistics
   */
  async getStats(): Promise<TopicStats> {
    const response = await api.get<TopicStats>(`${BASE_URL}/stats/`);
    return response.data;
  },

  /**
   * Bulk toggle is_active status for multiple topics
   */
  async bulkToggleActive(payload: BulkToggleActivePayload): Promise<{ status: string; count: number }> {
    const response = await api.post<{ status: string; count: number }>(
      `${BASE_URL}/bulk_toggle_active/`,
      payload
    );
    return response.data;
  },
};

export default adminTopicsService;
