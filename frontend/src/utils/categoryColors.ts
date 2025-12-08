/**
 * Utility functions for category color management
 * Jewel-tone color palette - rich, saturated gemstone colors
 */

type ColorName =
  | 'sapphire' | 'tanzanite' | 'amethyst' | 'rose-quartz' | 'emerald'
  | 'morganite' | 'jade' | 'ruby' | 'topaz' | 'peridot'
  // Legacy colors for backwards compatibility
  | 'teal' | 'cyan' | 'blue' | 'green' | 'purple' | 'pink' | 'red' | 'orange' | 'lime';

interface JewelColorClasses {
  // For category pills/badges
  bg: string;
  bgHover: string;
  text: string;
  bgSelected: string;
  textSelected: string;
  // For gradients (text-only cards)
  gradientFrom: string;
  gradientTo: string;
}

/**
 * Primary jewel tone color definitions
 */
const baseJewelColors = {
  sapphire: {
    bg: 'bg-[#0F52BA]/15',
    bgHover: 'hover:bg-[#0F52BA]/25',
    text: 'text-[#0F52BA] dark:text-[#5a8fe8]',
    bgSelected: 'bg-[#0F52BA]',
    textSelected: 'text-white',
    gradientFrom: '#0F52BA',
    gradientTo: '#0a3d8a',
  },
  tanzanite: {
    bg: 'bg-[#4B0082]/15',
    bgHover: 'hover:bg-[#4B0082]/25',
    text: 'text-[#4B0082] dark:text-[#9966CC]',
    bgSelected: 'bg-[#4B0082]',
    textSelected: 'text-white',
    gradientFrom: '#4B0082',
    gradientTo: '#3a0066',
  },
  amethyst: {
    bg: 'bg-[#5a175d]/15',
    bgHover: 'hover:bg-[#5a175d]/25',
    text: 'text-[#5a175d] dark:text-[#b366b8]',
    bgSelected: 'bg-[#5a175d]',
    textSelected: 'text-white',
    gradientFrom: '#5a175d',
    gradientTo: '#420f44',
  },
  'rose-quartz': {
    bg: 'bg-[#AA336A]/15',
    bgHover: 'hover:bg-[#AA336A]/25',
    text: 'text-[#AA336A] dark:text-[#e880a8]',
    bgSelected: 'bg-[#AA336A]',
    textSelected: 'text-white',
    gradientFrom: '#AA336A',
    gradientTo: '#8a2856',
  },
  emerald: {
    bg: 'bg-[#046307]/15',
    bgHover: 'hover:bg-[#046307]/25',
    text: 'text-[#046307] dark:text-[#4ade80]',
    bgSelected: 'bg-[#046307]',
    textSelected: 'text-white',
    gradientFrom: '#046307',
    gradientTo: '#034a05',
  },
  morganite: {
    bg: 'bg-[#C46480]/15',
    bgHover: 'hover:bg-[#C46480]/25',
    text: 'text-[#C46480] dark:text-[#f0a0b8]',
    bgSelected: 'bg-[#C46480]',
    textSelected: 'text-white',
    gradientFrom: '#C46480',
    gradientTo: '#a85068',
  },
  jade: {
    bg: 'bg-[#00A86B]/15',
    bgHover: 'hover:bg-[#00A86B]/25',
    text: 'text-[#00A86B] dark:text-[#4dd8a0]',
    bgSelected: 'bg-[#00A86B]',
    textSelected: 'text-white',
    gradientFrom: '#00A86B',
    gradientTo: '#008c5a',
  },
  ruby: {
    bg: 'bg-[#9B111E]/15',
    bgHover: 'hover:bg-[#9B111E]/25',
    text: 'text-[#9B111E] dark:text-[#e85a66]',
    bgSelected: 'bg-[#9B111E]',
    textSelected: 'text-white',
    gradientFrom: '#9B111E',
    gradientTo: '#7a0d18',
  },
  topaz: {
    bg: 'bg-[#E27D12]/15',
    bgHover: 'hover:bg-[#E27D12]/25',
    text: 'text-[#E27D12] dark:text-[#f5a855]',
    bgSelected: 'bg-[#E27D12]',
    textSelected: 'text-white',
    gradientFrom: '#E27D12',
    gradientTo: '#c56a0e',
  },
  peridot: {
    bg: 'bg-[#5E8C31]/15',
    bgHover: 'hover:bg-[#5E8C31]/25',
    text: 'text-[#5E8C31] dark:text-[#98c860]',
    bgSelected: 'bg-[#5E8C31]',
    textSelected: 'text-white',
    gradientFrom: '#5E8C31',
    gradientTo: '#4a7026',
  },
} as const;

/**
 * True jewel tone colors - rich, saturated gemstone colors
 * Using CSS custom properties defined in index.css
 */
const jewelColorMap: Record<ColorName, JewelColorClasses> = {
  ...baseJewelColors,
  // Legacy colors map to jewel tones
  teal: baseJewelColors.jade,
  cyan: baseJewelColors.sapphire,
  blue: baseJewelColors.sapphire,
  green: baseJewelColors.emerald,
  purple: baseJewelColors.amethyst,
  pink: baseJewelColors['rose-quartz'],
  red: baseJewelColors.ruby,
  orange: baseJewelColors.topaz,
  lime: baseJewelColors.peridot,
};

/**
 * Get Tailwind color classes for a category pill/badge
 * @param color - The color name from the backend (e.g., 'sapphire', 'ruby')
 * @param isSelected - Whether the category is currently selected
 * @returns Object with Tailwind classes for background, text, and hover states
 */
export function getCategoryColorClasses(color?: string, isSelected: boolean = false) {
  const colorName = (color as ColorName) || 'sapphire';
  const classes = jewelColorMap[colorName] || jewelColorMap.sapphire;

  if (isSelected) {
    return {
      background: `${classes.bgSelected} ${classes.textSelected} shadow-sm`,
      hover: '',
    };
  }

  return {
    background: `${classes.bg} ${classes.text}`,
    hover: `${classes.bgHover}`,
  };
}

/**
 * Get gradient classes for a text-only project card based on category
 * @param categoryColor - The primary category's color (e.g., 'sapphire', 'ruby')
 * @param projectId - Fallback project ID for deterministic gradient when no category
 * @returns Tailwind gradient classes using jewel tone hex colors
 */
export function getCategoryGradient(categoryColor?: string, projectId?: number): string {
  const colorName = (categoryColor as ColorName) || null;
  const classes = colorName ? jewelColorMap[colorName] : null;

  if (classes) {
    return `from-[${classes.gradientFrom}] to-[${classes.gradientTo}]`;
  }

  // Fallback: cycle through jewel gradients based on project ID
  const fallbackColors: ColorName[] = [
    'sapphire', 'emerald', 'amethyst', 'jade', 'topaz',
    'tanzanite', 'ruby', 'morganite', 'peridot', 'rose-quartz'
  ];
  const index = projectId ? projectId % fallbackColors.length : 0;
  const fallback = jewelColorMap[fallbackColors[index]];
  return `from-[${fallback.gradientFrom}] to-[${fallback.gradientTo}]`;
}

/**
 * Get inline style object for dynamic jewel colors
 * Use this when Tailwind JIT can't handle dynamic arbitrary values
 */
export function getCategoryGradientStyle(categoryColor?: string, projectId?: number): React.CSSProperties {
  const colorName = (categoryColor as ColorName) || null;
  const classes = colorName ? jewelColorMap[colorName] : null;

  if (classes) {
    return {
      background: `linear-gradient(135deg, ${classes.gradientFrom}, ${classes.gradientTo})`,
    };
  }

  // Fallback
  const fallbackColors: ColorName[] = [
    'sapphire', 'emerald', 'amethyst', 'jade', 'topaz',
    'tanzanite', 'ruby', 'morganite', 'peridot', 'rose-quartz'
  ];
  const index = projectId ? projectId % fallbackColors.length : 0;
  const fallback = jewelColorMap[fallbackColors[index]];
  return {
    background: `linear-gradient(135deg, ${fallback.gradientFrom}, ${fallback.gradientTo})`,
  };
}

/**
 * Get raw gradient colors for custom styling
 */
export function getCategoryColors(categoryColor?: string, projectId?: number): { from: string; to: string } {
  const colorName = (categoryColor as ColorName) || null;
  const classes = colorName ? jewelColorMap[colorName] : null;

  if (classes) {
    return { from: classes.gradientFrom, to: classes.gradientTo };
  }

  // Fallback
  const fallbackColors: ColorName[] = [
    'sapphire', 'emerald', 'amethyst', 'jade', 'topaz',
    'tanzanite', 'ruby', 'morganite', 'peridot', 'rose-quartz'
  ];
  const index = projectId ? projectId % fallbackColors.length : 0;
  const fallback = jewelColorMap[fallbackColors[index]];
  return { from: fallback.gradientFrom, to: fallback.gradientTo };
}

/**
 * Category to Jewel color mapping
 * Use this when assigning colors to categories in the database
 */
export const CATEGORY_JEWEL_COLORS = {
  'AI Agents & Multi-Tool Systems': 'emerald',
  'AI Models & Research': 'tanzanite',
  'Audio & Multimodal': 'rose-quartz',
  'Chatbots & Conversation': 'sapphire',
  'Data & Analytics': 'amethyst',
  'Design (Mockups & UI)': 'morganite',
  'Developer & Coding': 'jade',
  'Games & Interactive': 'ruby',
  'Images & Video': 'topaz',
  'Podcasts & Education': 'peridot',
} as const;

/**
 * Jewel tone hex values for direct use
 */
export const JEWEL_HEX = {
  sapphire: '#0F52BA',
  tanzanite: '#4B0082',
  amethyst: '#5a175d',
  'rose-quartz': '#AA336A',
  emerald: '#046307',
  morganite: '#C46480',
  jade: '#00A86B',
  ruby: '#9B111E',
  topaz: '#E27D12',
  peridot: '#5E8C31',
} as const;
