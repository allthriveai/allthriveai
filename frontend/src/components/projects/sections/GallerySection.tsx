/**
 * GallerySection - Screenshot carousel or grid with lightbox
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useState, useCallback } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { GallerySectionContent, GalleryImage } from '@/types/sections';

interface GallerySectionProps {
  content: GallerySectionContent;
  isEditing?: boolean;
  onUpdate?: (content: GallerySectionContent) => void;
}

interface ImageThumbnailProps {
  image: GalleryImage;
  index: number;
  onClick: () => void;
  isEditing?: boolean;
  onUpdate?: (index: number, image: GalleryImage) => void;
  onDelete?: (index: number) => void;
}

function ImageThumbnail({
  image,
  index,
  onClick,
  isEditing,
  onUpdate,
  onDelete,
}: ImageThumbnailProps) {
  const handleUrlChange = useCallback(
    async (newUrl: string) => {
      if (onUpdate) {
        onUpdate(index, { ...image, url: newUrl });
      }
    },
    [index, image, onUpdate]
  );

  const handleCaptionChange = useCallback(
    async (newCaption: string) => {
      if (onUpdate) {
        onUpdate(index, { ...image, caption: newCaption });
      }
    },
    [index, image, onUpdate]
  );

  const handleAltChange = useCallback(
    async (newAlt: string) => {
      if (onUpdate) {
        onUpdate(index, { ...image, alt: newAlt });
      }
    },
    [index, image, onUpdate]
  );

  if (isEditing) {
    return (
      <div className="group relative rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Delete button */}
        {onDelete && (
          <button
            onClick={() => onDelete(index)}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete image"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}

        {/* Image preview */}
        <div className="aspect-video">
          {image.url ? (
            <img
              src={image.thumbnail || image.url}
              alt={image.alt || image.caption || 'Gallery image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image URL
            </div>
          )}
        </div>

        {/* Edit fields */}
        <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
          <InlineEditableText
            value={image.url}
            isEditable={true}
            onChange={handleUrlChange}
            placeholder="Image URL..."
            className="text-xs text-gray-500 dark:text-gray-400 font-mono"
          />
          <InlineEditableText
            value={image.caption || ''}
            isEditable={true}
            onChange={handleCaptionChange}
            placeholder="Caption (optional)..."
            className="text-sm text-gray-700 dark:text-gray-300"
          />
          <InlineEditableText
            value={image.alt || ''}
            isEditable={true}
            onChange={handleAltChange}
            placeholder="Alt text (optional)..."
            className="text-xs text-gray-500 dark:text-gray-400"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 aspect-video hover:ring-2 hover:ring-primary-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <img
        src={image.thumbnail || image.url}
        alt={image.alt || image.caption || 'Gallery image'}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      </div>
      {/* Caption */}
      {image.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-sm truncate">{image.caption}</p>
        </div>
      )}
    </button>
  );
}

function Lightbox({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const currentImage = images[currentIndex];

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Image lightbox"
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
        aria-label="Close lightbox"
      >
        <XMarkIcon className="w-8 h-8" />
      </button>

      {/* Image Counter */}
      <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm text-white text-sm font-medium rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full transition-all"
          aria-label="Previous image"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || currentImage.caption || 'Gallery image'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-[scale-in_0.2s_ease-out]"
        />
        {currentImage.caption && (
          <p className="mt-4 text-white/80 text-center max-w-2xl">
            {currentImage.caption}
          </p>
        )}
      </div>

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full transition-all"
          aria-label="Next image"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

export function GallerySection({ content, isEditing, onUpdate }: GallerySectionProps) {
  const { images, layout = 'grid', title } = content;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleImageUpdate = useCallback(
    (index: number, updatedImage: GalleryImage) => {
      if (onUpdate) {
        const newImages = [...(images || [])];
        newImages[index] = updatedImage;
        onUpdate({ ...content, images: newImages });
      }
    },
    [content, images, onUpdate]
  );

  const handleImageDelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newImages = (images || []).filter((_, i) => i !== index);
        onUpdate({ ...content, images: newImages });
      }
    },
    [content, images, onUpdate]
  );

  const handleAddImage = useCallback(() => {
    if (onUpdate) {
      const newImage: GalleryImage = {
        url: '',
        caption: '',
        alt: '',
      };
      onUpdate({ ...content, images: [...(images || []), newImage] });
    }
  }, [content, images, onUpdate]);

  const handleLayoutChange = useCallback(
    (newLayout: 'grid' | 'carousel' | 'masonry') => {
      if (onUpdate) {
        onUpdate({ ...content, layout: newLayout });
      }
    },
    [content, onUpdate]
  );

  // Allow empty in edit mode
  if ((!images || images.length === 0) && !isEditing) {
    return null;
  }

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + (images?.length || 1)) % (images?.length || 1)));
  const nextImage = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % (images?.length || 1)));

  // Determine grid columns based on image count
  const imageCount = images?.length || 0;
  const gridCols =
    imageCount === 1 ? 'grid-cols-1' :
    imageCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
    imageCount === 4 ? 'grid-cols-2' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="project-section" data-section-type="gallery">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        {isEditing ? (
          <InlineEditableTitle
            value={title || 'Gallery'}
            isEditable={true}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'Gallery'}
          </h2>
        )}
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Layout selector (editing mode only) */}
      {isEditing && (
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Layout:</span>
          <select
            value={layout}
            onChange={(e) => handleLayoutChange(e.target.value as 'grid' | 'carousel' | 'masonry')}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="grid">Grid</option>
            <option value="carousel">Carousel</option>
            <option value="masonry">Masonry</option>
          </select>
        </div>
      )}

      {/* Grid Layout */}
      {layout === 'grid' && (
        <div className={`grid ${gridCols} gap-4`}>
          {images?.map((image, index) => (
            <ImageThumbnail
              key={index}
              image={image}
              index={index}
              onClick={() => openLightbox(index)}
              isEditing={isEditing}
              onUpdate={handleImageUpdate}
              onDelete={handleImageDelete}
            />
          ))}
          {/* Add Image button */}
          {isEditing && (
            <button
              onClick={handleAddImage}
              className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
            >
              <PlusIcon className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Add Image</span>
            </button>
          )}
        </div>
      )}

      {/* Carousel Layout */}
      {layout === 'carousel' && (
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {images?.map((image, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-[300px] md:w-[400px] snap-center"
              >
                <ImageThumbnail
                  image={image}
                  index={index}
                  onClick={() => openLightbox(index)}
                  isEditing={isEditing}
                  onUpdate={handleImageUpdate}
                  onDelete={handleImageDelete}
                />
              </div>
            ))}
            {/* Add Image button */}
            {isEditing && (
              <button
                onClick={handleAddImage}
                className="flex-shrink-0 w-[300px] md:w-[400px] flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <PlusIcon className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Add Image</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Masonry Layout */}
      {layout === 'masonry' && (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {images?.map((image, index) => (
            <div key={index} className="break-inside-avoid">
              <ImageThumbnail
                image={image}
                index={index}
                onClick={() => openLightbox(index)}
                isEditing={isEditing}
                onUpdate={handleImageUpdate}
                onDelete={handleImageDelete}
              />
            </div>
          ))}
          {/* Add Image button */}
          {isEditing && (
            <div className="break-inside-avoid">
              <button
                onClick={handleAddImage}
                className="w-full flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <PlusIcon className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Add Image</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox (view mode only) */}
      {!isEditing && lightboxIndex !== null && images && images.length > 0 && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}
    </section>
  );
}
