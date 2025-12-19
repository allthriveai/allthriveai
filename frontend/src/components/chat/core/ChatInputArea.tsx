/**
 * ChatInputArea - Input field with attachments and submit button
 *
 * Features:
 * - Text input with submit on Enter
 * - Optional file attachments with preview
 * - Custom prefix slot (for ChatPlusMenu)
 * - Disabled state during loading
 * - Max message length validation
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { ArrowRightIcon, XMarkIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import type { ChatInputAreaProps } from './types';

const MAX_MESSAGE_LENGTH = 10000;
const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/webm'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
  ],
};

export function ChatInputArea({
  onSendMessage,
  isLoading,
  isUploading,
  onCancelUpload,
  placeholder = 'Message Ember...',
  disabled = false,
  enableAttachments = false,
  attachments = [],
  onAttachmentsChange,
  prefix,
  onFileSelectRef,
}: ChatInputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [localAttachments, setLocalAttachments] = useState<File[]>(attachments);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Validate file
  const validateFile = (file: File): string | null => {
    const isImage = ALLOWED_TYPES.images.includes(file.type);
    const isVideo = ALLOWED_TYPES.videos.includes(file.type);
    const isDocument = ALLOWED_TYPES.documents.includes(file.type);

    if (!isImage && !isVideo && !isDocument) {
      return `File type not supported: ${file.name}`;
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return `Image too large (max 50MB): ${file.name}`;
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return `Video too large (max 500MB): ${file.name}`;
    }

    if (isDocument && file.size > MAX_DOCUMENT_SIZE) {
      return `Document too large (max 100MB): ${file.name}`;
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || !enableAttachments) return;

    const newFiles: File[] = [];
    let error: string | null = null;

    for (let i = 0; i < files.length; i++) {
      if (localAttachments.length + newFiles.length >= MAX_ATTACHMENTS) {
        error = `Maximum ${MAX_ATTACHMENTS} files allowed`;
        break;
      }

      const file = files[i];
      const validationError = validateFile(file);
      if (validationError) {
        error = validationError;
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      const updated = [...localAttachments, ...newFiles];
      setLocalAttachments(updated);
      onAttachmentsChange?.(updated);
    }

    setFileError(error);
    setTimeout(() => setFileError(null), 5000);
  }, [localAttachments, enableAttachments, onAttachmentsChange]);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    const updated = localAttachments.filter((_, i) => i !== index);
    setLocalAttachments(updated);
    onAttachmentsChange?.(updated);
  }, [localAttachments, onAttachmentsChange]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = inputValue.trim();
    if (!trimmed && localAttachments.length === 0) return;
    if (isLoading || disabled) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setFileError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      setTimeout(() => setFileError(null), 5000);
      return;
    }

    onSendMessage(trimmed, localAttachments.length > 0 ? localAttachments : undefined);
    setInputValue('');
    setLocalAttachments([]);
    onAttachmentsChange?.([]);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [enableAttachments]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, [enableAttachments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enableAttachments) return;

    setIsDragging(false);
    dragCounterRef.current = 0;
    handleFileSelect(e.dataTransfer.files);
  }, [enableAttachments, handleFileSelect]);

  // Trigger file picker
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Expose the file select trigger function to parent
  useEffect(() => {
    if (onFileSelectRef && enableAttachments) {
      onFileSelectRef(handleAttachClick);
    }
  }, [onFileSelectRef, enableAttachments, handleAttachClick]);

  return (
    <div
      className="p-4 border-t border-white/5 bg-background/80 backdrop-blur-sm relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && enableAttachments && (
        <div
          className="absolute inset-0 z-50 bg-cyan-500/20 border-2 border-dashed border-cyan-400 rounded-lg flex items-center justify-center pointer-events-none"
          style={{
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div className="text-center">
            <div className="text-cyan-300 text-lg font-medium">Drop files here</div>
            <div className="text-cyan-400/70 text-sm mt-1">Images, videos, and documents supported</div>
          </div>
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          {fileError}
        </div>
      )}

      {/* Attachment previews */}
      {localAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {localAttachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative group flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg text-xs"
            >
              <PaperClipIcon className="w-3 h-3 text-slate-400" />
              <span className="text-slate-300 max-w-[100px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
              >
                <XMarkIcon className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-center">
        {/* Custom prefix (e.g., ChatPlusMenu) */}
        {prefix}

        {/* Text input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="input-glass w-full pr-12"
            autoFocus
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || disabled || (!inputValue.trim() && localAttachments.length === 0)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightIcon className="w-4 h-4 text-cyan-bright" />
          </button>
        </div>

        {/* Hidden file input */}
        {enableAttachments && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={[...ALLOWED_TYPES.images, ...ALLOWED_TYPES.videos, ...ALLOWED_TYPES.documents].join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        )}
      </form>

      {/* Upload progress / cancel */}
      {isUploading && onCancelUpload && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Uploading...</span>
          <button
            type="button"
            onClick={onCancelUpload}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
