/**
 * IconPicker - Modal for selecting FontAwesome icons
 *
 * Features:
 * - All FontAwesome solid and brand icons
 * - Category tabs (All, Solid, Brands)
 * - Searchable icon grid
 * - Icon format: "fas:star" or "fab:github"
 */

import { useState, useMemo, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library, findIconDefinition } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import type { IconName, IconPrefix } from '@fortawesome/fontawesome-svg-core';

// Register all FontAwesome icons
library.add(fas, fab);

// CSS class constants
const BUTTON_ACTIVE_CLASSES = 'bg-primary-500 text-white';
const BUTTON_INACTIVE_CLASSES = 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600';

type IconCategory = 'all' | 'solid' | 'brands';

// Get all available icons from the library - cached for performance
let cachedIcons: Array<{ prefix: IconPrefix; name: IconName }> | null = null;

function getAllIcons(): Array<{ prefix: IconPrefix; name: IconName }> {
  if (cachedIcons) return cachedIcons;

  const icons: Array<{ prefix: IconPrefix; name: IconName }> = [];

  // Add solid icons
  Object.keys(fas).forEach((key) => {
    if (key !== 'prefix' && key !== 'fas') {
      const iconName = key.replace(/^fa/, '').replace(/([A-Z])/g, '-$1').toLowerCase().slice(1) as IconName;
      if (findIconDefinition({ prefix: 'fas', iconName })) {
        icons.push({ prefix: 'fas', name: iconName });
      }
    }
  });

  // Add brand icons
  Object.keys(fab).forEach((key) => {
    if (key !== 'prefix' && key !== 'fab') {
      const iconName = key.replace(/^fa/, '').replace(/([A-Z])/g, '-$1').toLowerCase().slice(1) as IconName;
      if (findIconDefinition({ prefix: 'fab', iconName })) {
        icons.push({ prefix: 'fab', name: iconName });
      }
    }
  });

  // Sort alphabetically by name
  icons.sort((a, b) => a.name.localeCompare(b.name));

  cachedIcons = icons;
  return icons;
}

/**
 * Parse icon string to prefix and name
 * Supports formats: "fas:star", "fab:github", "FaRocket" (legacy)
 */
export function parseIconString(iconStr: string): { prefix: IconPrefix; name: IconName } {
  if (!iconStr) return { prefix: 'fas', name: 'star' };

  // New format: "fas:star" or "fab:github"
  if (iconStr.includes(':')) {
    const [prefix, name] = iconStr.split(':');
    return {
      prefix: (prefix || 'fas') as IconPrefix,
      name: (name || 'star') as IconName,
    };
  }

  // Legacy format: "FaRocket" -> "fas:rocket"
  if (iconStr.startsWith('Fa')) {
    const name = iconStr
      .replace(/^Fa/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .slice(1) as IconName;
    return { prefix: 'fas', name };
  }

  // Assume it's just the name
  return { prefix: 'fas', name: iconStr as IconName };
}

/**
 * Format icon to string for storage
 */
export function formatIconString(prefix: IconPrefix, name: IconName): string {
  return `${prefix}:${name}`;
}

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ selectedIcon, onSelect, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<IconCategory>('all');

  // Parse selected icon
  const currentIcon = useMemo(() => parseIconString(selectedIcon || ''), [selectedIcon]);

  // Get all icons once
  const allIcons = useMemo(() => getAllIcons(), []);

  // Count icons by category
  const iconCounts = useMemo(() => ({
    all: allIcons.length,
    solid: allIcons.filter((i) => i.prefix === 'fas').length,
    brands: allIcons.filter((i) => i.prefix === 'fab').length,
  }), [allIcons]);

  // Get filtered icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons = allIcons;

    // Filter by category
    if (category === 'solid') {
      icons = icons.filter((i) => i.prefix === 'fas');
    } else if (category === 'brands') {
      icons = icons.filter((i) => i.prefix === 'fab');
    }

    // Filter by search query
    if (search.trim()) {
      const query = search.toLowerCase();
      icons = icons.filter((icon) => icon.name.includes(query));
    }

    return icons;
  }, [allIcons, search, category]);

  const handleSelect = useCallback(
    (prefix: IconPrefix, name: IconName) => {
      onSelect(formatIconString(prefix, name));
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Choose an Icon</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons... (e.g., star, github, arrow)"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
          <button
            onClick={() => setCategory('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              category === 'all' ? BUTTON_ACTIVE_CLASSES : BUTTON_INACTIVE_CLASSES
            }`}
          >
            All ({iconCounts.all})
          </button>
          <button
            onClick={() => setCategory('solid')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              category === 'solid' ? BUTTON_ACTIVE_CLASSES : BUTTON_INACTIVE_CLASSES
            }`}
          >
            Solid ({iconCounts.solid})
          </button>
          <button
            onClick={() => setCategory('brands')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              category === 'brands' ? BUTTON_ACTIVE_CLASSES : BUTTON_INACTIVE_CLASSES
            }`}
          >
            Brands ({iconCounts.brands})
          </button>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredIcons.length > 0 ? (
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
              {filteredIcons.map((icon) => {
                const isSelected =
                  currentIcon.prefix === icon.prefix && currentIcon.name === icon.name;
                return (
                  <button
                    key={`${icon.prefix}:${icon.name}`}
                    onClick={() => handleSelect(icon.prefix, icon.name)}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400'
                    }`}
                    title={`${icon.name} (${icon.prefix === 'fab' ? 'brand' : 'solid'})`}
                  >
                    <FontAwesomeIcon icon={[icon.prefix, icon.name]} className="text-lg" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No icons found matching "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={() => {
              onSelect('');
              onClose();
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Remove icon
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredIcons.length} icons
            {search && ` matching "${search}"`}
          </p>
        </div>
      </div>
    </div>
  );
}
