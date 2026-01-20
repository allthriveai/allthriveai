/**
 * EchoConversation - Unified chat component for Echo Creator Coach
 * TASK-025: Single chat for all modes with mode-aware styling
 *
 * Features:
 * - Renders chat messages with mode-aware styling
 * - Idea suggestions render inline using IdeaCard
 * - Action buttons trigger mode transitions via useEchoAgent
 * - Quick action buttons render contextually based on current mode
 * - Uses glass-panel, neon-glow styling from Neon Glass design system
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  ArrowRightIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  PaintBrushIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useEchoAgent } from '@/context/EchoAgentContext';
import { useEchoChat, type EchoChatMessage } from '@/hooks/useEchoChat';
import { EchoAvatar } from '@/components/content-engine/chat/EchoAvatar';
import { IdeaCard } from '@/components/content-engine/ideas/IdeaCard';
import type { EchoMode, SuggestedIdea, ContentIdea } from '@/types/contentEngine';

interface EchoConversationProps {
  sessionId: string;
  onIdeaSaved?: (ideaId: number, title: string) => void;
  className?: string;
}

// Mode-specific quick actions
interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  targetMode?: EchoMode;
}

const modeQuickActions: Record<EchoMode, QuickAction[]> = {
  idle: [
    {
      id: 'start-brainstorm',
      label: 'Start brainstorming',
      prompt: "Let's brainstorm some content ideas together!",
      icon: LightBulbIcon,
      targetMode: 'brainstorm',
    },
    {
      id: 'review-ideas',
      label: 'Review my ideas',
      prompt: 'Can you help me review my saved content ideas?',
      icon: ClipboardDocumentCheckIcon,
      targetMode: 'review',
    },
  ],
  brainstorm: [
    {
      id: 'more-ideas',
      label: 'More ideas',
      prompt: 'Give me more content ideas like this!',
      icon: SparklesIcon,
    },
    {
      id: 'different-angle',
      label: 'Different angle',
      prompt: 'Can you suggest a different angle or approach?',
      icon: LightBulbIcon,
    },
    {
      id: 'create-clip',
      label: 'Create a clip',
      prompt: 'Help me turn this into a content clip',
      icon: PaintBrushIcon,
      targetMode: 'create',
    },
  ],
  create: [
    {
      id: 'adjust-style',
      label: 'Adjust style',
      prompt: 'Can we adjust the style or tone of this?',
      icon: PaintBrushIcon,
    },
    {
      id: 'add-hook',
      label: 'Stronger hook',
      prompt: 'Can you suggest a stronger hook?',
      icon: SparklesIcon,
    },
    {
      id: 'schedule-it',
      label: 'Schedule this',
      prompt: "I'm happy with this, let's schedule it",
      icon: CalendarDaysIcon,
      targetMode: 'schedule',
    },
  ],
  schedule: [
    {
      id: 'best-time',
      label: 'Best posting time',
      prompt: 'When is the best time to post this?',
      icon: CalendarDaysIcon,
    },
    {
      id: 'more-content',
      label: 'Create more content',
      prompt: "Let's create more content to schedule",
      icon: LightBulbIcon,
      targetMode: 'brainstorm',
    },
  ],
  review: [
    {
      id: 'improve-idea',
      label: 'Improve this idea',
      prompt: 'How can I improve this content idea?',
      icon: SparklesIcon,
    },
    {
      id: 'brainstorm-more',
      label: 'Brainstorm more',
      prompt: "Let's brainstorm more ideas like this",
      icon: LightBulbIcon,
      targetMode: 'brainstorm',
    },
  ],
};

// Mode-specific styling
const modeStyles: Record<EchoMode, { accent: string; glow: string; border: string }> = {
  idle: {
    accent: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    border: 'border-cyan-500/20',
  },
  brainstorm: {
    accent: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/20',
  },
  create: {
    accent: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    border: 'border-purple-500/20',
  },
  schedule: {
    accent: 'text-green-400',
    glow: 'shadow-green-500/20',
    border: 'border-green-500/20',
  },
  review: {
    accent: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    border: 'border-blue-500/20',
  },
};

// Skeleton loading for messages
function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-700/50" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700/50 rounded w-3/4" />
        <div className="h-4 bg-slate-700/50 rounded w-1/2" />
      </div>
    </div>
  );
}

export function EchoConversation({
  sessionId,
  onIdeaSaved,
  className = '',
}: EchoConversationProps) {
  const { mode, transitionTo, recordIdeaSaved, recordAction } = useEchoAgent();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedIdeaTitles, setSavedIdeaTitles] = useState<Set<string>>(new Set());
  const [savingIdeaTitle, setSavingIdeaTitle] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get mode-specific styles
  const styles = modeStyles[mode];
  const quickActions = modeQuickActions[mode];

  // Handle errors
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Handle idea saved
  const handleIdeaSaved = useCallback(
    (ideaId: number, title: string) => {
      setSavingIdeaTitle(null);
      setSavedIdeaTitles((prev) => new Set(prev).add(title));
      recordIdeaSaved();
      onIdeaSaved?.(ideaId, title);
    },
    [recordIdeaSaved, onIdeaSaved]
  );

  // Echo chat hook
  const {
    messages,
    sendMessage,
    isConnected,
    isConnecting,
    isTyping,
    suggestedIdea,
    currentTool,
    reconnectAttempts,
    connect,
    clearSuggestedIdea,
  } = useEchoChat({
    sessionId,
    onError: handleError,
    onIdeaSaved: handleIdeaSaved,
    autoReconnect: true,
  });

  // Simulate loading history state
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => setIsLoadingHistory(false), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isConnected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, suggestedIdea]);

  // Handle send message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendMessage(content.trim());
      setInputValue('');
      recordAction('message_sent');
    },
    [sendMessage, recordAction]
  );

  // Handle quick action click
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (action.targetMode) {
        transitionTo(action.targetMode);
      }
      handleSendMessage(action.prompt);
    },
    [transitionTo, handleSendMessage]
  );

  // Handle save idea from suggestion
  const handleSaveIdea = useCallback(
    (idea: SuggestedIdea) => {
      setSavingIdeaTitle(idea.title);
      sendMessage(`Save this idea: "${idea.title}"`);
    },
    [sendMessage]
  );

  // Handle idea card actions - convert SuggestedIdea to ContentIdea for IdeaCard
  const handleIdeaCardAction = useCallback(
    (action: 'archive' | 'createClip' | 'schedule' | 'delete', ideaId: number) => {
      switch (action) {
        case 'createClip':
          transitionTo('create');
          sendMessage(`Help me create a clip from idea ${ideaId}`);
          break;
        case 'schedule':
          transitionTo('schedule');
          sendMessage(`Help me schedule idea ${ideaId}`);
          break;
        default:
          break;
      }
    },
    [transitionTo, sendMessage]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSendMessage(inputValue);
    },
    [inputValue, handleSendMessage]
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(inputValue);
      }
    },
    [inputValue, handleSendMessage]
  );

  // Convert SuggestedIdea to ContentIdea for IdeaCard
  const suggestedIdeaToContentIdea = useCallback(
    (idea: SuggestedIdea, index: number): ContentIdea => ({
      id: -1 * (index + 1), // Negative ID for unsaved ideas
      title: idea.title,
      description: idea.description,
      contentPillar: idea.pillarName,
      platforms: idea.platforms || [],
      source: 'brainstorm',
      status: 'saved',
      order: 0,
      clipsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    []
  );

  // Render message based on type
  const renderMessage = useCallback(
    (message: EchoChatMessage) => {
      // User message
      if (message.sender === 'user') {
        return (
          <div role="article" className="flex justify-end">
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 bg-cyan-500/20 text-white ${styles.border}`}
            >
              {message.content}
            </div>
          </div>
        );
      }

      // Idea suggestion message - render inline using IdeaCard
      if (message.metadata?.type === 'idea_suggestion' && message.metadata.suggestedIdea) {
        const idea = message.metadata.suggestedIdea;
        const contentIdea = suggestedIdeaToContentIdea(idea, messages.indexOf(message));
        const isSaved = savedIdeaTitles.has(idea.title);
        const isSaving = savingIdeaTitle === idea.title;

        return (
          <div role="article" className="flex gap-3 max-w-[85%]">
            <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <SparklesIcon className={`w-4 h-4 ${styles.accent}`} />
                <span className={`text-xs font-medium ${styles.accent}`}>
                  Idea Suggestion
                </span>
              </div>
              <IdeaCard
                idea={contentIdea}
                onCreateClip={() => handleIdeaCardAction('createClip', contentIdea.id)}
                onSchedule={() => handleIdeaCardAction('schedule', contentIdea.id)}
                isHighlighted={!isSaved}
              />
              {/* Save button below card */}
              {!isSaved && (
                <button
                  type="button"
                  onClick={() => handleSaveIdea(idea)}
                  disabled={isSaving}
                  className={`
                    mt-2 w-full flex items-center justify-center gap-2
                    px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    ${
                      isSaving
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 cursor-wait'
                        : `bg-cyan-500/20 text-cyan-300 border ${styles.border} hover:bg-cyan-500/30`
                    }
                  `}
                >
                  {isSaving ? 'Saving...' : 'Save Idea'}
                </button>
              )}
              {isSaved && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
                  <ClipboardDocumentCheckIcon className="w-4 h-4" />
                  Saved to Ideas
                </div>
              )}
            </div>
          </div>
        );
      }

      // Error message
      if (message.metadata?.type === 'error') {
        return (
          <div role="article" className="flex gap-3 max-w-[85%]">
            <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
            <div className="rounded-2xl px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-300">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                <span>{message.content}</span>
              </div>
              <button
                type="button"
                onClick={() => connect()}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Retry connection
              </button>
            </div>
          </div>
        );
      }

      // Regular assistant message
      return (
        <div role="article" className="flex gap-3 max-w-[85%]">
          <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
          <div className={`rounded-2xl px-4 py-2 bg-slate-800/50 text-slate-200 ${styles.border}`}>
            {message.content}
          </div>
        </div>
      );
    },
    [
      styles,
      messages,
      savedIdeaTitles,
      savingIdeaTitle,
      suggestedIdeaToContentIdea,
      handleSaveIdea,
      handleIdeaCardAction,
      connect,
    ]
  );

  // Connection status indicator
  const connectionStatus = useMemo(() => {
    if (isConnecting) {
      return (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          <span>Connecting to Echo...</span>
        </div>
      );
    }
    if (!isConnected) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Disconnected</span>
            {reconnectAttempts > 0 && (
              <span className="text-xs text-slate-500">
                (attempt {reconnectAttempts})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => connect()}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Reconnect
          </button>
        </div>
      );
    }
    return null;
  }, [isConnecting, isConnected, reconnectAttempts, connect]);

  // Loading skeleton
  const loadingSkeleton = useMemo(() => {
    if (!isLoadingHistory || messages.length > 0) return null;
    return (
      <div className="space-y-4 py-4">
        <MessageSkeleton />
        <MessageSkeleton />
      </div>
    );
  }, [isLoadingHistory, messages.length]);

  return (
    <div className={`flex flex-col h-full glass-panel rounded-xl ${className}`}>
      {/* Messages area */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {/* Connection status */}
        {connectionStatus}

        {/* Loading skeleton */}
        {loadingSkeleton}

        {/* Empty state */}
        {!connectionStatus &&
          !loadingSkeleton &&
          messages.length === 0 &&
          !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <EchoAvatar size="lg" className="mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {"Hey! I'm Echo"}
              </h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Your content brainstorming partner. Pick a quick action below or just start typing!
              </p>
            </div>
          )}

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}

        {/* Floating suggested idea if not already in messages */}
        {suggestedIdea &&
          !messages.some(
            (m) => m.metadata?.suggestedIdea?.title === suggestedIdea.title
          ) && (
            <div className="flex gap-3 max-w-[85%]">
              <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className={`w-4 h-4 ${styles.accent}`} />
                  <span className={`text-xs font-medium ${styles.accent}`}>
                    Idea Suggestion
                  </span>
                </div>
                <IdeaCard
                  idea={suggestedIdeaToContentIdea(suggestedIdea, 0)}
                  onCreateClip={() => handleIdeaCardAction('createClip', -1)}
                  onSchedule={() => handleIdeaCardAction('schedule', -1)}
                  isHighlighted
                />
                <button
                  type="button"
                  onClick={() => {
                    handleSaveIdea(suggestedIdea);
                    clearSuggestedIdea();
                  }}
                  disabled={savingIdeaTitle === suggestedIdea.title}
                  className={`
                    mt-2 w-full flex items-center justify-center gap-2
                    px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    bg-cyan-500/20 text-cyan-300 border ${styles.border} hover:bg-cyan-500/30
                  `}
                >
                  {savingIdeaTitle === suggestedIdea.title ? 'Saving...' : 'Save Idea'}
                </button>
              </div>
            </div>
          )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <EchoAvatar size="sm" className="flex-shrink-0" />
            <div className={`rounded-2xl px-4 py-2 bg-slate-800/50 ${styles.border}`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span
                    className={`w-2 h-2 rounded-full bg-cyan-400 animate-bounce`}
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className={`w-2 h-2 rounded-full bg-cyan-400 animate-bounce`}
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className={`w-2 h-2 rounded-full bg-cyan-400 animate-bounce`}
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                {currentTool && (
                  <span className="text-xs text-slate-400">{currentTool}...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="px-4 py-2 border-t border-slate-700/50">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <SparklesIcon className={`w-4 h-4 ${styles.accent} flex-shrink-0`} />
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action)}
                disabled={!isConnected || isTyping}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                  bg-slate-800/50 text-slate-300
                  border border-slate-700/50
                  transition-all duration-200
                  hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30
                  hover:shadow-sm hover:shadow-cyan-500/10
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-700/50">
        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Message Echo...' : 'Connecting...'}
            disabled={!isConnected || isTyping}
            className="flex-1 input-glass pr-12"
            autoFocus
          />
          <button
            type="submit"
            disabled={!isConnected || isTyping || !inputValue.trim()}
            className={`
              p-3 rounded-xl
              bg-cyan-500/20 hover:bg-cyan-500/30
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${styles.glow}
            `}
          >
            <ArrowRightIcon className="w-5 h-5 text-cyan-bright" />
          </button>
        </form>
      </div>
    </div>
  );
}
