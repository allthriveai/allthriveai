import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToolBySlug, getSimilarTools } from '@/services/tools';
import type { Tool } from '@/types/models';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  SparklesIcon,
  StarIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface RightToolPanelProps {
  toolSlug: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RightToolPanel({ toolSlug, isOpen, onClose }: RightToolPanelProps) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [similarTools, setSimilarTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (toolSlug && isOpen) {
      setTool(null);
      setSimilarTools([]);
      setError(null);
      setIsLoading(true);
      loadTool(toolSlug);
    }
  }, [toolSlug, isOpen]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  async function loadTool(slug: string) {
    try {
      setIsLoading(true);
      const toolData = await getToolBySlug(slug);
      setTool(toolData);

      // Load similar tools
      try {
        const similar = await getSimilarTools(slug);
        setSimilarTools(similar);
      } catch (err) {
        console.error('Failed to load similar tools:', err);
      }
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
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col">
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
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col">
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
            <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-xl flex items-center justify-center overflow-hidden shadow-lg">
                {tool.logoUrl ? (
                  <img src={tool.logoUrl} alt={`${tool.name} logo`} className="w-14 h-14 object-contain" />
                ) : (
                  <SparklesIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{tool.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{tool.tagline}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Badges & Category */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full">
              {tool.categoryDisplay}
            </span>
            {tool.isFeatured && (
              <span className="px-2 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                Featured
              </span>
            )}
            {tool.isVerified && (
              <span className="px-2 py-1 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center gap-1">
                <CheckCircleIcon className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={tool.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              Visit Website
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
            <Link
              to={`/tools/${tool.slug}`}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              Full Page
            </Link>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {tool.description && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                About
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {tool.description}
              </p>
            </section>
          )}

          {/* Key Features */}
          {tool.keyFeatures && tool.keyFeatures.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Key Features
              </h2>
              <ul className="space-y-2">
                {tool.keyFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pricing */}
          {tool.pricingModel && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Pricing
              </h2>
              <div className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                <span className="inline-block px-3 py-1 text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                  {tool.pricingModelDisplay}
                </span>
                {tool.pricingDetails && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{tool.pricingDetails}</p>
                )}
              </div>
            </section>
          )}

          {/* Use Cases */}
          {tool.useCases && tool.useCases.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Use Cases
              </h2>
              <div className="grid gap-2">
                {tool.useCases.map((useCase, index) => (
                  <div key={index} className="glass-subtle rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{useCase}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Similar Tools */}
          {similarTools.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <RocketLaunchIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Similar Tools
              </h2>
              <div className="grid gap-3">
                {similarTools.map((similarTool) => (
                  <Link
                    key={similarTool.id}
                    to={`/tools/${similarTool.slug}`}
                    className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {similarTool.logoUrl ? (
                          <img src={similarTool.logoUrl} alt={similarTool.name} className="w-8 h-8 object-contain" />
                        ) : (
                          <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {similarTool.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{similarTool.tagline}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
