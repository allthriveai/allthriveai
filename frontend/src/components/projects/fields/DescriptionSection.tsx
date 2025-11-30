/**
 * DescriptionSection - Reusable project description with word limit
 * Part of the scalable ProjectFieldsEditor system
 */

import { useState, useEffect } from 'react';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

interface DescriptionSectionProps {
  projectDescription: string;
  setProjectDescription: (description: string) => void;
  isSaving?: boolean;
  maxWords?: number;
}

export function DescriptionSection({
  projectDescription,
  setProjectDescription,
  isSaving = false,
  maxWords = 200,
}: DescriptionSectionProps) {
  const [wordCount, setWordCount] = useState(0);
  // Default to markdown mode (true = markdown, false = WYSIWYG)
  const [isMarkdownMode, setIsMarkdownMode] = useState(true);

  useEffect(() => {
    const words = projectDescription.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [projectDescription]);

  const isOverLimit = wordCount > maxWords;

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Why it's cool
      </label>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Brief description of your project ({maxWords} words max)
        </p>
        <button
          type="button"
          onClick={() => setIsMarkdownMode(!isMarkdownMode)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
          title={isMarkdownMode ? 'Switch to Rich Text Editor' : 'Switch to Markdown Editor'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span>{isMarkdownMode ? 'Switch to Rich Text Editor' : 'Switch to Markdown Editor'}</span>
        </button>
      </div>
      {isMarkdownMode ? (
        <textarea
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          placeholder="Describe what makes your project interesting...\n\nMarkdown supported:\n- **bold** and *italic*\n- [links](url)\n- Lists and more!"
          rows={6}
          disabled={isSaving}
          className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 font-mono text-sm ${
            isOverLimit
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        />
      ) : (
        <div className={`border rounded-lg ${
          isOverLimit
            ? 'border-red-500 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-700'
        }`}>
          <RichTextEditor
            value={projectDescription}
            onChange={setProjectDescription}
            placeholder="Describe what makes your project interesting..."
            minHeight="120px"
          />
        </div>
      )}
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isMarkdownMode
            ? 'Markdown enabled: Use **bold**, *italic*, [links](url), etc.'
            : 'WYSIWYG editor enabled'}
        </p>
        <p className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {wordCount} / {maxWords} words
        </p>
      </div>
    </div>
  );
}
