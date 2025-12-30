/**
 * LoadingMessage - Shows thinking/processing indicator during AI response
 *
 * Features:
 * - Animated bouncing dots
 * - Tool-specific status messages (e.g., "Importing from GitHub...")
 * - Rotating thinking messages when no specific tool is active
 * - Cancel button to abort processing
 * - Two variants: default (sidebar) and neon (AvaHomePage)
 * - Mini game during long operations (e.g., learning path creation)
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import type { LoadingMessageProps } from '../core/types';
import { ChatErrorBoundary } from '../ChatErrorBoundary';

// Lazy load game component to avoid blocking initial render
const ChatGameCard = lazy(() => import('../games/ChatGameCard').then(m => ({ default: m.ChatGameCard })));

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
  get_recommendations: 'Finding personalized recommendations',
  launch_inline_game: 'Launching game',
  regenerate_architecture_diagram: 'Regenerating architecture',
  create_learning_path: 'Building your personalized learning path — this can take a few minutes. Play a quick game while you wait!',
};

// Tools that take a long time and should show a mini game
const SHOW_GAME_FOR_TOOLS = ['create_learning_path'];

// Rotating status messages when no specific tool is active
// Playful themed for Ava!
const THINKING_MESSAGES = [
  'Thinking...',
  'Stoking the flames...',
  'Consulting my hoard...',
  'Warming up...',
  'Gathering thoughts...',
  'Almost there...',
  'Kindling ideas...',
  'Breathing fire on this...',
  'Perching and pondering...',
  'Consulting my treasure trove...',
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
  const shouldShowGame = currentTool && SHOW_GAME_FOR_TOOLS.includes(currentTool);

  if (isNeon) {
    // Neon Glass variant (AvaHomePage)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end">
          <img
            src="/ava-avatar.png"
            alt="Ava"
            className="w-12 h-12 rounded-full flex-shrink-0 mr-4 object-cover -scale-x-100"
          />
          <div className="glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm flex-1">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-base text-slate-600 dark:text-slate-400">
                {currentTool && TOOL_DISPLAY_NAMES[currentTool]
                  ? TOOL_DISPLAY_NAMES[currentTool]
                  : THINKING_MESSAGES[thinkingIndex]}
              </span>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="ml-2 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Mini game while waiting for long operations */}
        {shouldShowGame && (
          <div className="ml-16">
            <ChatErrorBoundary inline resetKey="loading-game">
              <Suspense fallback={<div className="h-32 animate-pulse bg-slate-800/30 rounded-xl" />}>
                <ChatGameCard gameType="snake" config={{ difficulty: 'easy' }} />
              </Suspense>
            </ChatErrorBoundary>
          </div>
        )}
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex flex-col gap-3">
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
      {/* Mini game while waiting for long operations */}
      {shouldShowGame && (
        <ChatErrorBoundary inline resetKey="loading-game-sidebar">
          <Suspense fallback={<div className="h-32 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl" />}>
            <ChatGameCard gameType="snake" config={{ difficulty: 'easy' }} />
          </Suspense>
        </ChatErrorBoundary>
      )}
    </div>
  );
}
