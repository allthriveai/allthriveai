/**
 * HeroDisplaySection - Reusable hero display field with full upload/input UI
 * Part of the scalable ProjectFieldsEditor system
 *
 * This component provides a complete hero display management interface.
 */

import {
  FaImage,
  FaVideo,
  FaQuoteLeft,
  FaImages,
  FaArrowUp,
  FaFont,
} from 'react-icons/fa';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { SlideshowImageItem } from '@/components/projects/BlockEditorComponents';
import { uploadImage } from '@/services/upload';

interface HeroDisplaySectionProps {
  // Mode selection
  heroDisplayMode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
  setHeroDisplayMode: (mode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup') => void;

  // Image mode
  featuredImageUrl?: string;
  setFeaturedImageUrl?: (url: string) => void;
  handleFeaturedImageUpload?: (file: File) => void;
  isUploadingFeatured?: boolean;

  // Video mode
  heroVideoUrl?: string;
  setHeroVideoUrl?: (url: string) => void;
  handleVideoUpload?: (file: File) => void;
  isUploadingVideo?: boolean;

  // Slideshow mode
  heroSlideshowImages?: string[];
  setHeroSlideshowImages?: (images: string[]) => void;

  // Quote/Prompt mode
  heroQuote?: string;
  setHeroQuote?: (quote: string) => void;

  // Slide Up mode
  slideUpElement1Type?: 'image' | 'video' | 'text';
  slideUpElement1Content?: string;
  slideUpElement1Caption?: string;
  setSlideUpElement1Type?: (type: 'image' | 'video' | 'text') => void;
  setSlideUpElement1Content?: (content: string) => void;
  setSlideUpElement1Caption?: (caption: string) => void;
  handleSlideUpElement1Upload?: (file: File, type: 'image' | 'video') => void;
  isUploadingSlideUp1?: boolean;

  slideUpElement2Type?: 'image' | 'video' | 'text';
  slideUpElement2Content?: string;
  slideUpElement2Caption?: string;
  setSlideUpElement2Type?: (type: 'image' | 'video' | 'text') => void;
  setSlideUpElement2Content?: (content: string) => void;
  setSlideUpElement2Caption?: (caption: string) => void;
  handleSlideUpElement2Upload?: (file: File, type: 'image' | 'video') => void;
  isUploadingSlideUp2?: boolean;

  isSaving?: boolean;
}

const HERO_MODES = [
  { id: 'image' as const, label: 'Image', icon: FaImage },
  { id: 'video' as const, label: 'Video', icon: FaVideo },
  { id: 'slideshow' as const, label: 'Slideshow', icon: FaImages },
  { id: 'quote' as const, label: 'Prompt', icon: FaQuoteLeft },
  { id: 'slideup' as const, label: 'Slide Up', icon: FaArrowUp },
];

export function HeroDisplaySection({
  heroDisplayMode,
  setHeroDisplayMode,
  featuredImageUrl,
  setFeaturedImageUrl,
  handleFeaturedImageUpload,
  isUploadingFeatured = false,
  heroVideoUrl,
  setHeroVideoUrl,
  handleVideoUpload,
  isUploadingVideo = false,
  heroSlideshowImages = [],
  setHeroSlideshowImages,
  heroQuote,
  setHeroQuote,
  slideUpElement1Type = 'image',
  slideUpElement1Content,
  slideUpElement1Caption,
  setSlideUpElement1Type,
  setSlideUpElement1Content,
  setSlideUpElement1Caption,
  handleSlideUpElement1Upload,
  isUploadingSlideUp1 = false,
  slideUpElement2Type = 'text',
  slideUpElement2Content,
  slideUpElement2Caption,
  setSlideUpElement2Type,
  setSlideUpElement2Content,
  setSlideUpElement2Caption,
  handleSlideUpElement2Upload,
  isUploadingSlideUp2 = false,
  isSaving = false,
}: HeroDisplaySectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const isDisabled = (mode: string) => {
    if (mode === 'image') {
      return !!(heroQuote || heroVideoUrl || heroSlideshowImages.length > 0);
    }
    if (mode === 'video') {
      return !!(featuredImageUrl || heroQuote || heroSlideshowImages.length > 0);
    }
    if (mode === 'slideshow') {
      return !!(featuredImageUrl || heroVideoUrl || heroQuote);
    }
    if (mode === 'quote') {
      return !!(featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0);
    }
    if (mode === 'slideup') {
      return !!(featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0 || heroQuote);
    }
    return false;
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Hero Display
      </label>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Choose how to showcase your project (Select only one option. To use a different hero display, remove content from your current selection.)
      </p>

      {/* Tab Navigation for Hero Display */}
      <div className="flex gap-2 mb-4">
        {HERO_MODES.map((mode) => {
          const Icon = mode.icon;
          const disabled = isDisabled(mode.id);
          const isActive = heroDisplayMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                if (!disabled) {
                  setHeroDisplayMode(mode.id);
                }
              }}
              disabled={disabled || isSaving}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                isActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : disabled
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Image Tab Content */}
      {heroDisplayMode === 'image' && (
        <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
          {featuredImageUrl ? (
            <div className="relative group">
              <img
                src={featuredImageUrl}
                alt="Hero"
                className="w-full max-h-96 object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
                <label className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && handleFeaturedImageUpload) handleFeaturedImageUpload(file);
                    }}
                    className="hidden"
                    disabled={isUploadingFeatured}
                  />
                  {isUploadingFeatured ? 'Uploading...' : 'Change'}
                </label>
                <button
                  onClick={() => setFeaturedImageUrl?.('')}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <PhotoIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    {isUploadingFeatured ? 'Uploading...' : 'Drop an image here or click to upload'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Recommended: 1200x630px (1.91:1 ratio)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && handleFeaturedImageUpload) handleFeaturedImageUpload(file);
                  }}
                  className="hidden"
                  disabled={isUploadingFeatured}
                />
              </label>
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
                <input
                  type="url"
                  value={featuredImageUrl || ''}
                  onChange={(e) => setFeaturedImageUrl?.(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={isSaving}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Tab Content */}
      {heroDisplayMode === 'video' && (
        <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-4">
          {heroVideoUrl && (heroVideoUrl.endsWith('.mp4') || heroVideoUrl.endsWith('.webm') || heroVideoUrl.endsWith('.ogg') || heroVideoUrl.includes('/projects/videos/')) ? (
            <div className="relative group">
              <video
                src={heroVideoUrl}
                controls
                className="w-full max-h-96 rounded-lg"
                onError={() => {
                  console.error('Video load error');
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
                <label className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && handleVideoUpload) handleVideoUpload(file);
                    }}
                    className="hidden"
                    disabled={isUploadingVideo}
                  />
                  {isUploadingVideo ? 'Uploading...' : 'Change Video'}
                </label>
                <button
                  onClick={() => setHeroVideoUrl?.('')}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <FaVideo className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    {isUploadingVideo ? 'Uploading video...' : 'Drop an MP4 video here or click to upload'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supports MP4, WebM, OGG formats
                  </p>
                </div>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && handleVideoUpload) {
                      try {
                        await handleVideoUpload(file);
                      } catch (error: any) {
                        console.error('Video upload error:', error);
                        alert(error?.message || error?.response?.data?.error || 'Failed to upload video');
                      }
                    }
                  }}
                  className="hidden"
                  disabled={isUploadingVideo}
                />
              </label>
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video URL (YouTube, Vimeo, Loom)
                </label>
                <input
                  type="url"
                  value={heroVideoUrl || ''}
                  onChange={(e) => setHeroVideoUrl?.(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={isSaving || isUploadingVideo}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slideshow Tab Content */}
      {heroDisplayMode === 'slideshow' && (
        <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Slideshow Images
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Upload multiple images for your slideshow. Drag to reorder.
            </p>
          </div>

          {/* Image Grid with Drag-and-Drop */}
          {heroSlideshowImages.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;

                const oldIndex = heroSlideshowImages.indexOf(active.id as string);
                const newIndex = heroSlideshowImages.indexOf(over.id as string);

                if (oldIndex !== -1 && newIndex !== -1 && setHeroSlideshowImages) {
                  setHeroSlideshowImages(arrayMove(heroSlideshowImages, oldIndex, newIndex));
                }
              }}
            >
              <SortableContext items={heroSlideshowImages}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {heroSlideshowImages.map((imageUrl, index) => (
                    <SlideshowImageItem
                      key={imageUrl}
                      id={imageUrl}
                      imageUrl={imageUrl}
                      index={index}
                      onRemove={() => {
                        if (setHeroSlideshowImages) {
                          const newImages = [...heroSlideshowImages];
                          newImages.splice(index, 1);
                          setHeroSlideshowImages(newImages);
                        }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Upload Area */}
          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                try {
                  const uploadedUrls: string[] = [];
                  for (const file of files) {
                    const data = await uploadImage(file, 'projects', true);
                    uploadedUrls.push(data.url);
                  }
                  if (setHeroSlideshowImages) {
                    setHeroSlideshowImages([...heroSlideshowImages, ...uploadedUrls]);
                  }
                } catch (error: any) {
                  console.error('Upload error:', error);
                  alert(error.message || 'Failed to upload images');
                }
                e.target.value = ''; // Reset input
              }}
              disabled={isUploadingFeatured || isSaving}
              className="hidden"
            />
            <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
              {isUploadingFeatured ? (
                <>
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">Uploading images...</p>
                </>
              ) : (
                <>
                  <FaImages className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Click to upload images
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select multiple images at once
                  </p>
                </>
              )}
            </div>
          </label>

          {heroSlideshowImages.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {heroSlideshowImages.length} image{heroSlideshowImages.length !== 1 ? 's' : ''} added
            </p>
          )}
        </div>
      )}

      {/* Quote/Prompt Tab Content */}
      {heroDisplayMode === 'quote' && (
        <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Prompt
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Share your prompt or project details
          </p>
          <textarea
            value={heroQuote || ''}
            onChange={(e) => setHeroQuote?.(e.target.value)}
            placeholder="Enter your prompt here..."
            disabled={isSaving}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 resize-none"
          />
        </div>
      )}

      {/* Slide-up Tab Content */}
      {heroDisplayMode === 'slideup' && (
        <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create a two-part display where the second element slides up on click (desktop) or automatically on mobile.
            </p>
          </div>

          {/* Element 1 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Element 1 (Always Visible)
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSlideUpElement1Type?.('image')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement1Type === 'image'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaImage className="w-4 h-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideUpElement1Type?.('video')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement1Type === 'video'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaVideo className="w-4 h-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideUpElement1Type?.('text')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement1Type === 'text'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaFont className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {slideUpElement1Type === 'image' ? 'Image' : slideUpElement1Type === 'video' ? 'Video' : 'Text Content'}
              </label>
              {slideUpElement1Type === 'text' ? (
                <textarea
                  value={slideUpElement1Content || ''}
                  onChange={(e) => setSlideUpElement1Content?.(e.target.value)}
                  placeholder="Enter text content..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              ) : slideUpElement1Type === 'image' ? (
                <div className="space-y-2">
                  <label className="block w-full cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && handleSlideUpElement1Upload) handleSlideUpElement1Upload(file, 'image');
                      }}
                      disabled={isUploadingSlideUp1}
                      className="hidden"
                    />
                    <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {isUploadingSlideUp1 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload image</p>
                      )}
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <input
                    type="url"
                    value={slideUpElement1Content || ''}
                    onChange={(e) => setSlideUpElement1Content?.(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={isUploadingSlideUp1}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block w-full cursor-pointer">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && handleSlideUpElement1Upload) handleSlideUpElement1Upload(file, 'video');
                      }}
                      disabled={isUploadingSlideUp1}
                      className="hidden"
                    />
                    <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {isUploadingSlideUp1 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading video...</p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload MP4 video</p>
                      )}
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <input
                    type="url"
                    value={slideUpElement1Content || ''}
                    onChange={(e) => setSlideUpElement1Content?.(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                    disabled={isUploadingSlideUp1}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Caption (optional)
              </label>
              <input
                type="text"
                value={slideUpElement1Caption || ''}
                onChange={(e) => setSlideUpElement1Caption?.(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Element 2 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Element 2 (Slides Up)
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSlideUpElement2Type?.('image')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement2Type === 'image'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaImage className="w-4 h-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideUpElement2Type?.('video')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement2Type === 'video'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaVideo className="w-4 h-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideUpElement2Type?.('text')}
                  className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                    slideUpElement2Type === 'text'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaFont className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {slideUpElement2Type === 'image' ? 'Image' : slideUpElement2Type === 'video' ? 'Video' : 'Text Content'}
              </label>
              {slideUpElement2Type === 'text' ? (
                <textarea
                  value={slideUpElement2Content || ''}
                  onChange={(e) => setSlideUpElement2Content?.(e.target.value)}
                  placeholder="Enter text content..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              ) : slideUpElement2Type === 'image' ? (
                <div className="space-y-2">
                  <label className="block w-full cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && handleSlideUpElement2Upload) handleSlideUpElement2Upload(file, 'image');
                      }}
                      disabled={isUploadingSlideUp2}
                      className="hidden"
                    />
                    <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {isUploadingSlideUp2 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload image</p>
                      )}
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <input
                    type="url"
                    value={slideUpElement2Content || ''}
                    onChange={(e) => setSlideUpElement2Content?.(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={isUploadingSlideUp2}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block w-full cursor-pointer">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && handleSlideUpElement2Upload) handleSlideUpElement2Upload(file, 'video');
                      }}
                      disabled={isUploadingSlideUp2}
                      className="hidden"
                    />
                    <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {isUploadingSlideUp2 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading video...</p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload MP4 video</p>
                      )}
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <input
                    type="url"
                    value={slideUpElement2Content || ''}
                    onChange={(e) => setSlideUpElement2Content?.(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                    disabled={isUploadingSlideUp2}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Caption (optional)
              </label>
              <input
                type="text"
                value={slideUpElement2Caption || ''}
                onChange={(e) => setSlideUpElement2Caption?.(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
