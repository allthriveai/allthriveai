/**
 * IdeasListPanel - Side panel for review mode in Echo Creator Coach
 * TASK-029: Displays filterable list of ideas with quick capture
 *
 * Features:
 * - IdeaFilters at top for status filtering
 * - Scrollable IdeaList in the middle
 * - QuickCapture input at bottom for fast idea entry
 * - Clicking an idea sets it as activeIdea for "Develop" action
 */

import { useState, useCallback } from 'react';
import { ArrowPathIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { useIdeas, useCreateIdea, useUpdateIdea } from '@/hooks/useIdeas';
import { IdeaList } from '@/components/content-engine/ideas/IdeaList';
import { IdeaFilters } from '@/components/content-engine/ideas/IdeaFilters';
import { QuickCapture } from '@/components/content-engine/ideas/QuickCapture';
import { useEchoAgent } from '@/context/EchoAgentContext';
import type { IdeaStatus, ContentIdea } from '@/types/contentEngine';

interface IdeasListPanelProps {
  className?: string;
}

// Skeleton cards for loading state
function SkeletonCard() {
  return (
    <div className="glass-card p-4 rounded-xl animate-pulse">
      <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-700/50 rounded w-full mb-3" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-slate-700/50 rounded-full" />
        <div className="h-5 w-16 bg-slate-700/50 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

// Empty state when no ideas
interface EmptyStateProps {
  hasFilter: boolean;
  onStartBrainstorm?: () => void;
}

function EmptyState({ hasFilter, onStartBrainstorm }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
        <LightBulbIcon className="w-8 h-8 text-blue-400" />
      </div>
      <h4 className="text-sm font-medium text-white mb-2">
        {hasFilter ? 'No matching ideas' : 'No ideas yet'}
      </h4>
      <p className="text-xs text-slate-400 mb-4 max-w-[200px]">
        {hasFilter
          ? 'Try adjusting your filters or capture a new idea below.'
          : 'Start a brainstorm session to generate content ideas.'}
      </p>
      {!hasFilter && onStartBrainstorm && (
        <button
          type="button"
          onClick={onStartBrainstorm}
          className="btn-outline text-sm px-4 py-2"
        >
          Start Brainstorming
        </button>
      )}
    </div>
  );
}

// Error state with retry
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
        <ArrowPathIcon className="w-6 h-6 text-red-400" />
      </div>
      <h4 className="text-sm font-medium text-red-400 mb-2">
        Failed to load ideas
      </h4>
      <p className="text-xs text-slate-400 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-outline text-sm px-4 py-2 flex items-center gap-2"
      >
        <ArrowPathIcon className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

export function IdeasListPanel({ className = '' }: IdeasListPanelProps) {
  const { setActiveIdea, transitionTo } = useEchoAgent();
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');

  // Fetch ideas with status filter
  const {
    ideas,
    isLoading,
    error,
    refetch,
  } = useIdeas({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  // Create idea hook
  const { createIdea, isCreating, error: createError } = useCreateIdea();

  // Update idea hook for archive action
  const { updateIdea } = useUpdateIdea();

  // Handle quick capture submission
  const handleQuickCapture = useCallback(
    async (title: string) => {
      try {
        await createIdea({ title, source: 'web' });
        await refetch();
      } catch {
        // Error is handled by the hook
      }
    },
    [createIdea, refetch]
  );

  // Handle clicking an idea card - set as active and offer "Develop" action
  const handleIdeaClick = useCallback(
    (ideaId: number) => {
      const idea = ideas.find((i) => i.id === ideaId);
      if (idea) {
        setActiveIdea({
          title: idea.title,
          description: idea.description,
          platforms: idea.platforms,
        });
      }
    },
    [ideas, setActiveIdea]
  );

  // Handle archive action
  const handleArchive = useCallback(
    async (ideaId: number) => {
      try {
        await updateIdea(ideaId, { status: 'archived' });
        await refetch();
      } catch {
        // Error is handled by the hook
      }
    },
    [updateIdea, refetch]
  );

  // Handle create clip action - transition to create mode
  const handleCreateClip = useCallback(
    (ideaId: number) => {
      const idea = ideas.find((i) => i.id === ideaId);
      if (idea) {
        transitionTo('create', {
          title: idea.title,
          description: idea.description,
          platforms: idea.platforms,
        });
      }
    },
    [ideas, transitionTo]
  );

  // Handle schedule action - transition to schedule mode
  const handleSchedule = useCallback(
    (ideaId: number) => {
      const idea = ideas.find((i) => i.id === ideaId);
      if (idea) {
        transitionTo('schedule', {
          title: idea.title,
          description: idea.description,
          platforms: idea.platforms,
        });
      }
    },
    [ideas, transitionTo]
  );

  // Handle start brainstorm action
  const handleStartBrainstorm = useCallback(() => {
    transitionTo('brainstorm');
  }, [transitionTo]);

  const hasFilter = statusFilter !== 'all';

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      aria-label="Ideas list panel"
    >
      {/* Filters at top */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50">
        <IdeaFilters status={statusFilter} onStatusChange={setStatusFilter} />
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : ideas.length === 0 ? (
          <EmptyState
            hasFilter={hasFilter}
            onStartBrainstorm={handleStartBrainstorm}
          />
        ) : (
          <IdeaList
            ideas={ideas}
            onArchive={handleArchive}
            onCreateClip={handleCreateClip}
            onSchedule={handleSchedule}
          />
        )}
      </div>

      {/* Quick capture at bottom */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50">
        <QuickCapture
          onSubmit={handleQuickCapture}
          isSubmitting={isCreating}
          error={createError}
        />
      </div>
    </div>
  );
}

export default IdeasListPanel;
