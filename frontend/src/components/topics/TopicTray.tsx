import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { getTopicDetail, normalizeTopicSlug, type TopicDetail } from '@/services/topics';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { XMarkIcon, HashtagIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faBook } from '@fortawesome/free-solid-svg-icons';

interface TopicTrayProps {
  isOpen: boolean;
  onClose: () => void;
  topicSlug: string;
  onTopicChange?: (newSlug: string) => void;
}

export function TopicTray({ isOpen, onClose, topicSlug }: TopicTrayProps) {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  // Track the visual open state (delayed to allow animation)
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      // First render the component (in closed position)
      setShouldRender(true);
      // Then after a frame, trigger the open animation
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      // Immediately start close animation
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Load topic data when tray is open and topicSlug changes
  useEffect(() => {
    if (isOpen && topicSlug) {
      loadTopic(topicSlug);
    }
  }, [isOpen, topicSlug]);

  async function loadTopic(slug: string) {
    try {
      setIsLoading(true);
      setError(null);
      const normalizedSlug = normalizeTopicSlug(slug);
      const topicData = await getTopicDetail(normalizedSlug, 6);
      setTopic(topicData);
    } catch (err: unknown) {
      console.error('Failed to load topic:', err);
      const errorMessage = err instanceof Error ? err.message : 'Topic not found';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
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
              <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-xl" />
              <div className="flex-1">
                <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-40 mb-2" />
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24" />
              </div>
            </div>
            <button onClick={onClose} className="p-2">
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl" />
            <div className="h-40 bg-gray-300 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      );
    }

    if (error || !topic) {
      return (
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Topic Not Found</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <div
            className="rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
          >
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || 'This topic could not be found.'}
            </p>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Explore other topics
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Header - Fixed with opaque background for readability */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Topic Icon */}
              <div
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <HashtagIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                  {topic.displayName}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {topic.projectCount} {topic.projectCount === 1 ? 'project' : 'projects'}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Definition */}
            <section
              className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faBook} className="w-3.5 h-3.5" />
                Definition
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                {topic.description}
              </p>
            </section>

            {/* Related Projects */}
            <section
              className="bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                  <FontAwesomeIcon icon={faFolderOpen} className="w-3.5 h-3.5" />
                  Related Projects
                </h2>
                {topic.projectCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {topic.projectCount} total
                  </span>
                )}
              </div>

              {topic.projects.length === 0 ? (
                // Empty state
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No projects tagged with "{topic.displayName}" yet
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Explore other topics or create something new!
                  </p>
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-1 mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Explore projects
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                // Loaded state - Show projects and link to explore
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {topic.projects.slice(0, 4).map((project) => (
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
                    to={topic.exploreUrl}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                  >
                    View all {topic.projectCount}{' '}
                    {topic.projectCount === 1 ? 'project' : 'projects'} →
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
          visuallyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer - Smooth slide animation */}
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-96 lg:w-[28rem] border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${
          visuallyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
