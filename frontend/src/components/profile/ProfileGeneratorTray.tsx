import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useProfileGeneratorChat, type ProfileChatMessage } from '@/hooks/useProfileGeneratorChat';
import type { ProfileSection } from '@/types/profileSections';

// Typing animation component for welcome message
function TypingMessage({
  content,
  onComplete,
  typingSpeed = 15
}: {
  content: string;
  onComplete?: () => void;
  typingSpeed?: number;
}) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated without triggering effect re-run
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (isComplete) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < content.length) {
        setDisplayedContent(content.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onCompleteRef.current?.();
      }
    }, typingSpeed);

    return () => clearInterval(interval);
  }, [content, typingSpeed, isComplete]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 text-sm list-disc list-inside">{children}</ul>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {!isComplete && (
        <span className="inline-block w-1 h-4 ml-0.5 bg-purple-500 animate-pulse" />
      )}
    </div>
  );
}

interface ProfileGeneratorTrayProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionsGenerated: (sections: ProfileSection[]) => void;
}

export function ProfileGeneratorTray({ isOpen, onClose, onSectionsGenerated }: ProfileGeneratorTrayProps) {
  const { state, sendMessage, sendMessageWithImage, resetChat, applyGeneratedSections } = useProfileGeneratorChat();
  const [inputValue, setInputValue] = useState('');
  const [shouldRender, setShouldRender] = useState(true);
  const [welcomeTypingComplete, setWelcomeTypingComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Re-render when opening
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Focus input when opening (after typing animation has time to start)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Clean up attachment preview URL on unmount or when attachment changes
  useEffect(() => {
    return () => {
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    setUploadError(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];

      // Only accept images
      if (!file.type.startsWith('image/')) {
        setUploadError('Please drop an image file (PNG, JPG, etc.)');
        return;
      }

      setAttachment(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  }, []);

  // Handle drag enter
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  // Handle drag over (required to allow drop)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Clear attachment
  const clearAttachment = useCallback(() => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachment(null);
    setAttachmentPreview(null);
    setUploadError(null);
  }, [attachmentPreview]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    // Allow sending if there's text OR an attachment
    if ((!inputValue.trim() && !attachment) || state.isStreaming) return;

    const message = inputValue.trim();
    setInputValue('');
    setUploadError(null);

    if (attachment) {
      // Send message with image
      const currentAttachment = attachment;
      clearAttachment();
      await sendMessageWithImage(message || 'Here is an image', currentAttachment);
    } else {
      await sendMessage(message);
    }
  }, [inputValue, attachment, state.isStreaming, sendMessage, sendMessageWithImage, clearAttachment]);

  // Handle input focus - scroll into view on mobile when keyboard opens
  const handleInputFocus = useCallback(() => {
    // Small delay to wait for keyboard to open
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Apply generated sections
  const handleApplySections = useCallback(() => {
    const sections = applyGeneratedSections();
    if (sections) {
      onSectionsGenerated(sections);
      onClose();
    }
  }, [applyGeneratedSections, onSectionsGenerated, onClose]);

  // Handle starting over
  const handleStartOver = useCallback(() => {
    setWelcomeTypingComplete(false);
    clearAttachment();
    resetChat();
  }, [resetChat, clearAttachment]);

  if (!shouldRender) return null;

  // Render a single message
  const renderMessage = (message: ProfileChatMessage) => {
    const isUser = message.role === 'user';
    const isWelcomeMessage = message.id === 'welcome-msg';

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-[85%] px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          {/* Show image thumbnail if message has one */}
          {message.imageUrl && (
            <div className="mb-2">
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
              />
            </div>
          )}
          {isUser ? (
            <span className="whitespace-pre-wrap break-words text-sm">{message.content}</span>
          ) : isWelcomeMessage && !welcomeTypingComplete ? (
            <TypingMessage
              content={message.content}
              onComplete={() => setWelcomeTypingComplete(true)}
              typingSpeed={12}
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 last:mb-0 text-sm list-disc list-inside">{children}</ul>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside
        data-testid="profile-generator-chat"
        className={`fixed right-0 top-0 h-[100dvh] w-full md:w-[28rem] lg:w-[32rem] border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out bg-white dark:bg-gray-900 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ maxHeight: '100dvh' }}
        onTransitionEnd={handleTransitionEnd}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div
            data-testid="drag-overlay"
            className="absolute inset-0 z-50 bg-purple-500/20 backdrop-blur-sm border-4 border-dashed border-purple-500 rounded-lg flex items-center justify-center"
          >
            <div className="text-center p-8">
              <PhotoIcon className="w-16 h-16 mx-auto text-purple-500 mb-4" />
              <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                Drop your image here
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                LinkedIn screenshots work great!
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/all-thrvie-logo-blue.png"
                alt="AllThrive"
                className="w-10 h-10 rounded-xl shadow-lg object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Profile Generator
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Let's create your perfect profile
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {state.messages.map(renderMessage)}

          {/* Tool execution indicator - prominent banner when generating */}
          {state.currentTool && (
            <div className="mb-4">
              <div className="px-4 py-4 rounded-xl bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 border border-purple-300 dark:border-purple-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center animate-pulse">
                    <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {state.currentTool === 'gather_user_data' && 'Analyzing Your Profile'}
                      {state.currentTool === 'generate_profile_sections' && 'Creating Your Sections'}
                      {state.currentTool === 'save_profile_sections' && 'Saving Your Profile'}
                      {!['gather_user_data', 'generate_profile_sections', 'save_profile_sections'].includes(state.currentTool) && 'Processing...'}
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      {state.currentTool === 'gather_user_data' && 'Looking at your projects, skills, and achievements...'}
                      {state.currentTool === 'generate_profile_sections' && 'Building personalized sections based on our conversation...'}
                      {state.currentTool === 'save_profile_sections' && 'Almost done! Saving your new profile...'}
                      {!['gather_user_data', 'generate_profile_sections', 'save_profile_sections'].includes(state.currentTool) && 'Please wait...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Generated Sections Preview - Prominent success banner */}
        {state.generatedSections && state.generatedSections.length > 0 && (
          <div
            data-testid="generated-sections"
            className="flex-shrink-0 px-4 py-4 border-t border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-green-800 dark:text-green-200">
                    Your profile is ready!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {state.generatedSections.length} personalized {state.generatedSections.length === 1 ? 'section' : 'sections'} created based on our conversation
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleStartOver}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={handleApplySections}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                >
                  <CheckIcon className="w-4 h-4" />
                  Apply to Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {(state.error || uploadError) && (
          <div
            data-testid="upload-error"
            className="flex-shrink-0 px-4 py-3 border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError || state.error}</p>
          </div>
        )}

        {/* Attachment Preview */}
        {attachment && attachmentPreview && (
          <div
            data-testid="attachment-preview"
            className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={attachmentPreview}
                  alt="Attachment preview"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                <button
                  data-testid="clear-attachment"
                  onClick={clearAttachment}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                  aria-label="Remove attachment"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {attachment.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(attachment.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                data-testid="profile-chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder={state.isStreaming ? 'Waiting for response...' : attachment ? 'Add a message (optional)...' : 'Type your message...'}
                disabled={state.isStreaming}
                rows={1}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '48px', maxHeight: '120px', fontSize: 'max(16px, 1rem)' }}
              />
            </div>
            <button
              data-testid="send-message-button"
              onClick={handleSend}
              disabled={(!inputValue.trim() && !attachment) || state.isStreaming}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 transition-colors"
              aria-label="Send message"
            >
              {state.isStreaming ? (
                <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Drag & drop an image or type a message
          </p>
        </div>
      </aside>
    </>,
    document.body
  );
}
