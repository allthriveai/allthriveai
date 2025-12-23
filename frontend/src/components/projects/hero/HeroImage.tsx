/**
 * HeroImage - Image display mode for project hero
 *
 * Displays featured image with zoom-on-hover and full-screen modal.
 * Supports inline editing for owners with upload/change/remove controls.
 * Supports drag-and-drop to open the editor tray and upload simultaneously.
 * Returns null if no image is provided and not in editing mode.
 */

import { useState, useRef, useCallback } from 'react';
import type { DragEvent } from 'react';
import { PhotoIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface HeroImageProps {
  imageUrl: string | null | undefined;
  projectTitle: string;
  projectType?: string; // Optional, kept for backwards compatibility
  isEditing?: boolean;
  onEditClick?: () => void;
  onImageChange?: (url: string) => void;
  onImageUpload?: (file: File) => void;
  isUploading?: boolean;
}

export function HeroImage({
  imageUrl,
  projectTitle,
  isEditing = false,
  onEditClick,
  onImageChange,
  onImageUpload,
  isUploading = false,
}: HeroImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events for drag-and-drop file upload
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditing) return;
      setIsDragging(true);
    },
    [isEditing]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the dropzone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!isEditing) return;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];

      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        console.warn('Only image files are supported');
        return;
      }

      // Open the tray if callback is provided
      if (onEditClick) {
        onEditClick();
      }

      // Upload the file
      if (onImageUpload) {
        onImageUpload(file);
      }
    },
    [isEditing, onEditClick, onImageUpload]
  );

  // Check if URL is a video file (should not be rendered as image)
  const isVideoUrl = imageUrl && /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(imageUrl);

  // Skip rendering if URL is a video file (bad data from legacy bug)
  if (isVideoUrl && !isEditing) {
    return null;
  }

  // No image - show placeholder only in editing mode
  if (!imageUrl) {
    if (!isEditing) return null;

    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onImageUpload) onImageUpload(file);
          }}
          className="hidden"
          disabled={isUploading}
        />
        <div
          onClick={() => {
            // If onEditClick is provided, open the tray instead of file picker
            if (onEditClick) {
              onEditClick();
            } else {
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative group transform hover:scale-[1.02] transition-all duration-500 ease-out cursor-pointer ${
            isDragging ? 'scale-[1.02]' : ''
          }`}
        >
          <div
            className={`absolute -inset-2 md:-inset-4 rounded-2xl md:rounded-3xl blur-lg md:blur-xl transition-all duration-300 ${
              isDragging ? 'bg-primary-500/20 opacity-100' : 'bg-slate-200/50 dark:bg-white/5 opacity-50'
            }`}
          />
          <div
            className={`relative p-1 md:p-2 backdrop-blur-sm rounded-2xl md:rounded-3xl border-dashed shadow-2xl transition-all duration-300 ${
              isDragging
                ? 'bg-primary-500/10 border-2 border-primary-500'
                : 'bg-slate-200/70 dark:bg-white/10 border border-slate-300 dark:border-white/20'
            }`}
          >
            <div className="w-full aspect-video rounded-xl md:rounded-2xl bg-slate-100 dark:bg-white/5 flex flex-col items-center justify-center p-8 min-h-[200px]">
              {isUploading ? (
                <>
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-white/60 text-sm">Uploading...</p>
                </>
              ) : isDragging ? (
                <>
                  <PhotoIcon className="w-16 h-16 text-primary-400 mb-4 animate-bounce" />
                  <p className="text-primary-400 text-sm font-medium mb-2">Drop image to upload</p>
                  <p className="text-slate-400 dark:text-white/40 text-xs">Release to open editor</p>
                </>
              ) : (
                <>
                  <PhotoIcon className="w-16 h-16 text-slate-300 dark:text-white/30 mb-4" />
                  <p className="text-slate-500 dark:text-white/60 text-sm font-medium mb-2">Click to add hero image</p>
                  <p className="text-slate-400 dark:text-white/40 text-xs">Recommended: 1200x630px</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* URL input option */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-slate-300 dark:bg-white/20" />
            <span className="text-xs text-slate-400 dark:text-white/40">OR</span>
            <div className="flex-1 h-px bg-slate-300 dark:bg-white/20" />
          </div>
          <input
            type="url"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && urlInputValue && onImageChange) {
                onImageChange(urlInputValue);
                setUrlInputValue('');
              }
            }}
            onBlur={() => {
              if (urlInputValue && onImageChange) {
                onImageChange(urlInputValue);
                setUrlInputValue('');
              }
            }}
            placeholder="Paste image URL and press Enter..."
            className="w-full px-4 py-2 text-sm bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/20 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onImageUpload) onImageUpload(file);
        }}
        className="hidden"
        disabled={isUploading}
      />

      <div
        className={`relative group transform hover:scale-[1.02] transition-all duration-500 ease-out hover:rotate-1 ${
          isEditing ? 'cursor-pointer' : 'cursor-zoom-in'
        } ${isDragging ? 'scale-[1.02] rotate-0' : ''}`}
        onClick={() => {
          if (isEditing && onEditClick) {
            onEditClick();
          } else if (!isEditing) {
            setIsModalOpen(true);
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Glassy Card Container for Image */}
        <div
          className={`absolute -inset-2 md:-inset-4 rounded-2xl md:rounded-3xl blur-lg md:blur-xl transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl ${
            isDragging ? 'bg-primary-500/20 opacity-100' : 'bg-slate-200/50 dark:bg-white/5 opacity-50'
          }`}
        />
        <div
          className={`relative p-1 md:p-2 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl transition-all duration-300 ${
            isDragging
              ? 'bg-primary-500/10 border-2 border-primary-500'
              : 'bg-slate-200/70 dark:bg-white/10 border border-slate-300 dark:border-white/20'
          }`}
        >
          {isUploading ? (
            <div className="w-full aspect-video rounded-xl md:rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={`${projectTitle} featured`}
              className="w-full h-auto rounded-xl md:rounded-2xl shadow-inner"
            />
          )}

          {/* Drag overlay - shows when dragging file over existing image */}
          {isEditing && isDragging && (
            <div className="absolute inset-0 m-1 md:m-2 rounded-xl md:rounded-2xl bg-primary-500/30 backdrop-blur-sm transition-all flex flex-col items-center justify-center">
              <PhotoIcon className="w-16 h-16 text-white mb-4 animate-bounce" />
              <p className="text-white text-sm font-medium">Drop to replace image</p>
            </div>
          )}

          {/* Edit overlay for owners */}
          {isEditing && !isUploading && !isDragging && (
            <div className="absolute inset-0 m-1 md:m-2 rounded-xl md:rounded-2xl bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditClick) {
                      onEditClick();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white transition-colors"
                  title="Edit hero"
                >
                  <PencilIcon className="w-6 h-6" />
                </button>
                {!onEditClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onImageChange) onImageChange('');
                    }}
                    className="p-3 bg-red-500/50 hover:bg-red-500/70 backdrop-blur-sm rounded-xl text-white transition-colors"
                    title="Remove image"
                  >
                    <TrashIcon className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {isModalOpen && !isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setIsModalOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsModalOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={imageUrl}
            alt={`${projectTitle} full view`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
