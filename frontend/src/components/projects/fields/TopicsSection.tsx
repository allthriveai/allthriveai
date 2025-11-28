/**
 * TopicsSection - Categories and topics selector
 * Part of the scalable ProjectFieldsEditor system
 */

import { TopicDropdown } from '../TopicDropdown';
import type { Taxonomy } from '@/types/models';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';

interface TopicsSectionProps {
  projectCategories: number[];
  availableCategories: Taxonomy[];
  setProjectCategories: (categories: number[]) => void;
  projectTopics: string[];
  setProjectTopics: (topics: string[]) => void;
  isSaving?: boolean;
}

export function TopicsSection({
  projectCategories,
  availableCategories,
  setProjectCategories,
  projectTopics,
  setProjectTopics,
  isSaving = false,
}: TopicsSectionProps) {
  const [topicInput, setTopicInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions when input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (topicInput.trim().length > 0) {
        try {
          const response = await api.get('/projects/topic-suggestions/', {
            params: { q: topicInput, limit: 10 }
          });
          setSuggestions(response.data.suggestions || []);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Failed to fetch topic suggestions:', error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [topicInput]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTopic = (topic?: string) => {
    const topicToAdd = topic || topicInput.trim();
    if (topicToAdd && !projectTopics.includes(topicToAdd)) {
      setProjectTopics([...projectTopics, topicToAdd]);
      setTopicInput('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTopic(suggestion);
  };

  const handleRemoveTopic = (topic: string) => {
    setProjectTopics(projectTopics.filter(t => t !== topic));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic();
    }
  };

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Categories
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Select categories to help others discover your project
        </p>
        <TopicDropdown
          selectedTopics={projectCategories}
          onChange={setProjectCategories}
          disabled={isSaving}
          availableTopics={availableCategories}
        />
      </div>

      {/* Topics */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Topics
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Add custom topics (e.g., python, redis, nextjs). Max 20 topics, 50 characters each.
        </p>
        <div className="relative">
          <div className="flex gap-2 mb-2">
            <input
              ref={inputRef}
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter a topic..."
              disabled={isSaving || projectTopics.length >= 20}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              maxLength={50}
            />
            <button
              type="button"
              onClick={() => handleAddTopic()}
              disabled={!topicInput.trim() || isSaving || projectTopics.length >= 20}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        {projectTopics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {projectTopics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => handleRemoveTopic(topic)}
                  disabled={isSaving}
                  className="hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                  aria-label={`Remove ${topic}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
