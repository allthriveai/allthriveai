/**
 * Message Composer Component
 *
 * Text input with send button for composing messages.
 * Handles typing indicators and keyboard shortcuts.
 */

import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';

interface MessageComposerProps {
  onSend: (content: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_MESSAGE_LENGTH = 4000;

export function MessageComposer({
  onSend,
  onTypingChange,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [content]);

  // Handle typing indicator
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_MESSAGE_LENGTH) return;

    setContent(value);

    // Notify typing start
    onTypingChange(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = window.setTimeout(() => {
      onTypingChange(false);
    }, 2000);
  };

  // Handle send
  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent('');
    onTypingChange(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Focus textarea after send
    textareaRef.current?.focus();
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const charCount = content.length;
  const isNearLimit = charCount > MAX_MESSAGE_LENGTH * 0.9;

  return (
    <div className="flex-shrink-0 border-t border-white/10 p-4 glass-subtle">
      <div className="flex items-end gap-3">
        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 rounded-xl input-glass resize-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px' }}
          />

          {/* Character Count */}
          {isNearLimit && (
            <div className={`absolute bottom-2 right-3 text-xs ${
              charCount >= MAX_MESSAGE_LENGTH ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {charCount}/{MAX_MESSAGE_LENGTH}
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !content.trim()}
          className="flex-shrink-0 p-3 rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send message (Enter)"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-slate-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

export default MessageComposer;
