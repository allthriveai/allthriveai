/**
 * BrainstormChatPanel - Main chat panel for Echo Creator Coach
 * US-018: Brainstorm chat panel with ContextBar, ChatMessageList, QuickPromptPills, ChatInput
 * US-020: Echo first-time onboarding flow
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ArrowRightIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEchoChat, type EchoChatMessage } from '@/hooks/useEchoChat';
import { useContentPillars } from '@/hooks/useContentPillars';
import { ContextBar } from './ContextBar';
import { QuickPromptPills } from './QuickPromptPills';
import { IdeaSuggestionMessage } from './IdeaSuggestionMessage';
import { EchoAvatar } from './EchoAvatar';
import {
  EchoOnboarding,
  WelcomeBackMessage,
  isOnboardingComplete,
  type EchoPreferences,
} from './EchoOnboarding';
import type { ContentPillar, Platform, SuggestedIdea } from '@/types/contentEngine';

interface BrainstormChatPanelProps {
  sessionId: string;
  onIdeaSaved?: (ideaId: number, title: string) => void;
  className?: string;
}

export function BrainstormChatPanel({
  sessionId,
  onIdeaSaved,
  className = '',
}: BrainstormChatPanelProps) {
  // Onboarding state - check localStorage on mount
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !isOnboardingComplete();
    } catch {
      return false; // Default to no onboarding if localStorage fails
    }
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    try {
      return isOnboardingComplete();
    } catch {
      return false;
    }
  });
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  const [activePlatforms, setActivePlatforms] = useState<Platform[]>(['twitter', 'linkedin']);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savingIdeaId, setSavingIdeaId] = useState<string | null>(null);
  const [savedIdeaIds, setSavedIdeaIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Content pillars hook
  const {
    pillars,
    isLoading: isPillarsLoading,
    activePillar,
    setActivePillar,
  } = useContentPillars();

  // Handle errors
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Handle idea saved
  const handleIdeaSaved = useCallback(
    (ideaId: number, title: string) => {
      setSavingIdeaId(null);
      setSavedIdeaIds((prev) => new Set(prev).add(title));
      onIdeaSaved?.(ideaId, title);
    },
    [onIdeaSaved]
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
    connect,
  } = useEchoChat({
    sessionId,
    onError: handleError,
    onIdeaSaved: handleIdeaSaved,
    autoReconnect: true,
  });

  // Handle platform toggle
  const handlePlatformToggle = useCallback((platform: Platform) => {
    setActivePlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  }, []);

  // Handle pillar select
  const handlePillarSelect = useCallback((pillar: ContentPillar | null) => {
    setActivePillar(pillar);
  }, [setActivePillar]);

  // Handle send message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendMessage(content.trim());
      setInputValue('');
    },
    [sendMessage]
  );

  // Handle quick prompt select
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  // Handle save idea
  const handleSaveIdea = useCallback(
    (idea: SuggestedIdea) => {
      setSavingIdeaId(idea.title);
      // The actual save happens through the WebSocket via save_idea tool
      // Send a message to Echo to save the idea
      sendMessage(`Save this idea: "${idea.title}"`);
    },
    [sendMessage]
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

  // Handle onboarding complete
  const handleOnboardingComplete = useCallback((preferences: EchoPreferences) => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    // Apply saved preferences to current session
    if (preferences.platforms.length > 0) {
      setActivePlatforms(preferences.platforms);
    }
  }, []);

  // Handle onboarding skip
  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
  }, []);

  // Show welcome back message for returning users
  useEffect(() => {
    if (hasCompletedOnboarding && !showOnboarding && messages.length === 0 && isConnected) {
      setShowWelcomeBack(true);
      // Auto-hide welcome back after 3 seconds
      const timer = setTimeout(() => setShowWelcomeBack(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, showOnboarding, messages.length, isConnected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, suggestedIdea]);

  // Render message based on type
  const renderMessage = useCallback(
    (message: EchoChatMessage) => {
      // User message
      if (message.sender === 'user') {
        return (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-cyan-500/20 text-white">
              {message.content}
            </div>
          </div>
        );
      }

      // Idea suggestion message
      if (message.metadata?.type === 'idea_suggestion' && message.metadata.suggestedIdea) {
        const idea = message.metadata.suggestedIdea;
        return (
          <IdeaSuggestionMessage
            idea={idea}
            onSave={handleSaveIdea}
            isSaving={savingIdeaId === idea.title}
            isSaved={savedIdeaIds.has(idea.title)}
          />
        );
      }

      // Error message
      if (message.metadata?.type === 'error') {
        return (
          <div className="flex gap-3 max-w-[85%]">
            <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
            <div className="rounded-2xl px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-300">
              {message.content}
            </div>
          </div>
        );
      }

      // Regular assistant message
      return (
        <div className="flex gap-3 max-w-[85%]">
          <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
          <div className="rounded-2xl px-4 py-2 bg-slate-800/50 text-slate-200">
            {message.content}
          </div>
        </div>
      );
    },
    [handleSaveIdea, savingIdeaId, savedIdeaIds]
  );

  // Loading/connecting state indicator
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
  }, [isConnecting, isConnected, connect]);

  // Show onboarding once WebSocket is connected
  if (showOnboarding && isConnected) {
    return (
      <div className={`flex flex-col h-full glass-panel rounded-xl ${className}`}>
        <EchoOnboarding
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full glass-panel rounded-xl ${className}`}>
      {/* Context Bar */}
      <ContextBar
        pillars={pillars}
        activePillar={activePillar}
        onPillarSelect={handlePillarSelect}
        activePlatforms={activePlatforms}
        onPlatformToggle={handlePlatformToggle}
        isLoading={isPillarsLoading}
      />

      {/* Messages area */}
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {/* Connection status */}
        {connectionStatus}

        {/* Welcome back message for returning users */}
        {showWelcomeBack && !connectionStatus && messages.length === 0 && (
          <WelcomeBackMessage />
        )}

        {/* Empty state - only show if not showing welcome back */}
        {!connectionStatus && messages.length === 0 && !isTyping && !showWelcomeBack && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <EchoAvatar size="lg" className="mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {"Hey! I'm Echo"}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {"Your content brainstorming partner. Let's create some amazing ideas together. Pick a pillar above or just start typing!"}
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}

        {/* Suggested idea (floating) */}
        {suggestedIdea && !messages.some((m) => m.metadata?.suggestedIdea?.title === suggestedIdea.title) && (
          <IdeaSuggestionMessage
            idea={suggestedIdea}
            onSave={handleSaveIdea}
            isSaving={savingIdeaId === suggestedIdea.title}
            isSaved={savedIdeaIds.has(suggestedIdea.title)}
          />
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <EchoAvatar size="sm" className="flex-shrink-0" />
            <div className="rounded-2xl px-4 py-2 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
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
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Quick prompts */}
      <div className="px-4 border-t border-slate-700/50">
        <QuickPromptPills
          activePillar={activePillar}
          activePlatforms={activePlatforms}
          onPromptSelect={handlePromptSelect}
          disabled={!isConnected || isTyping}
        />
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
            className="p-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightIcon className="w-5 h-5 text-cyan-bright" />
          </button>
        </form>
      </div>
    </div>
  );
}
