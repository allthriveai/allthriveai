import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { PromptEditorTray } from '@/components/admin/PromptEditorTray';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckIcon,
  SparklesIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

interface PromptChallengePrompt {
  id: number;
  promptText: string;
  category: { id: number; name: string; slug: string } | null;
  difficulty: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  weight: number;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface PromptStats {
  total: number;
  active: number;
  inactive: number;
  totalUsage: number;
  byDifficulty: { easy?: number; medium?: number; hard?: number };
  byCategory: { categoryId: number; categoryName: string; count: number }[];
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function StatCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'red' | 'primary' | 'blue';
  onClick?: () => void;
  active?: boolean;
}) {
  const colors = {
    green: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
    yellow: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
    primary: 'bg-primary-50 dark:bg-cyan-500/10 border-primary-200 dark:border-cyan-500/30',
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
  };
  const textColors = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400',
    primary: 'text-primary-600 dark:text-cyan-neon',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all ${colors[color]} ${
        active ? 'ring-2 ring-primary-500 dark:ring-cyan-500' : ''
      } ${onClick ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value.toLocaleString()}</p>
    </button>
  );
}

export default function PromptChallengePromptsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptChallengePrompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<PromptStats>({
    total: 0,
    active: 0,
    inactive: 0,
    totalUsage: 0,
    byDifficulty: {},
    byCategory: [],
  });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Tray state
  const [showTray, setShowTray] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptChallengePrompt | null>(null);
  const [trayLoading, setTrayLoading] = useState(false);
  const [trayError, setTrayError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    categoryId: '',
    difficulty: '',
    weight: '',
    isActive: '',
  });
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
      });
      if (categoryFilter) params.append('category', categoryFilter);
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (activeFilter) params.append('is_active', activeFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/battles/admin/prompt-challenge-prompts/?${params}`);
      setPrompts(response.data.prompts);
      setPagination({
        page: response.data.page,
        pageSize: response.data.pageSize,
        total: response.data.total,
        totalPages: response.data.totalPages,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch prompts');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, categoryFilter, difficultyFilter, activeFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/battles/admin/prompt-challenge-prompts/stats/');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/battles/admin/prompt-challenge-prompts/categories/');
      setCategories(response.data.categories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchPrompts();
      fetchStats();
      fetchCategories();
    }
  }, [user, fetchPrompts, fetchStats, fetchCategories]);

  const handleCreate = () => {
    setEditingPrompt(null);
    setTrayError(null);
    setShowTray(true);
  };

  const handleEdit = (prompt: PromptChallengePrompt) => {
    setEditingPrompt(prompt);
    setTrayError(null);
    setShowTray(true);
  };

  const handleTraySubmit = async (data: {
    promptText: string;
    categoryId: number | null;
    difficulty: string;
    weight: number;
    isActive: boolean;
  }) => {
    setTrayLoading(true);
    setTrayError(null);

    try {
      const payload = {
        promptText: data.promptText,
        categoryId: data.categoryId,
        difficulty: data.difficulty,
        weight: data.weight,
        isActive: data.isActive,
      };

      if (editingPrompt) {
        await api.put(`/battles/admin/prompt-challenge-prompts/${editingPrompt.id}/`, payload);
      } else {
        await api.post('/battles/admin/prompt-challenge-prompts/create/', payload);
      }

      setShowTray(false);
      await Promise.all([fetchPrompts(), fetchStats()]);
    } catch (err: any) {
      setTrayError(err.response?.data?.error || 'Failed to save prompt');
      throw err;
    } finally {
      setTrayLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setActionLoading(id);
    try {
      await api.delete(`/battles/admin/prompt-challenge-prompts/${id}/`);
      setDeleteConfirm(null);
      await Promise.all([fetchPrompts(), fetchStats()]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete prompt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (prompt: PromptChallengePrompt) => {
    setActionLoading(prompt.id);
    try {
      await api.put(`/battles/admin/prompt-challenge-prompts/${prompt.id}/`, {
        is_active: !prompt.isActive,
      });
      await Promise.all([fetchPrompts(), fetchStats()]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle active status');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === prompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prompts.map((p) => p.id)));
    }
  };

  const handleSelectPrompt = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleOpenBulkEdit = () => {
    setBulkEditData({
      categoryId: '',
      difficulty: '',
      weight: '',
      isActive: '',
    });
    setShowBulkEditModal(true);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;

    const updates: Record<string, unknown> = {};
    if (bulkEditData.categoryId !== '') {
      updates.categoryId = bulkEditData.categoryId === 'null' ? null : parseInt(bulkEditData.categoryId);
    }
    if (bulkEditData.difficulty !== '') {
      updates.difficulty = bulkEditData.difficulty;
    }
    if (bulkEditData.weight !== '') {
      updates.weight = parseFloat(bulkEditData.weight);
    }
    if (bulkEditData.isActive !== '') {
      updates.isActive = bulkEditData.isActive === 'true';
    }

    if (Object.keys(updates).length === 0) {
      setError('Please select at least one field to update');
      return;
    }

    setBulkActionLoading(true);
    try {
      await api.post('/battles/admin/prompt-challenge-prompts/bulk-update/', {
        ids: Array.from(selectedIds),
        updates,
      });
      setShowBulkEditModal(false);
      setSelectedIds(new Set());
      await Promise.all([fetchPrompts(), fetchStats()]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk update prompts');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      await api.post('/battles/admin/prompt-challenge-prompts/bulk-delete/', {
        ids: Array.from(selectedIds),
      });
      setShowBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      await Promise.all([fetchPrompts(), fetchStats()]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk delete prompts');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
    const styles = {
      easy: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30',
      medium: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30',
      hard: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${styles[difficulty as keyof typeof styles] || styles.medium}`}>
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
      </span>
    );
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-6 md:p-8 max-w-7xl">
          {/* Header */}
          <header className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Prompt <span className="text-primary-600 dark:text-cyan-neon">Library</span>
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage curated prompts for prompt battles
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 dark:bg-cyan-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-cyan-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Add Prompt
            </button>
          </header>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Prompts"
              value={stats.total}
              color="primary"
              onClick={() => setActiveFilter('')}
              active={activeFilter === ''}
            />
            <StatCard
              label="Active"
              value={stats.active}
              color="green"
              onClick={() => setActiveFilter('true')}
              active={activeFilter === 'true'}
            />
            <StatCard
              label="Inactive"
              value={stats.inactive}
              color="red"
              onClick={() => setActiveFilter('false')}
              active={activeFilter === 'false'}
            />
            <StatCard
              label="Total Uses"
              value={stats.totalUsage}
              color="blue"
            />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-primary-500/30 dark:focus:ring-cyan-500/30"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Difficulty Filter */}
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="mb-4 p-4 bg-primary-50 dark:bg-cyan-500/10 border border-primary-200 dark:border-cyan-500/30 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-primary-700 dark:text-cyan-300">
                {selectedIds.size} prompt{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenBulkEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                  Bulk Edit
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Prompts Table */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-primary-200 dark:border-cyan-500/30 border-t-primary-500 dark:border-t-cyan-neon rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Loading prompts...</p>
              </div>
            ) : prompts.length === 0 ? (
              <div className="p-12 text-center">
                <SparklesIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">No prompts found</p>
                <button
                  onClick={handleCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-primary-600 dark:text-cyan-neon hover:underline"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add your first prompt
                </button>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === prompts.length && prompts.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-500 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                    />
                  </div>
                  <div className="col-span-4">Prompt</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-1">Difficulty</div>
                  <div className="col-span-1">Weight</div>
                  <div className="col-span-1">Uses</div>
                  <div className="col-span-2">Actions</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                        !prompt.isActive ? 'opacity-50' : ''
                      } ${selectedIds.has(prompt.id) ? 'bg-primary-50/50 dark:bg-cyan-500/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <div className="hidden md:flex md:col-span-1 items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(prompt.id)}
                          onChange={() => handleSelectPrompt(prompt.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-500 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                      </div>

                      {/* Prompt Text */}
                      <div className="md:col-span-4">
                        <p className="text-slate-900 dark:text-white line-clamp-2">
                          {prompt.promptText}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {formatDate(prompt.createdAt)}
                        </p>
                      </div>

                      {/* Category */}
                      <div className="md:col-span-2 flex items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {prompt.category?.name || '-'}
                        </span>
                      </div>

                      {/* Difficulty */}
                      <div className="md:col-span-1 flex items-center">
                        <DifficultyBadge difficulty={prompt.difficulty} />
                      </div>

                      {/* Weight */}
                      <div className="md:col-span-1 flex items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {prompt.weight.toFixed(1)}
                        </span>
                      </div>

                      {/* Times Used */}
                      <div className="md:col-span-1 flex items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {prompt.timesUsed}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(prompt)}
                          disabled={actionLoading === prompt.id}
                          className={`p-2 rounded-lg transition-colors ${
                            prompt.isActive
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                          title={prompt.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(prompt)}
                          className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {deleteConfirm === prompt.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              disabled={actionLoading === prompt.id}
                              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              title="Confirm Delete"
                            >
                              <CheckIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                              title="Cancel"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(prompt.id)}
                            className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                      {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                      {pagination.total} prompts
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Add/Edit Tray */}
        <PromptEditorTray
          isOpen={showTray}
          onClose={() => setShowTray(false)}
          onSubmit={handleTraySubmit}
          editingPrompt={editingPrompt}
          categories={categories}
          isLoading={trayLoading}
          error={trayError}
        />

        {/* Bulk Edit Modal */}
        {showBulkEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowBulkEditModal(false)}
            />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Bulk Edit {selectedIds.size} Prompt{selectedIds.size !== 1 ? 's' : ''}
                </h2>
                <button
                  onClick={() => setShowBulkEditModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Only fill in the fields you want to update. Empty fields will not be changed.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={bulkEditData.categoryId}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
                  >
                    <option value="">-- No change --</option>
                    <option value="null">Remove category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={bulkEditData.difficulty}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
                  >
                    <option value="">-- No change --</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Weight
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    placeholder="-- No change --"
                    value={bulkEditData.weight}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, weight: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Status
                  </label>
                  <select
                    value={bulkEditData.isActive}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, isActive: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50"
                  >
                    <option value="">-- No change --</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBulkEditModal(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpdate}
                    disabled={bulkActionLoading}
                    className="px-4 py-2.5 bg-primary-600 dark:bg-cyan-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {bulkActionLoading ? 'Updating...' : 'Update All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowBulkDeleteConfirm(false)}
            />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-500/20 rounded-full">
                  <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
                  Delete {selectedIds.size} Prompt{selectedIds.size !== 1 ? 's' : ''}?
                </h3>
                <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
                  This action cannot be undone. All selected prompts will be permanently deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {bulkActionLoading ? 'Deleting...' : 'Delete All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </DashboardLayout>
  );
}
