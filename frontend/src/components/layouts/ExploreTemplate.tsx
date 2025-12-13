import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

export interface FilterOption {
  id: string;
  label: string;
  value: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  multiSelect?: boolean;
}

export interface ExploreTemplateProps<T> {
  // Header
  title: string;
  subtitle?: string;
  icon?: ReactNode;

  // Data
  items: T[];
  isLoading?: boolean;
  error?: string | null;

  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;

  // Filters
  filterGroups?: FilterGroup[];
  activeFilters?: Record<string, string[]>;
  onFilterChange?: (filterId: string, values: string[]) => void;

  // Rendering
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T) => string | number;

  // Empty states
  emptyMessage?: string;
  emptySearchMessage?: string;

  // Layout
  columns?: 2 | 3 | 4 | 5;
}

export function ExploreTemplate<T>({
  title,
  subtitle,
  icon,
  items,
  isLoading = false,
  error = null,
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue = '',
  filterGroups = [],
  activeFilters = {},
  onFilterChange,
  renderItem,
  getItemKey,
  emptyMessage = 'No items found',
  emptySearchMessage = 'No results match your search',
  columns = 4,
}: ExploreTemplateProps<T>) {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleFilterToggle = (groupId: string, optionValue: string) => {
    if (!onFilterChange) return;

    const currentValues = activeFilters[groupId] || [];
    const group = filterGroups.find(g => g.id === groupId);

    if (group?.multiSelect) {
      // Multi-select: toggle the value
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onFilterChange(groupId, newValues);
    } else {
      // Single-select: replace with new value or clear if same
      const newValues = currentValues.includes(optionValue) ? [] : [optionValue];
      onFilterChange(groupId, newValues);
    }
  };

  const clearAllFilters = () => {
    if (!onFilterChange) return;
    filterGroups.forEach(group => {
      onFilterChange(group.id, []);
    });
  };

  const activeFilterCount = Object.values(activeFilters).reduce(
    (sum, values) => sum + values.length,
    0
  );

  const columnClasses = {
    2: 'sm:columns-2',
    3: 'sm:columns-2 lg:columns-3',
    4: 'sm:columns-2 lg:columns-3 xl:columns-4',
    5: 'sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5',
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="flex-1 overflow-y-auto h-full">
          <div className="max-w-7xl mx-auto p-8 pb-24">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                {icon && <div className="text-primary-600 dark:text-primary-400">{icon}</div>}
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Search & Filters Bar */}
            <div className="mb-8 space-y-4">
              <div className="flex gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={localSearchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Filter Toggle Button */}
                {filterGroups.length > 0 && (
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-3 rounded-lg border transition-all flex items-center gap-2 font-medium ${
                      showFilters || activeFilterCount > 0
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <FunnelIcon className="w-5 h-5" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500 text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Filter Panel */}
              {showFilters && filterGroups.length > 0 && (
                <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Filters
                    </h3>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filterGroups.map((group) => (
                      <div key={group.id}>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          {group.label}
                        </h4>
                        <div className="space-y-2">
                          {group.options.map((option) => {
                            const isActive = (activeFilters[group.id] || []).includes(option.value);
                            return (
                              <button
                                key={option.id}
                                onClick={() => handleFilterToggle(group.id, option.value)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                  isActive
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{option.label}</span>
                                  {option.count !== undefined && (
                                    <span className="text-xs text-gray-500 dark:text-gray-500">
                                      {option.count}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Results Count */}
              {localSearchValue && !isLoading && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {items.length} result{items.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className={`columns-1 ${columnClasses[columns]} gap-8 space-y-8`}>
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="break-inside-avoid mb-8 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 animate-pulse"
                    style={{ height: `${200 + (i % 4) * 80}px` }}
                  />
                ))}
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && items.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {localSearchValue ? emptySearchMessage : emptyMessage}
                </p>
              </div>
            )}

            {/* Masonry Grid */}
            {!isLoading && !error && items.length > 0 && (
              <div className={`columns-1 ${columnClasses[columns]} gap-8 space-y-8`}>
                {items.map((item, index) => (
                  <div key={getItemKey(item)} className="break-inside-avoid mb-8">
                    {renderItem(item, index)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
