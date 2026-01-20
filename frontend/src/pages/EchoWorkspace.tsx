/**
 * EchoWorkspace - Main page for Echo Personal Assistant
 * US-006: /echo route renders EchoWorkspace page
 * US-008: ContextCard, TaskCard, IdeaCard components
 *
 * Features:
 * - Chat takes 70% of screen height
 * - Context cards area below chat (collapsed by default)
 * - Uses useEchoProfile hook to fetch and cache profile
 * - Loading state shows skeleton
 * - Auth redirect if not logged in (handled by ProtectedRoute)
 * - Collapsible task and idea context cards
 */

import { useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentListIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { EchoChat } from '@/components/echo/EchoChat';
import {
  ContextCard,
  ContextCardSkeleton,
} from '@/components/echo/ContextCard';
import { TaskCard, type EchoTask } from '@/components/echo/TaskCard';
import { IdeaCard } from '@/components/echo/IdeaCard';
import { useEchoProfile } from '@/hooks/useEchoProfile';
import { useAuth } from '@/hooks/useAuth';
import type { ContentIdea } from '@/types/contentEngine';

// Skeleton for loading state
function EchoWorkspaceSkeleton() {
  return (
    <div className="h-full flex flex-col gap-4 p-4 animate-pulse">
      {/* Chat skeleton - 70% height */}
      <div className="flex-[7] min-h-0">
        <div className="h-full glass-panel rounded-xl p-4">
          <div className="flex flex-col h-full">
            {/* Messages skeleton */}
            <div className="flex-1 space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700/50 rounded w-3/4" />
                  <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                  <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                </div>
              </div>
            </div>
            {/* Input skeleton */}
            <div className="h-14 bg-slate-800/50 rounded-xl mt-4" />
          </div>
        </div>
      </div>
      {/* Context cards skeleton - 30% height */}
      <div className="flex-[3] min-h-0">
        <div className="h-12 glass-subtle rounded-xl" />
      </div>
    </div>
  );
}

// Mock tasks data - will be replaced with real API data
const MOCK_TASKS: EchoTask[] = [
  {
    id: '1',
    title: 'Write blog post about AI trends',
    description: 'Draft 1500 word article',
    dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday (overdue)
    isCompleted: false,
    source: 'manual',
  },
  {
    id: '2',
    title: 'Review LinkedIn content calendar',
    dueDate: new Date().toISOString(), // Today
    isCompleted: false,
    source: 'asana',
  },
  {
    id: '3',
    title: 'Schedule tweets for the week',
    dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    isCompleted: true,
    source: 'manual',
  },
];

// Mock ideas data - will be replaced with real API data
const MOCK_IDEAS: ContentIdea[] = [
  {
    id: 1,
    title: '10 AI Tools Every Creator Should Know',
    description: 'A comprehensive guide to the best AI tools for content creation',
    contentPillar: 'AI & Tech',
    platforms: ['linkedin', 'twitter'],
    source: 'brainstorm',
    status: 'planned',
    order: 1,
    clipsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'The Future of Remote Work',
    contentPillar: 'Business',
    platforms: ['linkedin', 'youtube'],
    source: 'brainstorm',
    status: 'in_progress',
    order: 2,
    clipsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: 'Quick productivity hacks thread',
    platforms: ['twitter'],
    source: 'brainstorm',
    status: 'saved',
    order: 3,
    clipsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function EchoWorkspace() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { profile, isLoading: isProfileLoading } = useEchoProfile();
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  // Task state (using mock data for now)
  const [tasks, setTasks] = useState<EchoTask[]>(MOCK_TASKS);
  const [isLoadingTasks] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | number | null>(
    null
  );

  // Ideas state (using mock data for now)
  const [ideas] = useState<ContentIdea[]>(MOCK_IDEAS);
  const [isLoadingIdeas] = useState(false);

  // Generate a unique session ID for this page visit (stable across renders)
  const sessionId = useMemo(() => {
    return `echo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Calculated counts
  const incompleteTasks = useMemo(
    () => tasks.filter((t) => !t.isCompleted),
    [tasks]
  );
  const activeIdeas = useMemo(
    () => ideas.filter((i) => i.status !== 'archived'),
    [ideas]
  );

  // Handle task toggle
  const handleToggleTask = useCallback(
    (taskId: string | number, isCompleted: boolean) => {
      setTogglingTaskId(taskId);

      // Simulate API call
      setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, isCompleted } : t))
        );
        setTogglingTaskId(null);
      }, 500);
    },
    []
  );

  // Handle idea click
  const handleIdeaClick = useCallback((idea: ContentIdea) => {
    // TODO: Navigate to idea detail or open edit modal
    console.log('Clicked idea:', idea.id);
  }, []);

  // Auth loading state
  if (isAuthLoading) {
    return (
      <DashboardLayout>
        <EchoWorkspaceSkeleton />
      </DashboardLayout>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Profile loading state
  if (isProfileLoading) {
    return (
      <DashboardLayout>
        <EchoWorkspaceSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main
        role="main"
        aria-label="Echo Personal Assistant Workspace"
        className="h-full flex flex-col gap-4 p-4"
      >
        {/* Chat area - 70% on desktop, flexible on mobile */}
        <div className="flex-[7] min-h-0 lg:h-[70%]">
          <EchoChat sessionId={sessionId} className="h-full" />
        </div>

        {/* Context cards area - collapsed by default */}
        <div className="flex-[3] min-h-0 lg:h-[30%]">
          <div className="h-full glass-subtle rounded-xl overflow-hidden">
            {/* Collapse header */}
            <button
              type="button"
              onClick={() => setIsContextExpanded(!isContextExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
              aria-expanded={isContextExpanded}
              aria-controls="context-cards-content"
            >
              <span className="text-sm font-medium text-slate-300">
                Context & Resources
                {profile?.isOnboarded === false && (
                  <span className="ml-2 text-xs text-amber-400">
                    (Setup in progress)
                  </span>
                )}
              </span>
              {isContextExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUpIcon className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Collapsible content */}
            <div
              id="context-cards-content"
              className={`overflow-y-auto transition-all duration-300 ${
                isContextExpanded ? 'max-h-[calc(100%-44px)] p-4' : 'max-h-0 p-0'
              }`}
            >
              {isContextExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tasks Card */}
                  {isLoadingTasks ? (
                    <ContextCardSkeleton />
                  ) : (
                    <ContextCard
                      title="Tasks"
                      icon={
                        <ClipboardDocumentListIcon className="w-5 h-5" />
                      }
                      count={incompleteTasks.length}
                      emptyMessage="No tasks yet. Ask Echo to help you create some!"
                    >
                      <div className="space-y-1">
                        {incompleteTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleTask}
                            isToggling={togglingTaskId === task.id}
                          />
                        ))}
                      </div>
                    </ContextCard>
                  )}

                  {/* Ideas Card */}
                  {isLoadingIdeas ? (
                    <ContextCardSkeleton />
                  ) : (
                    <ContextCard
                      title="Content Ideas"
                      icon={<LightBulbIcon className="w-5 h-5" />}
                      count={activeIdeas.length}
                      emptyMessage="No ideas saved yet. Start brainstorming with Echo!"
                    >
                      <div className="space-y-1">
                        {activeIdeas.map((idea) => (
                          <IdeaCard
                            key={idea.id}
                            idea={idea}
                            onClick={handleIdeaClick}
                          />
                        ))}
                      </div>
                    </ContextCard>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
