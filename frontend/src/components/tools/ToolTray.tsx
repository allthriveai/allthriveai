import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { getToolBySlug } from '@/services/tools';
import { exploreProjects } from '@/services/explore';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Tool, Project } from '@/types/models';
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

  // Track if tray should be rendered (for slide-out animation)
  // Start with true so the tray renders immediately (closed position), allowing slide-in animation
  const [shouldRender, setShouldRender] = useState(true);

  // Projects using this tool
  const [projectsUsingTool, setProjectsUsingTool] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [totalProjectCount, setTotalProjectCount] = useState(0);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Load tool data when tray is open and toolSlug changes
  // This avoids unnecessary background requests while scrolling feeds
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

  // Fetch projects using this tool when tray is open and tool is loaded
  useEffect(() => {
    if (isOpen && tool?.id) {
      loadProjectsUsingTool(tool.id);
    }
  }, [isOpen, tool?.id]);

  async function loadProjectsUsingTool(toolId: number) {
    try {
      setProjectsLoading(true);
      const response = await exploreProjects({
        tools: [toolId],
        page_size: 20, // Fetch more to account for client-side filtering
        sort: 'trending',
      });

      // Client-side filter to ensure only projects with this tool are shown
      const filteredProjects = response.results.filter((project) =>
        project.tools && project.tools.includes(toolId)
      );

      // Take only first 4 after filtering
      setProjectsUsingTool(filteredProjects.slice(0, 4));

      // Count should reflect actual filtered count
      const totalFiltered = response.results.filter((project) =>
        project.tools && project.tools.includes(toolId)
      ).length;

      // Estimate total count based on filter ratio
      const filterRatio = response.results.length > 0
        ? totalFiltered / response.results.length
        : 1;
      setTotalProjectCount(Math.round(response.count * filterRatio));
    } catch (err) {
      console.error('Failed to load projects using tool:', err);
      setProjectsUsingTool([]);
      setTotalProjectCount(0);
    } finally {
      setProjectsLoading(false);
    }
  }

  if (!shouldRender) return null;

  // Render content based on state
  const renderContent = () => {
    if (isLoading) {
      return (
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
      );
    }

    if (error || !tool) {
      return (
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
      );
    }

    return (
      <>
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Logo */}
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden bg-white border border-gray-200 dark:border-gray-700 shadow-md" style={{ borderRadius: 'var(--radius)' }}>
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
            <section className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700" style={{ borderRadius: 'var(--radius)' }}>
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
              <section className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700" style={{ borderRadius: 'var(--radius)' }}>
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
              <section className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700" style={{ borderRadius: 'var(--radius)' }}>
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

            {/* All Thrive Projects Using This Tool */}
            <section className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700" style={{ borderRadius: 'var(--radius)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                  <FontAwesomeIcon icon={faFolderOpen} className="w-3.5 h-3.5" />
                  Projects using {tool.name}
                </h2>
                {totalProjectCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalProjectCount} total
                  </span>
                )}
              </div>

              {projectsLoading ? (
                // Loading state - Show 4 skeleton cards in 2-column grid
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32" />
                    </div>
                  ))}
                </div>
              ) : projectsUsingTool.length === 0 ? (
                // Empty state - No projects using this tool
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No projects using {tool.name} yet
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Be the first to build something!
                  </p>
                </div>
              ) : (
                // Loaded state - Show projects and link to explore
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {projectsUsingTool.map((project) => (
                      <div key={project.id} className="break-inside-avoid">
                        <ProjectCard
                          project={project}
                          variant="masonry"
                          userAvatarUrl={project.userAvatarUrl}
                        />
                      </div>
                    ))}
                  </div>
                  <Link
                    to={`/explore?tab=tools&tools=${tool.slug}`}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                  >
                    View all {totalProjectCount} {totalProjectCount === 1 ? 'project' : 'projects'}{' '}
                    using {tool.name} →
                  </Link>
                </>
              )}
            </section>
          </div>
        </div>
      </>
    );
  };

  // Use portal to render tray at document body level to escape parent overflow/z-index constraints
  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer - Smooth slide animation */}
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-96 lg:w-[32rem] border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {renderContent()}
      </aside>
    </>,
    document.body
  );
}
