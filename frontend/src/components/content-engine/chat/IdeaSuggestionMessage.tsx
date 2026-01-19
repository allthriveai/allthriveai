/**
 * IdeaSuggestionMessage - Renders idea card with Save button in chat
 * US-018: Idea suggestion message for Echo brainstorm chat
 */

import { useState } from 'react';
import {
  BookmarkIcon,
  CheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { EchoAvatar } from './EchoAvatar';
import { PlatformBadge } from '../ideas/PlatformBadge';
import type { SuggestedIdea, Platform } from '@/types/contentEngine';

interface IdeaSuggestionMessageProps {
  idea: SuggestedIdea;
  onSave: (idea: SuggestedIdea) => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function IdeaSuggestionMessage({
  idea,
  onSave,
  isSaving = false,
  isSaved = false,
}: IdeaSuggestionMessageProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = () => {
    if (!isSaving && !isSaved) {
      onSave(idea);
    }
  };

  return (
    <div className="flex gap-3 max-w-[85%]">
      <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />

      <div
        className={`
          glass-card rounded-2xl p-4
          border border-cyan-500/20
          bg-gradient-to-br from-cyan-500/5 to-cyan-600/5
          transition-all duration-300
          ${isHovered ? 'shadow-neon border-cyan-400/40' : ''}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <SparklesIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-cyan-400">Idea Suggestion</span>
        </div>

        {/* Title */}
        <h4 className="text-white font-semibold mb-2">{idea.title}</h4>

        {/* Description */}
        {idea.description && (
          <p className="text-sm text-slate-300 mb-3">{idea.description}</p>
        )}

        {/* Hook */}
        {idea.hook && (
          <div className="mb-3 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <span className="text-xs text-slate-400 block mb-1">Hook:</span>
            <p className="text-sm text-cyan-200 italic">{`"${idea.hook}"`}</p>
          </div>
        )}

        {/* Pillar and Platforms */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {idea.pillarName && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {idea.pillarName}
            </span>
          )}
          {idea.platforms && idea.platforms.length > 0 && (
            <div className="flex gap-1">
              {idea.platforms.map((platform: Platform) => (
                <PlatformBadge key={platform} platform={platform} />
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isSaved}
          className={`
            w-full flex items-center justify-center gap-2
            px-4 py-2 rounded-lg
            font-medium text-sm
            transition-all duration-200
            ${
              isSaved
                ? 'bg-green-500/20 text-green-300 border border-green-500/30 cursor-default'
                : isSaving
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 cursor-wait'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 hover:shadow-sm hover:shadow-cyan-500/20'
            }
            disabled:opacity-75
          `}
        >
          {isSaved ? (
            <>
              <CheckIcon className="w-4 h-4" />
              <span>Saved to Ideas</span>
            </>
          ) : isSaving ? (
            <>
              <BookmarkSolidIcon className="w-4 h-4 animate-pulse" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <BookmarkIcon className="w-4 h-4" />
              <span>Save Idea</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
