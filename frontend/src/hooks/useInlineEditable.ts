/**
 * useInlineEditable - Shared hook for click-to-edit functionality
 *
 * Handles:
 * - Edit mode toggling
 * - Local value state management
 * - Save/cancel operations with keyboard support
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInlineEditableOptions {
  /** Initial value */
  value: string;
  /** Callback when value is saved */
  onSave: (newValue: string) => Promise<void> | void;
  /** Whether Enter key saves (false for multiline) */
  enterToSave?: boolean;
}

interface UseInlineEditableReturn {
  /** Whether currently in edit mode */
  isEditing: boolean;
  /** Current local value (may differ from saved value during editing) */
  localValue: string;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Error message if save failed */
  error: string | null;
  /** Update the local value */
  setLocalValue: (value: string) => void;
  /** Enter edit mode */
  startEditing: () => void;
  /** Save changes and exit edit mode */
  save: () => Promise<void>;
  /** Cancel changes and exit edit mode */
  cancel: () => void;
  /** Keyboard handler for input elements */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Ref for the input element (for auto-focus) */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function useInlineEditable({
  value,
  onSave,
  enterToSave = true,
}: UseInlineEditableOptions): UseInlineEditableReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync local value when prop changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setError(null);
    setIsEditing(true);
  }, []);

  const save = useCallback(async () => {
    if (localValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(localValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      // Keep editing mode open on error
    } finally {
      setIsSaving(false);
    }
  }, [localValue, value, onSave]);

  const cancel = useCallback(() => {
    setLocalValue(value);
    setError(null);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (enterToSave && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
    },
    [cancel, save, enterToSave]
  );

  return {
    isEditing,
    localValue,
    isSaving,
    error,
    setLocalValue,
    startEditing,
    save,
    cancel,
    handleKeyDown,
    inputRef,
  };
}
