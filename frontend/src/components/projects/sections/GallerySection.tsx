/**
 * GallerySection - Screenshot carousel or grid with lightbox
 */

import { useState } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { GallerySectionContent, GalleryImage } from '@/types/sections';

interface GallerySectionProps {
  content: GallerySectionContent;
  isEditing?: boolean;
  onUpdate?: (content: GallerySectionContent) => void;
}

function ImageThumbnail({
  image,
  onClick,
}: {
  image: GalleryImage;
  onClick: () => void;
}) {
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
  const { images, layout = 'grid' } = content;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const nextImage = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length));

  // Determine grid columns based on image count
  const gridCols =
    images.length === 1 ? 'grid-cols-1' :
    images.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
    images.length === 4 ? 'grid-cols-2' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="project-section" data-section-type="gallery">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gallery</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Grid Layout */}
      {layout === 'grid' && (
        <div className={`grid ${gridCols} gap-4`}>
          {images.map((image, index) => (
            <ImageThumbnail
              key={index}
              image={image}
              onClick={() => openLightbox(index)}
            />
          ))}
        </div>
      )}

      {/* Carousel Layout */}
      {layout === 'carousel' && (
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {images.map((image, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-[300px] md:w-[400px] snap-center"
              >
                <ImageThumbnail
                  image={image}
                  onClick={() => openLightbox(index)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masonry Layout */}
      {layout === 'masonry' && (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {images.map((image, index) => (
            <div key={index} className="break-inside-avoid">
              <ImageThumbnail
                image={image}
                onClick={() => openLightbox(index)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
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
