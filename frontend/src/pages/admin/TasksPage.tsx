import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  useTasks,
  useTaskStatuses,
  useTaskTypes,
  useTaskPriorities,
  useAdminUsers,
  useTaskStats,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTask,
  useBulkUpdateTasks,
} from '@/hooks/useAdminTasks';
import { adminTasksService } from '@/services/adminTasks';
import type {
  Task,
  TaskQueryParams,
  TaskFilters,
  KanbanColumn,
} from '@/types/tasks';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';

// Sub-components
import { TaskKanbanView } from '@/components/admin/tasks/TaskKanbanView';
import { TaskTableView } from '@/components/admin/tasks/TaskTableView';
import { TaskModal } from '@/components/admin/tasks/TaskModal';
import { TaskFiltersPanel } from '@/components/admin/tasks/TaskFiltersPanel';

type ViewMode = 'kanban' | 'table';

export default function TasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  // Filter state
  const [filters, setFilters] = useState<TaskFilters>({});

  // Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // CSV Import/Export state
  const [showCsvMenu, setShowCsvMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
    total_errors: number;
  } | null>(null);

  // Build query params from filters
  const queryParams: TaskQueryParams = useMemo(() => {
    const params: TaskQueryParams = {};
    if (filters.statusIds?.length) {
      params.status = filters.statusIds.join(',');
    }
    if (filters.typeIds?.length) {
      params.taskType = filters.typeIds.join(',');
    }
    if (filters.priorityIds?.length) {
      params.priority = filters.priorityIds.join(',');
    }
    if (filters.assigneeIds) {
      params.assignee = Array.isArray(filters.assigneeIds)
        ? filters.assigneeIds.join(',')
        : filters.assigneeIds;
    }
    if (filters.due) {
      params.due = filters.due;
    }
    if (searchQuery) {
      params.search = searchQuery;
    }
    if (filters.archived) {
      params.archived = 'true';
    }
    return params;
  }, [filters, searchQuery]);

  // Fetch data
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(queryParams);
  const { data: statuses = [], isLoading: statusesLoading } = useTaskStatuses();
  const { data: types = [] } = useTaskTypes();
  const { data: priorities = [] } = useTaskPriorities();
  const { data: admins = [] } = useAdminUsers();
  const { data: stats } = useTaskStats();

  // Mutations
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const reorderTask = useReorderTask();
  const bulkUpdate = useBulkUpdateTasks();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Group tasks by status for kanban view
  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: tasks
        .filter((t) => t.status === status.id)
        .sort((a, b) => a.orderInStatus - b.orderInStatus),
    }));
  }, [statuses, tasks]);

  // Handlers
  const handleCreateTask = useCallback(() => {
    setEditingTask(null);
    setShowTaskModal(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  }, []);

  const handleSaveTask = useCallback(
    async (data: Partial<Task>) => {
      try {
        if (editingTask) {
          await updateTask.mutateAsync({
            id: editingTask.id,
            payload: data,
          });
        } else {
          await createTask.mutateAsync(data as any);
        }
        setShowTaskModal(false);
        setEditingTask(null);
      } catch (error) {
        console.error('Failed to save task:', error);
      }
    },
    [editingTask, createTask, updateTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: number) => {
      if (!confirm('Are you sure you want to delete this task?')) return;
      try {
        await deleteTask.mutateAsync(taskId);
      } catch (error) {
        console.error('Failed to delete task:', error);
      }
    },
    [deleteTask]
  );

  const handleReorderTask = useCallback(
    async (taskId: number, newStatusId: number | undefined, newOrder: number) => {
      try {
        await reorderTask.mutateAsync({
          taskId,
          newStatusId,
          newOrder,
        });
      } catch (error) {
        console.error('Failed to reorder task:', error);
      }
    },
    [reorderTask]
  );

  const handleBulkUpdate = useCallback(
    async (updates: { status?: number; assignee?: number | null; priority?: number }) => {
      if (selectedTaskIds.length === 0) return;
      try {
        await bulkUpdate.mutateAsync({
          taskIds: selectedTaskIds,
          ...updates,
        });
        setSelectedTaskIds([]);
      } catch (error) {
        console.error('Failed to bulk update:', error);
      }
    },
    [selectedTaskIds, bulkUpdate]
  );

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  // CSV Export handler
  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    setShowCsvMenu(false);
    try {
      await adminTasksService.exportToCsv(queryParams);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export tasks. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [queryParams]);

  // CSV Import handler
  const handleImportCsv = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await adminTasksService.importFromCsv(file);
      setImportResult(result);
      // Refresh tasks list
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
    } catch (error) {
      console.error('Failed to import CSV:', error);
      setImportResult({
        created: 0,
        updated: 0,
        errors: ['Failed to import file. Please check the format and try again.'],
        total_errors: 1,
      });
    } finally {
      setIsImporting(false);
    }
  }, [queryClient]);

  // Download template handler
  const handleDownloadTemplate = useCallback(async () => {
    setShowCsvMenu(false);
    try {
      await adminTasksService.downloadCsvTemplate();
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  }, []);

  // File input change handler
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImportCsv(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleImportCsv]
  );

  // Close CSV menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showCsvMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-csv-menu]')) {
          setShowCsvMenu(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showCsvMenu]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statusIds?.length) count++;
    if (filters.typeIds?.length) count++;
    if (filters.priorityIds?.length) count++;
    if (filters.assigneeIds) count++;
    if (filters.due) count++;
    if (searchQuery) count++;
    return count;
  }, [filters, searchQuery]);

  const isLoading = tasksLoading || statusesLoading;

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-full">
          {/* Header */}
          <header className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    Admin <span className="text-cyan-600 dark:text-cyan-400">Tasks</span>
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Track and manage admin tasks
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* CSV Import/Export Menu */}
                <div className="relative" data-csv-menu>
                  <button
                    onClick={() => setShowCsvMenu(!showCsvMenu)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    )}
                  </button>

                  {showCsvMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="p-1">
                        <button
                          onClick={handleExportCsv}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Export to CSV
                        </button>
                        <button
                          onClick={() => {
                            setShowCsvMenu(false);
                            setShowImportModal(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                        >
                          <ArrowUpTrayIcon className="w-4 h-4" />
                          Import from CSV
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                        <button
                          onClick={handleDownloadTemplate}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                          Download CSV Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCreateTask}
                  className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">New Task</span>
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            {stats && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  <span>{stats.byStatus?.done || 0} done</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <ArrowPathIcon className="w-4 h-4 text-yellow-500" />
                  <span>{stats.byStatus?.['in-progress'] || 0} in progress</span>
                </div>
                {stats.overdue > 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <ExclamationCircleIcon className="w-4 h-4" />
                    <span>{stats.overdue} overdue</span>
                  </div>
                )}
                {stats.dueSoon > 0 && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                    <ClockIcon className="w-4 h-4" />
                    <span>{stats.dueSoon} due soon</span>
                  </div>
                )}
              </div>
            )}
          </header>

          {/* Toolbar */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* View Toggle & Filters */}
            <div className="flex items-center gap-2">
              {/* Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <FunnelIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-cyan-500 text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}

              {/* View Mode Toggle */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'kanban'
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Kanban View"
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <TaskFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              statuses={statuses}
              types={types}
              priorities={priorities}
              admins={admins}
              onClose={() => setShowFilters(false)}
            />
          )}

          {/* Bulk Actions Bar */}
          {selectedTaskIds.length > 0 && (
            <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
                {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                {/* Quick status change */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate({ status: parseInt(e.target.value) });
                    }
                  }}
                  className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-cyan-300 dark:border-cyan-500/30 rounded-lg"
                  defaultValue=""
                >
                  <option value="">Move to...</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedTaskIds([])}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Main Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-cyan-200 dark:border-cyan-500/30 border-t-cyan-500 dark:border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : viewMode === 'kanban' ? (
            <TaskKanbanView
              columns={kanbanColumns}
              onTaskClick={handleEditTask}
              onReorder={handleReorderTask}
              onQuickCreate={(_statusId) => {
                // TODO: Pre-populate status when quick creating from a column
                void _statusId;
                setEditingTask(null);
                setShowTaskModal(true);
              }}
            />
          ) : (
            <TaskTableView
              tasks={tasks}
              statuses={statuses}
              types={types}
              priorities={priorities}
              admins={admins}
              selectedIds={selectedTaskIds}
              onSelectionChange={setSelectedTaskIds}
              onTaskClick={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {/* Empty State */}
          {!isLoading && tasks.length === 0 && (
            <div className="text-center py-16">
              <ClipboardDocumentListIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {activeFilterCount > 0 ? 'No matching tasks' : 'No tasks yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'Create your first task to get started'}
              </p>
              {activeFilterCount === 0 && (
                <button
                  onClick={handleCreateTask}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  Create Task
                </button>
              )}
            </div>
          )}

          {/* Task Modal */}
          {showTaskModal && (
            <TaskModal
              task={editingTask}
              statuses={statuses}
              types={types}
              priorities={priorities}
              admins={admins}
              currentUser={admins.find((a) => a.id === user?.id) || null}
              onSave={handleSaveTask}
              onClose={() => {
                setShowTaskModal(false);
                setEditingTask(null);
              }}
              isLoading={createTask.isPending || updateTask.isPending}
            />
          )}

          {/* CSV Import Modal */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Import Tasks from CSV
                  </h2>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  {!importResult ? (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Upload a CSV file to import tasks. The file should include columns for Title, Description, Status, Type, Priority, Assignee Email, and Due Date.
                      </p>

                      {/* File Drop Zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
                      >
                        {isImporting ? (
                          <div className="flex flex-col items-center">
                            <ArrowPathIcon className="w-10 h-10 text-cyan-500 animate-spin mb-3" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Importing...
                            </p>
                          </div>
                        ) : (
                          <>
                            <ArrowUpTrayIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Click to select a CSV file
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              or drag and drop
                            </p>
                          </>
                        )}
                      </div>

                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={handleDownloadTemplate}
                          className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                          Download template
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Import Results */}
                      <div className="space-y-4">
                        {(importResult.created > 0 || importResult.updated > 0) && (
                          <div className="p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                              <CheckCircleIcon className="w-5 h-5" />
                              <span className="font-medium">Import Successful</span>
                            </div>
                            <p className="mt-1 text-sm text-green-600 dark:text-green-300">
                              {importResult.created > 0 && `${importResult.created} task${importResult.created > 1 ? 's' : ''} created`}
                              {importResult.created > 0 && importResult.updated > 0 && ', '}
                              {importResult.updated > 0 && `${importResult.updated} task${importResult.updated > 1 ? 's' : ''} updated`}
                            </p>
                          </div>
                        )}

                        {importResult.total_errors > 0 && (
                          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                              <ExclamationCircleIcon className="w-5 h-5" />
                              <span className="font-medium">
                                {importResult.total_errors} Error{importResult.total_errors > 1 ? 's' : ''}
                              </span>
                            </div>
                            {importResult.errors.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm text-red-600 dark:text-red-300 max-h-32 overflow-y-auto">
                                {importResult.errors.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setImportResult(null)}
                          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          Import More
                        </button>
                        <button
                          onClick={() => {
                            setShowImportModal(false);
                            setImportResult(null);
                          }}
                          className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
                        >
                          Done
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
