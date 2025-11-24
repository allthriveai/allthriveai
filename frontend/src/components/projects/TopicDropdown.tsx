import { useState, useEffect, useRef } from 'react';
import { TOPICS, getTopicBySlug } from '@/config/topics';
import type { TopicSlug } from '@/config/topics';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface TopicDropdownProps {
  selectedTopics: TopicSlug[];
  onChange: (topics: TopicSlug[]) => void;
  disabled?: boolean;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
  lime: 'bg-lime-500',
  violet: 'bg-violet-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  slate: 'bg-slate-500',
  fuchsia: 'bg-fuchsia-500',
};

export function TopicDropdown({ selectedTopics, onChange, disabled }: TopicDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleTopic = (topicSlug: TopicSlug) => {
    if (selectedTopics.includes(topicSlug)) {
      onChange(selectedTopics.filter(t => t !== topicSlug));
    } else {
      onChange([...selectedTopics, topicSlug]);
    }
  };

  const handleRemoveTopic = (topicSlug: TopicSlug) => {
    onChange(selectedTopics.filter(t => t !== topicSlug));
  };

  return (
    <div className="space-y-3">
      {/* Selected Topics Display */}
      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTopics.map(topicSlug => {
            const topic = getTopicBySlug(topicSlug);
            if (!topic) return null;
            const colorClass = COLOR_CLASSES[topic.color] || 'bg-gray-500';

            return (
              <div
                key={topicSlug}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full text-sm border border-gray-200 dark:border-gray-700"
              >
                <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                <span className="font-medium text-gray-900 dark:text-white">{topic.label}</span>
                {!disabled && (
                  <button
                    onClick={() => handleRemoveTopic(topicSlug)}
                    className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                    type="button"
                  >
                    <XMarkIcon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTopics.length > 0 ? 'Add more topics...' : 'Select topics...'}
          </span>
          <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown List */}
        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            <div className="py-1">
              {TOPICS.map(topic => {
                const isSelected = selectedTopics.includes(topic.slug);
                const colorClass = COLOR_CLASSES[topic.color] || 'bg-gray-500';

                return (
                  <button
                    key={topic.slug}
                    type="button"
                    onClick={() => handleToggleTopic(topic.slug)}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                      isSelected ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${colorClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                          {topic.label}
                        </span>
                        {isSelected && (
                          <span className="text-xs text-primary-600 dark:text-primary-400">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {topic.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
