import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  useTopics,
  useTopicStats,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  useBulkToggleActive,
} from '@/hooks/useAdminTopics';
import type { Topic, TopicQueryParams, CreateTopicPayload } from '@/types/adminTopics';
import {
  TagIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';

// Available colors for topics
const TOPIC_COLORS = [
  'blue',
  'cyan',
  'purple',
  'red',
  'amber',
  'pink',
  'indigo',
  'emerald',
  'slate',
  'teal',
  'fuchsia',
  'lime',
  'violet',
  'orange',
  'yellow',
  'green',
  'sky',
];

// Color class mappings for display
const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-500',
  teal: 'bg-teal-500',
  fuchsia: 'bg-fuchsia-500',
  lime: 'bg-lime-500',
  violet: 'bg-violet-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  sky: 'bg-sky-500',
};

type SortField = 'title' | 'projectCount' | 'createdAt' | 'isActive';
type SortDir = 'asc' | 'desc';

interface TopicFormData {
  slug: string;
  title: string;
  description: string;
  color: string;
  isActive: boolean;
}

const DEFAULT_FORM_DATA: TopicFormData = {
  slug: '',
  title: '',
  description: '',
  color: 'blue',
  isActive: true,
};

export default function TopicsManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState<TopicFormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Partial<TopicFormData>>({});

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Build query params
  const queryParams: TopicQueryParams = useMemo(() => {
    const params: TopicQueryParams = {};
    if (filterActive !== 'all') {
      params.isActive = filterActive === 'active' ? 'true' : 'false';
    }
    if (searchQuery) {
      params.search = searchQuery;
    }
    params.sortBy = sortField;
    params.sortDir = sortDir;
    return params;
  }, [filterActive, searchQuery, sortField, sortDir]);

  // Fetch data
  const { data: topics = [], isLoading, refetch } = useTopics(queryParams);
  const { data: stats } = useTopicStats();

  // Mutations
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const bulkToggle = useBulkToggleActive();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditingTopic(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleOpenEdit = useCallback((topic: Topic) => {
    setEditingTopic(topic);
    setFormData({
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      color: topic.color,
      isActive: topic.isActive,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingTopic(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Partial<TopicFormData> = {};
    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      errors.slug = 'Slug must be lowercase letters, numbers, and hyphens only';
    }
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    try {
      const payload: CreateTopicPayload = {
        slug: formData.slug.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        color: formData.color,
        isActive: formData.isActive,
      };

      if (editingTopic) {
        await updateTopic.mutateAsync({ id: editingTopic.id, payload });
      } else {
        await createTopic.mutateAsync(payload);
      }
      handleCloseModal();
    } catch (error: unknown) {
      console.error('Failed to save topic:', error);
      // Handle API validation errors
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: Record<string, string[]> } }).response;
        if (response?.data) {
          const apiErrors: Partial<TopicFormData> = {};
          Object.entries(response.data).forEach(([key, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              apiErrors[key as keyof TopicFormData] = messages[0] as never;
            }
          });
          setFormErrors(apiErrors);
        }
      }
    }
  }, [formData, editingTopic, validateForm, createTopic, updateTopic, handleCloseModal]);

  const handleDelete = useCallback(
    async (topic: Topic) => {
      if (!confirm(`Are you sure you want to delete "${topic.title}"? This cannot be undone.`)) return;
      try {
        await deleteTopic.mutateAsync(topic.id);
      } catch (error) {
        console.error('Failed to delete topic:', error);
        alert('Failed to delete topic. It may be in use by projects.');
      }
    },
    [deleteTopic]
  );

  const handleToggleActive = useCallback(
    async (topic: Topic) => {
      try {
        await updateTopic.mutateAsync({
          id: topic.id,
          payload: { isActive: !topic.isActive },
        });
      } catch (error) {
        console.error('Failed to toggle topic:', error);
      }
    },
    [updateTopic]
  );

  const handleBulkToggle = useCallback(
    async (isActive: boolean) => {
      if (selectedIds.length === 0) return;
      try {
        await bulkToggle.mutateAsync({ topicIds: selectedIds, isActive });
        setSelectedIds([]);
      } catch (error) {
        console.error('Failed to bulk toggle:', error);
      }
    },
    [selectedIds, bulkToggle]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === topics.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(topics.map((t) => t.id));
    }
  }, [selectedIds.length, topics]);

  const handleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // Auto-generate slug from title
  const handleTitleChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({
        ...prev,
        title: value,
        // Only auto-generate slug if not editing and slug hasn't been manually set
        slug:
          !editingTopic && prev.slug === prev.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            ? value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            : prev.slug,
      }));
    },
    [editingTopic]
  );

  if (!user || user.role !== 'admin') {
    return null;
  }

  const isSaving = createTopic.isPending || updateTopic.isPending;

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-full">
          {/* Header */}
          <header className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                  <TagIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    Topics <span className="text-purple-600 dark:text-purple-400">Management</span>
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Manage project categorization topics
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">New Topic</span>
              </button>
            </div>

            {/* Stats */}
            {stats && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <TagIcon className="w-4 h-4" />
                  <span>{stats.total} total topics</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>{stats.active} active</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                  <XCircleIcon className="w-4 h-4" />
                  <span>{stats.inactive} inactive</span>
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
                  placeholder="Search topics..."
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

            {/* Filter & Refresh */}
            <div className="flex items-center gap-2">
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Topics</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <button
                onClick={() => refetch()}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                {selectedIds.length} topic{selectedIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkToggle(true)}
                  disabled={bulkToggle.isPending}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulkToggle(false)}
                  disabled={bulkToggle.isPending}
                  className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Topics Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-200 dark:border-purple-500/30 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-16">
              <TagIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {searchQuery || filterActive !== 'all' ? 'No matching topics' : 'No topics yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {searchQuery || filterActive !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first topic to get started'}
              </p>
              {!searchQuery && filterActive === 'all' && (
                <button
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  Create Topic
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === topics.length && topics.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('title')}
                          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          Topic
                          <ChevronUpDownIcon className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Description
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSort('projectCount')}
                          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mx-auto"
                        >
                          Projects
                          <ChevronUpDownIcon className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSort('isActive')}
                          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mx-auto"
                        >
                          Status
                          <ChevronUpDownIcon className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {topics.map((topic) => (
                      <tr
                        key={topic.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(topic.id)}
                            onChange={() => handleSelectOne(topic.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 rounded-full ${COLOR_CLASSES[topic.color] || 'bg-slate-500'}`}
                            />
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {topic.title}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {topic.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 max-w-md">
                            {topic.description}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">
                            {topic.projectCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(topic)}
                            disabled={updateTopic.isPending}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-full transition-colors ${
                              topic.isActive
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {topic.isActive ? (
                              <>
                                <CheckCircleIcon className="w-4 h-4" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-4 h-4" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(topic)}
                              className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(topic)}
                              disabled={deleteTopic.isPending}
                              className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {editingTopic ? 'Edit Topic' : 'Create Topic'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Form */}
                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className={`w-full px-3 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                        formErrors.title
                          ? 'border-red-300 dark:border-red-500 focus:ring-red-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-purple-500/30'
                      }`}
                      placeholder="e.g., AI Agents"
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.title}</p>
                    )}
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                      className={`w-full px-3 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 font-mono text-sm ${
                        formErrors.slug
                          ? 'border-red-300 dark:border-red-500 focus:ring-red-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-purple-500/30'
                      }`}
                      placeholder="e.g., ai-agents"
                    />
                    {formErrors.slug && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.slug}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className={`w-full px-3 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 resize-none ${
                        formErrors.description
                          ? 'border-red-300 dark:border-red-500 focus:ring-red-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-purple-500/30'
                      }`}
                      placeholder="Brief description of this topic..."
                    />
                    {formErrors.description && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>
                    )}
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TOPIC_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-lg ${COLOR_CLASSES[color]} transition-all ${
                            formData.color === color
                              ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-800 scale-110'
                              : 'hover:scale-105'
                          }`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    {editingTopic ? 'Save Changes' : 'Create Topic'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
