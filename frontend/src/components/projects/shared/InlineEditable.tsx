/**
 * InlineEditable - Click-to-edit text components for project owners
 *
 * These components enable inline editing of project content directly on the view page.
 * When the user is not an owner, they render as read-only elements.
 *
 * Features:
 * - Click to enter edit mode
 * - Press Enter to save (for single-line), Escape to cancel
 * - Loading indicator during save
 * - Error display on save failure
 * - Visual indicators for editable fields (subtle hover effect)
 */

import { useRef } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { useInlineEditable } from '@/hooks/useInlineEditable';

// ============================================================================
// Shared Sub-components
// ============================================================================

interface SaveIndicatorProps {
  isSaving: boolean;
  error: string | null;
}

function SaveIndicator({ isSaving, error }: SaveIndicatorProps) {
  if (isSaving) {
    return (
      <span className="ml-2 text-xs text-gray-400 animate-pulse">
        Saving...
      </span>
    );
  }
  if (error) {
    return (
      <span className="ml-2 text-xs text-red-500" title={error}>
        Failed to save
      </span>
    );
  }
  return null;
}

// ============================================================================
// InlineEditableTitle - For headings (h1, h2, etc.)
// ============================================================================

interface InlineEditableTitleProps {
  /** Current value */
  value: string;
  /** Whether the field is editable (usually isOwner) */
  isEditable?: boolean;
  /** Callback when value changes */
  onChange: (newValue: string) => Promise<void> | void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Custom className for the display element */
  className?: string;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
  /** Heading level */
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function InlineEditableTitle({
  value,
  isEditable = false,
  onChange,
  placeholder = 'Click to add title...',
  className = '',
  showEditIcon = true,
  as: Component = 'h1',
}: InlineEditableTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isEditing,
    localValue,
    isSaving,
    error,
    setLocalValue,
    startEditing,
    save,
    handleKeyDown,
  } = useInlineEditable({
    value,
    onSave: onChange,
    enterToSave: true,
  });

  // Not editable - render read-only
  if (!isEditable) {
    return (
      <Component className={className}>
        {value || <span className="text-gray-400">{placeholder}</span>}
      </Component>
    );
  }

  // Edit mode
  if (isEditing) {
    // Filter out gradient text classes that make text invisible in inputs
    const editClassName = className
      .replace(/text-transparent/g, '')
      .replace(/bg-clip-text/g, '')
      .replace(/bg-gradient-[\w-]+/g, '')
      .replace(/from-[\w-/]+/g, '')
      .replace(/via-[\w-/]+/g, '')
      .replace(/to-[\w-/]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => save()}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`w-full bg-transparent border-b-2 border-primary-500 focus:outline-none disabled:opacity-50 text-white ${editClassName}`}
          placeholder={placeholder}
          autoFocus
        />
        <SaveIndicator isSaving={isSaving} error={error} />
      </div>
    );
  }

  // Display mode (editable)
  return (
    <Component
      onClick={startEditing}
      className={`group cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEditing();
        }
      }}
    >
      <span className="relative">
        {value || <span className="text-gray-400">{placeholder}</span>}
        {showEditIcon && (
          <PencilIcon className="w-4 h-4 inline-block ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </Component>
  );
}

// ============================================================================
// InlineEditableText - For paragraphs and short text
// ============================================================================

interface InlineEditableTextProps {
  /** Current value */
  value: string;
  /** Whether the field is editable (usually isOwner) */
  isEditable?: boolean;
  /** Callback when value changes */
  onChange: (newValue: string) => Promise<void> | void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Custom className for the display element */
  className?: string;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
  /** Whether to use a textarea for multi-line input */
  multiline?: boolean;
  /** Number of rows for textarea */
  rows?: number;
}

export function InlineEditableText({
  value,
  isEditable = false,
  onChange,
  placeholder = 'Click to add text...',
  className = '',
  showEditIcon = true,
  multiline = false,
  rows = 3,
}: InlineEditableTextProps) {
  const singleLineRef = useRef<HTMLInputElement>(null);
  const multiLineRef = useRef<HTMLTextAreaElement>(null);

  const {
    isEditing,
    localValue,
    isSaving,
    error,
    setLocalValue,
    startEditing,
    save,
    handleKeyDown,
  } = useInlineEditable({
    value,
    onSave: onChange,
    enterToSave: !multiline, // Enter saves for single-line only
  });

  // Not editable - render read-only
  if (!isEditable) {
    return (
      <p className={className}>
        {value || <span className="text-gray-400">{placeholder}</span>}
      </p>
    );
  }

  // Edit mode
  if (isEditing) {
    // Filter out gradient text classes that make text invisible in inputs
    const editClassName = className
      .replace(/text-transparent/g, '')
      .replace(/bg-clip-text/g, '')
      .replace(/bg-gradient-[\w-]+/g, '')
      .replace(/from-[\w-/]+/g, '')
      .replace(/via-[\w-/]+/g, '')
      .replace(/to-[\w-/]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (multiline) {
      return (
        <div className="relative">
          <textarea
            ref={multiLineRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => save()}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className={`w-full bg-transparent border-2 border-primary-500 rounded-lg p-2 focus:outline-none resize-none disabled:opacity-50 text-white ${editClassName}`}
            placeholder={placeholder}
            rows={rows}
            autoFocus
          />
          <SaveIndicator isSaving={isSaving} error={error} />
        </div>
      );
    }

    return (
      <div className="relative">
        <input
          ref={singleLineRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => save()}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`w-full bg-transparent border-b-2 border-primary-500 focus:outline-none disabled:opacity-50 text-white ${editClassName}`}
          placeholder={placeholder}
          autoFocus
        />
        <SaveIndicator isSaving={isSaving} error={error} />
      </div>
    );
  }

  // Display mode (editable)
  return (
    <p
      onClick={startEditing}
      className={`group cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors min-h-[2em] ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEditing();
        }
      }}
    >
      <span className="relative">
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
        {showEditIcon && (
          <PencilIcon className="w-4 h-4 inline-block ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </p>
  );
}

// ============================================================================
// EditModeIndicator - Toggle between Edit and Published view modes
// ============================================================================

interface EditModeIndicatorProps {
  isOwner: boolean;
  isEditMode: boolean;
  onToggle: () => void;
  isSaving?: boolean;
}

export function EditModeIndicator({ isOwner, isEditMode, onToggle, isSaving }: EditModeIndicatorProps) {
  if (!isOwner) return null;

  return (
    <button
      onClick={onToggle}
      disabled={isSaving}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium rounded-full shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all group disabled:opacity-75"
    >
      {/* Toggle Switch */}
      <div className="relative w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors">
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 ${
            isEditMode
              ? 'left-6 bg-primary-500'
              : 'left-0.5 bg-green-500 dark:bg-green-400'
          }`}
        />
      </div>

      {/* Label */}
      <span className="min-w-[80px]">
        {isSaving ? (
          <span className="flex items-center gap-1.5 text-gray-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </span>
        ) : isEditMode ? (
          <span className="flex items-center gap-1.5">
            <PencilIcon className="w-4 h-4 text-primary-500" />
            Editing
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Published
          </span>
        )}
      </span>
    </button>
  );
}
