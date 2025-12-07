/**
 * Favorites Tab Component
 *
 * Displays all projects the user has hearted/liked.
 */
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { getLikedProjects } from '@/services/projects';
import type { Project } from '@/types/models';

interface FavoritesTabProps {
  username: string;
  isOwnProfile: boolean;
}

export function FavoritesTab({ username, isOwnProfile }: FavoritesTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLikedProjects() {
      if (!username) return;

      setIsLoading(true);
      setError(null);

      try {
        const likedProjects = await getLikedProjects(username);
        setProjects(likedProjects);
      } catch (err) {
        console.error('Failed to load liked projects:', err);
        setError('Failed to load favorites');
      } finally {
        setIsLoading(false);
      }
    }

    fetchLikedProjects();
  }, [username]);

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
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faHeartBroken} className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No favorites yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {isOwnProfile
            ? 'Heart projects you love to save them here!'
            : `${username} hasn't favorited any projects yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faHeart} className="w-5 h-5 text-pink-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {projects.length} Favorite{projects.length !== 1 ? 's' : ''}
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
