/**
 * ContextBar - Shows pillar chips and platform toggles
 * US-018: Context bar for Echo brainstorm chat
 */

import type { ContentPillar, Platform } from '@/types/contentEngine';

interface ContextBarProps {
  pillars: ContentPillar[];
  activePillar: ContentPillar | null;
  onPillarSelect: (pillar: ContentPillar | null) => void;
  activePlatforms: Platform[];
  onPlatformToggle: (platform: Platform) => void;
  isLoading?: boolean;
}

const platforms: { id: Platform; label: string; icon: React.ReactNode }[] = [
  {
    id: 'twitter',
    label: 'Twitter',
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

export function ContextBar({
  pillars,
  activePillar,
  onPillarSelect,
  activePlatforms,
  onPlatformToggle,
  isLoading = false,
}: ContextBarProps) {
  return (
    <div className="glass-subtle rounded-xl p-3 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Pillar chips */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <span className="text-xs text-slate-400 whitespace-nowrap">Pillar:</span>
            {isLoading ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-6 w-16 bg-slate-700/50 rounded-full animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onPillarSelect(null)}
                  aria-pressed={activePillar === null}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap
                    transition-all duration-200
                    ${
                      activePillar === null
                        ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                    }
                  `}
                >
                  All
                </button>
                {pillars.map((pillar) => (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => onPillarSelect(pillar)}
                    aria-pressed={activePillar?.id === pillar.id}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap
                      transition-all duration-200
                      ${
                        activePillar?.id === pillar.id
                          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      }
                    `}
                  >
                    {pillar.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Platform toggles */}
        <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700/50 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-xs text-slate-400 whitespace-nowrap">Platforms:</span>
          <div className="flex items-center gap-1">
            {platforms.map((platform) => {
              const isActive = activePlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => onPlatformToggle(platform.id)}
                  aria-pressed={isActive}
                  aria-label={`${platform.label} ${isActive ? 'enabled' : 'disabled'}`}
                  className={`
                    p-1.5 rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'bg-slate-700/30 text-slate-500 hover:bg-slate-700/50 hover:text-slate-400'
                    }
                  `}
                >
                  {platform.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
