/**
 * Ideas Tab Component
 * US-004: Ideas Tab with list view and quick capture
 * US-018: Added BrainstormChatPanel for Echo Creator Coach
 * US-019: Hybrid layout with chat (60%) and list (40%)
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { ChevronUpIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea } from '@/hooks/useIdeas';
import { QuickCapture } from '../ideas/QuickCapture';
import { IdeaFilters } from '../ideas/IdeaFilters';
import { IdeaList } from '../ideas/IdeaList';
import { BrainstormChatPanel } from '../chat';
import type { IdeaStatus } from '@/types/contentEngine';

export function IdeasTab() {
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [newlySavedId, setNewlySavedId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const handleCreateClip = useCallback((_id: number) => {
    // TODO: Navigate to create tab with idea context
    // Will be wired up when clip creation from ideas is implemented
  }, []);

  const handleSchedule = useCallback((_id: number) => {
    // TODO: Open schedule modal
    // Will be wired up when scheduling from ideas is implemented
  }, []);

  // Handle idea saved from brainstorm - refetch and animate
  const handleIdeaSaved = useCallback((ideaId: number, _title: string) => {
    refetch();
    setNewlySavedId(ideaId);
    // Clear the animation after it completes
    setTimeout(() => setNewlySavedId(null), 1000);
    // Expand list if collapsed on mobile
    setListCollapsed(false);
    // Scroll to list section
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [refetch]);

  // Generate a session ID for brainstorm chat
  const sessionId = useMemo(() => `ideas-${Date.now()}`, []);

  // Clear animation class after timeout
  useEffect(() => {
    if (newlySavedId) {
      const timer = setTimeout(() => setNewlySavedId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [newlySavedId]);

  // Loading state - show skeleton for both panels
  if (isLoading) {
    return (
      <div
        id="tabpanel-ideas"
        role="tabpanel"
        aria-labelledby="tab-ideas"
        className="h-full flex flex-col"
      >
        {/* Chat panel skeleton (60%) */}
        <div className="flex-[6] min-h-0 mb-2">
          <div className="h-full glass-panel rounded-xl p-4">
            <div className="h-8 bg-slate-800/50 rounded mb-4 animate-pulse" />
            <div className="flex-1 space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700/50 animate-pulse" />
                <div className="h-16 bg-slate-700/50 rounded-xl w-3/4 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* List panel skeleton (40%) */}
        <div className="flex-[4] min-h-0">
          <div className="h-full glass-panel rounded-xl p-4">
            <div className="flex justify-between mb-4">
              <div className="h-6 w-24 bg-slate-800/50 rounded animate-pulse" />
              <div className="h-6 w-32 bg-slate-800/50 rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="glass-card p-4 rounded-xl">
                  <div className="h-5 bg-slate-700/50 rounded w-3/4 mb-2 animate-pulse" />
                  <div className="h-4 bg-slate-700/50 rounded w-1/2 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error banner component (used inline)
  const errorBanner = error ? (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-2">
      <div className="flex items-center gap-2 text-red-300">
        <ExclamationTriangleIcon className="w-5 h-5" />
        <span className="text-sm">{error}</span>
      </div>
      <button
        onClick={() => refetch()}
        className="text-xs text-red-300 hover:text-red-200 underline"
      >
        Retry
      </button>
    </div>
  ) : null;

  // Empty ideas state component
  const emptyIdeasState = (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
        <FontAwesomeIcon icon={faLightbulb} className="text-2xl text-cyan-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">No Ideas Yet</h3>
      <p className="text-sm text-slate-400 max-w-xs">
        Chat with Echo above to brainstorm ideas, or capture one manually.
      </p>
    </div>
  );

  // Collapsible section header component
  const SectionHeader = ({
    title,
    isCollapsed,
    onToggle,
    children,
  }: {
    title: string;
    isCollapsed: boolean;
    onToggle: () => void;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors md:hidden"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronDownIcon className="w-4 h-4" />
        ) : (
          <ChevronUpIcon className="w-4 h-4" />
        )}
        {title}
      </button>
      <span className="hidden md:block text-sm font-medium text-slate-300">{title}</span>
      {children}
    </div>
  );

  // Hybrid layout - chat (60%) + list (40%)
  return (
    <div
      id="tabpanel-ideas"
      role="tabpanel"
      aria-labelledby="tab-ideas"
      className="h-full flex flex-col gap-2"
    >
      {/* Error banner */}
      {errorBanner}

      {/* Chat panel section (60%) */}
      <section
        aria-label="Brainstorm with Echo"
        className={`
          ${chatCollapsed ? 'flex-none' : 'flex-[6]'}
          min-h-0 transition-all duration-300
        `}
      >
        {/* Mobile collapse header */}
        <div className="md:hidden mb-2">
          <button
            type="button"
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            aria-expanded={!chatCollapsed}
          >
            {chatCollapsed ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronUpIcon className="w-4 h-4" />
            )}
            Brainstorm with Echo
          </button>
        </div>

        {/* Chat panel - collapsible on mobile */}
        <div
          className={`
            ${chatCollapsed ? 'hidden md:block md:h-full' : 'h-full'}
            transition-all duration-300
          `}
        >
          <BrainstormChatPanel
            sessionId={sessionId}
            onIdeaSaved={handleIdeaSaved}
            className="h-full"
          />
        </div>
      </section>

      {/* Divider */}
      <div className="hidden md:block h-px bg-slate-700/50" />

      {/* Ideas list section (40%) */}
      <section
        ref={listRef}
        aria-label="Your Ideas"
        className={`
          ${listCollapsed ? 'flex-none' : 'flex-[4]'}
          min-h-0 transition-all duration-300 flex flex-col
        `}
      >
        <SectionHeader
          title="Your Ideas"
          isCollapsed={listCollapsed}
          onToggle={() => setListCollapsed(!listCollapsed)}
        >
          <div className="flex items-center gap-3">
            <IdeaFilters
              status={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </div>
        </SectionHeader>

        {/* Ideas list content - collapsible on mobile */}
        <div
          className={`
            ${listCollapsed ? 'hidden md:block' : ''}
            flex-1 overflow-y-auto transition-all duration-300
          `}
        >
          {/* Quick Capture */}
          <div className="mb-4">
            <QuickCapture
              onSubmit={handleQuickCapture}
              isSubmitting={isCreating}
              error={createError}
            />
          </div>

          {/* Ideas list or empty state */}
          {ideas.length === 0 ? (
            statusFilter === 'all' ? emptyIdeasState : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">No ideas match the selected filter.</p>
              </div>
            )
          ) : (
            <div className={newlySavedId ? 'relative' : ''}>
              <IdeaList
                ideas={ideas}
                onArchive={handleArchive}
                onCreateClip={handleCreateClip}
                onSchedule={handleSchedule}
                onDelete={handleDelete}
                highlightedId={newlySavedId}
              />
              {/* New idea highlight animation handled via CSS */}
              <style>{`
                @keyframes slideDown {
                  from {
                    transform: translateY(-10px);
                    opacity: 0;
                  }
                  to {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
                [data-new-idea="true"] {
                  animation: slideDown 0.3s ease-out;
                }
              `}</style>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
