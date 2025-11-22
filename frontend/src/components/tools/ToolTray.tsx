import { useEffect, useState } from 'react';
import { getToolBySlug } from '@/services/tools';
import type { Tool } from '@/types/models';
import {
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTags,
  faAlignLeft,
  faListCheck,
  faBolt,
  faFolderOpen,
} from '@fortawesome/free-solid-svg-icons';

interface ToolTrayProps {
  isOpen: boolean;
  onClose: () => void;
  toolSlug: string;
}

export function ToolTray({ isOpen, onClose, toolSlug }: ToolTrayProps) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLinksDropdown, setShowLinksDropdown] = useState(false);

  useEffect(() => {
    if (isOpen && toolSlug) {
      loadTool(toolSlug);
    }
  }, [isOpen, toolSlug]);

  async function loadTool(slug: string) {
    try {
      setIsLoading(true);
      setError(null);
      const toolData = await getToolBySlug(slug);
      setTool(toolData);
    } catch (err: any) {
      console.error('Failed to load tool:', err);
      setError(err?.error || 'Tool not found');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  // Loading state
  if (isLoading) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300 ease-in-out pointer-events-none"
          onClick={onClose}
        />
        <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
          <div className="p-6 animate-pulse">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-xl" />
                <div className="flex-1">
                  <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-64" />
                </div>
              </div>
              <button onClick={onClose} className="p-2">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="h-24 bg-gray-300 dark:bg-gray-700 rounded-xl" />
              <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-xl" />
              <div className="h-40 bg-gray-300 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Error state
  if (error || !tool) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300 ease-in-out pointer-events-none"
          onClick={onClose}
        />
        <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tool Not Found</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-red-600 dark:text-red-400 mb-4">{error || 'This tool could not be found.'}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {/* Backdrop - Non-blocking, no blur, allows scrolling and full visibility */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300 ease-in-out pointer-events-none"
        onClick={onClose}
      />

      {/* Right Sidebar Drawer - Smooth slide-in animation */}
      <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transform transition-transform duration-300 ease-in-out animate-slide-in-right">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Logo */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md">
                {tool.logoUrl ? (
                  <img src={tool.logoUrl} alt={`${tool.name} logo`} className="w-10 h-10 object-contain" />
                ) : (
                  <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{tool.name}</h1>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {tool.tagline}
                </p>
                {/* Badges, Category & Website */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {/* More Links Dropdown */}
                  {(tool.websiteUrl || tool.documentationUrl || tool.pricingUrl) && (
                    <div className="relative">
                      <button
                        onClick={() => setShowLinksDropdown(!showLinksDropdown)}
                        className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
                        aria-label="More links"
                      >
                        Links
                      </button>
                      {showLinksDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowLinksDropdown(false)}
                          />
                          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                            {tool.websiteUrl && (
                              <a
                                href={tool.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => setShowLinksDropdown(false)}
                              >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                Website
                              </a>
                            )}
                            {tool.documentationUrl && (
                              <a
                                href={tool.documentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => setShowLinksDropdown(false)}
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                                Documentation
                              </a>
                            )}
                            {tool.pricingUrl && (
                              <a
                                href={tool.pricingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => setShowLinksDropdown(false)}
                              >
                                <CurrencyDollarIcon className="w-4 h-4" />
                                Pricing
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <span className="px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full">
                    {tool.categoryDisplay}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Taxonomy Categories */}
            {tool.tags.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faTags} className="w-3.5 h-3.5" />
                  Categories
                </h2>
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-full border border-primary-200 dark:border-primary-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Brief Description */}
            <section className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faAlignLeft} className="w-3.5 h-3.5" />
                Description
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                {tool.overview || tool.description}
              </p>
            </section>

            {/* Use Cases */}
            {tool.useCases.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faListCheck} className="w-3.5 h-3.5" />
                  Use cases
                </h2>
                <ul className="space-y-1 text-sm">
                  {tool.useCases.slice(0, 3).map((useCase, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{useCase.title}:</span>
                        {useCase.description && <> {useCase.description}</>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Latest updates and why they matter */}
            {tool.bestPractices.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5" />
                  What's new & why it matters
                </h2>
                {(tool.lastVerifiedAt || tool.updatedAt) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    Last updated:{' '}
                    {new Date(tool.lastVerifiedAt || tool.updatedAt).toLocaleDateString()}
                  </p>
                )}
                <ul className="space-y-1 text-sm">
                  {tool.bestPractices.slice(0, 3).map((practice, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                      <span className="text-gray-700 dark:text-gray-300">{practice}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* AllThrive Projects Using This Tool */}
            <section className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faFolderOpen} className="w-3.5 h-3.5" />
                All Thrive projects using this tool
              </h2>
              <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  Project showcase coming soon...
                </p>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
