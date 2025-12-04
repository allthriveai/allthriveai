/**
 * SlideUpSection - Interactive two-part display with reveal animation
 *
 * Displays Element 1 with Element 2 sliding up on interaction.
 * Supports image, video, and text content types for both elements.
 */

import { useState, useCallback } from 'react';
import { ChevronUpIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { FaImage, FaVideo, FaFont } from 'react-icons/fa';
import type { SlideUpSectionContent, SlideUpElement } from '@/types/sections';
import { uploadImage, uploadFile } from '@/services/upload';

interface SlideUpSectionProps {
  content: SlideUpSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: SlideUpSectionContent) => void;
}

export function SlideUpSection({ content, isEditing, onUpdate }: SlideUpSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading1, setIsUploading1] = useState(false);
  const [isUploading2, setIsUploading2] = useState(false);

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleElement1Update = useCallback((updates: Partial<SlideUpElement>) => {
    if (onUpdate) {
      onUpdate({
        ...content,
        element1: { ...content.element1, ...updates },
      });
    }
  }, [content, onUpdate]);

  const handleElement2Update = useCallback((updates: Partial<SlideUpElement>) => {
    if (onUpdate) {
      onUpdate({
        ...content,
        element2: { ...(content.element2 || { type: 'text', content: '' }), ...updates },
      });
    }
  }, [content, onUpdate]);

  const handleUpload = useCallback(async (
    file: File,
    elementNum: 1 | 2,
    fileType: 'image' | 'video'
  ) => {
    const setUploading = elementNum === 1 ? setIsUploading1 : setIsUploading2;
    const handleUpdate = elementNum === 1 ? handleElement1Update : handleElement2Update;

    setUploading(true);
    try {
      let url: string;
      if (fileType === 'video') {
        const data = await uploadFile(file, 'projects/videos', true);
        url = data.url;
      } else {
        const data = await uploadImage(file, 'projects', true);
        url = data.url;
      }
      handleUpdate({ content: url, type: fileType });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [handleElement1Update, handleElement2Update]);

  // Editing mode UI
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <ChevronUpIcon className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Slide Up Display</h3>
        </div>

        {/* Element 1 Editor */}
        <ElementEditor
          label="Element 1 (Always Visible)"
          element={content.element1}
          onUpdate={handleElement1Update}
          onUpload={(file, type) => handleUpload(file, 1, type)}
          isUploading={isUploading1}
        />

        {/* Element 2 Editor */}
        <ElementEditor
          label="Element 2 (Slides Up on Click)"
          element={content.element2 || { type: 'text', content: '' }}
          onUpdate={handleElement2Update}
          onUpload={(file, type) => handleUpload(file, 2, type)}
          isUploading={isUploading2}
        />
      </div>
    );
  }

  // Display mode - render the slide up interaction
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-900">
      {/* Element 1 - Always visible */}
      <div className="relative">
        {renderElement(content.element1)}
      </div>

      {/* Element 2 - Slides up */}
      {content.element2 && content.element2.content && (
        <>
          {/* Backdrop overlay when expanded */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-500 ${
              isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={handleToggle}
          />

          {/* Slide-up panel */}
          <div
            className={`absolute inset-x-0 bottom-0 transition-transform duration-700 ease-out ${
              isExpanded ? 'translate-y-0' : 'translate-y-full'
            }`}
            style={{ maxHeight: '85%' }}
          >
            <div className="relative h-full bg-white/30 dark:bg-gray-900/40 backdrop-blur-3xl rounded-t-3xl shadow-2xl border-t border-white/40 dark:border-white/20">
              {/* Handle bar */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/50 dark:bg-white/30 rounded-full" />

              {/* Close button */}
              <button
                onClick={handleToggle}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-xl hover:bg-white/50 dark:hover:bg-white/20 border border-white/40 dark:border-white/20 transition-all"
                aria-label="Close"
              >
                <ChevronUpIcon className="w-5 h-5 text-white rotate-180" />
              </button>

              {/* Content */}
              <div className="h-full overflow-y-auto pt-12 pb-6 px-4 md:px-6">
                {renderElement(content.element2)}
              </div>
            </div>
          </div>

          {/* Bottom indicator - tap to expand */}
          {!isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
              <div className="h-20 bg-gradient-to-t from-black/30 to-transparent" />
              <button
                onClick={handleToggle}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1 group"
                aria-label="Show More"
              >
                <div className="animate-bounce">
                  <ChevronUpIcon className="w-6 h-6 text-white drop-shadow-lg" />
                </div>
                <span className="text-xs font-medium text-white/80 drop-shadow-md">
                  Tap for more
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Element Renderer
// ============================================================================

function renderElement(element: SlideUpElement | undefined) {
  if (!element || !element.content) {
    return (
      <div className="w-full aspect-video flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-400">No content</p>
      </div>
    );
  }

  switch (element.type) {
    case 'image':
      return (
        <div className="w-full">
          <img
            src={element.content}
            alt={element.caption || 'Slide up image'}
            className="w-full h-auto object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
            }}
          />
          {element.caption && (
            <p className="mt-2 text-sm text-center text-white/80">{element.caption}</p>
          )}
        </div>
      );

    case 'video': {
      const isDirectVideo = element.content.match(/\.(mp4|webm|ogg)$/i) || element.content.includes('/projects/videos/');

      if (isDirectVideo) {
        return (
          <div className="w-full">
            <video
              src={element.content}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto"
            />
            {element.caption && (
              <p className="mt-2 text-sm text-center text-white/80">{element.caption}</p>
            )}
          </div>
        );
      }

      // Embedded video (YouTube, Vimeo, Loom)
      let embedUrl = '';
      const youtubeMatch = element.content.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
      const vimeoMatch = element.content.match(/vimeo\.com\/(\d+)/);
      const loomMatch = element.content.match(/loom\.com\/(?:share|embed)\/(\w+)/);

      if (youtubeMatch) {
        embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`;
      } else if (vimeoMatch) {
        embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      } else if (loomMatch) {
        embedUrl = `https://www.loom.com/embed/${loomMatch[1]}`;
      }

      if (!embedUrl) {
        return (
          <div className="w-full aspect-video flex items-center justify-center bg-gray-800 rounded-lg">
            <p className="text-gray-400">Invalid video URL</p>
          </div>
        );
      }

      return (
        <div className="w-full">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              src={embedUrl}
              title={element.caption || 'Video'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {element.caption && (
            <p className="mt-2 text-sm text-center text-white/80">{element.caption}</p>
          )}
        </div>
      );
    }

    case 'text':
      return (
        <div className="w-full p-6 md:p-8">
          <p className="text-white text-lg leading-relaxed">{element.content}</p>
          {element.caption && (
            <p className="mt-4 text-sm text-center text-white/80 italic">{element.caption}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ============================================================================
// Element Editor
// ============================================================================

interface ElementEditorProps {
  label: string;
  element: SlideUpElement;
  onUpdate: (updates: Partial<SlideUpElement>) => void;
  onUpload: (file: File, type: 'image' | 'video') => void;
  isUploading: boolean;
}

function ElementEditor({ label, element, onUpdate, onUpload, isUploading }: ElementEditorProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h4>

      {/* Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
        <div className="flex gap-2">
          {(['image', 'video', 'text'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate({ type })}
              className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                element.type === type
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
              }`}
            >
              {type === 'image' && <FaImage className="w-4 h-4 mx-auto" />}
              {type === 'video' && <FaVideo className="w-4 h-4 mx-auto" />}
              {type === 'text' && <FaFont className="w-4 h-4 mx-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {element.type === 'image' ? 'Image' : element.type === 'video' ? 'Video' : 'Text Content'}
        </label>

        {element.type === 'text' ? (
          <textarea
            value={element.content || ''}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Enter text content..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        ) : (
          <div className="space-y-2">
            {/* Upload button */}
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept={element.type === 'video' ? 'video/mp4,video/webm,video/ogg' : 'image/*'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file, element.type as 'image' | 'video');
                }}
                disabled={isUploading}
                className="hidden"
              />
              <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                {isUploading ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <PhotoIcon className="w-5 h-5" />
                    <span>Click to upload {element.type}</span>
                  </div>
                )}
              </div>
            </label>

            {/* URL input */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>
            <input
              type="url"
              value={element.content || ''}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder={element.type === 'video' ? 'https://youtube.com/watch?v=...' : 'https://example.com/image.jpg'}
              disabled={isUploading}
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />

            {/* Preview */}
            {element.content && (
              <div className="mt-2 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                {element.type === 'image' ? (
                  <img src={element.content} alt="Preview" className="w-full max-h-48 object-contain" />
                ) : element.content.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video src={element.content} controls className="w-full max-h-48" />
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">Video URL set (embedded player)</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Caption */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Caption (optional)
        </label>
        <input
          type="text"
          value={element.caption || ''}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="Add a caption..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}
