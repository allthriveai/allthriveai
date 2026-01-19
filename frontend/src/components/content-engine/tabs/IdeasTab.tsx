/**
 * Ideas Tab Component
 * US-004: Ideas Tab with list view and quick capture
 */

import { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faExclamationCircle, faRedo } from '@fortawesome/free-solid-svg-icons';
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea } from '@/hooks/useIdeas';
import { QuickCapture } from '../ideas/QuickCapture';
import { IdeaFilters } from '../ideas/IdeaFilters';
import { IdeaList } from '../ideas/IdeaList';
import type { IdeaStatus } from '@/types/contentEngine';

export function IdeasTab() {
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');

  // Only pass status filter if not 'all'
  const filterParams = statusFilter === 'all' ? undefined : { status: statusFilter };
  const { ideas, isLoading, error, refetch } = useIdeas(filterParams);
  const { createIdea, isCreating, error: createError } = useCreateIdea();
  const { updateIdea } = useUpdateIdea();
  const { deleteIdea } = useDeleteIdea();

  const handleQuickCapture = useCallback(async (title: string) => {
    await createIdea({ title });
    refetch();
  }, [createIdea, refetch]);

  const handleArchive = useCallback(async (id: number) => {
    await updateIdea(id, { status: 'archived' });
    refetch();
  }, [updateIdea, refetch]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteIdea(id);
    refetch();
  }, [deleteIdea, refetch]);

  const handleCreateClip = useCallback((id: number) => {
    // Navigate to create tab with idea context
    // For now, just log - will be wired up in later story
    console.log('Create clip from idea:', id);
  }, []);

  const handleSchedule = useCallback((id: number) => {
    // Open schedule modal
    // For now, just log - will be wired up in later story
    console.log('Schedule idea:', id);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        id="tabpanel-ideas"
        role="tabpanel"
        aria-labelledby="tab-ideas"
        className="h-full"
      >
        <div className="space-y-4">
          {/* Quick capture skeleton */}
          <div className="h-10 bg-slate-800/50 rounded animate-pulse" />

          {/* Filter skeleton */}
          <div className="flex justify-end">
            <div className="h-8 w-32 bg-slate-800/50 rounded animate-pulse" />
          </div>

          {/* Card skeletons */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-4 rounded-xl">
                <div className="h-5 bg-slate-700/50 rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-4 bg-slate-700/50 rounded w-1/2 mb-3 animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-slate-700/50 rounded animate-pulse" />
                  <div className="h-5 w-14 bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        id="tabpanel-ideas"
        role="tabpanel"
        aria-labelledby="tab-ideas"
        className="h-full flex items-center justify-center"
      >
        <div className="text-center glass-panel p-8 rounded-xl max-w-md">
          <FontAwesomeIcon icon={faExclamationCircle} className="text-4xl text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Ideas</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="btn-primary px-4 py-2 inline-flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faRedo} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (ideas.length === 0 && statusFilter === 'all') {
    return (
      <div
        id="tabpanel-ideas"
        role="tabpanel"
        aria-labelledby="tab-ideas"
        className="h-full"
      >
        <div className="mb-6">
          <QuickCapture
            onSubmit={handleQuickCapture}
            isSubmitting={isCreating}
            error={createError}
          />
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <FontAwesomeIcon icon={faLightbulb} className="text-3xl text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Ideas Yet</h2>
          <p className="text-slate-400 text-center max-w-sm">
            Capture your first content idea above. Ideas can be turned into clips and scheduled for publishing.
          </p>
        </div>
      </div>
    );
  }

  // Ideas list
  return (
    <div
      id="tabpanel-ideas"
      role="tabpanel"
      aria-labelledby="tab-ideas"
      className="h-full"
    >
      {/* Quick Capture - always visible */}
      <div className="mb-4">
        <QuickCapture
          onSubmit={handleQuickCapture}
          isSubmitting={isCreating}
          error={createError}
        />
      </div>

      {/* Filters */}
      <div className="flex justify-end mb-4">
        <IdeaFilters
          status={statusFilter}
          onStatusChange={setStatusFilter}
        />
      </div>

      {/* Ideas list or filtered empty state */}
      {ideas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No ideas match the selected filter.</p>
        </div>
      ) : (
        <IdeaList
          ideas={ideas}
          onArchive={handleArchive}
          onCreateClip={handleCreateClip}
          onSchedule={handleSchedule}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
