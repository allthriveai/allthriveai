/**
 * HeroSlideshow - Slideshow display mode for project hero
 *
 * Auto-advancing carousel with manual navigation and indicator dots.
 */

import { useState, useEffect } from 'react';

interface HeroSlideshowProps {
  images: string[];
}

export function HeroSlideshow({ images }: HeroSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance slideshow every 5 seconds (pause on hover)
  useEffect(() => {
    if (isHovered || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, images.length, isHovered]);

  if (!images || images.length === 0) return null;

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex((currentIndex + 1) % images.length);
  };

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
    >
      <div className="relative group">
        <div className="absolute -inset-2 md:-inset-4 bg-slate-200/50 dark:bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
        <div className="relative p-1 md:p-2 bg-slate-200/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-slate-300 dark:border-white/20 shadow-2xl">
          {/* Image */}
          <img
            src={images[currentIndex]}
            alt={`Slide ${currentIndex + 1} of ${images.length}`}
            className="relative w-full max-h-[400px] md:max-h-[600px] object-cover rounded-xl md:rounded-2xl shadow-inner transition-opacity duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
            }}
          />

          {/* Navigation Arrows (show only if more than 1 image) */}
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 backdrop-blur-sm text-white rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 touch-manipulation"
                aria-label="Previous slide"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 backdrop-blur-sm text-white rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 touch-manipulation"
                aria-label="Next slide"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Indicator Dots */}
          <div className="absolute bottom-3 md:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 md:gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 md:h-2.5 rounded-full transition-all touch-manipulation ${
                  idx === currentIndex ? 'bg-slate-900 dark:bg-white w-6 md:w-8' : 'bg-slate-900/30 dark:bg-white/30 hover:bg-slate-900/50 dark:hover:bg-white/50 active:bg-slate-900/60 dark:active:bg-white/60 w-2 md:w-2.5'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Image Counter */}
          <div className="absolute top-3 md:top-4 right-3 md:right-4 px-2.5 md:px-3 py-1 md:py-1.5 bg-black/50 backdrop-blur-sm text-white text-xs md:text-sm font-medium rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>
  );
}
