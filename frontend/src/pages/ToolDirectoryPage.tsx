import { useState, useEffect, useMemo } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getTools, getToolCategories, getToolCompanies } from '@/services/tools';
import { ToolSearchBar, type ToolFilters } from '@/components/tools/ToolSearchBar';
import type { Tool } from '@/types/models';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function ToolDirectoryPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ToolFilters>({});
  const [categories, setCategories] = useState<Array<{ value: string; label: string; count: number }>>([]);
  const [companies, setCompanies] = useState<Array<{ id: number; name: string; slug: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load categories and companies on mount
  useEffect(() => {
    async function loadFilters() {
      try {
        const [categoriesData, companiesData] = await Promise.all([
          getToolCategories(),
          getToolCompanies(),
        ]);
        setCategories(categoriesData);
        setCompanies(companiesData);
      } catch (err) {
        console.error('Failed to load filter options:', err);
        // Filters are non-critical - tools will still load without them
      }
    }
    loadFilters();
  }, []);

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load tools when filters or debounced search change
  useEffect(() => {
    async function loadTools() {
      try {
        setIsLoading(true);
        setError(null);
        const params: any = { ...filters };
        if (debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }
        const response = await getTools(params);
        const toolsList = response.results;
        // Sort alphabetically
        toolsList.sort((a, b) => a.name.localeCompare(b.name));
        setTools(toolsList);
      } catch (err: any) {
        console.error('Failed to load tools:', err);
        setError(err?.error || 'Failed to load tool directory');
      } finally {
        setIsLoading(false);
      }
    }
    loadTools();
  }, [filters, debouncedSearch]);

  // Group tools by first letter for dictionary-style layout (memoized for performance)
  const groupedTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};
    tools.forEach((tool) => {
      const firstLetter = tool.name[0].toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(tool);
    });
    return groups;
  }, [tools]);

  const letters = useMemo(() => Object.keys(groupedTools).sort(), [groupedTools]);

  return (
    <DashboardLayout>
      {() => (
        <div className="flex-1 overflow-y-auto h-full">
          <div className="max-w-6xl mx-auto p-8 pb-24">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <SparklesIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  Tool Directory
                </h1>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Explore AI tools and technologies to enhance your workflow
              </p>
            </div>

            {/* Search Bar with Filters */}
            <div className="mb-6">
              <ToolSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                companies={companies}
              />
            </div>

            {/* Results count */}
            {!isLoading && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {tools.length} tool{tools.length !== 1 ? 's' : ''} found
              </p>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-8 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-4" />
                    <div className="space-y-4">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-24 bg-gray-300 dark:bg-gray-700 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Tool Directory - Dictionary Style */}
            {!isLoading && !error && (
              <>
                {letters.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      {searchQuery || Object.keys(filters).length > 0
                        ? 'No tools found matching your criteria'
                        : 'No tools available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {letters.map((letter) => (
                      <div key={letter} id={letter}>
                        {/* Letter Header */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-bold text-2xl shadow-sm">
                            {letter}
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-300 dark:from-gray-700 to-transparent" />
                        </div>

                        {/* Tools in this letter */}
                        <div className="grid grid-cols-1 gap-4">
                          {groupedTools[letter].map((tool) => (
                            <Link
                              key={tool.id}
                              to={`/tools/${tool.slug}`}
                              className="block text-left glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg"
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                  {tool.logoUrl ? (
                                    <img src={tool.logoUrl} alt={`${tool.name} logo`} className="w-10 h-10 object-contain" />
                                  ) : (
                                    <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="mb-2">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                      {tool.name}
                                    </h3>
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                    {tool.tagline}
                                  </p>
                                  <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Alphabet Navigation (if more than 3 letters and no active search/filters) */}
                {letters.length > 3 && !searchQuery && Object.keys(filters).length === 0 && (
                  <div className="fixed bottom-8 right-8 glass-strong rounded-xl p-3 shadow-2xl border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col gap-1">
                      {letters.map((letter) => (
                        <a
                          key={letter}
                          href={`#${letter}`}
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Nested route outlet for tool detail drawer */}
          <Outlet />
        </div>
      )}
    </DashboardLayout>
  );
}
