import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import type { Taxonomy } from '@/types/models';

interface SearchBarWithFiltersProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
  // Filters
  topics?: Taxonomy[];
  tools?: Array<{ id: number; name: string; slug: string }>;
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
  openFiltersByDefault = false,
}: SearchBarWithFiltersProps) {
  const [query, setQuery] = useState(initialValue);
  const [showFilterDropdown, setShowFilterDropdown] = useState(openFiltersByDefault);

  // Open filters when openFiltersByDefault changes to true
  useEffect(() => {
    if (openFiltersByDefault) {
      setShowFilterDropdown(true);
    }
  }, [openFiltersByDefault]);

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

  const toggleTopic = (topicSlug: string) => {
    if (!onTopicsChange) return;
    if (selectedTopics.includes(topicSlug)) {
      onTopicsChange(selectedTopics.filter(t => t !== topicSlug));
    } else {
      onTopicsChange([...selectedTopics, topicSlug]);
    }
  };

  const toggleTool = (toolSlug: string) => {
    if (!onToolsChange) return;
    if (selectedToolSlugs.includes(toolSlug)) {
      onToolsChange(selectedToolSlugs.filter(t => t !== toolSlug));
    } else {
      onToolsChange([...selectedToolSlugs, toolSlug]);
    }
  };

  const clearAllFilters = () => {
    onTopicsChange?.([]);
    onToolsChange?.([]);
  };

  const activeFilterCount = selectedTopics.length + selectedToolSlugs.length;
  const hasFilters = activeFilterCount > 0;

  return (
    <div className="mb-6 space-y-3">
      {/* Search Bar */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* AI Sparkle Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Search Input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-16 pr-32 py-3.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
          />

          {/* Right Side Buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
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

            {/* Filter Toggle Button */}
            {showFilters && (
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`p-1.5 rounded-md transition-all ${
                  hasFilters || showFilterDropdown
                    ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                aria-label="Toggle filters"
              >
                <FunnelIcon className="w-5 h-5" />
                {hasFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Search Button */}
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors flex items-center gap-1.5"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </form>

      {/* Inline Filter Pills - Show active filters */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>

          {/* Active Topic Pills */}
          {selectedTopics.map(topicSlug => {
            const topic = topics.find(t => t.slug === topicSlug);
            return topic ? (
              <button
                key={topicSlug}
                onClick={() => toggleTopic(topicSlug)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
              >
                {topic.name}
                <XMarkIcon className="w-3 h-3" />
              </button>
            ) : null;
          })}

          {/* Active Tool Pills */}
          {selectedToolSlugs.map(toolSlug => {
            const tool = tools.find(t => t.slug === toolSlug);
            return tool ? (
              <button
                key={toolSlug}
                onClick={() => toggleTool(toolSlug)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
              >
                {tool.name}
                <XMarkIcon className="w-3 h-3" />
              </button>
            ) : null;
          })}

          {/* Clear All Button */}
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter Dropdown */}
      {showFilterDropdown && showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={() => setShowFilterDropdown(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Topics */}
            {topics.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topics
                </h4>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {topics.map((topic) => (
                    <button
                      key={topic.slug}
                      onClick={() => toggleTopic(topic.slug)}
                      className={`
                        px-3 py-1.5 rounded-md text-sm font-medium transition-all
                        ${
                          selectedTopics.includes(topic.slug)
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {tools.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tools
                </h4>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {tools.map((tool) => (
                    <button
                      key={tool.slug}
                      onClick={() => toggleTool(tool.slug)}
                      className={`
                        px-3 py-1.5 rounded-md text-sm font-medium transition-all
                        ${
                          selectedToolSlugs.includes(tool.slug)
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
