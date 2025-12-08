/**
 * Global Search Hook
 *
 * Zustand store + React Query integration for global semantic search.
 * Handles state management, keyboard shortcuts, and search API calls.
 */

import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useQuery } from '@tanstack/react-query';
import { globalSearch, getTotalResultCount } from '@/services/globalSearch';
import { useDebouncedValue } from './useDebouncedValue';
import type { SearchContentType, SearchResults, SearchStore } from '@/types/search';

// Maximum number of recent searches to store
const MAX_RECENT_SEARCHES = 5;

// Search debounce delay in ms
const SEARCH_DEBOUNCE_MS = 300;

// Minimum query length to trigger search
const MIN_QUERY_LENGTH = 2;

/**
 * Zustand store for global search state.
 *
 * Persists recent searches to localStorage.
 */
export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      // State
      isOpen: false,
      query: '',
      results: null,
      isLoading: false,
      error: null,
      activeType: 'all',
      recentSearches: [],

      // Actions
      openSearch: () => set({ isOpen: true }),
      closeSearch: () => set({ isOpen: false, query: '', results: null, error: null }),
      setQuery: (query) => set({ query, error: null }),
      setResults: (results) => set({ results }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setActiveType: (activeType) => set({ activeType }),

      addRecentSearch: (query) =>
        set((state) => {
          const trimmed = query.trim();
          if (!trimmed || trimmed.length < MIN_QUERY_LENGTH) return state;

          // Remove duplicates and add to front
          const filtered = state.recentSearches.filter(
            (s) => s.toLowerCase() !== trimmed.toLowerCase()
          );
          const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);

          return { recentSearches: updated };
        }),

      clearRecentSearches: () => set({ recentSearches: [] }),

      reset: () =>
        set({
          isOpen: false,
          query: '',
          results: null,
          isLoading: false,
          error: null,
          activeType: 'all',
        }),
    }),
    {
      name: 'global-search-storage',
      partialize: (state) => ({ recentSearches: state.recentSearches }),
    }
  )
);

/**
 * Hook for performing global search with React Query.
 *
 * Automatically debounces the query and handles loading/error states.
 */
export function useGlobalSearchQuery() {
  const { query, setResults, setLoading, setError, addRecentSearch } = useSearchStore();
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const shouldSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const queryResult = useQuery({
    queryKey: ['globalSearch', debouncedQuery],
    queryFn: async () => {
      const response = await globalSearch({ query: debouncedQuery });
      return response;
    },
    enabled: shouldSearch,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute (formerly cacheTime)
    retry: 1,
  });

  // Sync query state with store
  useEffect(() => {
    setLoading(queryResult.isLoading || queryResult.isFetching);
  }, [queryResult.isLoading, queryResult.isFetching, setLoading]);

  useEffect(() => {
    if (queryResult.data) {
      setResults(queryResult.data.results);
      // Only add to recent searches if we got results
      if (getTotalResultCount(queryResult.data.results) > 0) {
        addRecentSearch(debouncedQuery);
      }
    }
  }, [queryResult.data, debouncedQuery, setResults, addRecentSearch]);

  useEffect(() => {
    if (queryResult.error) {
      setError(
        queryResult.error instanceof Error
          ? queryResult.error.message
          : 'Search failed. Please try again.'
      );
    }
  }, [queryResult.error, setError]);

  // Clear results when query is too short
  useEffect(() => {
    if (!shouldSearch) {
      setResults({ projects: [], tools: [], quizzes: [], users: [] });
      setError(null);
    }
  }, [shouldSearch, setResults, setError]);

  return {
    ...queryResult,
    debouncedQuery,
    shouldSearch,
  };
}

/**
 * Hook for keyboard shortcut handling (Cmd+K / Ctrl+K).
 */
export function useSearchKeyboardShortcut() {
  const { isOpen, openSearch, closeSearch } = useSearchStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }

      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeSearch();
      }
    },
    [isOpen, openSearch, closeSearch]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Get filtered results based on active type.
 */
export function useFilteredResults(): SearchResults | null {
  const { results, activeType } = useSearchStore();

  if (!results) return null;

  if (activeType === 'all') {
    return results;
  }

  // Return only the active type
  const emptyResults: SearchResults = {
    projects: [],
    tools: [],
    quizzes: [],
    users: [],
  };

  return {
    ...emptyResults,
    [activeType]: results[activeType],
  };
}

/**
 * Get result counts by type.
 */
export function useResultCounts(): Record<SearchContentType | 'all', number> {
  const { results } = useSearchStore();

  if (!results) {
    return {
      all: 0,
      projects: 0,
      tools: 0,
      quizzes: 0,
      users: 0,
    };
  }

  return {
    all: getTotalResultCount(results),
    projects: results.projects.length,
    tools: results.tools.length,
    quizzes: results.quizzes.length,
    users: results.users.length,
  };
}
