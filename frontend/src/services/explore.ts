import { api } from './api';
import type { Project, PaginatedResponse } from '@/types/models';

export interface ExploreParams {
  tab?: 'for-you' | 'trending' | 'all';
  search?: string;
  categories?: number[];  // Category Taxonomy IDs (predefined)
  topics?: string[];      // Topic strings (user-generated)
  tools?: number[];       // Tool IDs
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
  totalPoints: number;
  level: number;
  tier: string;
  tierDisplay: string;
}

/**
 * Explore projects with filtering, search, and pagination
 */
export async function exploreProjects(params: ExploreParams): Promise<PaginatedResponse<Project>> {
  console.log('[exploreProjects] Calling API with params:', params);
  const response = await api.get<PaginatedResponse<any>>('/projects/explore/', { params });
  console.log('[exploreProjects] Response:', { count: response.data.count, resultsLength: response.data.results?.length });
  return response.data;
}

/**
 * Semantic search with Weaviate
 *
 * Note: Currently uses basic text search. Will be upgraded to Weaviate vector search.
 */
export async function semanticSearch(query: string, filters?: any): Promise<Project[]> {
  const response = await api.post<{ results: any[] }>('/search/semantic/', {
    query,
    filters
  });
  return response.data.results;
}

/**
 * Explore top user profiles
 */
export async function exploreProfiles(page: number = 1, page_size: number = 20): Promise<PaginatedResponse<User>> {
  const response = await api.get<PaginatedResponse<any>>('/users/explore/', {
    params: { page, page_size }
  });
  return response.data;
}

/**
 * Get available filter options (tools)
 */
export async function getFilterOptions(): Promise<{
  tools: Array<{ id: number; name: string; slug: string }>;
}> {
  const response = await api.get<PaginatedResponse<any>>('/tools/', {
    params: { ordering: 'name' }
  });
  return {
    tools: response.data.results.map((tool: any) => ({
      id: tool.id,
      name: tool.name,
      slug: tool.slug
    }))
  };
}
