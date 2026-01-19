/**
 * Brand Voice Tab Component
 * US-009: Brand Voice Tab
 *
 * Displays current brand voice settings and links to full settings page
 */

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faStar,
  faCog,
  faExclamationCircle,
  faRedo,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { useBrandVoices, useSetDefaultVoice } from '@/hooks/useBrandVoice';
import { BRAND_VOICE_TONES } from '@/services/brandVoice';

export function BrandVoiceTab() {
  const { voices, isLoading, error, refetch } = useBrandVoices();
  const { setDefault, isSettingDefault } = useSetDefaultVoice();

  const handleSetDefault = useCallback(async (id: number) => {
    try {
      await setDefault(id);
      refetch();
    } catch {
      // Error handled by hook
    }
  }, [setDefault, refetch]);

  const getToneLabel = (tone: string) => {
    const found = BRAND_VOICE_TONES.find((t) => t.value === tone);
    return found?.label || tone;
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        id="tabpanel-brand"
        role="tabpanel"
        aria-labelledby="tab-brand"
        className="h-full"
      >
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-6">
            <div className="h-6 w-32 bg-slate-800/50 rounded mb-4 animate-pulse" />
            <div className="h-4 w-48 bg-slate-700/50 rounded mb-6 animate-pulse" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-slate-800/30 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        id="tabpanel-brand"
        role="tabpanel"
        aria-labelledby="tab-brand"
        className="h-full flex items-center justify-center"
      >
        <div className="text-center glass-panel p-8 rounded-xl max-w-md">
          <FontAwesomeIcon icon={faExclamationCircle} className="text-4xl text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Brand Voice</h2>
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
  if (voices.length === 0) {
    return (
      <div
        id="tabpanel-brand"
        role="tabpanel"
        aria-labelledby="tab-brand"
        className="h-full"
      >
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <FontAwesomeIcon icon={faBullhorn} className="text-3xl text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Define Your Brand Voice</h2>
          <p className="text-slate-400 text-center max-w-sm mb-6">
            Create a brand voice profile so AI-generated content matches your style, tone, and target audience.
          </p>
          <Link
            to="/settings/brand-voice"
            className="btn-primary px-6 py-2 inline-flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            Create Brand Voice
          </Link>
        </div>
      </div>
    );
  }

  // Brand voice list
  return (
    <div
      id="tabpanel-brand"
      role="tabpanel"
      aria-labelledby="tab-brand"
      className="h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Your Brand Voices</h2>
        <Link
          to="/settings/brand-voice"
          className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
        >
          <FontAwesomeIcon icon={faCog} className="text-xs" />
          Manage in Settings
        </Link>
      </div>

      {/* Voice cards */}
      <div className="space-y-3">
        {voices.map((voice) => (
          <div
            key={voice.id}
            className={`
              glass-card p-4 rounded-xl transition-all
              ${voice.isDefault ? 'ring-1 ring-cyan-500/30' : ''}
            `}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-white truncate">{voice.name}</h3>
                  {voice.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      <FontAwesomeIcon icon={faStar} className="text-[10px]" />
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">{getToneLabel(voice.tone)}</span>
                  {voice.targetAudience && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500 truncate">{voice.targetAudience}</span>
                    </>
                  )}
                </div>
                {voice.catchphrases && voice.catchphrases.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Phrases: {voice.catchphrases.slice(0, 3).join(', ')}
                    {voice.catchphrases.length > 3 && ` +${voice.catchphrases.length - 3} more`}
                  </div>
                )}
              </div>

              {!voice.isDefault && (
                <button
                  onClick={() => handleSetDefault(voice.id)}
                  disabled={isSettingDefault}
                  className="text-slate-400 hover:text-amber-400 p-2 rounded transition-colors disabled:opacity-50"
                  title="Set as default"
                >
                  <FontAwesomeIcon icon={faStar} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 glass-card rounded-xl">
        <p className="text-sm text-slate-400">
          <strong className="text-slate-300">Tip:</strong> Your default brand voice is automatically used when creating clips.
          You can select a different voice when starting a new conversation in the Create tab.
        </p>
      </div>

      {/* Link to full settings */}
      <div className="mt-4">
        <Link
          to="/settings/brand-voice"
          className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          Add New Brand Voice
        </Link>
      </div>
    </div>
  );
}
