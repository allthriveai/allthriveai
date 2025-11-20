import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
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

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  const [similarTools, setSimilarTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for animation to complete before navigating
    setTimeout(() => {
      navigate(-1);
    }, 300);
  }, [navigate]);

  useEffect(() => {
    if (slug) {
      // Clear previous tool data immediately to prevent stale data flash
      setTool(null);
      setSimilarTools([]);
      setError(null);
      setIsLoading(true);
      loadTool(slug);
    }
  }, [slug]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleClose]);

  async function loadTool(toolSlug: string) {
    try {
      setIsLoading(true);
      const toolData = await getToolBySlug(toolSlug);
      setTool(toolData);

      // Load similar tools
      try {
        const similar = await getSimilarTools(toolSlug);
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

  // Loading state
  if (isLoading) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
            isClosing ? 'opacity-0' : 'animate-[fade-in_0.2s_ease-out]'
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
        <aside className={`fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ${
          isClosing ? 'translate-x-full' : 'animate-[slide-in-right_0.3s_ease-out]'
        }`}>
          <div className="p-6 animate-pulse">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-xl" />
                <div className="flex-1">
                  <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-64" />
                </div>
              </div>
              <button onClick={handleClose} className="p-2">
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
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
            isClosing ? 'opacity-0' : 'animate-[fade-in_0.2s_ease-out]'
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
        <aside className={`fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ${
          isClosing ? 'translate-x-full' : 'animate-[slide-in-right_0.3s_ease-out]'
        }`}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tool Not Found</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-red-600 dark:text-red-400 mb-4">{error || 'This tool could not be found.'}</p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Back to Directory
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
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'animate-[fade-in_0.2s_ease-out]'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside className={`fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] glass-strong border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ${
        isClosing ? 'translate-x-full' : 'animate-[slide-in-right_0.3s_ease-out]'
      }`}>
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
              onClick={handleClose}
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg"
            >
              Visit Website <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
            {tool.documentationUrl && (
              <a
                href={tool.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                <DocumentTextIcon className="w-4 h-4" />
                Docs
              </a>
            )}
            {tool.pricingUrl && (
              <a
                href={tool.pricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                <CurrencyDollarIcon className="w-4 h-4" />
                Pricing
              </a>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Description */}
            <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {tool.overview || tool.description}
              </p>
            </section>

            {/* Key Features */}
            {tool.keyFeatures.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <RocketLaunchIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Key Features
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {tool.keyFeatures.map((feature, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-lg"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">{feature.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Use Cases */}
            {tool.useCases.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <LightBulbIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                  Use Cases
                </h2>
                <div className="space-y-3">
                  {tool.useCases.map((useCase, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-secondary-50 dark:bg-secondary-900/10 border border-secondary-200 dark:border-secondary-800 rounded-lg"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">{useCase.title}</h3>
                      <p className="text-gray-700 dark:text-gray-300 text-xs mb-2">{useCase.description}</p>
                      {useCase.example && (
                        <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded-md">
                          <p className="text-xs text-gray-600 dark:text-gray-400 italic">Example: {useCase.example}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Best Practices */}
            {tool.bestPractices.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Best Practices
                </h2>
                <ul className="space-y-2">
                  {tool.bestPractices.map((practice, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center justify-center text-xs font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-gray-300 text-sm">{practice}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Usage Tips */}
            {tool.usageTips.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  Pro Tips
                </h2>
                <ul className="space-y-2">
                  {tool.usageTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <SparklesIcon className="flex-shrink-0 w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <span className="flex-1 text-gray-700 dark:text-gray-300 text-sm">{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Limitations */}
            {tool.limitations.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  Limitations
                </h2>
                <ul className="space-y-2">
                  {tool.limitations.map((limitation, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="flex-shrink-0 w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5" />
                      <span className="flex-1 text-gray-700 dark:text-gray-300 text-sm">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {/* Technical Details */}
            <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CodeBracketIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Technical Details
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1 text-xs">API Available</div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {tool.apiAvailable ? 'Yes' : 'No'}
                  </div>
                </div>
                {tool.requiresApiKey && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1 text-xs">Requires API Key</div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Yes</div>
                  </div>
                )}
                {tool.requiresWaitlist && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1 text-xs">Access</div>
                    <div className="font-medium text-orange-600 dark:text-orange-400 text-sm">Waitlist Required</div>
                  </div>
                )}
                {tool.integrations.length > 0 && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-2 text-xs">Integrations</div>
                    <div className="flex flex-wrap gap-1">
                      {tool.integrations.map((integration, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {integration}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Links */}
            {(tool.githubUrl || tool.twitterHandle || tool.discordUrl) && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Links</h3>
                <div className="space-y-2 text-sm">
                  {tool.githubUrl && (
                    <a
                      href={tool.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      GitHub
                    </a>
                  )}
                  {tool.twitterHandle && (
                    <a
                      href={`https://twitter.com/${tool.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      Twitter
                    </a>
                  )}
                  {tool.discordUrl && (
                    <a
                      href={tool.discordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      Discord
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Similar Tools */}
            {similarTools.length > 0 && (
              <section className="glass-subtle rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Similar Tools</h3>
                <div className="space-y-2">
                  {similarTools.map((similarTool) => (
                    <Link
                      key={similarTool.id}
                      to={`/tools/${similarTool.slug}`}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-lg flex items-center justify-center overflow-hidden">
                        {similarTool.logoUrl ? (
                          <img src={similarTool.logoUrl} alt={similarTool.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <SparklesIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{similarTool.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{similarTool.tagline}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
