/**
 * HeroDisplaySection - Reusable hero display mode selector
 * Part of the scalable ProjectFieldsEditor system
 */

import {
  FaImage,
  FaVideo,
  FaQuoteLeft,
  FaImages,
  FaArrowUp,
} from 'react-icons/fa';

interface HeroDisplaySectionProps {
  heroDisplayMode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
  setHeroDisplayMode: (mode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup') => void;
  featuredImageUrl?: string;
  heroQuote?: string;
  heroVideoUrl?: string;
  heroSlideshowImages?: string[];
  isSaving?: boolean;
}

const HERO_MODES = [
  { id: 'image' as const, label: 'Image', icon: FaImage },
  { id: 'video' as const, label: 'Video', icon: FaVideo },
  { id: 'slideshow' as const, label: 'Slideshow', icon: FaImages },
  { id: 'quote' as const, label: 'Quote', icon: FaQuoteLeft },
  { id: 'slideup' as const, label: 'Slide Up', icon: FaArrowUp },
];

export function HeroDisplaySection({
  heroDisplayMode,
  setHeroDisplayMode,
  featuredImageUrl,
  heroQuote,
  heroVideoUrl,
  heroSlideshowImages = [],
  isSaving = false,
}: HeroDisplaySectionProps) {
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
        Choose how to showcase your project in the hero section
      </p>

      <div className="flex flex-wrap gap-2">
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

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        You can only use one hero display mode at a time. Clear other hero content to switch modes.
      </p>
    </div>
  );
}
