import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ChatInterface } from './ChatInterface';
import { ChatPlusMenu, type IntegrationType } from './ChatPlusMenu';
import { useIntelligentChat } from '@/hooks/useIntelligentChat';
import { useAuth } from '@/hooks/useAuth';

interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
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
}: IntelligentChatPanelProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | undefined>();

  const { messages, isConnected, isLoading, sendMessage, connect, reconnectAttempts } = useIntelligentChat({
    conversationId,
    onError: (err) => setError(err),
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(undefined);
    sendMessage(content);
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
    if (messages.length > 0) return null;

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

          {/* User info */}
          {user && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {user.username || user.email}
            </div>
          )}
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
