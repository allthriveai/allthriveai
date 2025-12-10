/**
 * Clipped Tab Component
 *
 * Displays all projects the user has clipped:
 * - Projects they've hearted on the platform
 * - External projects they've added from the web (type: 'clipped')
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPaperclip, faHeart, faPlus } from '@fortawesome/free-solid-svg-icons';
import { faChrome } from '@fortawesome/free-brands-svg-icons';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { getClippedProjects } from '@/services/projects';
import type { Project } from '@/types/models';

interface ClippedTabProps {
  username: string;
  isOwnProfile: boolean;
}

export function ClippedTab({ username, isOwnProfile }: ClippedTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    async function fetchClippedProjects() {
      if (!username) return;

      setIsLoading(true);
      setError(null);

      try {
        // Get all clipped content (hearted projects + external clipped projects)
        const clippedProjects = await getClippedProjects(username);
        setProjects(clippedProjects);
      } catch (err) {
        console.error('Failed to load clipped projects:', err);
        setError('Failed to load clipped items');
      } finally {
        setIsLoading(false);
      }
    }

    fetchClippedProjects();
  }, [username]);

  // Auto-hide coming soon toast
  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => setShowComingSoon(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 relative">
        {/* Coming Soon Toast */}
        {showComingSoon && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
              <FontAwesomeIcon icon={faChrome} className="w-5 h-5 text-pink-500" />
              <span className="font-medium">Chrome extension coming soon!</span>
            </div>
          </div>
        )}

        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faPaperclip} className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Nothing clipped yet
        </h3>

        {isOwnProfile ? (
          <div className="max-w-4xl mx-auto">
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Save cool stuff you find around the web and AllThrive
            </p>

            {/* How to clip instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              {/* Heart on Explore */}
              <Link
                to="/explore"
                className="p-6 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors block"
              >
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon icon={faHeart} className="w-6 h-6 text-pink-500" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Heart projects on Explore
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Find cool projects and tap the heart to save them here
                </p>
              </Link>

              {/* Chrome Extension */}
              <button
                onClick={() => setShowComingSoon(true)}
                className="p-6 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors w-full"
              >
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon icon={faChrome} className="w-6 h-6 text-blue-500" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                  Clip from the web
                  <span className="text-xs bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">
                    Soon
                  </span>
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Chrome extension to clip anything while browsing
                </p>
              </button>

              {/* Paste URL in chat */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openAddProject'))}
                className="p-6 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors w-full"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                    boxShadow: '0 2px 8px rgba(34, 211, 238, 0.25)',
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} className="w-6 h-6 text-slate-900" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Paste a URL in +Add Project
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Share a link in the chat and we'll create a project page for you
                </p>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {username} hasn't clipped anything yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faPaperclip} className="w-5 h-5 text-pink-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {projects.length} Clipped
        </h2>
      </div>

      {/* Projects Grid */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
        {projects.map((project) => (
          <div key={project.id} className="break-inside-avoid mb-6">
            <ProjectCard
              project={project}
              onDelete={async () => {}}
              isOwner={false}
              variant="masonry"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
