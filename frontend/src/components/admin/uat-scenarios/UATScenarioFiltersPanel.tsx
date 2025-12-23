/**
 * UATScenarioFiltersPanel - Filter panel for UAT scenarios
 */
import type { UATCategory, UATScenarioAssignee, UATScenarioFilters, TestResult, Priority } from '@/types/uatScenarios';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface UATScenarioFiltersPanelProps {
  filters: UATScenarioFilters;
  onFiltersChange: (filters: UATScenarioFilters) => void;
  categories: UATCategory[];
  admins: UATScenarioAssignee[];
  onClose: () => void;
}

// Color mapping for categories and priorities
const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  slate: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-500/30' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-500/30' },
  green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-500/30' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-500/30' },
  red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-500/30' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-500/30' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-500/30' },
};

function getColorClasses(color: string) {
  return colorMap[color] || colorMap.slate;
}

export function UATScenarioFiltersPanel({
  filters,
  onFiltersChange,
  categories,
  admins: _admins,
  onClose,
}: UATScenarioFiltersPanelProps) {
  void _admins; // No longer used since assignee filter is removed

  const setResultFilter = (value: TestResult | 'not_tested' | undefined) => {
    onFiltersChange({ ...filters, latestResult: value });
  };

  const setCategoryFilter = (value: string) => {
    if (value === '') {
      onFiltersChange({ ...filters, category: undefined });
    } else {
      onFiltersChange({ ...filters, category: parseInt(value) });
    }
  };

  const setPriorityFilter = (value: Priority | undefined) => {
    onFiltersChange({ ...filters, priority: value });
  };

  const resultOptions: { value: TestResult | 'not_tested' | undefined; label: string }[] = [
    { value: undefined, label: 'All' },
    { value: 'pass', label: 'Pass' },
    { value: 'fail', label: 'Fail' },
    { value: 'na', label: 'N/A' },
    { value: 'not_tested', label: 'Not Tested' },
  ];

  const priorityOptions: { value: Priority | undefined; label: string; color: string }[] = [
    { value: undefined, label: 'All', color: 'slate' },
    { value: 'critical', label: 'Critical', color: 'red' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'medium', label: 'Medium', color: 'blue' },
    { value: 'low', label: 'Low', color: 'slate' },
  ];

  return (
    <div className="mb-4 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Filters</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Priority Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Priority
          </label>
          <div className="flex flex-wrap gap-1.5">
            {priorityOptions.map((option) => {
              const isSelected = filters.priority === option.value;
              const colors = getColorClasses(option.color);
              return (
                <button
                  key={option.label}
                  onClick={() => setPriorityFilter(option.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? `${colors.bg} ${colors.text} border ${colors.border}`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                !filters.category
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              All
            </button>
            {categories.map((category) => {
              const isSelected = filters.category === category.id;
              const colors = getColorClasses(category.color);
              return (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id.toString())}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? `${colors.bg} ${colors.text} border ${colors.border}`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Latest Result
          </label>
          <div className="flex flex-wrap gap-1.5">
            {resultOptions.map((option) => {
              const isSelected = filters.latestResult === option.value;
              return (
                <button
                  key={option.label}
                  onClick={() => setResultFilter(option.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
