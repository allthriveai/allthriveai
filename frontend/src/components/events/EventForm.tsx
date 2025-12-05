import { useState } from 'react';
import type { CreateEventData } from '@/services/eventsService';

interface EventFormProps {
  onSubmit: (data: CreateEventData) => Promise<void>;
  onCancel: () => void;
}

interface ValidationErrors {
  title?: string;
  startDate?: string;
  endDate?: string;
  eventUrl?: string;
  thumbnail?: string;
}

function validateEventForm(data: CreateEventData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Title validation
  if (!data.title.trim()) {
    errors.title = 'Title is required';
  } else if (data.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (data.title.length > 200) {
    errors.title = 'Title must be less than 200 characters';
  }

  // Start date validation
  if (!data.startDate) {
    errors.startDate = 'Start date is required';
  }

  // End date validation
  if (!data.endDate) {
    errors.endDate = 'End date is required';
  } else if (data.startDate && new Date(data.endDate) < new Date(data.startDate)) {
    errors.endDate = 'End date must be after start date';
  }

  // URL validation
  const urlPattern = /^https?:\/\/.+/i;
  if (data.eventUrl && !urlPattern.test(data.eventUrl)) {
    errors.eventUrl = 'Please enter a valid URL starting with http:// or https://';
  }
  if (data.thumbnail && !urlPattern.test(data.thumbnail)) {
    errors.thumbnail = 'Please enter a valid URL starting with http:// or https://';
  }

  return errors;
}

export function EventForm({ onSubmit, onCancel }: EventFormProps) {
  const [formData, setFormData] = useState<CreateEventData>({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    eventUrl: '',
    isAllDay: false,
    color: '#3b82f6',
    thumbnail: '',
    isPublished: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const validationErrors = validateEventForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Event Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          aria-invalid={!!fieldErrors.title}
          aria-describedby={fieldErrors.title ? 'title-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.title ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.title && (
          <p id="title-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Start Date */}
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Start Date & Time *
        </label>
        <input
          type="datetime-local"
          id="startDate"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          aria-invalid={!!fieldErrors.startDate}
          aria-describedby={fieldErrors.startDate ? 'start-date-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.startDate ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.startDate && (
          <p id="start-date-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.startDate}</p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          End Date & Time *
        </label>
        <input
          type="datetime-local"
          id="endDate"
          name="endDate"
          value={formData.endDate}
          onChange={handleChange}
          aria-invalid={!!fieldErrors.endDate}
          aria-describedby={fieldErrors.endDate ? 'end-date-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.endDate ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.endDate && (
          <p id="end-date-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.endDate}</p>
        )}
      </div>

      {/* All Day Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isAllDay"
          name="isAllDay"
          checked={formData.isAllDay}
          onChange={handleChange}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="isAllDay" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          All-day event
        </label>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Location
        </label>
        <input
          type="text"
          id="location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Event URL */}
      <div>
        <label htmlFor="eventUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Event URL
        </label>
        <input
          type="url"
          id="eventUrl"
          name="eventUrl"
          value={formData.eventUrl}
          onChange={handleChange}
          placeholder="https://..."
          aria-invalid={!!fieldErrors.eventUrl}
          aria-describedby={fieldErrors.eventUrl ? 'event-url-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.eventUrl ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.eventUrl && (
          <p id="event-url-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.eventUrl}</p>
        )}
      </div>

      {/* Thumbnail URL */}
      <div>
        <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Thumbnail URL
        </label>
        <input
          type="url"
          id="thumbnail"
          name="thumbnail"
          value={formData.thumbnail}
          onChange={handleChange}
          placeholder="https://..."
          aria-invalid={!!fieldErrors.thumbnail}
          aria-describedby={fieldErrors.thumbnail ? 'thumbnail-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.thumbnail ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.thumbnail && (
          <p id="thumbnail-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.thumbnail}</p>
        )}
      </div>

      {/* Color */}
      <div>
        <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Event Color
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            id="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
            className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">{formData.color}</span>
        </div>
      </div>

      {/* Published Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isPublished"
          name="isPublished"
          checked={formData.isPublished}
          onChange={handleChange}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="isPublished" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Publish immediately
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Event'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
