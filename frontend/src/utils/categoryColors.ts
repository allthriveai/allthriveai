/**
 * Utility functions for category color management
 * Ocean-inspired color palette (greens and blues)
 */

type ColorName =
  | 'teal' | 'cyan' | 'blue' | 'sky' | 'emerald'
  | 'green' | 'lime' | 'mint' | 'turquoise' | 'aqua'
  | 'slate' | 'indigo' | 'ocean';

interface ColorClasses {
  bg: string;
  bgHover: string;
  text: string;
  bgSelected: string;
  textSelected: string;
  bgDark: string;
  textDark: string;
}

/**
 * Maps color name to Tailwind color classes for category pills
 * Ocean color palette: blues, teals, cyans, and greens
 */
const colorMap: Record<ColorName, ColorClasses> = {
  // Deep ocean blues
  blue: {
    bg: 'bg-blue-100',
    bgHover: 'hover:bg-blue-200',
    text: 'text-blue-700',
    bgSelected: 'bg-blue-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-blue-900/30',
    textDark: 'dark:text-blue-300',
  },
  indigo: {
    bg: 'bg-indigo-100',
    bgHover: 'hover:bg-indigo-200',
    text: 'text-indigo-700',
    bgSelected: 'bg-indigo-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-indigo-900/30',
    textDark: 'dark:text-indigo-300',
  },
  sky: {
    bg: 'bg-sky-100',
    bgHover: 'hover:bg-sky-200',
    text: 'text-sky-700',
    bgSelected: 'bg-sky-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-sky-900/30',
    textDark: 'dark:text-sky-300',
  },
  // Tropical waters
  cyan: {
    bg: 'bg-cyan-100',
    bgHover: 'hover:bg-cyan-200',
    text: 'text-cyan-700',
    bgSelected: 'bg-cyan-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-cyan-900/30',
    textDark: 'dark:text-cyan-300',
  },
  teal: {
    bg: 'bg-teal-100',
    bgHover: 'hover:bg-teal-200',
    text: 'text-teal-700',
    bgSelected: 'bg-teal-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-teal-900/30',
    textDark: 'dark:text-teal-300',
  },
  turquoise: {
    bg: 'bg-cyan-50',
    bgHover: 'hover:bg-cyan-100',
    text: 'text-cyan-600',
    bgSelected: 'bg-cyan-400',
    textSelected: 'text-white',
    bgDark: 'dark:bg-cyan-800/30',
    textDark: 'dark:text-cyan-200',
  },
  aqua: {
    bg: 'bg-teal-50',
    bgHover: 'hover:bg-teal-100',
    text: 'text-teal-600',
    bgSelected: 'bg-teal-400',
    textSelected: 'text-white',
    bgDark: 'dark:bg-teal-800/30',
    textDark: 'dark:text-teal-200',
  },
  // Ocean greens and kelp
  emerald: {
    bg: 'bg-emerald-100',
    bgHover: 'hover:bg-emerald-200',
    text: 'text-emerald-700',
    bgSelected: 'bg-emerald-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-emerald-900/30',
    textDark: 'dark:text-emerald-300',
  },
  green: {
    bg: 'bg-green-100',
    bgHover: 'hover:bg-green-200',
    text: 'text-green-700',
    bgSelected: 'bg-green-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-green-900/30',
    textDark: 'dark:text-green-300',
  },
  lime: {
    bg: 'bg-lime-100',
    bgHover: 'hover:bg-lime-200',
    text: 'text-lime-700',
    bgSelected: 'bg-lime-600',
    textSelected: 'text-white',
    bgDark: 'dark:bg-lime-900/30',
    textDark: 'dark:text-lime-300',
  },
  mint: {
    bg: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    text: 'text-emerald-600',
    bgSelected: 'bg-emerald-400',
    textSelected: 'text-white',
    bgDark: 'dark:bg-emerald-800/30',
    textDark: 'dark:text-emerald-200',
  },
  // Deep sea and neutral
  ocean: {
    bg: 'bg-blue-50',
    bgHover: 'hover:bg-blue-100',
    text: 'text-blue-600',
    bgSelected: 'bg-blue-600',
    textSelected: 'text-white',
    bgDark: 'dark:bg-blue-950/30',
    textDark: 'dark:text-blue-200',
  },
  slate: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-700',
    bgSelected: 'bg-slate-500',
    textSelected: 'text-white',
    bgDark: 'dark:bg-slate-900/30',
    textDark: 'dark:text-slate-300',
  },
};

/**
 * Get Tailwind color classes for a category
 * @param color - The color name from the backend (e.g., 'blue', 'teal')
 * @param isSelected - Whether the category is currently selected
 * @returns Object with Tailwind classes for background, text, and hover states
 */
export function getCategoryColorClasses(color?: string, isSelected: boolean = false) {
  const colorName = (color as ColorName) || 'teal'; // default to teal if no color
  const classes = colorMap[colorName] || colorMap.teal;

  if (isSelected) {
    return {
      background: `${classes.bgSelected} ${classes.textSelected} shadow-sm`,
      hover: '',
    };
  }

  return {
    background: `${classes.bg} ${classes.bgDark} ${classes.text} ${classes.textDark}`,
    hover: `${classes.bgHover} dark:hover:bg-${colorName}-800/50`,
  };
}

/**
 * Get inline style object for dynamic color classes
 * Useful when Tailwind's JIT compiler needs help with dynamic values
 */
export function getCategoryColorStyle(color?: string, isSelected: boolean = false) {
  // This is a backup for cases where Tailwind classes don't work
  // The class-based approach should be preferred
  return {};
}
