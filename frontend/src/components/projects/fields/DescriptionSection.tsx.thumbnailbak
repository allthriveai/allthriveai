/**
 * DescriptionSection - Reusable project description with word limit
 * Part of the scalable ProjectFieldsEditor system
 */

import { useState, useEffect } from 'react';

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
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Brief description of your project ({maxWords} words max)
      </p>
      <textarea
        value={projectDescription}
        onChange={(e) => setProjectDescription(e.target.value)}
        placeholder="Describe what makes your project interesting..."
        rows={4}
        disabled={isSaving}
        className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
          isOverLimit
            ? 'border-red-500 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-700'
        }`}
      />
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Keep it concise and highlight the most interesting aspects
        </p>
        <p className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {wordCount} / {maxWords} words
        </p>
      </div>
    </div>
  );
}
