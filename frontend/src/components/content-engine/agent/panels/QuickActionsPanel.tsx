/**
 * QuickActionsPanel - Welcome/idle state panel for Content Engine
 * TASK-027: Displays action cards when Echo is in 'idle' mode
 *
 * Features:
 * - 3 action cards: Brainstorm, Develop saved ideas, Plan content
 * - Recent ideas section (collapsed, shows last 3)
 * - Clicking action triggers mode transition and sends initial message
 * - Glass-panel styling with cyan/green gradient borders
 */

import { useState, useCallback, useMemo } from 'react';
import {
  LightBulbIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useIdeas } from '@/hooks/useIdeas';
import { useEchoAgent } from '@/context/EchoAgentContext';
import type { ContentIdea, EchoMode } from '@/types/contentEngine';

interface QuickAction {
  id: string;
  mode: EchoMode;
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  initialMessage: string;
  gradient: string;
  borderColor: string;
  iconColor: string;
  requiresIdeas?: boolean;
}

const quickActions: QuickAction[] = [
  {
    id: 'brainstorm',
    mode: 'brainstorm',
    title: 'Brainstorm new ideas',
    description: 'Generate fresh content ideas with Echo',
    icon: LightBulbIcon,
    initialMessage: "Let's brainstorm some new content ideas",
    gradient: 'from-cyan-500/10 to-cyan-600/5',
    borderColor: 'border-cyan-500/30 hover:border-cyan-400/50',
    iconColor: 'text-cyan-400',
  },
  {
    id: 'develop',
    mode: 'review',
    title: 'Develop saved ideas',
    description: 'Expand and refine your saved ideas',
    icon: DocumentTextIcon,
    initialMessage: 'Help me develop one of my saved ideas',
    gradient: 'from-green-500/10 to-green-600/5',
    borderColor: 'border-green-500/30 hover:border-green-400/50',
    iconColor: 'text-green-400',
    requiresIdeas: true,
  },
  {
    id: 'plan',
    mode: 'schedule',
    title: 'Plan content',
    description: 'Create a content calendar strategy',
    icon: CalendarIcon,
    initialMessage: 'Help me plan my content calendar',
    gradient: 'from-purple-500/10 to-purple-600/5',
    borderColor: 'border-purple-500/30 hover:border-purple-400/50',
    iconColor: 'text-purple-400',
  },
];

interface QuickActionCardProps {
  action: QuickAction;
  ideasCount?: number;
  onClick: (action: QuickAction) => void;
  isDisabled?: boolean;
}

function QuickActionCard({
  action,
  ideasCount,
  onClick,
  isDisabled,
}: QuickActionCardProps) {
  const Icon = action.icon;
  const showCount = action.id === 'develop' && typeof ideasCount === 'number';

  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={isDisabled}
      title={isDisabled ? 'Save some ideas first' : undefined}
      aria-label={`${action.title}${showCount ? ` (${ideasCount} ideas)` : ''}`}
      className={`
        w-full p-4 rounded-xl text-left transition-all duration-200
        glass-panel bg-gradient-to-br ${action.gradient}
        border ${action.borderColor}
        ${isDisabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer'}
        group
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            p-2 rounded-lg bg-slate-800/50 border border-slate-700/50
            group-hover:border-slate-600/50 transition-colors
          `}
        >
          <Icon className={`w-5 h-5 ${action.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-white">{action.title}</h4>
            {showCount && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                {ideasCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
        </div>
      </div>
    </button>
  );
}

// Skeleton for loading state
function ActionCardSkeleton() {
  return (
    <div className="w-full p-4 rounded-xl glass-panel border border-slate-700/50 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-700/50" />
        <div className="flex-1">
          <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-700/50 rounded w-full" />
        </div>
      </div>
    </div>
  );
}

interface RecentIdeasProps {
  ideas: ContentIdea[];
  isLoading: boolean;
}

function RecentIdeas({ ideas, isLoading }: RecentIdeasProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="h-4 bg-slate-700/50 rounded w-24 mb-3 animate-pulse" />
        <div className="space-y-2">
          <div className="h-10 bg-slate-700/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (ideas.length === 0) {
    return null;
  }

  const recentIdeas = ideas.slice(0, 3);

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="font-medium">Recent ideas</span>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4" />
        ) : (
          <ChevronDownIcon className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {recentIdeas.map((idea) => (
            <div
              key={idea.id}
              className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors"
            >
              <p className="text-sm text-white truncate">{idea.title}</p>
              {idea.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {idea.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
  className?: string;
}

export function QuickActionsPanel({
  onSendMessage,
  className = '',
}: QuickActionsPanelProps) {
  const { transitionTo } = useEchoAgent();
  const { ideas, isLoading, pagination } = useIdeas({ pageSize: 3 });

  // Handle action card click
  const handleActionClick = useCallback(
    (action: QuickAction) => {
      // Transition to the appropriate mode
      transitionTo(action.mode);

      // Send initial message to start conversation
      onSendMessage(action.initialMessage);
    },
    [transitionTo, onSendMessage]
  );

  // Memoize whether develop action should be disabled
  const isDevelopDisabled = useMemo(() => {
    return !isLoading && pagination.count === 0;
  }, [isLoading, pagination.count]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Welcome header */}
      <div className="flex items-center gap-2 mb-2">
        <SparklesIcon className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-medium text-white">Quick Actions</h3>
      </div>

      {/* Action cards */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <ActionCardSkeleton />
            <ActionCardSkeleton />
            <ActionCardSkeleton />
          </>
        ) : (
          quickActions.map((action) => (
            <QuickActionCard
              key={action.id}
              action={action}
              ideasCount={action.id === 'develop' ? pagination.count : undefined}
              onClick={handleActionClick}
              isDisabled={action.requiresIdeas && isDevelopDisabled}
            />
          ))
        )}
      </div>

      {/* Recent ideas section */}
      <RecentIdeas ideas={ideas} isLoading={isLoading} />
    </div>
  );
}

export default QuickActionsPanel;
