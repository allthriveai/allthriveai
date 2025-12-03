import { XMarkIcon, PaperAirplaneIcon, PhotoIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useEffect, useState } from 'react';
import type { ChatMessage, ChatConfig } from '@/types/chat';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  config?: ChatConfig;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string, attachments?: File[]) => void;
  header?: React.ReactNode;
  headerContent?: React.ReactNode;
  inputPlaceholder?: string;
  customMessageRenderer?: (message: ChatMessage) => React.ReactNode;
  customInputPrefix?: React.ReactNode;
  customEmptyState?: React.ReactNode;
  /** Replaces the entire messages area when provided (useful for GitHub repo list, etc.) */
  customContent?: React.ReactNode;
  error?: string;
  /** Enable file/image attachments */
  enableAttachments?: boolean;
}

export function ChatInterface({
  isOpen,
  onClose,
  config,
  messages,
  isLoading,
  onSendMessage,
  header,
  headerContent,
  inputPlaceholder = 'Type a message...',
  customMessageRenderer,
  customInputPrefix,
  customEmptyState,
  customContent,
  error,
  enableAttachments = false,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

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
    if (!input?.value.trim() && attachments.length === 0) return;

    onSendMessage(input?.value || '', attachments.length > 0 ? attachments : undefined);
    if (input) input.value = '';
    setAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Limit to 5 files max
    setAttachments(prev => [...prev, ...files].slice(0, 5));
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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
        className={`fixed right-0 top-16 w-full md:w-[480px] h-[calc(100vh-4rem)] border-l border-white/20 dark:border-white/10 flex flex-col shadow-2xl transition-all duration-300 z-40 ${
          isOpen ? 'translate-x-0 opacity-100 visible' : 'translate-x-full opacity-0 invisible pointer-events-none'
        }`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {header ? (
            header
          ) : headerContent ? (
            headerContent
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text:white">
                {config?.agentName || 'Chat'}
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
        {config?.agentDescription && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {config.agentDescription}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Custom content replaces entire messages area */}
          {customContent ? (
            customContent
          ) : (
            <>
              {/* Custom empty state or initial message */}
              {messages.length === 0 && (
                customEmptyState ? (
                  customEmptyState
                ) : config?.initialMessage ? (
                  <div className="flex justify-start">
                    <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      {config.initialMessage}
                    </div>
                  </div>
                ) : null
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
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 flex-shrink-0 bg-white dark:bg-gray-900 overflow-visible relative">
          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="relative group flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
                >
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-8 h-8 object-cover rounded"
                    />
                  ) : (
                    <PhotoIcon className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="max-w-[120px] truncate text-gray-700 dark:text-gray-300">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            {/* Custom Input Prefix (e.g., + button) */}
            {customInputPrefix && (
              <div className="flex-shrink-0 relative">
                {customInputPrefix}
              </div>
            )}

            {/* Attachment Button */}
            {enableAttachments && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="chat-file-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || attachments.length >= 5}
                  className="p-2 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={attachments.length >= 5 ? 'Maximum 5 files' : 'Attach image'}
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
              </>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder={inputPlaceholder}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text:white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all chat-input"
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
