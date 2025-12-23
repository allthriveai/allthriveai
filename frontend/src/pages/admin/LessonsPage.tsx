import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  getAdminLessons,
  getAdminAILessons,
  getAdminAILessonDetail,
  updateLessonMetadata,
  updateAdminAILesson,
  bulkMarkAsLessons,
  bulkUnmarkAsLessons,
  type LessonMetadata,
  type AILessonMetadata,
} from '@/services/learningPaths';
import {
  AcademicCapIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  BookOpenIcon,
  ClockIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

type TabMode = 'curated' | 'ai';
type FilterMode = 'all' | 'lessons' | 'not_lessons';

export default function LessonsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<TabMode>('curated');
  const [page, setPage] = useState(1);
  const [aiPage, setAiPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Edit modal state for AI lessons
  const [editingLesson, setEditingLesson] = useState<AILessonMetadata | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    difficulty: 'beginner',
    estimatedMinutes: 10,
    keyConcepts: [] as string[],
    explanation: '',
    examples: [] as Array<{ title: string; description: string; code?: string }>,
    practicePrompt: '',
    mermaidDiagram: '',
  });
  const [keyConceptInput, setKeyConceptInput] = useState('');
  const [newExample, setNewExample] = useState({ title: '', description: '', code: '' });

  // Build query params for curated lessons
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = {
      page,
      pageSize,
    };
    if (searchQuery) params.search = searchQuery;
    if (filterMode === 'lessons') params.isLesson = true;
    if (filterMode === 'not_lessons') params.isLesson = false;
    return params;
  }, [page, pageSize, searchQuery, filterMode]);

  // Build query params for AI lessons
  const aiQueryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page: aiPage,
      pageSize,
    };
    if (searchQuery) params.search = searchQuery;
    return params;
  }, [aiPage, pageSize, searchQuery]);

  // Fetch curated lessons
  const {
    data: lessonsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-lessons', queryParams],
    queryFn: () => getAdminLessons(queryParams),
    enabled: user?.role === 'admin' && activeTab === 'curated',
  });

  // Fetch AI lessons
  const {
    data: aiLessonsData,
    isLoading: aiIsLoading,
    isError: aiIsError,
    refetch: aiRefetch,
  } = useQuery({
    queryKey: ['admin-ai-lessons', aiQueryParams],
    queryFn: () => getAdminAILessons(aiQueryParams),
    enabled: user?.role === 'admin' && activeTab === 'ai',
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LessonMetadata> }) =>
      updateLessonMetadata(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
    },
  });

  const bulkMarkMutation = useMutation({
    mutationFn: bulkMarkAsLessons,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      setSelectedIds([]);
    },
  });

  const bulkUnmarkMutation = useMutation({
    mutationFn: bulkUnmarkAsLessons,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      setSelectedIds([]);
    },
  });

  // AI Lesson update mutation
  const updateAILessonMutation = useMutation({
    mutationFn: ({
      pathId,
      order,
      data,
    }: {
      pathId: number;
      order: number;
      data: Partial<{
        title: string;
        summary: string;
        difficulty: string;
        estimatedMinutes: number;
        keyConcepts: string[];
        explanation: string;
        examples: Array<{ title: string; description: string; code?: string }>;
        practicePrompt: string;
        mermaidDiagram: string;
      }>;
    }) => updateAdminAILesson(pathId, order, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-lessons'] });
      setEditingLesson(null);
    },
  });

  // Handlers
  const handleToggleLesson = (lesson: LessonMetadata) => {
    updateMutation.mutate({
      id: lesson.id,
      data: { isLesson: !lesson.isLesson },
    });
  };

  const handleSelectAll = () => {
    if (!lessonsData?.results) return;
    if (selectedIds.length === lessonsData.results.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(lessonsData.results.map((l) => l.id));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkMark = () => {
    if (selectedIds.length > 0) {
      bulkMarkMutation.mutate(selectedIds);
    }
  };

  const handleBulkUnmark = () => {
    if (selectedIds.length > 0) {
      bulkUnmarkMutation.mutate(selectedIds);
    }
  };

  // AI Lesson edit handlers
  const handleEditAILesson = async (lesson: AILessonMetadata) => {
    setEditingLesson(lesson);
    setEditFormLoading(true);
    setKeyConceptInput('');
    setNewExample({ title: '', description: '', code: '' });

    try {
      // Fetch full lesson content
      const fullContent = await getAdminAILessonDetail(lesson.pathId, lesson.order);
      setEditForm({
        title: fullContent.title,
        summary: fullContent.summary,
        difficulty: fullContent.difficulty,
        estimatedMinutes: fullContent.estimatedMinutes,
        keyConcepts: fullContent.keyConcepts || [],
        explanation: fullContent.explanation || '',
        examples: fullContent.examples || [],
        practicePrompt: fullContent.practicePrompt || '',
        mermaidDiagram: fullContent.mermaidDiagram || '',
      });
    } catch (error) {
      console.error('Failed to load lesson details:', error);
      // Fall back to basic data from list
      setEditForm({
        title: lesson.title,
        summary: lesson.summary,
        difficulty: lesson.difficulty,
        estimatedMinutes: lesson.estimatedMinutes,
        keyConcepts: [...lesson.keyConcepts],
        explanation: '',
        examples: [],
        practicePrompt: '',
        mermaidDiagram: '',
      });
    } finally {
      setEditFormLoading(false);
    }
  };

  const handleSaveAILesson = () => {
    if (!editingLesson) return;
    updateAILessonMutation.mutate({
      pathId: editingLesson.pathId,
      order: editingLesson.order,
      data: editForm,
    });
  };

  const handleAddKeyConcept = () => {
    if (keyConceptInput.trim() && !editForm.keyConcepts.includes(keyConceptInput.trim())) {
      setEditForm((prev) => ({
        ...prev,
        keyConcepts: [...prev.keyConcepts, keyConceptInput.trim()],
      }));
      setKeyConceptInput('');
    }
  };

  const handleRemoveKeyConcept = (concept: string) => {
    setEditForm((prev) => ({
      ...prev,
      keyConcepts: prev.keyConcepts.filter((c) => c !== concept),
    }));
  };

  const handleAddExample = () => {
    if (newExample.title.trim() && newExample.description.trim()) {
      setEditForm((prev) => ({
        ...prev,
        examples: [...prev.examples, { ...newExample }],
      }));
      setNewExample({ title: '', description: '', code: '' });
    }
  };

  const handleRemoveExample = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateExample = (index: number, field: 'title' | 'description' | 'code', value: string) => {
    setEditForm((prev) => ({
      ...prev,
      examples: prev.examples.map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      ),
    }));
  };

  // Pagination
  const totalPages = lessonsData ? Math.ceil(lessonsData.count / pageSize) : 0;
  const aiTotalPages = aiLessonsData ? Math.ceil(aiLessonsData.count / pageSize) : 0;

  // Handle tab change
  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    setPage(1);
    setAiPage(1);
    setSelectedIds([]);
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AcademicCapIcon className="w-6 h-6 text-primary-600 dark:text-cyan-neon" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Lesson Library
                </h1>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Manage curated and AI-generated educational content
              </p>
            </div>

            <button
              onClick={() => (activeTab === 'curated' ? refetch() : aiRefetch())}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleTabChange('curated')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'curated'
                  ? 'border-primary-500 dark:border-cyan-500 text-primary-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpenIcon className="w-4 h-4" />
              Curated Lessons
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700">
                {lessonsData?.count || 0}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('ai')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'ai'
                  ? 'border-primary-500 dark:border-cyan-500 text-primary-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              AI-Generated Lessons
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700">
                {aiLessonsData?.count || 0}
              </span>
            </button>
          </div>

          {/* Curated Lessons Tab Content */}
          {activeTab === 'curated' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {lessonsData?.count || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Total Projects</div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {lessonsData?.results.filter((l) => l.isLesson).length || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Marked as Lessons</div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {lessonsData?.results.reduce((sum, l) => sum + l.positiveRatings, 0) || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Positive Ratings</div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                    {lessonsData?.results.reduce((sum, l) => sum + l.timesUsedForLearning, 0) || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Times Used</div>
                </div>
              </div>

              {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-slate-400" />
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                {(['all', 'lessons', 'not_lessons'] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setFilterMode(mode);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      filterMode === mode
                        ? 'bg-primary-500 dark:bg-cyan-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mode === 'all' ? 'All' : mode === 'lessons' ? 'Lessons' : 'Not Lessons'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-primary-50 dark:bg-cyan-500/10 border border-primary-200 dark:border-cyan-500/30 rounded-lg">
              <span className="text-sm font-medium text-primary-700 dark:text-cyan-300">
                {selectedIds.length} selected
              </span>
              <button
                onClick={handleBulkMark}
                disabled={bulkMarkMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckIcon className="w-4 h-4" />
                Mark as Lessons
              </button>
              <button
                onClick={handleBulkUnmark}
                disabled={bulkUnmarkMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-4 h-4" />
                Unmark as Lessons
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="ml-auto text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          lessonsData?.results &&
                          lessonsData.results.length > 0 &&
                          selectedIds.length === lessonsData.results.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary-600 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Author
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Is Lesson
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Difficulty
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ratings
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Used
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading lessons...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-red-500">
                        Failed to load lessons. Please try again.
                      </td>
                    </tr>
                  ) : lessonsData?.results.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No projects found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    lessonsData?.results.map((lesson) => (
                      <tr
                        key={lesson.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lesson.id)}
                            onChange={() => handleSelectOne(lesson.id)}
                            className="rounded border-slate-300 dark:border-slate-600 text-primary-600 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`/${lesson.authorUsername}/${lesson.projectSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-cyan-400 transition-colors"
                          >
                            {lesson.projectTitle}
                          </a>
                          {lesson.learningSummary && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                              {lesson.learningSummary}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          @{lesson.authorUsername}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {lesson.isLesson ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                              <CheckCircleIcon className="w-3.5 h-3.5" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full">
                              <XCircleIcon className="w-3.5 h-3.5" />
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                              lesson.complexityLevel === 'beginner'
                                ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/20'
                                : lesson.complexityLevel === 'intermediate'
                                  ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20'
                                  : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20'
                            }`}
                          >
                            {lesson.complexityLevel || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                              <StarIcon className="w-4 h-4" />
                              {lesson.positiveRatings}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">/</span>
                            <span className="text-slate-500">{lesson.negativeRatings}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                          {lesson.timesUsedForLearning}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleLesson(lesson)}
                            disabled={updateMutation.isPending}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                              lesson.isLesson
                                ? 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                                : 'text-white bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {lesson.isLesson ? 'Unmark' : 'Mark as Lesson'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

              {/* Pagination */}
              {lessonsData && lessonsData.count > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {(page - 1) * pageSize + 1} to{' '}
                    {Math.min(page * pageSize, lessonsData.count)} of {lessonsData.count} results
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>
          )}

          {/* AI Lessons Tab Content */}
          {activeTab === 'ai' && (
            <>
              {/* Stats Cards for AI Lessons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {aiLessonsData?.count || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Total AI Lessons</div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {aiLessonsData?.results.filter((l) => l.hasExamples).length || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">With Examples</div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {aiLessonsData?.results.filter((l) => l.hasDiagram).length || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">With Diagrams</div>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, path, or author..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAiPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                />
              </div>

              {/* AI Lessons Table */}
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Lesson
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Learning Path
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Difficulty
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Features
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {aiIsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading AI lessons...
                          </td>
                        </tr>
                      ) : aiIsError ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                            Failed to load AI lessons. Please try again.
                          </td>
                        </tr>
                      ) : aiLessonsData?.results.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No AI-generated lessons found.
                          </td>
                        </tr>
                      ) : (
                        aiLessonsData?.results.map((lesson) => (
                          <tr
                            key={lesson.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <SparklesIcon className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-white">
                                    {lesson.title}
                                  </div>
                                  {lesson.summary && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 max-w-md">
                                      {lesson.summary}
                                    </p>
                                  )}
                                  {lesson.keyConcepts.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {lesson.keyConcepts.slice(0, 3).map((concept, i) => (
                                        <span
                                          key={i}
                                          className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                                        >
                                          {concept}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/${lesson.username}/learn/${lesson.pathSlug}`}
                                className="text-sm text-primary-600 dark:text-cyan-400 hover:underline"
                              >
                                {lesson.pathTitle}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                              @{lesson.username}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                                  lesson.difficulty === 'beginner'
                                    ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/20'
                                    : lesson.difficulty === 'intermediate'
                                      ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20'
                                      : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20'
                                }`}
                              >
                                {lesson.difficulty}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="flex items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                <ClockIcon className="w-4 h-4" />
                                {lesson.estimatedMinutes}m
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {lesson.hasExamples && (
                                  <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded">
                                    Examples
                                  </span>
                                )}
                                {lesson.hasDiagram && (
                                  <span className="px-1.5 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 rounded">
                                    Diagram
                                  </span>
                                )}
                                {lesson.hasPracticePrompt && (
                                  <span className="px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded">
                                    Practice
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleEditAILesson(lesson)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-cyan-300 bg-primary-50 dark:bg-cyan-500/10 hover:bg-primary-100 dark:hover:bg-cyan-500/20 rounded-lg transition-colors"
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* AI Lessons Pagination */}
                {aiLessonsData && aiLessonsData.count > pageSize && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {(aiPage - 1) * pageSize + 1} to{' '}
                      {Math.min(aiPage * pageSize, aiLessonsData.count)} of {aiLessonsData.count} results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAiPage((p) => Math.max(1, p - 1))}
                        disabled={aiPage === 1}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Page {aiPage} of {aiTotalPages}
                      </span>
                      <button
                        onClick={() => setAiPage((p) => Math.min(aiTotalPages, p + 1))}
                        disabled={aiPage === aiTotalPages}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Edit AI Lesson Modal */}
          {editingLesson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                {/* Modal Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Edit AI Lesson
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {editingLesson.pathTitle} • Lesson #{editingLesson.order}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingLesson(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                {editFormLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600 dark:text-cyan-400" />
                    <span className="ml-3 text-slate-600 dark:text-slate-400">Loading lesson content...</span>
                  </div>
                ) : (
                  <div className="p-4 space-y-6">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                        Basic Information
                      </h3>

                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                      </div>

                      {/* Summary */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Summary <span className="text-slate-400">(1-2 sentence hook)</span>
                        </label>
                        <textarea
                          value={editForm.summary}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, summary: e.target.value }))
                          }
                          rows={2}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                      </div>

                      {/* Difficulty and Duration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Difficulty
                          </label>
                          <select
                            value={editForm.difficulty}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, difficulty: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Duration (minutes)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={editForm.estimatedMinutes}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                estimatedMinutes: parseInt(e.target.value) || 10,
                              }))
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          />
                        </div>
                      </div>

                      {/* Key Concepts */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Key Concepts
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={keyConceptInput}
                            onChange={(e) => setKeyConceptInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddKeyConcept();
                              }
                            }}
                            placeholder="Add a concept..."
                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddKeyConcept}
                            className="px-3 py-2 text-sm font-medium text-white bg-primary-600 dark:bg-cyan-600 hover:bg-primary-700 dark:hover:bg-cyan-700 rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editForm.keyConcepts.map((concept, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                            >
                              {concept}
                              <button
                                type="button"
                                onClick={() => handleRemoveKeyConcept(concept)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                          {editForm.keyConcepts.length === 0 && (
                            <span className="text-sm text-slate-400">No concepts added</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <hr className="border-slate-200 dark:border-slate-700" />

                    {/* Main Content Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                        Lesson Content
                      </h3>

                      {/* Explanation */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Explanation <span className="text-slate-400">(Markdown supported)</span>
                        </label>
                        <textarea
                          value={editForm.explanation}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, explanation: e.target.value }))
                          }
                          rows={12}
                          placeholder="Write the main lesson content here. Use markdown for formatting, code blocks, etc."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500 font-mono text-sm"
                        />
                      </div>

                      {/* Practice Prompt */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Practice Prompt <span className="text-slate-400">(optional exercise for learner)</span>
                        </label>
                        <textarea
                          value={editForm.practicePrompt}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, practicePrompt: e.target.value }))
                          }
                          rows={3}
                          placeholder="Try this: Create a simple example that..."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                      </div>

                      {/* Mermaid Diagram */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Mermaid Diagram <span className="text-slate-400">(optional visual diagram)</span>
                        </label>
                        <textarea
                          value={editForm.mermaidDiagram}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, mermaidDiagram: e.target.value }))
                          }
                          rows={6}
                          placeholder={`graph TD\n    A[Start] --> B[Process]\n    B --> C[End]`}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500 font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <hr className="border-slate-200 dark:border-slate-700" />

                    {/* Examples Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                        Examples ({editForm.examples.length})
                      </h3>

                      {/* Existing Examples */}
                      {editForm.examples.map((example, index) => (
                        <div
                          key={index}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Example {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExample(index)}
                              className="text-sm text-red-500 hover:text-red-700 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={example.title}
                            onChange={(e) => handleUpdateExample(index, 'title', e.target.value)}
                            placeholder="Example title"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          />
                          <textarea
                            value={example.description}
                            onChange={(e) => handleUpdateExample(index, 'description', e.target.value)}
                            placeholder="Example description"
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                          />
                          <textarea
                            value={example.code || ''}
                            onChange={(e) => handleUpdateExample(index, 'code', e.target.value)}
                            placeholder="Code snippet (optional)"
                            rows={4}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500 font-mono text-sm"
                          />
                        </div>
                      ))}

                      {/* Add New Example */}
                      <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Add New Example
                        </span>
                        <input
                          type="text"
                          value={newExample.title}
                          onChange={(e) => setNewExample((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Example title"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                        <textarea
                          value={newExample.description}
                          onChange={(e) => setNewExample((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Example description"
                          rows={2}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500"
                        />
                        <textarea
                          value={newExample.code}
                          onChange={(e) => setNewExample((prev) => ({ ...prev, code: e.target.value }))}
                          placeholder="Code snippet (optional)"
                          rows={4}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddExample}
                          disabled={!newExample.title.trim() || !newExample.description.trim()}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 dark:bg-cyan-600 hover:bg-primary-700 dark:hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Example
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <button
                    onClick={() => setEditingLesson(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAILesson}
                    disabled={updateAILessonMutation.isPending || editFormLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 dark:bg-cyan-600 hover:bg-primary-700 dark:hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {updateAILessonMutation.isPending ? 'Saving...' : 'Save Changes'}
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
