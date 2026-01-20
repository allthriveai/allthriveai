/**
 * QuickSelect - Tappable pill buttons for quick selection
 * US-007: QuickSelect renders tappable pill buttons
 *
 * Features:
 * - Renders options as tappable pill buttons
 * - Supports single-select and multi-select modes
 * - Multi-select mode shows 'Continue' button when items selected
 * - Pills wrap to multiple lines on mobile
 */

import { useCallback, useMemo } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export interface QuickSelectOption {
  /**
   * Unique identifier for the option
   */
  id: string;
  /**
   * Display label for the pill
   */
  label: string;
  /**
   * Optional description (shown on hover or below label)
   */
  description?: string;
}

interface QuickSelectProps {
  /**
   * Available options to select from
   */
  options: QuickSelectOption[];
  /**
   * Currently selected option IDs
   */
  selected: string[];
  /**
   * Callback when selection changes
   */
  onSelect: (selected: string[]) => void;
  /**
   * Whether multiple options can be selected
   * @default false
   */
  multiple?: boolean;
  /**
   * Callback when Continue button is clicked (multi-select mode only)
   */
  onContinue?: () => void;
  /**
   * Custom label for the Continue button
   * @default "Continue"
   */
  continueLabel?: string;
  /**
   * Whether the component is disabled
   * @default false
   */
  disabled?: boolean;
  /**
   * Optional CSS class name
   */
  className?: string;
}

export function QuickSelect({
  options,
  selected,
  onSelect,
  multiple = false,
  onContinue,
  continueLabel = 'Continue',
  disabled = false,
  className = '',
}: QuickSelectProps) {
  // Handle option click
  const handleOptionClick = useCallback(
    (optionId: string) => {
      if (disabled) return;

      if (multiple) {
        // Multi-select: toggle the option
        const newSelected = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId];
        onSelect(newSelected);
      } else {
        // Single-select: select only this option
        onSelect([optionId]);
      }
    },
    [disabled, multiple, selected, onSelect]
  );

  // Show continue button in multi-select mode when items are selected
  const showContinue = useMemo(
    () => multiple && selected.length > 0 && onContinue,
    [multiple, selected.length, onContinue]
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Pills container - wraps to multiple lines */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={multiple ? 'Select multiple options' : 'Select an option'}
      >
        {options.map((option) => {
          const isSelected = selected.includes(option.id);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleOptionClick(option.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={option.description ? `${option.label}: ${option.description}` : option.label}
              title={option.description}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                }
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Continue button for multi-select mode */}
      {showContinue && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {continueLabel}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
