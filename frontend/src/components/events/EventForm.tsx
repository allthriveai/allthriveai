import { useState } from 'react';
import type { CreateEventData } from '@/services/eventsService';

interface EventFormProps {
  onSubmit: (data: CreateEventData) => Promise<void>;
  onCancel: () => void;
}

interface ValidationErrors {
  title?: string;
  start_date?: string;
  end_date?: string;
  event_url?: string;
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
  if (!data.start_date) {
    errors.start_date = 'Start date is required';
  }

  // End date validation
  if (!data.end_date) {
    errors.end_date = 'End date is required';
  } else if (data.start_date && new Date(data.end_date) < new Date(data.start_date)) {
    errors.end_date = 'End date must be after start date';
  }

  // URL validation
  const urlPattern = /^https?:\/\/.+/i;
  if (data.event_url && !urlPattern.test(data.event_url)) {
    errors.event_url = 'Please enter a valid URL starting with http:// or https://';
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
    start_date: '',
    end_date: '',
    location: '',
    event_url: '',
    is_all_day: false,
    color: '#3b82f6',
    thumbnail: '',
    is_published: true,
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
        <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Start Date & Time *
        </label>
        <input
          type="datetime-local"
          id="start_date"
          name="start_date"
          value={formData.start_date}
          onChange={handleChange}
          aria-invalid={!!fieldErrors.start_date}
          aria-describedby={fieldErrors.start_date ? 'start-date-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.start_date ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.start_date && (
          <p id="start-date-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.start_date}</p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          End Date & Time *
        </label>
        <input
          type="datetime-local"
          id="end_date"
          name="end_date"
          value={formData.end_date}
          onChange={handleChange}
          aria-invalid={!!fieldErrors.end_date}
          aria-describedby={fieldErrors.end_date ? 'end-date-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.end_date ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.end_date && (
          <p id="end-date-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.end_date}</p>
        )}
      </div>

      {/* All Day Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_all_day"
          name="is_all_day"
          checked={formData.is_all_day}
          onChange={handleChange}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="is_all_day" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
        <label htmlFor="event_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Event URL
        </label>
        <input
          type="url"
          id="event_url"
          name="event_url"
          value={formData.event_url}
          onChange={handleChange}
          placeholder="https://..."
          aria-invalid={!!fieldErrors.event_url}
          aria-describedby={fieldErrors.event_url ? 'event-url-error' : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.event_url ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.event_url && (
          <p id="event-url-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.event_url}</p>
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
          id="is_published"
          name="is_published"
          checked={formData.is_published}
          onChange={handleChange}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="is_published" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
