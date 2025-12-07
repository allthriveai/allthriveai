import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  HELP_CATEGORIES,
  HELP_QUESTIONS,
  getFeaturedQuestions,
  getQuestionsByCategory,
  searchHelpQuestions,
  type HelpQuestion,
  type HelpCategory,
} from '@/data/helpQuestions';

interface HelpQuestionsPanelProps {
  /** Callback when a help question is selected */
  onQuestionSelect: (question: HelpQuestion) => void;
  /** Callback to close the help panel */
  onClose: () => void;
}

/**
 * HelpQuestionsPanel - Displays categorized help questions for users
 *
 * Features:
 * - Search functionality
 * - Category filtering
 * - Featured/popular questions
 * - Beautiful card-based layout
 */
export function HelpQuestionsPanel({ onQuestionSelect, onClose }: HelpQuestionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);

  // Determine which questions to show
  const getDisplayedQuestions = (): HelpQuestion[] => {
    if (searchQuery.trim()) {
      return searchHelpQuestions(searchQuery);
    }

    if (selectedCategory) {
      return getQuestionsByCategory(selectedCategory);
    }

    return getFeaturedQuestions();
  };

  const displayedQuestions = getDisplayedQuestions();

  const handleQuestionClick = (question: HelpQuestion) => {
    onQuestionSelect(question);
    // Panel will be closed by parent component
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              How can we help you?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Choose a question below or search for what you need
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Popular
            </button>
            {HELP_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Questions Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {displayedQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              No results found
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
              Try adjusting your search or browse our categories above
            </p>
          </div>
        ) : (
          <>
            {/* Category header when filtered */}
            {selectedCategory && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">
                    {HELP_CATEGORIES.find(c => c.id === selectedCategory)?.icon}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {HELP_CATEGORIES.find(c => c.id === selectedCategory)?.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {HELP_CATEGORIES.find(c => c.id === selectedCategory)?.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3">
              {displayedQuestions.map((question) => {
                const category = HELP_CATEGORIES.find(c => c.id === question.category);
                return (
                  <button
                    key={question.id}
                    onClick={() => handleQuestionClick(question)}
                    className="w-full text-left px-5 py-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Category Icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                        <span className="text-xl">{category?.icon}</span>
                      </div>

                      {/* Question Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {question.question}
                        </div>
                        {!selectedCategory && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {category?.title}
                          </div>
                        )}
                      </div>

                      {/* Arrow Icon */}
                      <div className="flex-shrink-0 text-slate-400 group-hover:text-primary-500 transition-colors">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
