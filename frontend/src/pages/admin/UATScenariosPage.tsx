/**
 * UATScenariosPage - Admin page for managing UAT test scenarios
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  useUATScenarios,
  useUATCategories,
  useUATAdminUsers,
  useUATScenarioStats,
  useCreateUATScenario,
  useUpdateUATScenario,
  useDeleteUATScenario,
  useCreateUATCategory,
  useCreateTaskFromScenario,
  useCreateUATTestRun,
} from '@/hooks/useUATScenarios';
import type {
  UATScenario,
  UATScenarioQueryParams,
  UATScenarioFilters,
  CreateUATScenarioPayload,
  UpdateUATScenarioPayload,
  CreateUATTestRunPayload,
} from '@/types/uatScenarios';
import {
  BeakerIcon,
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

// Sub-components
import {
  UATScenarioTableView,
  UATScenarioFiltersPanel,
  UATScenarioModal,
  UATTestRunModal,
} from '@/components/admin/uat-scenarios';

export default function UATScenariosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // View state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<number[]>([]);

  // Filter state
  const [filters, setFilters] = useState<UATScenarioFilters>({});

  // Scenario modal state
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<UATScenario | null>(null);

  // Test run modal state
  const [showTestRunModal, setShowTestRunModal] = useState(false);
  const [testRunScenario, setTestRunScenario] = useState<UATScenario | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Build query params from filters
  const queryParams: UATScenarioQueryParams = useMemo(() => {
    const params: UATScenarioQueryParams = {};
    if (filters.latestResult) {
      params.latestResult = filters.latestResult === 'not_tested' ? 'not_tested' : filters.latestResult;
    }
    if (filters.category) {
      params.category = filters.category;
    }
    if (searchQuery) {
      params.search = searchQuery;
    }
    return params;
  }, [filters, searchQuery]);

  // Fetch data
  const { data: scenarios = [], isLoading: scenariosLoading } = useUATScenarios(queryParams);
  const { data: categories = [], isLoading: categoriesLoading } = useUATCategories();
  const { data: admins = [] } = useUATAdminUsers();
  const { data: stats } = useUATScenarioStats();

  // Mutations
  const createScenario = useCreateUATScenario();
  const updateScenario = useUpdateUATScenario();
  const deleteScenario = useDeleteUATScenario();
  const createCategory = useCreateUATCategory();
  const createTaskFromScenario = useCreateTaskFromScenario();
  const createTestRun = useCreateUATTestRun();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Handlers
  const handleCreateScenario = useCallback(() => {
    setEditingScenario(null);
    setShowScenarioModal(true);
  }, []);

  const handleEditScenario = useCallback((scenario: UATScenario) => {
    setEditingScenario(scenario);
    setShowScenarioModal(true);
  }, []);

  const handleSaveScenario = useCallback(
    async (data: CreateUATScenarioPayload | UpdateUATScenarioPayload) => {
      try {
        if (editingScenario) {
          await updateScenario.mutateAsync({
            id: editingScenario.id,
            payload: data as UpdateUATScenarioPayload,
          });
        } else {
          await createScenario.mutateAsync(data as CreateUATScenarioPayload);
        }
        setShowScenarioModal(false);
        setEditingScenario(null);
      } catch (error) {
        console.error('Failed to save scenario:', error);
      }
    },
    [editingScenario, createScenario, updateScenario]
  );

  const handleDeleteScenario = useCallback(
    async (scenarioId: number) => {
      if (!confirm('Are you sure you want to delete this scenario?')) return;
      try {
        await deleteScenario.mutateAsync(scenarioId);
      } catch (error) {
        console.error('Failed to delete scenario:', error);
      }
    },
    [deleteScenario]
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      const result = await createCategory.mutateAsync({ name });
      return result;
    },
    [createCategory]
  );

  const handleCreateTask = useCallback(
    async (scenarioId: number) => {
      try {
        const result = await createTaskFromScenario.mutateAsync(scenarioId);
        // Navigate to the created task
        navigate(`/admin/tasks?task=${result.taskId}`);
      } catch (error) {
        console.error('Failed to create task:', error);
      }
    },
    [createTaskFromScenario, navigate]
  );

  const handleAddTestRun = useCallback((scenario: UATScenario) => {
    setTestRunScenario(scenario);
    setShowTestRunModal(true);
  }, []);

  const handleSaveTestRun = useCallback(
    async (data: CreateUATTestRunPayload) => {
      try {
        await createTestRun.mutateAsync(data);
        setShowTestRunModal(false);
        setTestRunScenario(null);
      } catch (error) {
        console.error('Failed to save test run:', error);
      }
    },
    [createTestRun]
  );

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  const handleExportYaml = useCallback(async () => {
    setIsExporting(true);
    try {
      // For now, just show info - actual export is done via CLI
      alert('To export scenarios to YAML, run:\n\nmake export-uat-scenarios');
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.latestResult) count++;
    if (filters.category) count++;
    if (searchQuery) count++;
    return count;
  }, [filters, searchQuery]);

  const isLoading = scenariosLoading || categoriesLoading;

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
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                  <BeakerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    UAT <span className="text-purple-600 dark:text-purple-400">Scenarios</span>
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Manage user acceptance test scenarios
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Export */}
                <button
                  onClick={handleExportYaml}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                  title="Export to YAML"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={handleCreateScenario}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">New Scenario</span>
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            {stats && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  <span>{stats.latestPassed} passed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
                  <span>{stats.latestFailed} failed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <MinusCircleIcon className="w-4 h-4 text-slate-400" />
                  <span>{stats.latestNa} N/A</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <ClockIcon className="w-4 h-4 text-yellow-500" />
                  <span>{stats.scenariosNeverTested} not tested</span>
                </div>
                {stats.passRate > 0 && (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className={stats.passRate >= 80 ? 'text-green-600 dark:text-green-400' : stats.passRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                      {stats.passRate.toFixed(0)}% pass rate
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                  <span>{stats.totalTestRuns} total runs</span>
                </div>
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
                  placeholder="Search scenarios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 dark:focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
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

            {/* Filters */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <FunnelIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-purple-500 text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <UATScenarioFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              categories={categories}
              admins={admins}
              onClose={() => setShowFilters(false)}
            />
          )}

          {/* Bulk Actions Bar */}
          {selectedScenarioIds.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                {selectedScenarioIds.length} scenario{selectedScenarioIds.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedScenarioIds([])}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Main Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-200 dark:border-purple-500/30 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : (
            <UATScenarioTableView
              scenarios={scenarios}
              categories={categories}
              admins={admins}
              selectedIds={selectedScenarioIds}
              onSelectionChange={setSelectedScenarioIds}
              onScenarioClick={handleEditScenario}
              onDeleteScenario={handleDeleteScenario}
              onCreateTask={handleCreateTask}
              onAddTestRun={handleAddTestRun}
            />
          )}

          {/* Empty State */}
          {!isLoading && scenarios.length === 0 && (
            <div className="text-center py-16">
              <BeakerIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {activeFilterCount > 0 ? 'No matching scenarios' : 'No scenarios yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'Create your first UAT scenario to get started'}
              </p>
              {activeFilterCount === 0 && (
                <button
                  onClick={handleCreateScenario}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  Create Scenario
                </button>
              )}
            </div>
          )}

          {/* Scenario Modal */}
          {showScenarioModal && (
            <UATScenarioModal
              scenario={editingScenario}
              categories={categories}
              admins={admins}
              onSave={handleSaveScenario}
              onClose={() => {
                setShowScenarioModal(false);
                setEditingScenario(null);
              }}
              onCreateCategory={handleCreateCategory}
              isLoading={createScenario.isPending || updateScenario.isPending}
            />
          )}

          {/* Test Run Modal */}
          {showTestRunModal && testRunScenario && (
            <UATTestRunModal
              scenario={testRunScenario}
              admins={admins}
              onSave={handleSaveTestRun}
              onClose={() => {
                setShowTestRunModal(false);
                setTestRunScenario(null);
              }}
              isLoading={createTestRun.isPending}
            />
          )}
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
