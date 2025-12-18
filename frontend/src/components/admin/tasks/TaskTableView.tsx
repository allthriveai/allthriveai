import { useState, useCallback } from 'react';
import type { Task, TaskOption, TaskAdminUser } from '@/types/tasks';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface TaskTableViewProps {
  tasks: Task[];
  statuses: TaskOption[];
  types: TaskOption[];
  priorities: TaskOption[];
  admins: TaskAdminUser[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: number) => void;
}

type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Color mapping
const colorMap: Record<string, { bg: string; text: string }> = {
  slate: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300' },
  green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300' },
  red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300' },
};

function getColorClasses(color: string) {
  return colorMap[color] || colorMap.slate;
}

export function TaskTableView({
  tasks,
  statuses: _statuses,
  types: _types,
  priorities: _priorities,
  admins: _admins,
  selectedIds,
  onSelectionChange,
  onTaskClick,
  onDeleteTask,
}: TaskTableViewProps) {
  // These props are kept for potential future use (e.g., inline editing)
  void _statuses;
  void _types;
  void _priorities;
  void _admins;
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'status':
        comparison = (a.statusDetail?.name || '').localeCompare(b.statusDetail?.name || '');
        break;
      case 'priority':
        comparison = (a.priorityDetail?.order || 0) - (b.priorityDetail?.order || 0);
        break;
      case 'assignee': {
        const aName = a.assigneeDetail?.firstName || a.assigneeDetail?.email || '';
        const bName = b.assigneeDetail?.firstName || b.assigneeDetail?.email || '';
        comparison = aName.localeCompare(bName);
        break;
      }
      case 'dueDate': {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = aDate - bDate;
        break;
      }
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === tasks.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(tasks.map((t) => t.id));
    }
  }, [selectedIds.length, tasks, onSelectionChange]);

  const handleSelectTask = useCallback(
    (taskId: number) => {
      if (selectedIds.includes(taskId)) {
        onSelectionChange(selectedIds.filter((id) => id !== taskId));
      } else {
        onSelectionChange([...selectedIds, taskId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {/* Checkbox */}
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === tasks.length && tasks.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
                />
              </th>
              {/* Title */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Task
                  <SortIcon field="title" />
                </button>
              </th>
              {/* Status */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Status
                  <SortIcon field="status" />
                </button>
              </th>
              {/* Priority */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Priority
                  <SortIcon field="priority" />
                </button>
              </th>
              {/* Assignee */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('assignee')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Assignee
                  <SortIcon field="assignee" />
                </button>
              </th>
              {/* Due Date */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('dueDate')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Due Date
                  <SortIcon field="dueDate" />
                </button>
              </th>
              {/* Actions */}
              <th className="w-16 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {sortedTasks.map((task) => {
              const isSelected = selectedIds.includes(task.id);
              const isOverdue =
                task.dueDate && new Date(task.dueDate) < new Date() && !task.completedAt;
              const statusColors = task.statusDetail
                ? getColorClasses(task.statusDetail.color)
                : null;
              const priorityColors = task.priorityDetail
                ? getColorClasses(task.priorityDetail.color)
                : null;

              return (
                <tr
                  key={task.id}
                  className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                    isSelected ? 'bg-cyan-50 dark:bg-cyan-500/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectTask(task.id)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
                    />
                  </td>
                  {/* Title */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onTaskClick(task)}
                      className="text-left group"
                    >
                      <div className="flex items-center gap-2">
                        {task.taskTypeDetail && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              getColorClasses(task.taskTypeDetail.color).bg
                            } ${getColorClasses(task.taskTypeDetail.color).text}`}
                          >
                            {task.taskTypeDetail.name}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {task.title}
                      </span>
                    </button>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    {statusColors && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${statusColors.bg} ${statusColors.text}`}
                      >
                        {task.statusDetail?.name}
                      </span>
                    )}
                  </td>
                  {/* Priority */}
                  <td className="px-4 py-3">
                    {priorityColors && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${priorityColors.bg} ${priorityColors.text}`}
                      >
                        {task.priorityDetail?.name}
                      </span>
                    )}
                  </td>
                  {/* Assignee */}
                  <td className="px-4 py-3">
                    {task.assigneeDetail ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                          {task.assigneeDetail.avatar ? (
                            <img
                              src={task.assigneeDetail.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (
                              task.assigneeDetail.firstName?.[0] ||
                              task.assigneeDetail.email[0]
                            ).toUpperCase()
                          )}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {task.assigneeDetail.firstName ||
                            task.assigneeDetail.email.split('@')[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        Unassigned
                      </span>
                    )}
                  </td>
                  {/* Due Date */}
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span
                        className={`flex items-center gap-1 text-sm ${
                          isOverdue
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <CalendarIcon className="w-4 h-4" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        No date
                      </span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Delete task"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          No tasks found
        </div>
      )}
    </div>
  );
}
