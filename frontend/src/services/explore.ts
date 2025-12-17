import { api } from './api';
import type { Project, PaginatedResponse } from '@/types/models';

export interface ExploreParams {
  tab?: 'for-you' | 'trending' | 'new';
  search?: string;
  categories?: number[];  // Category Taxonomy IDs (predefined)
  topics?: string[];      // Topic strings (user-generated)
  tools?: number[];       // Tool IDs
  page?: number;
  page_size?: number;
  sort?: string;          // Sort order (e.g., 'trending', 'new', 'top')
  seed?: string;          // Random seed for stable shuffled ordering (legacy, used by 'new' tab)
  freshness_token?: string;  // Freshness token for exploration scoring, deprioritization, and shuffling
}

export interface UserTool {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
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
  topTools?: UserTool[];
}

/**
 * Explore projects with filtering, search, and pagination
 */
export async function exploreProjects(params: ExploreParams): Promise<PaginatedResponse<Project>> {
  // Build query string manually to avoid axios adding [] brackets to arrays
  const queryParams = new URLSearchParams();

  if (params.tab) queryParams.append('tab', params.tab);
  if (params.search) queryParams.append('search', params.search);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params.seed) queryParams.append('seed', params.seed);
  if (params.freshness_token) queryParams.append('freshness_token', params.freshness_token);

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

  const response = await api.get<PaginatedResponse<any>>(url);

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
 * The API returns: { query, search_type, results: { projects, tools, quizzes, users }, meta }
 */
export async function semanticSearch(query: string, filters?: SemanticSearchFilters): Promise<Project[]> {
  const response = await api.post<{
    query: string;
    searchType: string;
    results: { projects: Project[]; tools: any[]; quizzes: any[]; users: any[] };
    meta: any;
  }>('/search/semantic/', {
    query,
    filters,
  });
  // Extract projects array from the nested results
  return response.data.results?.projects || [];
}

/**
 * Explore top user profiles
 * @param page - Page number
 * @param page_size - Number of results per page
 * @param include_all - If true, include users without projects (e.g., beta testers, agents)
 */
export async function exploreProfiles(page: number = 1, page_size: number = 20, include_all: boolean = true): Promise<PaginatedResponse<User>> {
  const response = await api.get<PaginatedResponse<User>>('/users/explore/', {
    params: { page, page_size, include_all }
  });
  return response.data;
}

/**
 * Get available filter options (tools)
 */
export async function getFilterOptions(): Promise<{
  tools: Array<{ id: number; name: string; slug: string; logoUrl?: string }>;
}> {
  const response = await api.get<PaginatedResponse<any>>('/tools/', {
    params: { ordering: 'name', page_size: 500 }
  });
  return {
    tools: response.data.results.map((tool: any) => ({
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      logoUrl: tool.logoUrl  // Already transformed from logo_url by API interceptor
    }))
  };
}
