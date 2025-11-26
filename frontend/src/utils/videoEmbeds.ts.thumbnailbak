/**
 * Utility functions for converting video URLs to embed formats
 * Supports YouTube, Vimeo, and Loom
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'loom' | 'direct';

/**
 * Detect the video provider from a URL
 */
export const detectVideoProvider = (url: string): VideoProvider => {
  if (!url) return 'direct';

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (url.includes('loom.com')) {
    return 'loom';
  }
  return 'direct';
};

/**
 * Convert a video URL to its embeddable format
 *
 * @param url - The video URL to convert
 * @returns The embed URL, or the original URL if it's a direct video file
 *
 * @example
 * convertToEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
 * // Returns: 'https://youtube.com/embed/dQw4w9WgXcQ'
 *
 * convertToEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
 * // Returns: 'https://youtube.com/embed/dQw4w9WgXcQ'
 *
 * convertToEmbedUrl('https://vimeo.com/123456789')
 * // Returns: 'https://player.vimeo.com/video/123456789'
 *
 * convertToEmbedUrl('https://www.loom.com/share/abc123')
 * // Returns: 'https://www.loom.com/embed/abc123'
 */
export const convertToEmbedUrl = (url: string): string => {
  if (!url) return '';

  const provider = detectVideoProvider(url);

  switch (provider) {
    case 'youtube':
      // Handle both youtube.com/watch?v= and youtu.be/ formats
      return url
        .replace('watch?v=', 'embed/')
        .replace('youtu.be/', 'youtube.com/embed/');

    case 'vimeo':
      return url.replace('vimeo.com/', 'player.vimeo.com/video/');

    case 'loom':
      return url.replace('/share/', '/embed/');

    case 'direct':
    default:
      // Return as-is for direct video URLs (.mp4, .webm, etc.)
      return url;
  }
};

/**
 * Check if a URL is a supported embeddable video
 */
export const isEmbeddableVideo = (url: string): boolean => {
  const provider = detectVideoProvider(url);
  return provider !== 'direct';
};

/**
 * Get appropriate iframe allow attributes for a video provider
 */
export const getVideoIframeAllowAttributes = (provider: VideoProvider): string => {
  switch (provider) {
    case 'youtube':
      return 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    case 'vimeo':
    case 'loom':
      return 'autoplay; fullscreen; picture-in-picture';
    default:
      return '';
  }
};
