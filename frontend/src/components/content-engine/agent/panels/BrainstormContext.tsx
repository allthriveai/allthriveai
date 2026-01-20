/**
 * BrainstormContext - Context panel for brainstorm mode
 * TASK-028: Shows content pillars and platform toggles for brainstorming
 *
 * Features:
 * - Content pillar chips (toggleable) from useContentPillars
 * - Platform toggles (Twitter, LinkedIn, YouTube) with icons
 * - Selected pillars/platforms sync with EchoAgentProvider state
 * - Changes send updated context with next message
 */

import { useCallback } from 'react';
import { ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useContentPillars } from '@/hooks/useContentPillars';
import { useEchoAgent } from '@/context/EchoAgentContext';
import type { ContentPillar, Platform } from '@/types/contentEngine';

interface BrainstormContextProps {
  className?: string;
}

// Platform definitions with SVG icons
const platforms: { id: Platform; label: string; icon: React.ReactNode }[] = [
  {
    id: 'twitter',
    label: 'Twitter / X',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
      </svg>
    ),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

// Skeleton loading chips
function PillarSkeletons() {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-7 w-20 bg-slate-700/50 rounded-full animate-pulse"
        />
      ))}
    </div>
  );
}

export function BrainstormContext({ className = '' }: BrainstormContextProps) {
  const { pillars, isLoading, error, refetch } = useContentPillars();
  const {
    activePillars,
    activePlatforms,
    setActivePillars,
    setActivePlatforms,
  } = useEchoAgent();

  // Toggle pillar selection
  const handlePillarToggle = useCallback(
    (pillar: ContentPillar) => {
      const isSelected = activePillars.some((p) => p.id === pillar.id);
      if (isSelected) {
        setActivePillars(activePillars.filter((p) => p.id !== pillar.id));
      } else {
        setActivePillars([...activePillars, pillar]);
      }
    },
    [activePillars, setActivePillars]
  );

  // Toggle platform selection
  const handlePlatformToggle = useCallback(
    (platform: Platform) => {
      const isSelected = activePlatforms.includes(platform);
      if (isSelected) {
        setActivePlatforms(activePlatforms.filter((p) => p !== platform));
      } else {
        setActivePlatforms([...activePlatforms, platform]);
      }
    },
    [activePlatforms, setActivePlatforms]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Content Pillars Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Content Pillars</h4>
          {activePillars.length > 0 && (
            <span className="text-xs text-amber-400/70">
              {activePillars.length} selected
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !error && <PillarSkeletons />}

        {/* Empty state */}
        {!isLoading && !error && pillars.length === 0 && (
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <p className="text-sm text-slate-400 mb-2">
              No content pillars available.
            </p>
            <a
              href="/settings/content"
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Cog6ToothIcon className="w-3.5 h-3.5" />
              Add content pillars in settings
            </a>
          </div>
        )}

        {/* Pillars chips */}
        {!isLoading && !error && pillars.length > 0 && (
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent md:flex-wrap md:overflow-visible">
            {pillars.map((pillar) => {
              const isSelected = activePillars.some((p) => p.id === pillar.id);
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => handlePillarToggle(pillar)}
                  aria-pressed={isSelected}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                    transition-all duration-200 flex-shrink-0
                    ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                    }
                  `}
                >
                  {pillar.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/50" />

      {/* Platform Toggles Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Target Platforms</h4>
          {activePlatforms.length > 0 && (
            <span className="text-xs text-amber-400/70">
              {activePlatforms.length} selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => {
            const isSelected = activePlatforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => handlePlatformToggle(platform.id)}
                aria-pressed={isSelected}
                aria-label={`${platform.label} ${isSelected ? 'enabled' : 'disabled'}`}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg
                  transition-all duration-200
                  ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50'
                      : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                  }
                `}
              >
                {platform.icon}
                <span className="text-xs font-medium">{platform.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Context hint */}
      {(activePillars.length > 0 || activePlatforms.length > 0) && (
        <p className="text-xs text-slate-500 mt-3">
          Echo will tailor suggestions based on your selections.
        </p>
      )}
    </div>
  );
}

export default BrainstormContext;
