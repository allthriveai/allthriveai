/**
 * Image Optimization Utilities
 *
 * Provides helpers for optimized image loading on the explore page and project cards.
 * Works with AWS Serverless Image Handler when deployed, or falls back to original images.
 *
 * Features:
 * - Generates responsive image srcset for different viewport sizes
 * - Automatic WebP format detection
 * - Lazy loading with blur-up placeholder support
 * - Mobile-optimized image sizes
 */

// Image size presets for different use cases
export const IMAGE_SIZES = {
  // Project card thumbnails
  cardMobile: 400,
  cardTablet: 600,
  cardDesktop: 800,

  // Full project page hero
  heroMobile: 800,
  heroTablet: 1200,
  heroDesktop: 1920,

  // Avatar/profile images
  avatarSmall: 48,
  avatarMedium: 96,
  avatarLarge: 200,

  // Tiny placeholder for blur-up effect
  placeholder: 20,
} as const;

// Quality presets
export const IMAGE_QUALITY = {
  low: 60,
  medium: 75,
  high: 85,
  lossless: 100,
} as const;

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
}

/**
 * Check if the browser supports WebP format
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Check if a URL is from our media bucket (can be optimized)
 */
export function isOptimizableUrl(url: string): boolean {
  if (!url) return false;

  // URLs from our S3/CloudFront media bucket
  const optimizablePatterns = [
    '/media/',
    'allthrive-media',
    'allthrive.ai/media',
    'd1234567890.cloudfront.net', // Replace with actual CloudFront domain
  ];

  return optimizablePatterns.some((pattern) => url.includes(pattern));
}

/**
 * Generate an optimized image URL with resize parameters
 *
 * When AWS Serverless Image Handler is deployed, this generates URLs like:
 *   /media/images/photo.jpg?w=400&q=80&f=webp
 *
 * For now, it just returns the original URL (optimization happens at CDN level)
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!originalUrl) return '';

  // External URLs (Unsplash, etc.) - return as-is
  // Many external CDNs already optimize images
  if (originalUrl.startsWith('http') && !isOptimizableUrl(originalUrl)) {
    // Unsplash supports URL params for resizing
    if (originalUrl.includes('unsplash.com')) {
      const params = new URLSearchParams();
      if (options.width) params.set('w', options.width.toString());
      if (options.quality) params.set('q', options.quality.toString());
      params.set('auto', 'format'); // Auto WebP
      const separator = originalUrl.includes('?') ? '&' : '?';
      return `${originalUrl}${separator}${params.toString()}`;
    }
    return originalUrl;
  }

  // For our media URLs, add optimization params
  // These will be processed by CloudFront Function + Serverless Image Handler
  const { width, height, quality = IMAGE_QUALITY.medium, format = 'auto' } = options;

  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality !== IMAGE_QUALITY.lossless) params.set('q', quality.toString());
  if (format !== 'auto') params.set('f', format);

  // If no params, return original
  if (params.toString() === '') return originalUrl;

  const separator = originalUrl.includes('?') ? '&' : '?';
  return `${originalUrl}${separator}${params.toString()}`;
}

/**
 * Generate srcset string for responsive images
 *
 * Returns a srcset with multiple sizes for the browser to choose from
 */
export function generateSrcSet(
  originalUrl: string,
  sizes: number[] = [400, 800, 1200],
  quality: number = IMAGE_QUALITY.medium
): string {
  if (!originalUrl) return '';

  return sizes
    .map((width) => {
      const url = getOptimizedImageUrl(originalUrl, { width, quality });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 *
 * Tells the browser which image size to use at different viewport widths
 */
export function generateSizes(
  mobileWidth: number = 400,
  tabletWidth: number = 800,
  desktopWidth: number = 1200
): string {
  return `(max-width: 640px) ${mobileWidth}px, (max-width: 1024px) ${tabletWidth}px, ${desktopWidth}px`;
}

/**
 * Props for the OptimizedImage component helper
 */
export interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean; // Load immediately (above the fold)
  sizes?: 'card' | 'hero' | 'avatar' | 'custom';
  customSizes?: number[];
  quality?: keyof typeof IMAGE_QUALITY;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Get image props for an optimized image element
 *
 * Usage in React:
 * ```tsx
 * const imageProps = getOptimizedImageProps({
 *   src: project.bannerUrl,
 *   alt: project.title,
 *   sizes: 'card',
 * });
 *
 * return <img {...imageProps} className="w-full h-auto" />;
 * ```
 */
export function getOptimizedImageProps(options: OptimizedImageProps): React.ImgHTMLAttributes<HTMLImageElement> {
  const {
    src,
    alt,
    className,
    priority = false,
    sizes = 'card',
    customSizes,
    quality = 'medium',
  } = options;

  // Determine sizes based on preset
  let imageSizes: number[];
  let sizesAttr: string;

  switch (sizes) {
    case 'card':
      imageSizes = [IMAGE_SIZES.cardMobile, IMAGE_SIZES.cardTablet, IMAGE_SIZES.cardDesktop];
      sizesAttr = generateSizes(400, 600, 800);
      break;
    case 'hero':
      imageSizes = [IMAGE_SIZES.heroMobile, IMAGE_SIZES.heroTablet, IMAGE_SIZES.heroDesktop];
      sizesAttr = generateSizes(800, 1200, 1920);
      break;
    case 'avatar':
      imageSizes = [IMAGE_SIZES.avatarSmall, IMAGE_SIZES.avatarMedium, IMAGE_SIZES.avatarLarge];
      sizesAttr = generateSizes(48, 96, 200);
      break;
    case 'custom':
      imageSizes = customSizes || [400, 800, 1200];
      sizesAttr = generateSizes(...(imageSizes.slice(0, 3) as [number, number, number]));
      break;
    default:
      imageSizes = [400, 800, 1200];
      sizesAttr = generateSizes(400, 800, 1200);
  }

  const qualityValue = IMAGE_QUALITY[quality];

  return {
    src: getOptimizedImageUrl(src, { width: imageSizes[1], quality: qualityValue }),
    srcSet: generateSrcSet(src, imageSizes, qualityValue),
    sizes: sizesAttr,
    alt,
    className,
    loading: priority ? 'eager' : 'lazy',
    decoding: priority ? 'sync' : 'async',
  };
}

/**
 * Preload critical images (above the fold)
 *
 * Call this for images that should load immediately
 */
export function preloadImage(url: string, width: number = IMAGE_SIZES.cardDesktop): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getOptimizedImageUrl(url, { width });
  document.head.appendChild(link);
}

/**
 * Calculate aspect ratio padding for image containers
 *
 * Prevents layout shift while images load
 */
export function getAspectRatioPadding(width: number, height: number): string {
  return `${(height / width) * 100}%`;
}
