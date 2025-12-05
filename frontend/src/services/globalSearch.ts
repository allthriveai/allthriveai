/**
 * Global Search Service
 *
 * API service for unified semantic search using Weaviate.
 */

import { api } from './api';
import type { SearchOptions, SearchResponse, SearchResults } from '@/types/search';

const DEFAULT_SEARCH_OPTIONS: Partial<SearchOptions> = {
  types: ['projects', 'tools', 'quizzes', 'users'],
  limit: 10,
  alpha: 0.7, // Hybrid search: 70% vector, 30% keyword
};

/**
 * Perform a semantic search across all content types.
 *
 * @param options - Search options including query, types, limit, and alpha
 * @returns Search results grouped by content type
 */
export async function globalSearch(options: SearchOptions): Promise<SearchResponse> {
  const { query, types, limit, alpha } = {
    ...DEFAULT_SEARCH_OPTIONS,
    ...options,
  };

  // Validate query
  if (!query || query.trim().length < 2) {
    return {
      query: query || '',
      searchType: 'text',
      results: {
        projects: [],
        tools: [],
        quizzes: [],
        users: [],
      },
      meta: {
        weaviateAvailable: false,
        typesSearched: [],
        alpha: alpha || 0.7,
      },
    };
  }

  const response = await api.post<SearchResponse>('/search/semantic/', {
    query: query.trim(),
    types,
    limit,
    alpha,
  });

  return response.data;
}

/**
 * Get just the total count of results across all types.
 */
export function getTotalResultCount(results: SearchResults): number {
  return (
    results.projects.length +
    results.tools.length +
    results.quizzes.length +
    results.users.length
  );
}

/**
 * Get results for a specific type with type safety.
 */
export function getResultsByType<T extends keyof SearchResults>(
  results: SearchResults,
  type: T
): SearchResults[T] {
  return results[type];
}

/**
 * Check if there are any results.
 */
export function hasResults(results: SearchResults): boolean {
  return getTotalResultCount(results) > 0;
}

/**
 * Get display label for content type.
 */
export function getTypeLabel(type: keyof SearchResults | 'all'): string {
  const labels: Record<keyof SearchResults | 'all', string> = {
    all: 'All Results',
    projects: 'Projects',
    tools: 'Tools',
    quizzes: 'Quizzes',
    users: 'People',
  };
  return labels[type];
}

/**
 * Get icon name for content type (for use with Lucide icons).
 */
export function getTypeIcon(type: keyof SearchResults | 'all'): string {
  const icons: Record<keyof SearchResults | 'all', string> = {
    all: 'Search',
    projects: 'FolderOpen',
    tools: 'Wrench',
    quizzes: 'GraduationCap',
    users: 'Users',
  };
  return icons[type];
}
