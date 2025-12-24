/**
 * Image Lightbox Component
 *
 * Full-screen overlay to view images at larger size.
 * Click outside or press Escape to close.
 */
import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
  /** Optional array of images for gallery navigation */
  images?: { url: string; alt?: string }[];
  /** Current index when using gallery mode */
  currentIndex?: number;
  /** Callback when navigating in gallery mode */
  onNavigate?: (index: number) => void;
}

export function ImageLightbox({
  isOpen,
  onClose,
  imageUrl,
  alt = 'Image preview',
  images,
  currentIndex = 0,
  onNavigate,
}: ImageLightboxProps) {
  const isGalleryMode = images && images.length > 1;
  const displayUrl = isGalleryMode ? images[currentIndex]?.url : imageUrl;
  const displayAlt = isGalleryMode ? images[currentIndex]?.alt || alt : alt;

  const handlePrevious = useCallback(() => {
    if (isGalleryMode && onNavigate && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [isGalleryMode, onNavigate, currentIndex]);

  const handleNext = useCallback(() => {
    if (isGalleryMode && onNavigate && currentIndex < images!.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [isGalleryMode, onNavigate, currentIndex, images]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, handlePrevious, handleNext]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close lightbox"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {/* Navigation arrows for gallery mode */}
          {isGalleryMode && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                disabled={currentIndex === 0}
                className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous image"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                disabled={currentIndex === images!.length - 1}
                className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next image"
              >
                <ArrowRightIcon className="w-6 h-6" />
              </button>

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm">
                {currentIndex + 1} / {images!.length}
              </div>
            </>
          )}

          {/* Image */}
          <motion.img
            key={displayUrl}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={displayUrl}
            alt={displayAlt}
            className="relative max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
