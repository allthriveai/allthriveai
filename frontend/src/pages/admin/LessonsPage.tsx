import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  getAdminLessons,
  updateLessonMetadata,
  bulkMarkAsLessons,
  bulkUnmarkAsLessons,
  type LessonMetadata,
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
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

type FilterMode = 'all' | 'lessons' | 'not_lessons';

export default function LessonsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Build query params
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

  // Fetch lessons
  const {
    data: lessonsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-lessons', queryParams],
    queryFn: () => getAdminLessons(queryParams),
    enabled: user?.role === 'admin',
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

  // Pagination
  const totalPages = lessonsData ? Math.ceil(lessonsData.count / pageSize) : 0;

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
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>

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
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
