/**
 * IconCard - Reusable card component with icon, title, and description
 *
 * Used in the Features section, icon_card blocks, and other places where we need icon cards.
 * Supports both display mode (read-only) and edit mode (inline editing).
 *
 * Features:
 * - FontAwesome icon support with icon picker (all solid + brand icons)
 * - Emoji icon support
 * - Inline text editing for title/description
 * - Drag handle for reordering (when editing)
 * - Delete button (when editing)
 * - Beautiful hover effects in display mode
 *
 * Icon format: "fas:star", "fab:github" (new format) or "FaRocket" (legacy support)
 */

import { useState, useRef, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { IconPicker, parseIconString } from '@/components/editor/IconPicker';

// Register all FontAwesome icons
library.add(fas, fab);

// ============================================================================
// Constants
// ============================================================================

const ICON_CONTAINER_CLASSES = 'flex items-center justify-center w-16 h-16 mb-4 rounded-xl bg-primary-50 dark:bg-primary-900/20';
const ICON_TEXT_CLASSES = 'text-3xl text-primary-600 dark:text-primary-400';
const ICON_EMOJI_CLASSES = 'text-3xl';
const ICON_PLACEHOLDER_CLASSES = 'w-6 h-6 text-gray-400';
const DRAG_HANDLE_CLASSES = 'absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing border border-gray-200 dark:border-gray-700';
const DELETE_BUTTON_CLASSES = 'absolute -top-2 -right-2 p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-900 shadow-sm';

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
  /** Variant for different layouts */
  variant?: 'default' | 'compact';
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
 * Render a FontAwesome icon from icon string
 */
function renderIcon(iconStr: string, className: string = 'w-6 h-6') {
  if (!iconStr) return null;

  const { prefix, name } = parseIconString(iconStr);

  try {
    return (
      <FontAwesomeIcon
        icon={[prefix, name]}
        className={className}
      />
    );
  } catch {
    // Icon not found
    return null;
  }
}

/**
 * IconDisplay - Reusable component to render icon (emoji or FontAwesome)
 */
function IconDisplay({ icon, title, className }: { icon: string; title?: string; className?: string }) {
  const iconIsEmoji = isEmoji(icon);

  if (iconIsEmoji) {
    return (
      <span className={className || ICON_EMOJI_CLASSES} role="img" aria-label={title}>
        {icon}
      </span>
    );
  }

  if (icon) {
    return renderIcon(icon, className || ICON_TEXT_CLASSES);
  }

  return <PencilIcon className={ICON_PLACEHOLDER_CLASSES} />;
}

// ============================================================================
// Display Mode Component
// ============================================================================

function IconCardDisplay({ data, variant = 'default' }: { data: IconCardData; variant?: 'default' | 'compact' }) {
  const { icon, title, description } = data;

  if (variant === 'compact') {
    // Compact variant - just icon and text, centered
    return (
      <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Icon */}
        <div className={ICON_CONTAINER_CLASSES}>
          <IconDisplay icon={icon} title={title} />
        </div>

        {/* Text */}
        <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          {title || description || 'No text'}
        </p>
      </div>
    );
  }

  // Default variant - full card with centered icon, title and description
  return (
    <div className="group relative flex flex-col items-center bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Icon - Centered */}
      <div className={ICON_CONTAINER_CLASSES}>
        <IconDisplay icon={icon} title={title} />
      </div>

      {/* Title - Centered with text wrap */}
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors break-words w-full">
        {title || 'Untitled'}
      </h4>

      {/* Description - Centered with text wrap */}
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed text-center break-words w-full">
        {description || 'No description'}
      </p>

      {/* Hover Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ============================================================================
// Shared Edit Mode Components
// ============================================================================

/** Drag handle for reordering cards */
function DragHandle({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  if (!dragHandleProps) return null;

  return (
    <div {...dragHandleProps} className={DRAG_HANDLE_CLASSES}>
      <Bars3Icon className="w-4 h-4 text-gray-400" />
    </div>
  );
}

/** Delete button for removing cards */
function DeleteButton({ onDelete }: { onDelete?: () => void }) {
  if (!onDelete) return null;

  return (
    <button
      onClick={onDelete}
      className={DELETE_BUTTON_CLASSES}
      title="Delete"
    >
      <XMarkIcon className="w-4 h-4" />
    </button>
  );
}

/** Editable icon button with picker */
function EditableIcon({
  icon,
  onIconClick,
}: {
  icon: string;
  onIconClick: () => void;
}) {
  return (
    <button
      onClick={onIconClick}
      className="flex items-center justify-center w-16 h-16 mb-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:ring-2 hover:ring-primary-500 transition-all cursor-pointer"
      title="Click to change icon"
    >
      <IconDisplay icon={icon} />
    </button>
  );
}

/** Editable text input for icon card */
function EditableInput({
  inputRef,
  value,
  onChange,
  onBlur,
  onEnter,
  placeholder,
  className,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter?: () => void;
  placeholder: string;
  className: string;
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      className={className}
      placeholder={placeholder}
    />
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
  variant?: 'default' | 'compact';
}

function IconCardEdit({
  data,
  onChange,
  onDelete,
  dragHandleProps,
  isDragging,
  variant = 'default',
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

  // Reusable IconPicker modal
  const iconPickerModal = showIconPicker && (
    <IconPicker
      selectedIcon={icon}
      onSelect={handleIconSelect}
      onClose={() => setShowIconPicker(false)}
    />
  );

  if (variant === 'compact') {
    // Compact variant - just icon and single text field
    return (
      <>
        <div
          className={`group relative flex flex-col items-center p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed transition-all ${
            isDragging
              ? 'border-primary-500 shadow-lg scale-[1.02] opacity-90'
              : 'border-primary-300 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600'
          }`}
        >
          <DragHandle dragHandleProps={dragHandleProps} />
          <DeleteButton onDelete={onDelete} />
          <EditableIcon icon={icon} onIconClick={() => setShowIconPicker(true)} />

          {/* Editable Text */}
          <EditableInput
            inputRef={titleInputRef}
            value={localTitle}
            onChange={setLocalTitle}
            onBlur={handleTitleBlur}
            onEnter={handleTitleBlur}
            placeholder="Add text..."
            className="w-full text-center text-sm font-medium bg-transparent border-none outline-none focus:ring-0 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        {iconPickerModal}
      </>
    );
  }

  // Default variant - full card with centered icon, title and description
  return (
    <>
      <div
        className={`group relative flex flex-col items-center bg-white dark:bg-gray-800/50 rounded-xl p-6 border-2 border-dashed transition-all ${
          isDragging
            ? 'border-primary-500 shadow-lg scale-[1.02] opacity-90'
            : 'border-primary-300 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-600'
        }`}
      >
        <DragHandle dragHandleProps={dragHandleProps} />
        <DeleteButton onDelete={onDelete} />
        <EditableIcon icon={icon} onIconClick={() => setShowIconPicker(true)} />

        {/* Editable Title - Centered */}
        <EditableInput
          inputRef={titleInputRef}
          value={localTitle}
          onChange={setLocalTitle}
          onBlur={handleTitleBlur}
          onEnter={() => {
            handleTitleBlur();
            descriptionInputRef.current?.focus();
          }}
          placeholder="Feature title..."
          className="w-full text-lg font-semibold text-center bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 mb-2"
        />

        {/* Editable Description - Centered */}
        <textarea
          ref={descriptionInputRef}
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          className="w-full text-sm text-center bg-transparent border-none outline-none focus:ring-0 text-gray-600 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 resize-none leading-relaxed"
          placeholder="Describe this feature..."
          rows={2}
        />
      </div>
      {iconPickerModal}
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
  variant = 'default',
}: IconCardProps) {
  if (isEditing && onChange) {
    return (
      <IconCardEdit
        data={data}
        onChange={onChange}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        variant={variant}
      />
    );
  }

  return <IconCardDisplay data={data} variant={variant} />;
}

// ============================================================================
// Default Export for convenience
// ============================================================================

export default IconCard;
