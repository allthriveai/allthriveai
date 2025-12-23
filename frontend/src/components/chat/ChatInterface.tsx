import { XMarkIcon, PaperAirplaneIcon, PhotoIcon, XCircleIcon, DocumentIcon, FilmIcon } from '@heroicons/react/24/outline';
import { useRef, useEffect, useState } from 'react';
import type { ChatMessage, ChatConfig } from '@/types/chat';

// Allowed file types (must match backend validation)
const ALLOWED_FILE_TYPES = {
  images: new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
  ]),
  videos: new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ]),
  documents: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ]),
};

// Size limits (must match backend)
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB

function isAllowedFileType(type: string): boolean {
  return (
    ALLOWED_FILE_TYPES.images.has(type) ||
    ALLOWED_FILE_TYPES.videos.has(type) ||
    ALLOWED_FILE_TYPES.documents.has(type)
  );
}

function getMaxSizeForType(type: string): number {
  if (ALLOWED_FILE_TYPES.images.has(type)) return MAX_IMAGE_SIZE;
  if (ALLOWED_FILE_TYPES.videos.has(type)) return MAX_VIDEO_SIZE;
  return MAX_DOC_SIZE;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (ALLOWED_FILE_TYPES.images.has(type)) return PhotoIcon;
  if (ALLOWED_FILE_TYPES.videos.has(type)) return FilmIcon;
  return DocumentIcon;
}

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
  /** Callback to cancel ongoing upload */
  onCancelUpload?: () => void;
  /** Whether an upload is in progress (shows cancel option) */
  isUploading?: boolean;
  /** Callback to cancel ongoing AI processing */
  onCancelProcessing?: () => void;
  /** Current tool being executed (for enhanced loading indicator) */
  currentTool?: string | null;
  /** Callback to receive the file select trigger function */
  onFileSelectRef?: (triggerFn: () => void) => void;
}

// Human-friendly tool names for the loading indicator
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  import_from_url: 'Importing from URL',
  import_github_project: 'Importing from GitHub',
  create_media_project: 'Creating media project',
  import_video_project: 'Processing video', // Deprecated - keeping for backwards compat
  scrape_webpage_for_project: 'Scraping webpage',
  create_project: 'Creating project',
  create_product: 'Creating product',
  extract_url_info: 'Analyzing URL',
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
  onCancelUpload,
  isUploading = false,
  onCancelProcessing,
  currentTool,
  onFileSelectRef,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  // Clear file error after 5 seconds
  useEffect(() => {
    if (fileError) {
      const timer = setTimeout(() => setFileError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [fileError]);

  // Rotate thinking messages while loading (only when no specific tool is active)
  useEffect(() => {
    if (isLoading && !currentTool) {
      const interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setThinkingIndex(0);
    }
  }, [isLoading, currentTool]);

  // Validate and filter files
  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file type
      if (!isAllowedFileType(file.type)) {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'Unknown';
        errors.push(`${file.name}: .${ext} files are not supported`);
        continue;
      }

      // Check file size
      const maxSize = getMaxSizeForType(file.type);
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max ${formatFileSize(maxSize)})`);
        continue;
      }

      valid.push(file);
    }

    return { valid, errors };
  };

  // Check if user is near the bottom of the chat
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll to track if user has scrolled up
  const handleScroll = () => {
    setUserHasScrolledUp(!isNearBottom());
  };

  // Auto-scroll to bottom only when user hasn't scrolled up
  useEffect(() => {
    if (messages.length > 0 && !userHasScrolledUp) {
      // Use a gentler scroll that keeps content visible
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, userHasScrolledUp]);

  // Reset scroll state when user sends a new message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'user') {
        setUserHasScrolledUp(false);
      }
    }
  }, [messages.length]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Provide file select trigger function to parent
  useEffect(() => {
    if (onFileSelectRef && enableAttachments) {
      onFileSelectRef(() => {
        fileInputRef.current?.click();
      });
    }
  }, [onFileSelectRef, enableAttachments]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      setFileError(errors.join('; '));
    }

    if (valid.length > 0) {
      setAttachments(prev => [...prev, ...valid]);
    }

    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input?.value.trim() && attachments.length === 0) return;

    onSendMessage(input?.value || '', attachments.length > 0 ? attachments : undefined);
    if (input) input.value = '';
    setAttachments([]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Validate files before adding
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setFileError(errors.join('\n'));
      }

      if (valid.length > 0) {
        // Limit to 5 files max
        setAttachments(prev => [...prev, ...valid].slice(0, 5));
      }
    }
  };

  const renderMessage = (message: ChatMessage) => {
    if (customMessageRenderer) {
      return customMessageRenderer(message);
    }

    return (
      <div
        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-end'}`}
      >
        <div
          className={`max-w-[85%] sm:max-w-sm md:max-w-md px-4 py-2 rounded-lg whitespace-pre-wrap ${
            message.sender === 'user'
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
          }`}
        >
          {message.content}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Hidden file input for programmatic file selection */}
      {enableAttachments && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={handleFileInputChange}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed right-0 top-0 md:top-16 w-full md:w-[480px] h-[100dvh] md:h-[calc(100vh-4rem)] border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl transition-all duration-300 z-[60] md:z-40 bg-white dark:bg-gray-900 md:bg-white/95 md:dark:bg-gray-900/95 ${
          isOpen ? 'translate-x-0 opacity-100 visible' : 'translate-x-full opacity-0 invisible pointer-events-none'
        }`}
        style={{
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        aria-hidden={!isOpen}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay with blur effect */}
        {isDragging && enableAttachments && (
          <div
            className="absolute inset-0 z-50 bg-primary-500/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none"
            style={{
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow-lg max-w-sm">
              <div className="flex items-start gap-3">
                <div className="flex gap-1">
                  <PhotoIcon className="w-6 h-6 text-primary-500" />
                  <FilmIcon className="w-6 h-6 text-primary-500" />
                  <DocumentIcon className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">Drop files here</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Images, videos, PDFs, documents</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Up to 5 files</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {header ? (
            header
          ) : headerContent ? (
            headerContent
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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

        {/* File Error Display */}
        {fileError && (
          <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Some files couldn't be added</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 whitespace-pre-line">{fileError}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, WebM), Documents (PDF, Word, Excel, PowerPoint, TXT, ZIP)
                </p>
              </div>
              <button
                onClick={() => setFileError(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
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
                          <span className="animate-pulse transition-opacity duration-300">{THINKING_MESSAGES[thinkingIndex]}</span>
                        )}
                      </span>
                      {onCancelProcessing && (
                        <button
                          type="button"
                          onClick={onCancelProcessing}
                          className="ml-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 flex-shrink-0 bg-white dark:bg-gray-900 overflow-visible relative">
          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="mb-3">
              {/* Uploading state with cancel option */}
              {isUploading && (
                <div className="flex items-center justify-between mb-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-primary-700 dark:text-primary-300">
                      Uploading {attachments.length} file{attachments.length > 1 ? 's' : ''}...
                    </span>
                  </div>
                  {onCancelUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        onCancelUpload();
                        setAttachments([]);
                      }}
                      className="px-3 py-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {/* File list with clear all option */}
              {!isUploading && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {attachments.length} file{attachments.length > 1 ? 's' : ''} ready to send
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachments([])}
                    className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={`relative group flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm ${isUploading ? 'opacity-75' : ''}`}
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    ) : (
                      (() => {
                        const FileIcon = getFileIcon(file.type);
                        return <FileIcon className="w-5 h-5 text-gray-500" />;
                      })()
                    )}
                    <span className="max-w-[80px] sm:max-w-[120px] truncate text-gray-700 dark:text-gray-300">
                      {file.name}
                    </span>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <XCircleIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            {/* Custom Input Prefix (e.g., + button) */}
            {customInputPrefix && (
              <div className="flex-shrink-0 relative">
                {customInputPrefix}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              placeholder={inputPlaceholder}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all chat-input"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 shadow-md"
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[55] md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
