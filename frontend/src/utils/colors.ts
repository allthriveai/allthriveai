/**
 * Color utilities for converting Tailwind CSS color names to hex values
 */

// Default colors for fallback
export const DEFAULT_QUEST_COLORS = { colorFrom: '#22d3ee', colorTo: '#4ade80' };

// Tailwind color to hex mapping
const tailwindToHex: Record<string, string> = {
  // Cyan
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  // Teal
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  // Green
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  // Blue
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  // Purple
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  // Pink
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  // Orange
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  // Red
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  // Gray
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  // Yellow
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'gold-500': '#eab308', // alias for yellow
};

/**
 * Convert Tailwind color name to hex value
 * If the color is already a hex value, returns it as-is
 * @param color Tailwind color name (e.g., 'blue-500') or hex value (e.g., '#3b82f6')
 * @returns Hex color value
 */
export function tailwindColorToHex(color: string | undefined | null): string {
  if (!color) return DEFAULT_QUEST_COLORS.colorFrom;
  if (color.startsWith('#')) return color;
  return tailwindToHex[color] || DEFAULT_QUEST_COLORS.colorFrom;
}

/**
 * Convert quest colors from Tailwind to hex
 * @param colorFrom Tailwind color name for gradient start
 * @param colorTo Tailwind color name for gradient end
 * @returns Object with hex color values
 */
export function convertQuestColors(
  colorFrom: string | undefined | null,
  colorTo: string | undefined | null
): { colorFrom: string; colorTo: string } {
  return {
    colorFrom: tailwindColorToHex(colorFrom),
    colorTo: tailwindColorToHex(colorTo) || tailwindColorToHex(colorFrom),
  };
}
