import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useRef, useEffect } from 'react';
import type { ChatMessage, ChatConfig } from '@/types/chat';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  config: ChatConfig;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  headerContent?: React.ReactNode;
  inputPlaceholder?: string;
  customMessageRenderer?: (message: ChatMessage) => React.ReactNode;
}

export function ChatInterface({
  isOpen,
  onClose,
  config,
  messages,
  isLoading,
  onSendMessage,
  headerContent,
  inputPlaceholder = 'Type a message...',
  customMessageRenderer,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input?.value.trim()) return;

    onSendMessage(input.value);
    input.value = '';
  };

  const renderMessage = (message: ChatMessage) => {
    if (customMessageRenderer) {
      return customMessageRenderer(message);
    }

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
  };

  return (
    <>
      {/* Sliding Panel */}
      <div
        className={`fixed md:relative md:w-96 w-full h-screen bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-lg md:shadow-none transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {headerContent ? (
            headerContent
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {config.agentName}
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}
        </div>

        {/* Description */}
        {config.agentDescription && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {config.agentDescription}
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && config.initialMessage && (
            <div className="flex justify-start">
              <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {config.initialMessage}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id}>
              {renderMessage(message)}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 flex-shrink-0 bg-white dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={inputPlaceholder}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
