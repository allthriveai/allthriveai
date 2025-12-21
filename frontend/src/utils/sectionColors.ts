/**
 * Section/Concept Colors - Gradients for app navigation sections
 *
 * These are distinct from Category Colors (which are for content types).
 * Section colors create wayfinding - the same gradient appears on the
 * feeling pill AND the destination page header.
 *
 * IMPORTANT: Do not confuse with categoryColors.ts which is for content categories.
 */

export type SectionId = 'play' | 'learn' | 'explore' | 'share' | 'connect' | 'challenge';

interface SectionColorConfig {
  id: SectionId;
  name: string;
  description: string;
  // Gradient colors
  gradientFrom: string;
  gradientTo: string;
  // Text color for light/dark modes
  textLight: string;
  textDark: string;
  // Background tints
  bgLight: string;
  bgDark: string;
  // Border colors
  borderLight: string;
  borderDark: string;
}

/**
 * Section gradient definitions
 * Each section has a unique gradient that flows through the app
 */
export const SECTION_COLORS: Record<SectionId, SectionColorConfig> = {
  play: {
    id: 'play',
    name: 'Play',
    description: 'Games, battles, and interactive challenges',
    gradientFrom: '#8B5CF6', // violet-500
    gradientTo: '#7C3AED',   // violet-600
    textLight: '#7C3AED',
    textDark: '#A78BFA',
    bgLight: 'rgba(139, 92, 246, 0.1)',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    borderLight: 'rgba(139, 92, 246, 0.3)',
    borderDark: 'rgba(139, 92, 246, 0.4)',
  },
  learn: {
    id: 'learn',
    name: 'Learn',
    description: 'Tutorials, courses, and skill building',
    gradientFrom: '#F59E0B', // amber-500
    gradientTo: '#D97706',   // amber-600
    textLight: '#D97706',
    textDark: '#FBBF24',
    bgLight: 'rgba(245, 158, 11, 0.1)',
    bgDark: 'rgba(245, 158, 11, 0.15)',
    borderLight: 'rgba(245, 158, 11, 0.3)',
    borderDark: 'rgba(245, 158, 11, 0.4)',
  },
  explore: {
    id: 'explore',
    name: 'Explore',
    description: 'Discover projects and creators',
    gradientFrom: '#0EA5E9', // cyan-500 (brand)
    gradientTo: '#0891B2',   // cyan-600
    textLight: '#0891B2',
    textDark: '#22D3EE',
    bgLight: 'rgba(14, 165, 233, 0.1)',
    bgDark: 'rgba(14, 165, 233, 0.15)',
    borderLight: 'rgba(14, 165, 233, 0.3)',
    borderDark: 'rgba(14, 165, 233, 0.4)',
  },
  share: {
    id: 'share',
    name: 'Share',
    description: 'Create and share your projects',
    gradientFrom: '#10B981', // emerald-500
    gradientTo: '#059669',   // emerald-600
    textLight: '#059669',
    textDark: '#34D399',
    bgLight: 'rgba(16, 185, 129, 0.1)',
    bgDark: 'rgba(16, 185, 129, 0.15)',
    borderLight: 'rgba(16, 185, 129, 0.3)',
    borderDark: 'rgba(16, 185, 129, 0.4)',
  },
  connect: {
    id: 'connect',
    name: 'Connect',
    description: 'Community and social features',
    gradientFrom: '#EC4899', // pink-500
    gradientTo: '#DB2777',   // pink-600
    textLight: '#DB2777',
    textDark: '#F472B6',
    bgLight: 'rgba(236, 72, 153, 0.1)',
    bgDark: 'rgba(236, 72, 153, 0.15)',
    borderLight: 'rgba(236, 72, 153, 0.3)',
    borderDark: 'rgba(236, 72, 153, 0.4)',
  },
  challenge: {
    id: 'challenge',
    name: 'Challenge',
    description: 'Weekly challenges and competitions',
    gradientFrom: '#EF4444', // red-500
    gradientTo: '#DC2626',   // red-600
    textLight: '#DC2626',
    textDark: '#F87171',
    bgLight: 'rgba(239, 68, 68, 0.1)',
    bgDark: 'rgba(239, 68, 68, 0.15)',
    borderLight: 'rgba(239, 68, 68, 0.3)',
    borderDark: 'rgba(239, 68, 68, 0.4)',
  },
};

/**
 * Get section color config by ID
 */
export function getSectionColor(sectionId: SectionId): SectionColorConfig {
  return SECTION_COLORS[sectionId];
}

/**
 * Get inline gradient style for a section
 */
export function getSectionGradientStyle(sectionId: SectionId): React.CSSProperties {
  const section = SECTION_COLORS[sectionId];
  return {
    background: `linear-gradient(135deg, ${section.gradientFrom}, ${section.gradientTo})`,
  };
}

/**
 * Get Tailwind-compatible classes for a section pill (feeling pill)
 * Returns classes for both light and dark mode
 */
export function getSectionPillClasses(sectionId: SectionId): {
  base: string;
  hover: string;
  gradient: { from: string; to: string };
} {
  const section = SECTION_COLORS[sectionId];

  return {
    base: `border transition-all duration-300`,
    hover: `hover:scale-105 active:scale-95`,
    gradient: {
      from: section.gradientFrom,
      to: section.gradientTo,
    },
  };
}

/**
 * Map feeling option IDs to section IDs
 */
export const FEELING_TO_SECTION: Record<string, SectionId> = {
  'share': 'share',
  'play': 'play',
  'challenge': 'challenge',
  'learn': 'learn',
  'marketplace': 'share', // Part of create/share flow
  'explore': 'explore',
  'connect': 'connect',
  'feedback': 'connect', // Community-related
  'avatar': 'share', // Profile/creation related
  'personalize': 'connect', // Setting up profile is community-related
  'trending': 'explore', // Discovering what's popular
  'quick-win': 'play', // Quick wins are like mini-games
};

/**
 * Get section ID from a feeling option ID
 */
export function getSectionFromFeeling(feelingId: string): SectionId {
  return FEELING_TO_SECTION[feelingId] || 'explore';
}
