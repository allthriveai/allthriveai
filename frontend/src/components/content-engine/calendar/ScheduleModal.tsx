/**
 * Schedule Modal Component
 * US-008: Schedule Modal for scheduling clips
 */

import { useState, useCallback, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faCalendar, faClock, faComment } from '@fortawesome/free-solid-svg-icons';
import { useCreateSchedule } from '@/hooks/useSchedule';
import type { Platform } from '@/types/contentEngine';

interface ScheduleModalProps {
  clipId: number;
  clipTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'Twitter' },
];

export function ScheduleModal({ clipId, clipTitle, isOpen, onClose, onSuccess }: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [textContent, setTextContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { createSchedule, isCreating, error: apiError } = useCreateSchedule();

  // Toggle platform selection
  const togglePlatform = useCallback((platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
    setValidationError(null);
  }, []);

  // Validate and submit
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate date
    if (!selectedDate) {
      setValidationError('Please select a date');
      return;
    }

    // Validate it's not in the past
    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    if (scheduledDateTime < new Date()) {
      setValidationError('Cannot schedule in the past');
      return;
    }

    // Validate platforms
    if (selectedPlatforms.length === 0) {
      setValidationError('Please select at least one platform');
      return;
    }

    // Validate text content
    if (!textContent.trim()) {
      setValidationError('Please enter a caption for your post');
      return;
    }

    // Create schedule for each platform
    try {
      for (const platform of selectedPlatforms) {
        await createSchedule({
          clip: clipId,
          platform,
          textContent: textContent.trim(),
          scheduledFor: scheduledDateTime.toISOString(),
        });
      }
      onSuccess?.();
      onClose();
    } catch {
      // Error is handled by the hook
    }
  }, [selectedDate, selectedTime, selectedPlatforms, textContent, clipId, createSchedule, onSuccess, onClose]);

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div
        className="glass-panel rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="schedule-modal-title" className="text-xl font-bold text-white">
            Schedule Post
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            aria-label="Close modal"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Clip info */}
        {clipTitle && (
          <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-400">Clip</p>
            <p className="text-white font-medium truncate">{clipTitle}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Date picker */}
          <div className="mb-4">
            <label htmlFor="schedule-date" className="block text-sm text-slate-400 mb-2">
              <FontAwesomeIcon icon={faCalendar} className="mr-2" />
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setValidationError(null);
              }}
              min={minDate}
              className="input-glass w-full"
              required
            />
          </div>

          {/* Time picker */}
          <div className="mb-4">
            <label htmlFor="schedule-time" className="block text-sm text-slate-400 mb-2">
              <FontAwesomeIcon icon={faClock} className="mr-2" />
              Time
            </label>
            <input
              id="schedule-time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="input-glass w-full"
              required
            />
          </div>

          {/* Post caption */}
          <div className="mb-4">
            <label htmlFor="schedule-caption" className="block text-sm text-slate-400 mb-2">
              <FontAwesomeIcon icon={faComment} className="mr-2" />
              Caption
            </label>
            <textarea
              id="schedule-caption"
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                setValidationError(null);
              }}
              placeholder="Write your post caption..."
              className="input-glass w-full h-24 resize-none"
              required
            />
          </div>

          {/* Platform selection */}
          <div className="mb-6">
            <p className="text-sm text-slate-400 mb-2">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? platform.id === 'linkedin'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : platform.id === 'youtube'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                      }
                    `}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Errors */}
          {(validationError || apiError) && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{validationError || apiError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-ghost py-2"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 btn-primary py-2 disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Scheduling...
                </>
              ) : (
                'Schedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
