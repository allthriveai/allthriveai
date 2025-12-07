/**
 * SectionTypePicker - Modal for selecting a section type to add
 *
 * Displays a grid of available section types with:
 * - Icon and title for each type
 * - Brief description of what the section contains
 * - Click to select and create
 *
 * Uses keyboard navigation and focus trapping for accessibility.
 */

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  DocumentTextIcon,
  SparklesIcon,
  CodeBracketIcon,
  PhotoIcon,
  CubeTransparentIcon,
  PlayCircleIcon,
  LightBulbIcon,
  LinkIcon,
  PlusCircleIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline';
import type { SectionType } from '@/types/sections';

// ============================================================================
// Section Type Data
// ============================================================================

interface SectionTypeOption {
  type: SectionType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'primary' | 'secondary';
}

const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  {
    type: 'overview',
    title: 'Overview',
    description: 'Quick summary with headline and key metrics',
    icon: DocumentTextIcon,
    category: 'primary',
  },
  {
    type: 'features',
    title: 'Key Features',
    description: 'Icon cards highlighting what makes this special',
    icon: SparklesIcon,
    category: 'primary',
  },
  {
    type: 'tech_stack',
    title: 'Tech Stack',
    description: 'Technologies and tools organized by category',
    icon: CodeBracketIcon,
    category: 'primary',
  },
  {
    type: 'gallery',
    title: 'Gallery',
    description: 'Screenshots and visual demos in various layouts',
    icon: PhotoIcon,
    category: 'primary',
  },
  {
    type: 'demo',
    title: 'Demo',
    description: 'Video walkthrough or link to live demo',
    icon: PlayCircleIcon,
    category: 'secondary',
  },
  {
    type: 'architecture',
    title: 'Architecture',
    description: 'System design diagram with Mermaid',
    icon: CubeTransparentIcon,
    category: 'secondary',
  },
  {
    type: 'challenges',
    title: 'Challenges & Solutions',
    description: 'Problems faced and how you solved them',
    icon: LightBulbIcon,
    category: 'secondary',
  },
  {
    type: 'links',
    title: 'Resources',
    description: 'Documentation, blog posts, and related links',
    icon: LinkIcon,
    category: 'secondary',
  },
  {
    type: 'slideup',
    title: 'Slide Up',
    description: 'Two-part interactive display with reveal animation',
    icon: ArrowUpIcon,
    category: 'secondary',
  },
  {
    type: 'custom',
    title: 'Custom Section',
    description: 'Free-form content with blocks',
    icon: PlusCircleIcon,
    category: 'secondary',
  },
];

// ============================================================================
// Props
// ============================================================================

interface SectionTypePickerProps {
  onSelect: (type: SectionType) => void;
  onClose: () => void;
  excludeTypes?: SectionType[];
}

// ============================================================================
// Main Component
// ============================================================================

export function SectionTypePicker({
  onSelect,
  onClose,
  excludeTypes = [],
}: SectionTypePickerProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Filter out excluded types
  const availableTypes = SECTION_TYPE_OPTIONS.filter(
    (option) => !excludeTypes.includes(option.type)
  );

  // Separate by category
  const primaryTypes = availableTypes.filter((t) => t.category === 'primary');
  const secondaryTypes = availableTypes.filter((t) => t.category === 'secondary');

  // Focus first button on mount
  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Render a section type button
  const renderTypeButton = (
    option: SectionTypeOption,
    _index: number,
    isFirst: boolean
  ) => {
    const IconComponent = option.icon;
    return (
      <button
        key={option.type}
        ref={isFirst ? firstButtonRef : null}
        onClick={() => onSelect(option.type)}
        className="flex items-start gap-4 p-4 text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center transition-colors">
          <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
            {option.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {option.description}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-picker-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2
              id="section-picker-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              Add Section
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Choose a section type to add to your project
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Primary Sections */}
          {primaryTypes.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Essential Sections
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {primaryTypes.map((option, index) =>
                  renderTypeButton(option, index, index === 0)
                )}
              </div>
            </div>
          )}

          {/* Secondary Sections */}
          {secondaryTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Additional Sections
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {secondaryTypes.map((option, index) =>
                  renderTypeButton(
                    option,
                    index,
                    primaryTypes.length === 0 && index === 0
                  )
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {availableTypes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                All section types have been added to this project.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            You can reorder, hide, or delete sections after adding them
          </p>
        </div>
      </div>
    </div>
  );
}

export default SectionTypePicker;
