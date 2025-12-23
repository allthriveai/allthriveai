/**
 * FigmaFlow - Self-contained Figma integration flow component
 *
 * Handles the complete Figma integration:
 * 1. Connect to Figma (OAuth)
 * 2. Paste Figma file URL to import
 *
 * Features:
 * - URL validation
 * - Loading states
 * - Error handling
 */

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFigma } from '@fortawesome/free-brands-svg-icons';
import { ArrowLeftIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { IntegrationFlowState } from '../core/types';

interface FigmaFlowProps {
  state: IntegrationFlowState;
  onConnect: () => void;
  onImportUrl: (url: string) => Promise<void>;
  isFigmaUrl: (url: string) => boolean;
  onBack: () => void;
}

export function FigmaFlow({
  state,
  onConnect,
  onImportUrl,
  isFigmaUrl,
  onBack,
}: FigmaFlowProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(true);

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    if (value.trim()) {
      setIsValidUrl(isFigmaUrl(value));
    } else {
      setIsValidUrl(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !isFigmaUrl(urlInput)) {
      setIsValidUrl(false);
      return;
    }
    onImportUrl(urlInput);
  };

  // Loading state
  if (state.step === 'loading') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <FontAwesomeIcon icon={faFigma} className="w-6 h-6 text-purple-400 animate-pulse" />
          <span className="text-sm text-slate-400">{state.message}</span>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-slate-700/30 rounded-lg" />
        </div>
      </div>
    );
  }

  // Connect state
  if (state.step === 'connect') {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="text-center py-6">
          <FontAwesomeIcon icon={faFigma} className="w-12 h-12 text-purple-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Figma</h3>
          <p className="text-sm text-slate-400 mb-6">{state.message}</p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faFigma} />
            Connect Figma
          </button>
        </div>
      </div>
    );
  }

  // Select (URL input) state
  if (state.step === 'select') {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>

        <div className="text-center py-4">
          <FontAwesomeIcon icon={faFigma} className="w-10 h-10 text-purple-400 mb-3" />
          <h3 className="text-base font-medium text-white mb-1">Import from Figma</h3>
          <p className="text-sm text-slate-400">{state.message}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.figma.com/design/..."
              className={`w-full pl-9 pr-4 py-2 bg-slate-800/50 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none ${
                isValidUrl
                  ? 'border-slate-700 focus:border-purple-500'
                  : 'border-red-500 focus:border-red-500'
              }`}
            />
          </div>
          {!isValidUrl && (
            <p className="text-xs text-red-400">
              Please enter a valid Figma file URL (e.g., figma.com/design/... or figma.com/file/...)
            </p>
          )}
          <button
            type="submit"
            disabled={!urlInput.trim()}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            Import Design
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          Supported: Figma design files, prototypes, and FigJam boards
        </p>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faFigma} className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm text-red-400">{state.error}</p>
        </div>
      </div>
    );
  }

  return null;
}
