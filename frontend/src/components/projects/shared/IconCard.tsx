/**
 * IconCard - Reusable card component with icon, title, and description
 *
 * Used in the Features section and other places where we need icon cards.
 * Supports both display mode (read-only) and edit mode (inline editing).
 *
 * Features:
 * - FontAwesome icon support with icon picker
 * - Emoji icon support
 * - Inline text editing for title/description
 * - Drag handle for reordering (when editing)
 * - Delete button (when editing)
 * - Beautiful hover effects in display mode
 */

import { useState, useRef, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import * as FaIcons from 'react-icons/fa';
import { IconPicker } from '@/components/editor/IconPicker';

// ============================================================================
// Types
// ============================================================================

export interface IconCardData {
  icon: string;
  title: string;
  description: string;
}

interface IconCardProps {
  /** The card data */
  data: IconCardData;
  /** Whether the card is in edit mode */
  isEditing?: boolean;
  /** Callback when data changes (edit mode only) */
  onChange?: (data: IconCardData) => void;
  /** Callback when delete is clicked (edit mode only) */
  onDelete?: () => void;
  /** Drag handle props from dnd-kit (edit mode only) */
  dragHandleProps?: Record<string, unknown>;
  /** Whether the card is being dragged */
  isDragging?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string is an emoji
 */
function isEmoji(str: string): boolean {
  if (!str) return false;
  return /^\p{Emoji}/u.test(str);
}

/**
 * Render a FontAwesome icon by name
 */
function renderFaIcon(iconName: string, className: string = 'w-6 h-6') {
  const Icon = (FaIcons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  if (!Icon) return null;
  return <Icon className={className} />;
}

// ============================================================================
// Display Mode Component
// ============================================================================

function IconCardDisplay({ data }: { data: IconCardData }) {
  const { icon, title, description } = data;
  const iconIsEmoji = isEmoji(icon);

  return (
    <div className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Icon */}
      <div className="mb-4">
        {iconIsEmoji ? (
          <span className="text-4xl" role="img" aria-label={title}>
            {icon}
          </span>
        ) : icon ? (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
            {renderFaIcon(icon, 'w-6 h-6 text-primary-600 dark:text-primary-400')}
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <PencilIcon className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title || 'Untitled'}
      </h4>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {description || 'No description'}
      </p>

      {/* Hover Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ============================================================================
// Edit Mode Component
// ============================================================================

interface IconCardEditProps {
  data: IconCardData;
  onChange: (data: IconCardData) => void;
  onDelete?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

function IconCardEdit({
  data,
  onChange,
  onDelete,
  dragHandleProps,
  isDragging,
}: IconCardEditProps) {
  const { icon, title, description } = data;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state with props
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  const handleTitleBlur = () => {
    if (localTitle !== title) {
      onChange({ ...data, title: localTitle });
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== description) {
      onChange({ ...data, description: localDescription });
    }
  };

  const handleIconSelect = (iconName: string) => {
    onChange({ ...data, icon: iconName });
    setShowIconPicker(false);
  };

  const iconIsEmoji = isEmoji(icon);

  return (
    <>
      <div
        className={`group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border-2 border-dashed transition-all ${
          isDragging
            ? 'border-primary-500 shadow-lg scale-[1.02] opacity-90'
            : 'border-primary-300 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600'
        }`}
      >
        {/* Drag Handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing border border-gray-200 dark:border-gray-700"
          >
            <Bars3Icon className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-900 shadow-sm"
            title="Delete"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}

        {/* Editable Icon */}
        <button
          onClick={() => setShowIconPicker(true)}
          className="mb-4 group/icon"
        >
          {iconIsEmoji ? (
            <span className="text-4xl block hover:scale-110 transition-transform">
              {icon}
            </span>
          ) : icon ? (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center hover:ring-2 hover:ring-primary-500 transition-all">
              {renderFaIcon(icon, 'w-6 h-6 text-primary-600 dark:text-primary-400')}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:ring-2 hover:ring-primary-500 transition-all">
              <PencilIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <span className="text-xs text-gray-400 mt-1 opacity-0 group-hover/icon:opacity-100 transition-opacity">
            Click to change
          </span>
        </button>

        {/* Editable Title */}
        <input
          ref={titleInputRef}
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTitleBlur();
              descriptionInputRef.current?.focus();
            }
          }}
          className="w-full text-lg font-semibold bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 mb-2"
          placeholder="Feature title..."
        />

        {/* Editable Description */}
        <textarea
          ref={descriptionInputRef}
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-600 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 resize-none leading-relaxed"
          placeholder="Describe this feature..."
          rows={2}
        />
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <IconPicker
          selectedIcon={icon}
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function IconCard({
  data,
  isEditing = false,
  onChange,
  onDelete,
  dragHandleProps,
  isDragging,
}: IconCardProps) {
  if (isEditing && onChange) {
    return (
      <IconCardEdit
        data={data}
        onChange={onChange}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
      />
    );
  }

  return <IconCardDisplay data={data} />;
}

// ============================================================================
// Default Export for convenience
// ============================================================================

export default IconCard;
