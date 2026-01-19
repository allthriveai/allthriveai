/**
 * Quick Capture Component
 * US-004: Ideas Tab with list view and quick capture
 */

import { useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';

interface QuickCaptureProps {
  onSubmit: (title: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

export function QuickCapture({ onSubmit, isSubmitting = false, error }: QuickCaptureProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    await onSubmit(title.trim());
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Capture a new idea..."
          className="input-glass flex-1"
          disabled={isSubmitting}
          aria-label="New idea title"
        />
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add idea"
        >
          {isSubmitting ? (
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          ) : (
            <FontAwesomeIcon icon={faPlus} />
          )}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}
    </form>
  );
}
