/**
 * ContextCard - Collapsible card container for Echo workspace context panels
 * US-008: ContextCard shows collapsed summary (title, count), expands on click
 *
 * Features:
 * - Shows collapsed summary with title and item count
 * - Expands on click to show children content
 * - aria-expanded for accessibility
 * - Skeleton loading state
 * - Empty state when no items
 */

import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ContextCardProps {
  /**
   * Card title displayed in header
   */
  title: string;
  /**
   * Icon component to display next to title
   */
  icon: ReactNode;
  /**
   * Number of items (displayed as badge)
   */
  count: number;
  /**
   * Whether the card is in loading state
   */
  isLoading?: boolean;
  /**
   * Message to show when count is 0
   */
  emptyMessage?: string;
  /**
   * Whether the card starts expanded
   */
  defaultExpanded?: boolean;
  /**
   * Content to render when expanded
   */
  children: ReactNode;
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Skeleton loading state for ContextCard
 */
export function ContextCardSkeleton() {
  return (
    <div className="glass-card rounded-xl overflow-hidden animate-pulse">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-slate-700/50" />
          <div className="h-4 w-24 rounded bg-slate-700/50" />
        </div>
        <div className="w-6 h-6 rounded bg-slate-700/50" />
      </div>
    </div>
  );
}

export function ContextCard({
  title,
  icon,
  count,
  isLoading = false,
  emptyMessage = 'No items',
  defaultExpanded = false,
  children,
  className = '',
}: ContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Show skeleton during loading
  if (isLoading) {
    return <ContextCardSkeleton />;
  }

  const cardId = `context-card-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const contentId = `${cardId}-content`;

  return (
    <div className={`glass-card rounded-xl overflow-hidden ${className}`}>
      {/* Header - clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <span className="text-cyan-400">{icon}</span>

          {/* Title */}
          <span className="text-sm font-medium text-white">{title}</span>

          {/* Count badge */}
          <span
            className={`
              px-2 py-0.5 text-xs font-medium rounded-full
              ${count > 0 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700/50 text-slate-400'}
            `}
          >
            {count}
          </span>
        </div>

        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Collapsible content */}
      <div
        id={contentId}
        className={`
          overflow-hidden transition-all duration-300
          ${isExpanded ? 'max-h-[400px] border-t border-slate-700/30' : 'max-h-0'}
        `}
      >
        {isExpanded && (
          <div className="p-4 overflow-y-auto max-h-[360px]">
            {count === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {emptyMessage}
              </p>
            ) : (
              children
            )}
          </div>
        )}
      </div>
    </div>
  );
}
