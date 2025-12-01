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

  // Build query string manually to avoid axios adding [] brackets to arrays
  const queryParams = new URLSearchParams();

  if (params.tab) queryParams.append('tab', params.tab);
  if (params.search) queryParams.append('search', params.search);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.page_size) queryParams.append('page_size', params.page_size.toString());

  // Add array parameters without brackets (categories=1&categories=2)
  if (params.categories) {
    params.categories.forEach(id => queryParams.append('categories', id.toString()));
  }
  if (params.tools) {
    params.tools.forEach(id => queryParams.append('tools', id.toString()));
  }
  if (params.topics) {
    params.topics.forEach(topic => queryParams.append('topics', topic));
  }

  const queryString = queryParams.toString();
  const url = `/projects/explore/${queryString ? `?${queryString}` : ''}`;

  console.log('[exploreProjects] URL:', url);
  const response = await api.get<PaginatedResponse<any>>(url);

  // Log the raw response to see all fields
  console.log('[exploreProjects] RAW response.data keys:', Object.keys(response.data));
  console.log('[exploreProjects] RAW response.data.next:', response.data.next);
  console.log('[exploreProjects] Full response.data:', JSON.stringify(response.data, null, 2).substring(0, 500));

  return response.data;
}

export interface SemanticSearchFilters {
  categories?: number[];
  topics?: string[];
  tools?: number[];
  projectType?: string;
}

/**
 * Semantic search with Weaviate
 *
 * Note: Currently uses basic text search. Will be upgraded to Weaviate vector search.
 */
export async function semanticSearch(query: string, filters?: SemanticSearchFilters): Promise<Project[]> {
  const response = await api.post<{ results: Project[] }>('/search/semantic/', {
    query,
    filters
  });
  return response.data.results;
}

/**
 * Explore top user profiles
 */
export async function exploreProfiles(page: number = 1, page_size: number = 20): Promise<PaginatedResponse<User>> {
  const response = await api.get<PaginatedResponse<User>>('/users/explore/', {
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
