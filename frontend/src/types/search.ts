/**
 * Global Search Types
 *
 * Types for unified semantic search across projects, tools, quizzes, and users.
 */

import type { TierName, UserRole } from './models';

// Search result types
export type SearchContentType = 'projects' | 'tools' | 'quizzes' | 'users';

// Base search result with common fields
export interface BaseSearchResult {
  id: number | string;
  title: string;
  description: string;
  url: string;
  score?: number;
}

// Project search result
export interface ProjectSearchResult extends BaseSearchResult {
  id: number;
  slug: string;
  username: string;
  featuredImageUrl: string | null;
  toolNames: string[];
  categoryNames: string[];
  topics: string[];
  heartCount: number;
  type: string;
}

// Tool search result
export interface ToolSearchResult extends BaseSearchResult {
  id: number;
  slug: string;
  category: string;
  logoUrl: string | null;
  projectCount: number;
  pricingModel: string;
  hasFreeTier: boolean;
}

// Quiz search result
export interface QuizSearchResult extends BaseSearchResult {
  id: string;
  slug: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  toolNames: string[];
}

// User search result
export interface UserSearchResult extends BaseSearchResult {
  id: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  tier: TierName | null;
  projectCount: number;
  bio: string | null;
}

// Grouped search results from API
export interface SearchResults {
  projects: ProjectSearchResult[];
  tools: ToolSearchResult[];
  quizzes: QuizSearchResult[];
  users: UserSearchResult[];
}

// API response structure
export interface SearchResponse {
  query: string;
  searchType: 'hybrid' | 'text';
  results: SearchResults;
  meta: {
    weaviateAvailable: boolean;
    typesSearched: SearchContentType[];
    alpha: number;
  };
}

// Search request options
export interface SearchOptions {
  query: string;
  types?: SearchContentType[];
  limit?: number;
  alpha?: number; // 0 = keyword only, 1 = vector only, 0.7 = hybrid default
}

// Search state for UI
export interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResults | null;
  isLoading: boolean;
  error: string | null;
  activeType: SearchContentType | 'all';
  recentSearches: string[];
}

// Search store actions
export interface SearchActions {
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setResults: (results: SearchResults) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveType: (type: SearchContentType | 'all') => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  reset: () => void;
}

// Combined store type
export type SearchStore = SearchState & SearchActions;

// Type guard helpers
export function isProjectResult(result: BaseSearchResult): result is ProjectSearchResult {
  return 'slug' in result && 'username' in result && 'heartCount' in result;
}

export function isToolResult(result: BaseSearchResult): result is ToolSearchResult {
  return 'category' in result && 'pricingModel' in result;
}

export function isQuizResult(result: BaseSearchResult): result is QuizSearchResult {
  return 'difficulty' in result && 'questionCount' in result;
}

export function isUserResult(result: BaseSearchResult): result is UserSearchResult {
  return 'username' in result && 'role' in result && 'projectCount' in result;
}
