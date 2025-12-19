/**
 * LoadingMessage - Shows thinking/processing indicator during AI response
 *
 * Features:
 * - Animated bouncing dots
 * - Tool-specific status messages (e.g., "Importing from GitHub...")
 * - Rotating thinking messages when no specific tool is active
 * - Cancel button to abort processing
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import type { LoadingMessageProps } from '../core/types';

// Human-friendly tool names for the loading indicator
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  import_from_url: 'Importing from URL',
  import_github_project: 'Importing from GitHub',
  create_media_project: 'Creating media project',
  import_video_project: 'Processing video',
  scrape_webpage_for_project: 'Scraping webpage',
  create_project: 'Creating project',
  create_product: 'Creating product',
  extract_url_info: 'Analyzing URL',
  search_projects: 'Searching projects',
  get_trending_projects: 'Finding trending projects',
  get_similar_projects: 'Finding similar projects',
  get_project_details: 'Getting project details',
  recommend_projects: 'Finding recommendations',
  launch_inline_game: 'Launching game',
  regenerate_architecture_diagram: 'Regenerating architecture',
};

// Rotating status messages when no specific tool is active
const THINKING_MESSAGES = [
  'Thinking...',
  'Processing...',
  'Working on it...',
  'Almost there...',
  'Analyzing...',
  'Generating response...',
];

export function LoadingMessage({
  currentTool,
  onCancel,
  variant = 'default',
}: LoadingMessageProps) {
  const [thinkingIndex, setThinkingIndex] = useState(0);

  // Rotate thinking messages when no specific tool is active
  useEffect(() => {
    if (!currentTool) {
      const interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setThinkingIndex(0);
    }
  }, [currentTool]);

  const isNeon = variant === 'neon';

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex justify-start">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
        </div>
        <div className="glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-base text-slate-400">
              {currentTool && TOOL_DISPLAY_NAMES[currentTool]
                ? TOOL_DISPLAY_NAMES[currentTool]
                : THINKING_MESSAGES[thinkingIndex]}
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="ml-2 px-2 py-1 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentTool && TOOL_DISPLAY_NAMES[currentTool] ? (
              <span className="flex items-center gap-1">
                <span className="animate-pulse">{TOOL_DISPLAY_NAMES[currentTool]}</span>
                <span className="inline-flex">
                  <span className="animate-[pulse_1.5s_ease-in-out_infinite]">.</span>
                  <span className="animate-[pulse_1.5s_ease-in-out_0.2s_infinite]">.</span>
                  <span className="animate-[pulse_1.5s_ease-in-out_0.4s_infinite]">.</span>
                </span>
              </span>
            ) : (
              <span className="animate-pulse transition-opacity duration-300">
                {THINKING_MESSAGES[thinkingIndex]}
              </span>
            )}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="ml-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
