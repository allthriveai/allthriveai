/**
 * PromptEditor Component
 *
 * Text area for writing creative prompts during battle.
 * Features character count, validation, and submit button.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { useBattleTimer } from '@/hooks/useBattleTimer';

interface PromptEditorProps {
  onSubmit: (prompt: string) => void;
  onTyping?: (isTyping: boolean) => void;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  timeRemaining?: number | null;
  /** Key that changes when timer should be reset (e.g., after challenge refresh) */
  timerResetKey?: number;
}

export function PromptEditor({
  onSubmit,
  onTyping,
  minLength = 10,
  maxLength = 2000,
  disabled = false,
  placeholder = "Engineer your winning prompt! Be specific: describe the subject, art style (e.g. watercolor, 3D render), mood, lighting, composition, and camera angle. Detailed prompts score higher!",
  timeRemaining: serverTimeRemaining,
  timerResetKey,
}: PromptEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Use centralized timer hook for consistent countdown behavior
  const {
    timeRemaining: localTimeRemaining,
    formattedTime,
    isWarning,
    isCritical,
  } = useBattleTimer({
    serverTimeRemaining,
    isActive: !disabled,
    resetKey: timerResetKey,
  });

  const charCount = prompt.length;
  const isValid = charCount >= minLength && charCount <= maxLength;
  const isTooShort = charCount > 0 && charCount < minLength;
  const isTooLong = charCount > maxLength;

  // Handle typing indicator
  const handleChange = useCallback(
    (value: string) => {
      setPrompt(value);

      if (onTyping) {
        onTyping(true);

        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }

        const timeout = setTimeout(() => {
          onTyping(false);
        }, 1000);

        setTypingTimeout(timeout);
      }
    },
    [onTyping, typingTimeout]
  );

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  const handleSubmit = () => {
    if (!isValid || disabled) return;
    onSubmit(prompt.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey && isValid && !disabled) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {/* Header - stacks on mobile to prevent overlap */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <label htmlFor="prompt-editor-textarea" className="flex items-center gap-2 cursor-pointer">
          <SparklesIcon className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
          <span className="text-white font-medium text-sm sm:text-base">Your Prompt</span>
        </label>

        {localTimeRemaining !== null && (
          <motion.div
            className={`
              px-3 py-1.5 rounded-full font-mono text-base sm:text-sm font-bold self-start sm:self-auto
              ${isCritical
                ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                : isWarning
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-cyan-500/20 text-cyan-400'
              }
            `}
            animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 0.5 }}
            role="timer"
            aria-live={isCritical ? 'assertive' : 'polite'}
            aria-label={`Time remaining: ${formattedTime}`}
          >
            {formattedTime}
          </motion.div>
        )}
      </div>

      {/* Text area container */}
      <div
        className={`
          relative rounded-2xl overflow-hidden transition-all duration-300
          ${isFocused ? 'ring-2 ring-cyan-400/50 shadow-neon' : ''}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <textarea
          id="prompt-editor-textarea"
          value={prompt}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={4}
          aria-describedby="prompt-char-count prompt-hint"
          aria-invalid={isTooLong}
          className={`
            w-full p-3 md:p-4 pb-14 md:pb-16 text-base
            bg-slate-900/50 backdrop-blur-xl
            border border-white/10
            text-white placeholder:text-slate-500
            resize-none
            focus:outline-none focus:bg-slate-900/70
            transition-colors
            ${isTooLong ? 'text-rose-300' : ''}
          `}
        />

        {/* Bottom bar */}
        <div
          className="absolute bottom-0 left-0 right-0 p-3
                     bg-gradient-to-t from-slate-900/90 to-transparent
                     flex items-center justify-between"
        >
          {/* Character count */}
          <div className="flex items-center gap-3">
            <span
              id="prompt-char-count"
              className={`
                text-sm font-mono
                ${isTooShort ? 'text-amber-400' : ''}
                ${isTooLong ? 'text-rose-400' : ''}
                ${isValid ? 'text-emerald-400' : 'text-slate-500'}
              `}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">{charCount} of {maxLength} characters</span>
              <span aria-hidden="true">{charCount} / {maxLength}</span>
            </span>

            {isTooShort && (
              <span className="text-xs text-amber-400 flex items-center gap-1" role="alert">
                <ExclamationTriangleIcon className="w-3 h-3" aria-hidden="true" />
                Min {minLength} chars
              </span>
            )}
          </div>

          {/* Submit button */}
          <motion.button
            whileHover={{ scale: isValid && !disabled ? 1.05 : 1 }}
            whileTap={{ scale: isValid && !disabled ? 0.95 : 1 }}
            onClick={handleSubmit}
            disabled={!isValid || disabled}
            className={`
              flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl
              font-semibold text-xs md:text-sm transition-all
              ${isValid && !disabled
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 shadow-neon cursor-pointer'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <span>Submit</span>
            <PaperAirplaneIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </motion.button>
        </div>
      </div>

      {/* Tips */}
      <p id="prompt-hint" className="mt-2 text-xs text-slate-500 hidden md:block">
        Your prompt is scored! Vague prompts lose points. Add style, mood, lighting, and composition for higher scores.{' '}
        <kbd className="text-slate-600 font-mono">⌘+Enter</kbd> to submit
      </p>
    </motion.div>
  );
}

export default PromptEditor;
