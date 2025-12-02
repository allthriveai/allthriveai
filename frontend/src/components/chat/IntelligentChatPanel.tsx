import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ChatInterface } from './ChatInterface';
import { ChatPlusMenu, type IntegrationType } from './ChatPlusMenu';
import { useIntelligentChat } from '@/hooks/useIntelligentChat';
import { useAuth } from '@/hooks/useAuth';

// Constants
const ONBOARDING_BUTTON_BASE = 'w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm disabled:opacity-50';
const BUTTON_FLEX_CONTAINER = 'flex items-center gap-3';
const BUTTON_TITLE_STYLE = 'font-medium text-slate-900 dark:text-slate-100 text-sm';
const BUTTON_SUBTITLE_STYLE = 'text-xs text-slate-600 dark:text-slate-400';

interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  welcomeMode?: boolean; // Show onboarding welcome message for new users
}

/**
 * IntelligentChatPanel - Unified AI assistant for project creation and support
 *
 * Features:
 * - Real-time streaming with WebSocket
 * - Automatic mode switching between project creation and support
 * - ChatGPT-style + menu with integrations (GitHub, YouTube, Upload, URL)
 * - Automatic reconnection on disconnect
 * - LangGraph agent integration with conversation state
 */
export function IntelligentChatPanel({
  isOpen,
  onClose,
  conversationId = 'default-conversation',
  welcomeMode = false,
}: IntelligentChatPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [hasInteracted, setHasInteracted] = useState(false);

  // Handle project creation - redirect to the new project page
  const handleProjectCreated = useCallback((projectUrl: string, projectTitle: string) => {
    console.log(`[Chat] Project created: ${projectTitle} at ${projectUrl}`);
    // Close the chat panel and navigate to the project
    onClose();
    // Small delay to allow the chat to close smoothly
    setTimeout(() => {
      navigate(projectUrl);
    }, 300);
  }, [navigate, onClose]);

  const { messages, isConnected, isLoading, sendMessage, connect, reconnectAttempts } = useIntelligentChat({
    conversationId,
    onError: (err) => setError(err),
    onProjectCreated: handleProjectCreated,
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(undefined);
    setHasInteracted(true);
    sendMessage(content);
  };

  // Onboarding button handlers - send messages to the AI agent
  const handlePlayGame = () => {
    setHasInteracted(true);
    sendMessage('Play a game to help personalize my experience');
  };

  const handleAddFirstProject = () => {
    setHasInteracted(true);
    sendMessage('I want to add my first project to my portfolio');
  };

  const handleMakeSomethingNew = () => {
    setHasInteracted(true);
    sendMessage("I don't know where to start - let's make something new together");
  };

  const handleRetry = () => {
    setError(undefined);
    connect();
  };

  const handleIntegrationSelect = (type: IntegrationType) => {
    // Send a message to the AI about the selected integration
    let message = '';
    switch (type) {
      case 'github':
        message = 'I want to add a GitHub repository to my project';
        break;
      case 'youtube':
        message = 'I want to add a YouTube video to my project';
        break;
      case 'upload':
        message = 'I want to upload files to my project';
        break;
      case 'url':
        message = 'I want to add content from a URL to my project';
        break;
    }
    if (message) {
      sendMessage(message);
    }
  };

  // Empty state when no messages
  const renderEmptyState = () => {
    if (messages.length > 0 || hasInteracted) return null;

    // Welcome mode for new users after onboarding
    if (welcomeMode) {
      return (
        <div className="flex flex-col items-start justify-start h-full px-4 pt-4">
          <div className="max-w-md">
            <div className="mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="text-sm mb-1 flex items-center gap-2">
                🎉 Glad you're here{user?.first_name ? `, ${user.first_name}` : ''}!
              </p>
              <p className="text-sm">Let's get you started. What would you like to do?</p>
            </div>

            {/* 3 Onboarding Options */}
            <div className="space-y-2">
              <button
                onClick={handlePlayGame}
                disabled={isLoading}
                className={ONBOARDING_BUTTON_BASE}
              >
                <div className={BUTTON_FLEX_CONTAINER}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎮</span>
                  </div>
                  <div className="flex-1">
                    <div className={BUTTON_TITLE_STYLE}>
                      Play a game
                    </div>
                    <div className={BUTTON_SUBTITLE_STYLE}>
                      Help us personalize your experience
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleAddFirstProject}
                disabled={isLoading}
                className={ONBOARDING_BUTTON_BASE}
              >
                <div className={BUTTON_FLEX_CONTAINER}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">➕</span>
                  </div>
                  <div className="flex-1">
                    <div className={BUTTON_TITLE_STYLE}>
                      Add your first project
                    </div>
                    <div className={BUTTON_SUBTITLE_STYLE}>
                      Paste a link, connect an integration, or describe it
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleMakeSomethingNew}
                disabled={isLoading}
                className={ONBOARDING_BUTTON_BASE}
              >
                <div className={BUTTON_FLEX_CONTAINER}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">✨</span>
                  </div>
                  <div className="flex-1">
                    <div className={BUTTON_TITLE_STYLE}>
                      Don't know where to start?
                    </div>
                    <div className={BUTTON_SUBTITLE_STYLE}>
                      Let's make something new together
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default empty state
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="mb-4">
          <svg
            className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Start a Conversation
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
          Ask me anything about your projects, get help with tasks, or brainstorm ideas.
          I'm powered by LangGraph AI agents to assist you.
        </p>
      </div>
    );
  };

  // Enhanced error display with retry button
  const renderError = () => {
    if (!error) return null;

    return (
      <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">
              Connection Error
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            {reconnectAttempts > 0 && (
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Reconnect attempts: {reconnectAttempts}/5
              </p>
            )}
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  };

  return (
    <ChatInterface
      isOpen={isOpen}
      onClose={onClose}
      onSendMessage={handleSendMessage}
      messages={messages}
      isLoading={isLoading}
      error={error}
      customInputPrefix={
        <ChatPlusMenu
          onIntegrationSelect={handleIntegrationSelect}
          disabled={isLoading}
        />
      }
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              AllThrive AI Chat
            </h2>

            {/* Connection status indicator */}
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isConnected
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            >
              <span className="mr-1.5">{isConnected ? '●' : '○'}</span>
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info */}
            {user && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {user.username || user.email}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                onClose();
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      }
      inputPlaceholder="Ask me anything..."
      customMessageRenderer={(message) => {
        // Show empty state before any messages
        if (messages.length === 0) {
          return renderEmptyState();
        }

        // Default message rendering
        return (
          <div
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg whitespace-pre-wrap ${
                message.sender === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.content}
            </div>
          </div>
        );
      }}
    />
  );
}
