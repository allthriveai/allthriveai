/**
 * IdeaDescriptionMessage - Text input for describing an idea
 *
 * Shown when user clicks "I have an idea" option.
 * Collects a brief description, then sends to Ava for help finding
 * relevant projects and people to connect with.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

const MIN_LENGTH = 10;
const MAX_LENGTH = 500;

interface IdeaDescriptionMessageProps {
  onSubmit: (description: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function IdeaDescriptionMessage({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: IdeaDescriptionMessageProps) {
  const [description, setDescription] = useState('');

  const isValid = description.trim().length >= MIN_LENGTH;
  const charsRemaining = MAX_LENGTH - description.length;

  const handleSubmit = () => {
    if (isValid && !isSubmitting) {
      onSubmit(description.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isValid && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <label
        htmlFor="idea-description"
        className="block mb-3 text-base text-slate-600 dark:text-slate-300"
      >
        What's your idea? Describe it briefly and I'll help you find inspiration and people to connect with.
      </label>

      <textarea
        id="idea-description"
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="I want to build a chatbot that helps users..."
        className="w-full bg-white/5 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700
          resize-none rounded-lg p-3
          text-slate-800 dark:text-white
          placeholder-slate-400 dark:placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
        rows={3}
        disabled={isSubmitting}
        aria-describedby="idea-char-count"
        autoFocus
      />

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span
            id="idea-char-count"
            className={`text-xs ${charsRemaining < 50 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}
          >
            {charsRemaining} characters remaining
          </span>
          {description.length > 0 && description.trim().length < MIN_LENGTH && (
            <span className="text-xs text-amber-500">
              (min {MIN_LENGTH} chars)
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300
              disabled:opacity-50 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="text-sm px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              'Get Help'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
