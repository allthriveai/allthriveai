/**
 * IdeaCard - Individual content idea item for Echo workspace
 * US-008: IdeaCard shows title, status badge, platform icon
 *
 * Features:
 * - Title with optional description
 * - Status badge (saved, planned, in_progress, archived)
 * - Platform icons (LinkedIn, Twitter, YouTube)
 * - Content pillar indicator
 * - Click to view/edit
 */

import { useMemo, type ReactNode } from 'react';
import type { ContentIdea, IdeaStatus, Platform } from '@/types/contentEngine';

// Platform icon components using Heroicons-style SVGs
function LinkedInIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="LinkedIn"
    >
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function TwitterIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="Twitter/X"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="YouTube"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Status configuration
const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  saved: {
    label: 'Saved',
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-300',
  },
  planned: {
    label: 'Planned',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-300',
  },
  in_progress: {
    label: 'In Progress',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-300',
  },
  archived: {
    label: 'Archived',
    bgColor: 'bg-slate-700/50',
    textColor: 'text-slate-400',
  },
};

// Platform icon mapping
const PLATFORM_ICONS: Record<Platform, (props: { className?: string }) => ReactNode> = {
  linkedin: LinkedInIcon,
  twitter: TwitterIcon,
  youtube: YouTubeIcon,
};

interface IdeaCardProps {
  /**
   * Content idea data
   */
  idea: ContentIdea;
  /**
   * Callback when card is clicked
   */
  onClick?: (idea: ContentIdea) => void;
  /**
   * Optional CSS class name
   */
  className?: string;
}

export function IdeaCard({ idea, onClick, className = '' }: IdeaCardProps) {
  const statusConfig = useMemo(() => {
    return STATUS_CONFIG[idea.status] || STATUS_CONFIG.saved;
  }, [idea.status]);

  const handleClick = () => {
    if (onClick) {
      onClick(idea);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={`
        p-3 rounded-lg
        ${onClick ? 'cursor-pointer hover:bg-slate-800/30' : ''}
        transition-colors
        ${idea.status === 'archived' ? 'opacity-60' : ''}
        ${className}
      `}
    >
      {/* Header: Title and status badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-white line-clamp-2 flex-1">
          {idea.title}
        </h4>

        {/* Status badge */}
        <span
          className={`
            flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full
            ${statusConfig.bgColor} ${statusConfig.textColor}
          `}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Description (if present) */}
      {idea.description && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          {idea.description}
        </p>
      )}

      {/* Footer: Content pillar and platform icons */}
      <div className="flex items-center justify-between gap-2">
        {/* Content pillar */}
        {idea.contentPillar && (
          <span className="text-xs text-cyan-400 truncate max-w-[50%]">
            {idea.contentPillar}
          </span>
        )}

        {/* Platform icons */}
        {idea.platforms.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {idea.platforms.map((platform) => {
              const IconComponent = PLATFORM_ICONS[platform];
              if (!IconComponent) return null;

              return (
                <span
                  key={platform}
                  className="text-slate-400"
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
