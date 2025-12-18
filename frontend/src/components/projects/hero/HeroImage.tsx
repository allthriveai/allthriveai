/**
 * HeroImage - Image display mode for project hero
 *
 * Displays featured image with zoom-on-hover and full-screen modal.
 * Supports inline editing for owners with upload/change/remove controls.
 * Returns null if no image is provided and not in editing mode.
 */

import { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          className="relative group transform hover:scale-[1.02] transition-all duration-500 ease-out cursor-pointer"
        >
          <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50" />
          <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 border-dashed shadow-2xl">
            <div className="w-full aspect-video rounded-xl md:rounded-2xl bg-white/5 flex flex-col items-center justify-center p-8 min-h-[200px]">
              {isUploading ? (
                <>
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white/60 text-sm">Uploading...</p>
                </>
              ) : (
                <>
                  <PhotoIcon className="w-16 h-16 text-white/30 mb-4" />
                  <p className="text-white/60 text-sm font-medium mb-2">Click to add hero image</p>
                  <p className="text-white/40 text-xs">Recommended: 1200x630px</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* URL input option */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-xs text-white/40">OR</span>
            <div className="flex-1 h-px bg-white/20" />
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
            className="w-full px-4 py-2 text-sm bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary-500"
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
        }`}
        onClick={() => {
          if (isEditing && onEditClick) {
            onEditClick();
          } else if (!isEditing) {
            setIsModalOpen(true);
          }
        }}
      >
        {/* Glassy Card Container for Image */}
        <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
        <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
          {isUploading ? (
            <div className="w-full aspect-video rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={`${projectTitle} featured`}
              className="w-full h-auto rounded-xl md:rounded-2xl shadow-inner"
            />
          )}

          {/* Edit overlay for owners */}
          {isEditing && !isUploading && (
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
