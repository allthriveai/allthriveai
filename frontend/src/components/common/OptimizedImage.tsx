import { useState, useCallback } from 'react';
import { getOptimizedImageProps, type OptimizedImageProps } from '@/utils/imageOptimization';

interface Props extends OptimizedImageProps {
  fallbackSrc?: string;
  placeholderClassName?: string;
  containerClassName?: string;
  showPlaceholder?: boolean;
}

/**
 * OptimizedImage Component
 *
 * A performant image component with:
 * - Responsive srcset for different viewport sizes
 * - Native lazy loading
 * - Smooth fade-in transition on load
 * - Shimmer placeholder while loading
 * - Fallback handling for broken images
 *
 * Usage:
 * ```tsx
 * <OptimizedImage
 *   src={project.bannerUrl}
 *   alt={project.title}
 *   sizes="card"
 *   className="rounded-lg"
 * />
 * ```
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  fallbackSrc,
  placeholderClassName = '',
  containerClassName = '',
  showPlaceholder = true,
  priority = false,
  sizes = 'card',
  customSizes,
  quality = 'medium',
  onLoad,
  onError,
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Get optimized image props
  const imageProps = getOptimizedImageProps({
    src: hasError && fallbackSrc ? fallbackSrc : src,
    alt,
    priority,
    sizes,
    customSizes,
    quality,
  });

  // If no src, show placeholder
  if (!src && !fallbackSrc) {
    return (
      <div
        className={`bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 ${containerClassName}`}
        aria-label={alt}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Shimmer placeholder */}
      {showPlaceholder && !isLoaded && (
        <div
          className={`absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 animate-pulse ${placeholderClassName}`}
        />
      )}

      {/* Actual image */}
      <img
        {...imageProps}
        className={`
          transition-opacity duration-300 ease-in-out
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${className}
        `}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Lightweight version without container wrapper
 * Use when you need just the img element with optimization
 */
export function OptimizedImg({
  src,
  alt,
  className = '',
  priority = false,
  sizes = 'card',
  customSizes,
  quality = 'medium',
  onLoad,
  onError,
}: OptimizedImageProps & { className?: string }) {
  const imageProps = getOptimizedImageProps({
    src,
    alt,
    priority,
    sizes,
    customSizes,
    quality,
  });

  return (
    <img
      {...imageProps}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
