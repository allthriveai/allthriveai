import { useState } from 'react';
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Taxonomy } from '@/types/models';
import { FilterDropdown, SelectedFilters } from './FilterDropdown';

interface SearchBarWithFiltersProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
  // Filters
  topics?: Taxonomy[];
  tools?: Array<{ id: number; name: string; slug: string; logoUrl?: string }>;
  selectedTopics?: string[];  // Category slugs
  selectedToolSlugs?: string[];
  onTopicsChange?: (topicSlugs: string[]) => void;  // Category slugs
  onToolsChange?: (toolSlugs: string[]) => void;
  showFilters?: boolean;
  openFiltersByDefault?: boolean;
}

export function SearchBarWithFilters({
  onSearch,
  placeholder = 'Search with AI...',
  initialValue = '',
  topics = [],
  tools = [],
  selectedTopics = [],
  selectedToolSlugs = [],
  onTopicsChange,
  onToolsChange,
  showFilters = false,
}: SearchBarWithFiltersProps) {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleRemoveCategory = (slug: string) => {
    onTopicsChange?.(selectedTopics.filter((s) => s !== slug));
  };

  const handleRemoveTool = (slug: string) => {
    onToolsChange?.(selectedToolSlugs.filter((s) => s !== slug));
  };

  const handleClearAll = () => {
    onTopicsChange?.([]);
    onToolsChange?.([]);
  };

  const totalSelected = selectedTopics.length + selectedToolSlugs.length;

  return (
    <div className="space-y-3">
      {/* Search Bar with Filter Button Inside */}
      <form onSubmit={handleSubmit}>
        <label htmlFor="explore-search-input" className="sr-only">
          Search projects with AI
        </label>
        <div className="relative">
          {/* AI Sparkle Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2" aria-hidden="true">
            <SparklesIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          </div>

          <input
            id="explore-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-16 py-3 text-base border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow hover:shadow-sm ${
              showFilters ? 'pr-36' : 'pr-20'
            }`}
          />

          {/* Right Side Buttons - Inside Input */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}

            {/* Filter Dropdown Button - Inside Input */}
            {showFilters && (
              <FilterDropdown
                categories={topics}
                tools={tools}
                selectedCategorySlugs={selectedTopics}
                selectedToolSlugs={selectedToolSlugs}
                onCategoriesChange={onTopicsChange || (() => {})}
                onToolsChange={onToolsChange || (() => {})}
                compact
              />
            )}

            {/* Search Button */}
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-all flex items-center gap-1.5"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </form>

      {/* Selected Filters Pills */}
      {showFilters && totalSelected > 0 && (
        <SelectedFilters
          categories={topics}
          tools={tools}
          selectedCategorySlugs={selectedTopics}
          selectedToolSlugs={selectedToolSlugs}
          onRemoveCategory={handleRemoveCategory}
          onRemoveTool={handleRemoveTool}
          onClearAll={handleClearAll}
        />
      )}
    </div>
  );
}
