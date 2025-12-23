/**
 * Constants for Project components
 * Centralized configuration for magic numbers and reusable values
 */

// Autosave configuration
export const AUTOSAVE_DEBOUNCE_MS = 2000;

// Card size breakpoints (text length in characters)
export const QUOTE_CARD_SIZE = {
  SHORT: 100,
  MEDIUM: 250,
  HEIGHT_SHORT: 'min-h-[300px]',
  HEIGHT_MEDIUM: 'min-h-[400px]',
  HEIGHT_LONG: 'min-h-[500px]',
} as const;

// Tag display limits
export const MAX_VISIBLE_TAGS = 3;

// Banner image recommendations
export const BANNER_IMAGE = {
  RECOMMENDED_WIDTH: 1600,
  RECOMMENDED_HEIGHT: 400,
  ASPECT_RATIO: '4:1',
  MAX_SIZE_MB: 5,
} as const;

// Featured image recommendations
export const FEATURED_IMAGE = {
  RECOMMENDED_WIDTH: 1200,
  RECOMMENDED_HEIGHT: 630,
  ASPECT_RATIO: '1.91:1',
} as const;

// Slideshow configuration
export const SLIDESHOW = {
  MAX_IMAGES: 20,
  THUMBNAIL_COLS_MOBILE: 2,
  THUMBNAIL_COLS_DESKTOP: 3,
} as const;

// Animation durations (ms)
export const ANIMATION = {
  HOVER_TRANSITION: 300,
  GRADIENT_SCALE: 700,
  CARD_HOVER_SCALE: 1.02,
  CARD_HOVER_TRANSLATE_Y: -1,
} as const;

// Gradient overlay
export const GRADIENT_OVERLAY = {
  TOP_OFFSET: -40, // pixels from bottom for gradient start
  DEFAULT_FROM: 'rgb(124, 58, 237)', // violet-600
  DEFAULT_TO: 'rgb(79, 70, 229)', // indigo-600
} as const;

// Tool display
export const TOOL_DISPLAY = {
  ICON_SIZE: 'w-5 h-5',
  AVATAR_SIZE: 'w-9 h-9',
} as const;

// Project type labels
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  github_repo: 'GitHub Repo',
  figma_design: 'Figma Design',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  reddit_thread: 'Reddit Thread',
  video: 'Video',
  rss_article: 'Curated',
  battle: 'Prompt Battle',
  game: 'Game',
  other: 'Project',
};
