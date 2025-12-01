import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface ToolFilters {
  tool_type?: string;
  category?: string;
  company?: number;
  pricing_model?: string;
  has_free_tier?: boolean;
}

interface ToolFiltersProps {
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

export function ToolFiltersBar({ filters, onFiltersChange, categories, companies }: ToolFiltersProps) {
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '').length;

  const clearFilters = () => {
    onFiltersChange({});
  };

  const updateFilter = (key: keyof ToolFilters, value: string | boolean | undefined) => {
    const newFilters = { ...filters };
    if (value === '' || value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value as any;
    }
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-4">
      {/* Filter Pills Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <FunnelIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Tool Type Filter */}
        <select
          value={filters.tool_type || ''}
          onChange={(e) => updateFilter('tool_type', e.target.value || undefined)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Types</option>
          {TOOL_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={filters.category || ''}
          onChange={(e) => updateFilter('category', e.target.value || undefined)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label} ({cat.count})
            </option>
          ))}
        </select>

        {/* Company Filter */}
        {companies && companies.length > 0 && (
          <select
            value={filters.company || ''}
            onChange={(e) => updateFilter('company', e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.count})
              </option>
            ))}
          </select>
        )}

        {/* Pricing Filter */}
        <select
          value={filters.pricing_model || ''}
          onChange={(e) => updateFilter('pricing_model', e.target.value || undefined)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Pricing</option>
          {PRICING_MODELS.map((pricing) => (
            <option key={pricing.value} value={pricing.value}>
              {pricing.label}
            </option>
          ))}
        </select>

        {/* Free Tier Toggle */}
        <button
          onClick={() => updateFilter('has_free_tier', filters.has_free_tier ? undefined : true)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filters.has_free_tier
              ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          Free Tier
        </button>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
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
