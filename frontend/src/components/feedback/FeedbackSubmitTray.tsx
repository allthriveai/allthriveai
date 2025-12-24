/**
 * FeedbackSubmitTray - Right sidebar tray for creating new feedback submissions
 */

import { Fragment, useState, useEffect } from 'react';
import { Transition, RadioGroup } from '@headlessui/react';
import { XMarkIcon, LightBulbIcon, BugAntIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  createFeedbackItem,
  type CreateFeedbackData,
  type FeedbackItem,
  type FeedbackCategory,
} from '@/services/feedback';

interface FeedbackSubmitTrayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: FeedbackItem) => void;
  defaultType?: 'feature' | 'bug';
}

const feedbackTypes = [
  {
    value: 'feature' as const,
    label: 'Feature Request',
    description: 'Suggest a new feature or improvement',
    icon: LightBulbIcon,
    color: 'text-purple-500 dark:text-purple-400',
    selectedBg: 'bg-purple-50 dark:bg-purple-500/20',
    selectedBorder: 'border-purple-300 dark:border-purple-500/50',
  },
  {
    value: 'bug' as const,
    label: 'Bug Report',
    description: 'Report something that is not working correctly',
    icon: BugAntIcon,
    color: 'text-red-500 dark:text-red-400',
    selectedBg: 'bg-red-50 dark:bg-red-500/20',
    selectedBorder: 'border-red-300 dark:border-red-500/50',
  },
];

const categoryGroups: { label: string; categories: { value: FeedbackCategory; label: string }[] }[] = [
  {
    label: 'Features',
    categories: [
      { value: 'explore', label: 'Explore' },
      { value: 'learn', label: 'Learn' },
      { value: 'games', label: 'Games' },
      { value: 'prompt_battles', label: 'Prompt Battles' },
      { value: 'lounge', label: 'Lounge' },
    ],
  },
  {
    label: 'Agents',
    categories: [
      { value: 'ember', label: 'Ember' },
      { value: 'sage', label: 'Sage' },
      { value: 'haven', label: 'Haven' },
      { value: 'guide', label: 'Guide' },
    ],
  },
  {
    label: 'General',
    categories: [
      { value: 'ui_ux', label: 'UI/UX' },
      { value: 'responsive', label: 'Responsive Design' },
      { value: 'accessibility', label: 'Accessibility' },
      { value: 'account', label: 'Account & Settings' },
      { value: 'other', label: 'Other' },
    ],
  },
];

export function FeedbackSubmitTray({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'feature',
}: FeedbackSubmitTrayProps) {
  const [feedbackType, setFeedbackType] = useState<'feature' | 'bug'>(defaultType);
  const [category, setCategory] = useState<FeedbackCategory>('explore');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset type when defaultType changes
  useEffect(() => {
    setFeedbackType(defaultType);
  }, [defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateFeedbackData = {
        feedbackType,
        category,
        title: title.trim(),
        description: description.trim(),
      };
      const newItem = await createFeedbackItem(data);
      onSuccess(newItem);
      handleClose();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setCategory('explore');
    setError(null);
    setFeedbackType(defaultType);
    onClose();
  };

  return (
    <>
      {/* Backdrop - click to close, doesn't block main page scroll */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/30"
          onClick={handleClose}
        />
      </Transition>

      {/* Tray */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition-transform duration-300 ease-out"
        enterFrom="translate-x-full"
        enterTo="translate-x-0"
        leave="transition-transform duration-200 ease-in"
        leaveFrom="translate-x-0"
        leaveTo="translate-x-full"
      >
        <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Submit Feedback
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Share your ideas or report issues to help us improve
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                  {error}
                </div>
              )}

              {/* Type selector */}
              <RadioGroup value={feedbackType} onChange={setFeedbackType}>
                <RadioGroup.Label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                  What type of feedback?
                </RadioGroup.Label>
                <div className="grid grid-cols-2 gap-3">
                  {feedbackTypes.map((type) => (
                    <RadioGroup.Option
                      key={type.value}
                      value={type.value}
                      className={({ checked }) =>
                        `flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all duration-200
                        ${
                          checked
                            ? `${type.selectedBg} ${type.selectedBorder}`
                            : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                        }`
                      }
                    >
                      {({ checked }) => (
                        <>
                          <type.icon className={`w-6 h-6 ${type.color}`} />
                          <RadioGroup.Label
                            as="div"
                            className={`text-sm font-medium text-center ${checked ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-300'}`}
                          >
                            {type.label}
                          </RadioGroup.Label>
                        </>
                      )}
                    </RadioGroup.Option>
                  ))}
                </div>
              </RadioGroup>

              {/* Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                >
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    feedbackType === 'feature'
                      ? 'e.g., Add dark mode toggle'
                      : 'e.g., Login button not working on mobile'
                  }
                  maxLength={255}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                />
                <div className="text-xs text-gray-500 dark:text-slate-500 mt-1 text-right">
                  {title.length}/255
                </div>
              </div>

              {/* Category dropdown */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                >
                  Category
                </label>
                <div className="relative">
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                  >
                    {categoryGroups.map((group) => (
                      <optgroup key={group.label} label={group.label} className="bg-white dark:bg-slate-800 font-medium">
                        {group.categories.map((cat) => (
                          <option key={cat.value} value={cat.value} className="bg-white dark:bg-slate-800 font-normal">
                            {cat.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    feedbackType === 'feature'
                      ? 'Describe the feature you would like to see and why it would be useful...'
                      : 'Describe the issue, steps to reproduce, and what you expected to happen...'
                  }
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="flex-1 px-4 py-3 text-sm font-medium bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:shadow-none transition-all"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
        </div>
      </Transition>
    </>
  );
}
