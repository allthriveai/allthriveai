/**
 * EchoChat - Chat component for Echo workspace
 * US-006: Chat takes 70% of screen height
 *
 * Features:
 * - Displays chat messages with Echo assistant
 * - Reuses ChatInputArea from existing chat core
 * - Shows loading/connecting states
 * - Auto-scrolls to latest message
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ChatInputArea } from '@/components/chat/core/ChatInputArea';
import { useEchoChat, type EchoChatMessage } from '@/hooks/useEchoChat';
import { useEchoProfile, type OnboardingPhase } from '@/hooks/useEchoProfile';
import { OnboardingProgress } from './OnboardingProgress';
import { QuickSelect, type QuickSelectOption } from './QuickSelect';

interface EchoChatProps {
  sessionId: string;
  className?: string;
}

// Quick select options for different onboarding phases
const GOAL_OPTIONS: QuickSelectOption[] = [
  { id: 'grow-audience', label: 'Grow my audience', description: 'Build a larger following' },
  { id: 'thought-leadership', label: 'Build thought leadership', description: 'Establish expertise' },
  { id: 'drive-traffic', label: 'Drive traffic', description: 'Send traffic to my site' },
  { id: 'generate-leads', label: 'Generate leads', description: 'Attract potential customers' },
  { id: 'stay-consistent', label: 'Stay consistent', description: 'Post regularly' },
];

const PLATFORM_OPTIONS: QuickSelectOption[] = [
  { id: 'linkedin', label: 'LinkedIn', description: 'Professional networking' },
  { id: 'twitter', label: 'Twitter/X', description: 'Short-form posts and threads' },
  { id: 'youtube', label: 'YouTube', description: 'Video content' },
];

const TOPIC_OPTIONS: QuickSelectOption[] = [
  { id: 'ai-tech', label: 'AI & Tech' },
  { id: 'business', label: 'Business & Startups' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'personal-dev', label: 'Personal Development' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'leadership', label: 'Leadership' },
];

/**
 * Get the quick select options for the current onboarding phase
 */
function getOptionsForPhase(phase: OnboardingPhase): QuickSelectOption[] {
  switch (phase) {
    case 'goals':
      return GOAL_OPTIONS;
    case 'platforms':
      return PLATFORM_OPTIONS;
    case 'topics':
      return TOPIC_OPTIONS;
    default:
      return [];
  }
}

/**
 * Get the question prompt for the current onboarding phase
 */
function getPromptForPhase(phase: OnboardingPhase): string {
  switch (phase) {
    case 'intro':
      return "Hi! I'm Echo, your content coach. Ready to get started?";
    case 'goals':
      return "What are your content goals?";
    case 'platforms':
      return "Which platforms do you create content for?";
    case 'topics':
      return "What topics do you cover?";
    case 'tasks':
      return "What would you like help with today?";
    default:
      return '';
  }
}

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

// Simple Echo avatar
function EchoAvatarSmall() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
      <SparklesIcon className="w-4 h-4 text-white" />
    </div>
  );
}

export function EchoChat({ sessionId, className = '' }: EchoChatProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [quickSelectValues, setQuickSelectValues] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user's Echo profile for onboarding state
  const { profile, isLoading: isLoadingProfile } = useEchoProfile();
  const onboardingPhase = profile?.onboardingPhase ?? 'intro';
  const isOnboarding = onboardingPhase !== 'complete';

  // Handle errors
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Echo chat hook
  const {
    messages,
    sendMessage,
    isConnected,
    isConnecting,
    isTyping,
    currentTool,
    reconnectAttempts,
    connect,
  } = useEchoChat({
    sessionId,
    onError: handleError,
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
  }, [messages, isTyping]);

  // Handle send message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendMessage(content.trim());
    },
    [sendMessage]
  );

  // Handle quick select continue (sends selected options as a message)
  const handleQuickSelectContinue = useCallback(() => {
    if (quickSelectValues.length === 0) return;

    // Get the labels for selected options
    const options = getOptionsForPhase(onboardingPhase);
    const selectedLabels = quickSelectValues
      .map(id => options.find(o => o.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    // Send as a message
    sendMessage(selectedLabels);
    setQuickSelectValues([]);
  }, [quickSelectValues, onboardingPhase, sendMessage]);

  // Handle quick select for single-select phases
  const handleQuickSelectSingle = useCallback((selected: string[]) => {
    if (selected.length === 0) return;

    // Get the label for the selected option
    const options = getOptionsForPhase(onboardingPhase);
    const selectedLabel = options.find(o => o.id === selected[0])?.label;

    if (selectedLabel) {
      sendMessage(selectedLabel);
    }
  }, [onboardingPhase, sendMessage]);

  // Check if current phase uses multi-select
  const isMultiSelectPhase = useMemo(() => {
    return onboardingPhase === 'goals' || onboardingPhase === 'platforms' || onboardingPhase === 'topics';
  }, [onboardingPhase]);

  // Get quick select options for current phase
  const quickSelectOptions = useMemo(() => {
    return getOptionsForPhase(onboardingPhase);
  }, [onboardingPhase]);

  // Get the prompt for current phase
  const phasePrompt = useMemo(() => {
    return getPromptForPhase(onboardingPhase);
  }, [onboardingPhase]);

  // Render message based on type
  const renderMessage = useCallback((message: EchoChatMessage) => {
    // User message
    if (message.sender === 'user') {
      return (
        <div role="article" className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-cyan-500/20 text-white border border-cyan-500/20">
            {message.content}
          </div>
        </div>
      );
    }

    // Error message
    if (message.metadata?.type === 'error') {
      return (
        <div role="article" className="flex gap-3 max-w-[85%]">
          <EchoAvatarSmall />
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
        <EchoAvatarSmall />
        <div className="rounded-2xl px-4 py-2 bg-slate-800/50 text-slate-200 border border-cyan-500/20">
          {message.content}
        </div>
      </div>
    );
  }, [connect]);

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
      {/* Onboarding progress bar - only visible during onboarding */}
      {isOnboarding && !isLoadingProfile && (
        <OnboardingProgress phase={onboardingPhase} />
      )}

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

        {/* Empty state - show onboarding prompt with quick select, or generic intro */}
        {!connectionStatus &&
          !loadingSkeleton &&
          messages.length === 0 &&
          !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-4">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {isOnboarding ? phasePrompt : 'Echo Personal Assistant'}
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mb-4">
                {isOnboarding
                  ? 'Select one or more options below, or type your own response.'
                  : "Your AI-powered assistant for content strategy and creation. Let's get started!"}
              </p>

              {/* Quick select options for onboarding phases */}
              {isOnboarding && quickSelectOptions.length > 0 && (
                <div className="w-full max-w-md">
                  <QuickSelect
                    options={quickSelectOptions}
                    selected={quickSelectValues}
                    onSelect={isMultiSelectPhase ? setQuickSelectValues : handleQuickSelectSingle}
                    multiple={isMultiSelectPhase}
                    onContinue={isMultiSelectPhase ? handleQuickSelectContinue : undefined}
                    disabled={!isConnected || isTyping}
                  />
                </div>
              )}
            </div>
          )}

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <EchoAvatarSmall />
            <div className="rounded-2xl px-4 py-2 bg-slate-800/50 border border-cyan-500/20">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
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

      {/* Input area - reusing ChatInputArea */}
      <ChatInputArea
        onSendMessage={handleSendMessage}
        isLoading={isTyping}
        placeholder={isConnected ? 'Message Echo...' : 'Connecting...'}
        disabled={!isConnected}
      />
    </div>
  );
}
