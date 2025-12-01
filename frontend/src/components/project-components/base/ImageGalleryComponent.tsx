/**
 * ImageGalleryComponent - Visual showcase
 */

import { useState } from 'react';
import type { ImageGalleryComponent as ImageGalleryComponentType } from '@/types/components';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface ImageGalleryComponentProps {
  component: ImageGalleryComponentType;
}

export function ImageGalleryComponent({ component }: ImageGalleryComponentProps) {
  const { data } = component;
  const { title, images, variant, columns = 3 } = data;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === 0 ? images.length - 1 : lightboxIndex - 1);
    }
  };
  const nextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === images.length - 1 ? 0 : lightboxIndex + 1);
    }
  };

  // Grid variant - uniform grid
  if (variant === 'grid') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className={`grid ${gridCols[columns]} gap-4`}>
          {images.map((image, index) => (
            <figure
              key={index}
              className="group relative overflow-hidden rounded-xl cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image.url}
                alt={image.alt || ''}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {image.caption && (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm">{image.caption}</p>
                </figcaption>
              )}
            </figure>
          ))}
        </div>

        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      </section>
    );
  }

  // Masonry variant - pinterest-style layout
  if (variant === 'masonry') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="columns-2 md:columns-3 gap-4 space-y-4">
          {images.map((image, index) => (
            <figure
              key={index}
              className="group relative overflow-hidden rounded-xl cursor-pointer break-inside-avoid"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image.url}
                alt={image.alt || ''}
                className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
              />
              {image.caption && (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm">{image.caption}</p>
                </figcaption>
              )}
            </figure>
          ))}
        </div>

        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      </section>
    );
  }

  // Carousel variant - horizontal slider
  if (variant === 'carousel') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {images.map((image, index) => (
              <figure
                key={index}
                className="flex-shrink-0 w-80 snap-center cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={image.url}
                  alt={image.alt || ''}
                  className="w-full h-60 object-cover rounded-xl hover:scale-[1.02] transition-transform"
                />
                {image.caption && (
                  <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>

        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      </section>
    );
  }

  // Lightbox variant - thumbnails that open lightbox
  return (
    <section className="py-8">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {title}
        </h2>
      )}

      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            className="relative w-20 h-20 overflow-hidden rounded-lg hover:ring-2 hover:ring-primary-500 transition-all"
          >
            <img
              src={image.url}
              alt={image.alt || ''}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      <Lightbox
        images={images}
        currentIndex={lightboxIndex}
        onClose={closeLightbox}
        onPrev={prevImage}
        onNext={nextImage}
      />
    </section>
  );
}

interface LightboxProps {
  images: ImageGalleryComponentType['data']['images'];
  currentIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ images, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  if (currentIndex === null) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
      >
        <XMarkIcon className="w-8 h-8" />
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeftIcon className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || ''}
          className="max-w-full max-h-[80vh] object-contain"
        />
        {currentImage.caption && (
          <p className="mt-4 text-white/80 text-center max-w-xl">
            {currentImage.caption}
          </p>
        )}
        <p className="mt-2 text-white/50 text-sm">
          {currentIndex + 1} / {images.length}
        </p>
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
        >
          <ChevronRightIcon className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
