/**
 * GlobalSearchModal - Unified search modal for all content types
 *
 * Features:
 * - Cmd+K / Ctrl+K keyboard shortcut to open
 * - Semantic search using Weaviate vectors
 * - Tabs for filtering by content type
 * - Keyboard navigation (arrow keys + enter)
 * - Recent searches
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  FolderOpenIcon,
  WrenchIcon,
  AcademicCapIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { CommandLineIcon } from '@heroicons/react/24/solid';
import {
  useSearchStore,
  useGlobalSearchQuery,
  useFilteredResults,
  useResultCounts,
  useSearchKeyboardShortcut,
} from '@/hooks/useGlobalSearch';
import { getTypeLabel } from '@/services/globalSearch';
import type { SearchContentType, ProjectSearchResult, ToolSearchResult, QuizSearchResult, UserSearchResult } from '@/types/search';

// Type tab configuration
const TYPE_TABS: { type: SearchContentType | 'all'; icon: typeof FolderOpenIcon }[] = [
  { type: 'all', icon: MagnifyingGlassIcon },
  { type: 'projects', icon: FolderOpenIcon },
  { type: 'tools', icon: WrenchIcon },
  { type: 'quizzes', icon: AcademicCapIcon },
  { type: 'users', icon: UserGroupIcon },
];

export function GlobalSearchModal() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    isOpen,
    query,
    isLoading,
    error,
    activeType,
    recentSearches,
    closeSearch,
    setQuery,
    setActiveType,
  } = useSearchStore();

  // Set up keyboard shortcut listener
  useSearchKeyboardShortcut();

  // Trigger search query
  useGlobalSearchQuery();

  // Get filtered results based on active type
  const filteredResults = useFilteredResults();
  const resultCounts = useResultCounts();

  // Build flat list of all results for keyboard navigation
  const flatResults = filteredResults
    ? [
        ...filteredResults.projects.map((r) => ({ ...r, _type: 'projects' as const })),
        ...filteredResults.tools.map((r) => ({ ...r, _type: 'tools' as const })),
        ...filteredResults.quizzes.map((r) => ({ ...r, _type: 'quizzes' as const })),
        ...filteredResults.users.map((r) => ({ ...r, _type: 'users' as const })),
      ]
    : [];

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatResults.length > 0) {
        e.preventDefault();
        const selected = flatResults[selectedIndex];
        if (selected) {
          handleResultClick(selected.url);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Cycle through tabs
        const currentIndex = TYPE_TABS.findIndex((t) => t.type === activeType);
        const nextIndex = (currentIndex + (e.shiftKey ? -1 : 1) + TYPE_TABS.length) % TYPE_TABS.length;
        setActiveType(TYPE_TABS[nextIndex].type);
      }
    },
    [flatResults, selectedIndex, activeType, setActiveType]
  );

  // Navigate to result
  const handleResultClick = (url: string) => {
    closeSearch();
    navigate(url);
  };

  // Handle recent search click
  const handleRecentSearch = (search: string) => {
    setQuery(search);
  };

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeSearch}
    >
      <div
        className="relative w-full max-w-2xl mx-4 bg-brand-dark border border-primary-500/30 rounded-2xl shadow-2xl shadow-primary-500/10 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-primary-500/20">
          <MagnifyingGlassIcon className="w-5 h-5 text-primary-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tools, quizzes, people..."
            className="flex-1 bg-transparent text-white text-lg placeholder:text-gray-500 outline-none"
          />
          {isLoading && (
            <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">
              {isMac ? 'esc' : 'Esc'}
            </kbd>
            <span>to close</span>
          </div>
          <button
            onClick={closeSearch}
            className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-primary-500/20 overflow-x-auto">
          {TYPE_TABS.map(({ type, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeType === type
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{getTypeLabel(type)}</span>
              {resultCounts[type] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeType === type ? 'bg-primary-500/30' : 'bg-gray-700'
                }`}>
                  {resultCounts[type]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {error && (
            <div className="p-4 text-center text-red-400">
              <p>{error}</p>
            </div>
          )}

          {!query && recentSearches.length > 0 && (
            <div className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
                <ClockIcon className="w-4 h-4" />
                Recent Searches
              </h3>
              <div className="space-y-1">
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    onClick={() => handleRecentSearch(search)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
                    <span>{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query && recentSearches.length === 0 && (
            <div className="p-8 text-center">
              <CommandLineIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">Start typing to search</p>
              <p className="text-sm text-gray-500 mt-1">
                Search across projects, tools, quizzes, and people
              </p>
            </div>
          )}

          {query && flatResults.length === 0 && !isLoading && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No results found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try different keywords or check your spelling
              </p>
            </div>
          )}

          {filteredResults && (
            <div className="divide-y divide-gray-800/50">
              {/* Projects */}
              {filteredResults.projects.length > 0 && (
                <ResultSection
                  title="Projects"
                  icon={FolderOpenIcon}
                  results={filteredResults.projects}
                  selectedIndex={selectedIndex}
                  startIndex={0}
                  onResultClick={handleResultClick}
                  renderResult={(result: ProjectSearchResult, isSelected) => {
                    const toolNames = result.toolNames || (result as any).tool_names || [];
                    const imageUrl = result.featuredImageUrl || (result as any).featured_image_url;
                    return (
                      <div className="flex items-center gap-3 min-w-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-gray-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center shrink-0">
                            <FolderOpenIcon className="w-5 h-5 text-primary-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">{result.title}</div>
                          <div className="text-sm text-gray-400 truncate">
                            by @{result.username}
                            {toolNames.length > 0 && (
                              <span className="ml-2 text-gray-500">
                                using {toolNames.slice(0, 2).join(', ')}
                                {toolNames.length > 2 && ` +${toolNames.length - 2}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRightIcon className={`w-4 h-4 shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-primary-400' : 'opacity-0'}`} />
                      </div>
                    );
                  }}
                />
              )}

              {/* Tools */}
              {filteredResults.tools.length > 0 && (
                <ResultSection
                  title="Tools"
                  icon={WrenchIcon}
                  results={filteredResults.tools}
                  selectedIndex={selectedIndex}
                  startIndex={filteredResults.projects.length}
                  onResultClick={handleResultClick}
                  renderResult={(result: ToolSearchResult, isSelected) => {
                    const logoUrl = result.logoUrl || (result as any).logo_url;
                    const title = result.title || (result as any).name;
                    const hasFreeTier = result.hasFreeTier || (result as any).has_free_tier;
                    return (
                      <div className="flex items-center gap-3 min-w-0">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-contain bg-white p-1 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-500/30 to-primary-500/30 flex items-center justify-center shrink-0">
                            <WrenchIcon className="w-5 h-5 text-accent-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">{title}</div>
                          <div className="text-sm text-gray-400 truncate">
                            {result.category}
                            {hasFreeTier && (
                              <span className="ml-2 text-green-400">Free tier</span>
                            )}
                          </div>
                        </div>
                        <ArrowRightIcon className={`w-4 h-4 shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-primary-400' : 'opacity-0'}`} />
                      </div>
                    );
                  }}
                />
              )}

              {/* Quizzes */}
              {filteredResults.quizzes.length > 0 && (
                <ResultSection
                  title="Quizzes"
                  icon={AcademicCapIcon}
                  results={filteredResults.quizzes}
                  selectedIndex={selectedIndex}
                  startIndex={filteredResults.projects.length + filteredResults.tools.length}
                  onResultClick={handleResultClick}
                  renderResult={(result: QuizSearchResult, isSelected) => {
                    const questionCount = result.questionCount || (result as any).question_count || 0;
                    return (
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center shrink-0">
                          <AcademicCapIcon className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">{result.title}</div>
                          <div className="text-sm text-gray-400 truncate">
                            {result.topic} &bull; {result.difficulty} &bull; {questionCount} questions
                          </div>
                        </div>
                        <ArrowRightIcon className={`w-4 h-4 shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-primary-400' : 'opacity-0'}`} />
                      </div>
                    );
                  }}
                />
              )}

              {/* Users */}
              {filteredResults.users.length > 0 && (
                <ResultSection
                  title="People"
                  icon={UserGroupIcon}
                  results={filteredResults.users}
                  selectedIndex={selectedIndex}
                  startIndex={
                    filteredResults.projects.length +
                    filteredResults.tools.length +
                    filteredResults.quizzes.length
                  }
                  onResultClick={handleResultClick}
                  renderResult={(result: UserSearchResult, isSelected) => {
                    const avatarUrl = result.avatarUrl || (result as any).avatar_url;
                    const fullName = result.fullName || (result as any).full_name;
                    const projectCount = result.projectCount || (result as any).project_count || 0;
                    const username = result.username || 'user';
                    return (
                      <div className="flex items-center gap-3 min-w-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover bg-gray-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center shrink-0">
                            <span className="text-lg font-bold text-primary-400">
                              {username[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">
                            {fullName || username}
                          </div>
                          <div className="text-sm text-gray-400 truncate">
                            @{username}
                            {projectCount > 0 && (
                              <span className="ml-2 text-gray-500">
                                {projectCount} project{projectCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRightIcon className={`w-4 h-4 shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-primary-400' : 'opacity-0'}`} />
                      </div>
                    );
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-primary-500/20 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Tab</kbd>
              switch tabs
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">&uarr;</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Enter</kbd>
              open
            </span>
          </div>
          <span className="text-gray-600">Powered by semantic search</span>
        </div>
      </div>
    </div>
  );
}

// Result section component
interface ResultSectionProps<T> {
  title: string;
  icon: typeof FolderOpenIcon;
  results: T[];
  selectedIndex: number;
  startIndex: number;
  onResultClick: (url: string) => void;
  renderResult: (result: T, isSelected: boolean) => React.ReactNode;
}

function ResultSection<T extends { url: string }>({
  title,
  icon: Icon,
  results,
  selectedIndex,
  startIndex,
  onResultClick,
  renderResult,
}: ResultSectionProps<T>) {
  return (
    <div className="py-2">
      <h3 className="flex items-center gap-2 px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      <div className="mt-1">
        {results.map((result, i) => {
          const isSelected = selectedIndex === startIndex + i;
          return (
            <button
              key={result.url}
              onClick={() => onResultClick(result.url)}
              className={`w-full px-4 py-2 text-left transition-colors ${
                isSelected
                  ? 'bg-primary-500/10 border-l-2 border-primary-500'
                  : 'hover:bg-gray-800/50 border-l-2 border-transparent'
              }`}
            >
              {renderResult(result, isSelected)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GlobalSearchModal;
