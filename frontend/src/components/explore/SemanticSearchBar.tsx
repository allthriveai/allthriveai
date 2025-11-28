import { useState } from 'react';
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SemanticSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export function SemanticSearchBar({
  onSearch,
  placeholder = 'Search with AI...',
  initialValue = '',
}: SemanticSearchBarProps) {
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

  return (
    <form onSubmit={handleSubmit} className="mb-6">
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
          className="w-full pl-16 pr-24 py-3.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-16 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        {/* Search Button */}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors flex items-center gap-1.5"
          aria-label="Search"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* AI Badge */}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <SparklesIcon className="w-3.5 h-3.5" />
        <span>Powered by Weaviate semantic search</span>
      </div>
    </form>
  );
}
