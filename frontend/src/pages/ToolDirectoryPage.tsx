import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getTaxonomies } from '@/services/personalization';
import type { Taxonomy } from '@/types/models';
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function ToolDirectoryPage() {
  const [tools, setTools] = useState<Taxonomy[]>([]);
  const [filteredTools, setFilteredTools] = useState<Taxonomy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Right sidebar state
  const [selectedTool, setSelectedTool] = useState<Taxonomy | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTools(tools);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    );
    setFilteredTools(filtered);
  }, [searchQuery, tools]);

  async function loadTools() {
    try {
      setIsLoading(true);
      const allTaxonomies = await getTaxonomies();
      // Filter only tools category
      const toolTaxonomies = allTaxonomies.filter((t) => t.category === 'tool');
      // Sort alphabetically
      toolTaxonomies.sort((a, b) => a.name.localeCompare(b.name));
      setTools(toolTaxonomies);
      setFilteredTools(toolTaxonomies);
    } catch (err: any) {
      console.error('Failed to load tools:', err);
      setError(err?.error || 'Failed to load tool directory');
    } finally {
      setIsLoading(false);
    }
  }

  // Group tools by first letter for dictionary-style layout
  const groupedTools: Record<string, Taxonomy[]> = {};
  filteredTools.forEach((tool) => {
    const firstLetter = tool.name[0].toUpperCase();
    if (!groupedTools[firstLetter]) {
      groupedTools[firstLetter] = [];
    }
    groupedTools[firstLetter].push(tool);
  });

  const letters = Object.keys(groupedTools).sort();

  return (
    <DashboardLayout>
      {() => (
        <div className="flex-1 overflow-y-auto h-full">
          <div className="max-w-6xl mx-auto p-8 pb-24">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <SparklesIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  AI Tool Directory
                </h1>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Explore {tools.length} AI tools and platforms to enhance your workflow
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-2xl">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search AI tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
                />
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Found {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-8 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-4" />
                    <div className="space-y-4">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-24 bg-gray-300 dark:bg-gray-700 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Tool Directory - Dictionary Style */}
            {!isLoading && !error && (
              <>
                {letters.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      {searchQuery
                        ? `No tools found matching "${searchQuery}"`
                        : 'No tools available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {letters.map((letter) => (
                      <div key={letter} id={letter}>
                        {/* Letter Header */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 text-white rounded-xl font-bold text-2xl shadow-lg">
                            {letter}
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-300 dark:from-gray-700 to-transparent" />
                        </div>

                        {/* Tools in this letter */}
                        <div className="grid grid-cols-1 gap-4">
                          {groupedTools[letter].map((tool) => (
                            <button
                              key={tool.id}
                              onClick={() => { setSelectedTool(tool); setIsDrawerOpen(true); }}
                              className="text-left glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg w-full"
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-lg flex items-center justify-center overflow-hidden">
                                  {tool.logo_url ? (
                                    <img src={tool.logo_url} alt={`${tool.name} logo`} className="w-10 h-10 object-contain" />
                                  ) : (
                                    <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {tool.name}
                                  </h3>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Alphabet Navigation (if more than 3 letters) */}
                {letters.length > 3 && !searchQuery && (
                  <div className="fixed bottom-8 right-8 glass-strong rounded-xl p-3 shadow-2xl border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col gap-1">
                      {letters.map((letter) => (
                        <a
                          key={letter}
                          href={`#${letter}`}
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Sidebar Drawer */}
          {isDrawerOpen && selectedTool && (
            <div className="fixed inset-0 z-40">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsDrawerOpen(false)}
                aria-hidden="true"
              />

              {/* Drawer Panel */}
              <aside className="absolute right-0 top-0 h-full w-full sm:w-[480px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-y-auto">
                <div className="h-full flex flex-col">
                  {/* Header - fixed */}
                  <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 flex items-center justify-center overflow-hidden shadow-lg">
                          {selectedTool.logo_url ? (
                            <img src={selectedTool.logo_url} alt={`${selectedTool.name} logo`} className="w-11 h-11 object-contain" />
                          ) : (
                            <SparklesIcon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedTool.name}</h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize font-medium">{selectedTool.category}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        aria-label="Close"
                      >
                        <XMarkIcon className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Website link */}
                    {selectedTool.website_url && (
                      <a
                        href={selectedTool.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Visit Website <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {/* Content - scrollable */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Description */}
                    {selectedTool.description && (
                      <div className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {selectedTool.description}
                        </p>
                      </div>
                    )}

                    {/* Usage tips */}
                    {selectedTool.usage_tips && selectedTool.usage_tips.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          How to use effectively
                        </h3>
                        <ul className="space-y-2.5">
                          {selectedTool.usage_tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="flex-1">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Best for */}
                    {selectedTool.best_for && selectedTool.best_for.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                          Best for
                        </h3>
                        <ul className="space-y-2.5">
                          {selectedTool.best_for.map((use, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                              <CheckCircleIcon className="flex-shrink-0 w-5 h-5 text-secondary-600 dark:text-secondary-400 mt-0.5" />
                              <span className="flex-1">{use}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
