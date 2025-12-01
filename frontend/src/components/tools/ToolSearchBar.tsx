import { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';

export interface ToolFilters {
  tool_type?: string;
  category?: string;
  company?: number;
  pricing_model?: string;
  has_free_tier?: boolean;
}

interface ToolSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: ToolFilters;
  onFiltersChange: (filters: ToolFilters) => void;
  categories: Array<{ value: string; label: string; count: number }>;
  companies: Array<{ id: number; name: string; slug: string; count: number }>;
}

// Tool type options
const TOOL_TYPES = [
  { value: 'ai_tool', label: 'AI Tools' },
  { value: 'technology', label: 'Technologies' },
];

// Pricing model options
const PRICING_MODELS = [
  { value: 'free', label: 'Free' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'open_source', label: 'Open Source' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'pay_per_use', label: 'Pay Per Use' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function ToolSearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  categories,
  companies,
}: ToolSearchBarProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '').length;

  const clearFilters = () => {
    onFiltersChange({});
  };

  const updateFilter = (key: keyof ToolFilters, value: string | number | boolean | undefined) => {
    const newFilters = { ...filters };
    if (value === '' || value === undefined) {
      delete newFilters[key];
    } else {
      (newFilters as any)[key] = value;
    }
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-3">
      {/* Search Bar with Filter Button */}
      <div className="relative max-w-2xl">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search tools and technologies..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-24 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
        />

        {/* Right Side Buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Clear Search */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`relative p-2 rounded-lg transition-all ${
              activeFilterCount > 0 || showFilterDropdown
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label="Toggle filters"
          >
            <FunnelIcon className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>

          {filters.tool_type && (
            <FilterPill
              label={TOOL_TYPES.find((t) => t.value === filters.tool_type)?.label || filters.tool_type}
              onRemove={() => updateFilter('tool_type', undefined)}
            />
          )}
          {filters.category && (
            <FilterPill
              label={categories.find((c) => c.value === filters.category)?.label || filters.category}
              onRemove={() => updateFilter('category', undefined)}
            />
          )}
          {filters.company && (
            <FilterPill
              label={companies?.find((c) => c.id === filters.company)?.name || `Company ${filters.company}`}
              onRemove={() => updateFilter('company', undefined)}
            />
          )}
          {filters.pricing_model && (
            <FilterPill
              label={PRICING_MODELS.find((p) => p.value === filters.pricing_model)?.label || filters.pricing_model}
              onRemove={() => updateFilter('pricing_model', undefined)}
            />
          )}
          {filters.has_free_tier && (
            <FilterPill label="Free Tier" onRemove={() => updateFilter('has_free_tier', undefined)} />
          )}

          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter Dropdown Panel */}
      {showFilterDropdown && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-lg max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={() => setShowFilterDropdown(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tool Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Type
              </label>
              <select
                value={filters.tool_type || ''}
                onChange={(e) => updateFilter('tool_type', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Types</option>
                {TOOL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => updateFilter('category', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            {companies && companies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Company
                </label>
                <select
                  value={filters.company || ''}
                  onChange={(e) => updateFilter('company', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Pricing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Pricing
              </label>
              <select
                value={filters.pricing_model || ''}
                onChange={(e) => updateFilter('pricing_model', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Pricing</option>
                {PRICING_MODELS.map((pricing) => (
                  <option key={pricing.value} value={pricing.value}>
                    {pricing.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Free Tier Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.has_free_tier || false}
                onChange={(e) => updateFilter('has_free_tier', e.target.checked || undefined)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Only show tools with free tier</span>
            </label>
          </div>

          {/* Apply/Clear Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setShowFilterDropdown(false)}
              className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800/30 rounded-full transition-colors"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
