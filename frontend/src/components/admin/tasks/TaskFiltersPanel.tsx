import type { TaskOption, TaskAdminUser, TaskFilters } from '@/types/tasks';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TaskFiltersPanelProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  statuses: TaskOption[];
  types: TaskOption[];
  priorities: TaskOption[];
  admins: TaskAdminUser[];
  onClose: () => void;
}

export function TaskFiltersPanel({
  filters,
  onFiltersChange,
  statuses,
  types,
  priorities,
  admins,
  onClose,
}: TaskFiltersPanelProps) {
  const toggleArrayFilter = (
    key: 'statusIds' | 'typeIds' | 'priorityIds',
    id: number
  ) => {
    const current = filters[key] || [];
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    onFiltersChange({ ...filters, [key]: updated.length > 0 ? updated : undefined });
  };

  const setAssigneeFilter = (value: string) => {
    if (value === '') {
      onFiltersChange({ ...filters, assigneeIds: undefined });
    } else if (value === 'unassigned') {
      onFiltersChange({ ...filters, assigneeIds: 'unassigned' });
    } else {
      onFiltersChange({ ...filters, assigneeIds: [parseInt(value)] });
    }
  };

  const setDueFilter = (value: string) => {
    onFiltersChange({
      ...filters,
      due: value as 'overdue' | 'today' | 'week' | undefined || undefined,
    });
  };

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Status
          </label>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((status) => {
              const isSelected = filters.statusIds?.includes(status.id);
              return (
                <button
                  key={status.id}
                  onClick={() => toggleArrayFilter('statusIds', status.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {status.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {types.map((type) => {
              const isSelected = filters.typeIds?.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleArrayFilter('typeIds', type.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Priority
          </label>
          <div className="flex flex-wrap gap-1.5">
            {priorities.map((priority) => {
              const isSelected = filters.priorityIds?.includes(priority.id);
              return (
                <button
                  key={priority.id}
                  onClick={() => toggleArrayFilter('priorityIds', priority.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {priority.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assignee & Due Date */}
        <div className="space-y-4">
          {/* Assignee Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Assignee
            </label>
            <select
              value={
                filters.assigneeIds === 'unassigned'
                  ? 'unassigned'
                  : Array.isArray(filters.assigneeIds)
                  ? filters.assigneeIds[0]?.toString() || ''
                  : ''
              }
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50"
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.firstName || admin.email.split('@')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Due Date
            </label>
            <select
              value={filters.due || ''}
              onChange={(e) => setDueFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50"
            >
              <option value="">All</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
