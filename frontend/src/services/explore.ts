import { api } from './api';
import type { Project, PaginatedResponse } from '@/types/models';

export interface ExploreParams {
  tab?: 'for-you' | 'trending' | 'all';
  search?: string;
  tools?: number[];
  topics?: string[];
  sort?: 'newest' | 'trending' | 'popular' | 'random';
  page?: number;
  page_size?: number;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  tagline?: string;
  projectCount: number;
  followers: number;
  level: number;
}

/**
 * Explore projects with filtering, search, and pagination
 */
export async function exploreProjects(params: ExploreParams): Promise<PaginatedResponse<Project>> {
  const response = await api.get<PaginatedResponse<any>>('/api/v1/projects/explore/', { params });
  // Transform projects if needed (camelCase conversion handled by API interceptor)
  return response.data;
}

/**
 * Semantic search with Weaviate
 */
export async function semanticSearch(query: string, filters?: any): Promise<Project[]> {
  const response = await api.post<{ results: any[] }>('/api/v1/search/semantic/', {
    query,
    filters
  });
  return response.data.results;
}

/**
 * Explore top user profiles
 */
export async function exploreProfiles(page: number = 1, page_size: number = 20): Promise<PaginatedResponse<User>> {
  const response = await api.get<PaginatedResponse<any>>('/api/v1/users/explore/', {
    params: { page, page_size }
  });
  return response.data;
}

/**
 * Get available filter options (topics, tools)
 */
export async function getFilterOptions(): Promise<{
  topics: string[];
  tools: Array<{ id: number; name: string }>;
}> {
  // This could be a separate endpoint or derived from the projects
  // For now, return empty - will be populated by backend
  return {
    topics: [],
    tools: []
  };
}
