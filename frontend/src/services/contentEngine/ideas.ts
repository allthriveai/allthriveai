/**
 * Content Engine Ideas API Service
 * US-003: Ideas API service and hooks
 */

import { api } from '../api';
import type {
  ContentIdea,
  CreateIdeaPayload,
  UpdateIdeaPayload,
  IdeaStatus,
  Platform,
} from '@/types/contentEngine';

export interface IdeasListParams {
  status?: IdeaStatus;
  platform?: Platform;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedIdeasResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContentIdea[];
}

/**
 * Get paginated list of ideas
 */
export async function getIdeas(params?: IdeasListParams): Promise<PaginatedIdeasResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.platform) queryParams.set('platform', params.platform);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const queryString = queryParams.toString();
  const url = queryString ? `/content-engine/ideas/?${queryString}` : '/content-engine/ideas/';
  const response = await api.get(url);
  return response.data;
}

/**
 * Get a single idea by ID
 */
export async function getIdea(id: number): Promise<ContentIdea> {
  const response = await api.get(`/content-engine/ideas/${id}/`);
  return response.data;
}

/**
 * Create a new idea
 */
export async function createIdea(data: CreateIdeaPayload): Promise<ContentIdea> {
  const response = await api.post('/content-engine/ideas/', data);
  return response.data;
}

/**
 * Update an existing idea
 */
export async function updateIdea(id: number, data: UpdateIdeaPayload): Promise<ContentIdea> {
  const response = await api.patch(`/content-engine/ideas/${id}/`, data);
  return response.data;
}

/**
 * Delete an idea
 */
export async function deleteIdea(id: number): Promise<void> {
  await api.delete(`/content-engine/ideas/${id}/`);
}

/**
 * Ideas API object for convenience
 */
export const ideasApi = {
  list: getIdeas,
  get: getIdea,
  create: createIdea,
  update: updateIdea,
  delete: deleteIdea,
};
