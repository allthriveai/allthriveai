/**
 * AllProjectsSection - Automatically displays all user projects
 *
 * Unlike FeaturedProjectsSection which requires manual selection,
 * this section automatically fetches and displays all user projects.
 * Projects open in a preview tray when clicked.
 */

import { useState, useEffect } from 'react';
import { EyeIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { AllProjectsSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import type { Project } from '@/types/models';
import { api } from '@/services/api';
import { useProjectPreviewTraySafe } from '@/context/ProjectPreviewTrayContext';

interface AllProjectsSectionProps {
  content: AllProjectsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: AllProjectsSectionContent) => void;
}

// Project Card for the grid - opens in tray on click
function ProjectCard({
  project,
  showDescription = true,
  onOpenPreview,
}: {
  project: Project;
  showDescription?: boolean;
  onOpenPreview: (project: Project) => void;
}) {
  const imageUrl = project.featuredImageUrl || project.bannerUrl;

  // Get the first tool for "Built with" display
  const builtWithTool = project.toolsDetails?.[0] || (project.tools?.[0] as any);
  const toolName = builtWithTool?.name || (typeof builtWithTool === 'string' ? builtWithTool : null);
  const toolIcon = builtWithTool?.iconUrl;

  return (
    <div
      onClick={() => onOpenPreview(project)}
      className="group relative rounded overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenPreview(project);
        }
      }}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-[16/10]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-500/20 via-cyan-500/20 to-secondary-500/20 flex items-center justify-center">
            <span className="text-4xl font-bold text-gray-300 dark:text-gray-600">
              {project.title.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Built with badge */}
        {toolName && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/95 dark:bg-gray-900/95 rounded backdrop-blur-sm">
            {toolIcon && (
              <img src={toolIcon} alt={toolName} className="w-4 h-4 object-contain" />
            )}
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Built with {toolName}
            </span>
          </div>
        )}

        {/* Stats overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
          {project.viewCount !== undefined && project.viewCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/90">
              <EyeIcon className="w-4 h-4" />
              {project.viewCount.toLocaleString()}
            </span>
          )}
          {project.likesCount !== undefined && project.likesCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/90">
              <HeartIconSolid className="w-4 h-4 text-red-400" />
              {project.likesCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Click to see more overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="px-4 py-2 bg-white/95 dark:bg-gray-900/95 rounded text-sm font-medium text-gray-900 dark:text-white shadow-lg">
            Click to see more
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-base text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
          {project.title}
        </h3>

        {/* Description */}
        {showDescription && project.description && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {project.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function AllProjectsSection({
  content,
  user,
  isEditing,
  onUpdate: _onUpdate,
}: AllProjectsSectionProps) {
  // Kept for potential future use (e.g., inline editing of projects)
  void _onUpdate;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const projectPreviewContext = useProjectPreviewTraySafe();
  const openProjectPreview = projectPreviewContext?.openProjectPreview;

  const title = content?.title || 'My Projects';
  const showDescription = content?.showDescription !== false;
  const initialDisplayCount = content?.initialDisplayCount || 6;

  // Fetch all user projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get(`/users/${user.username}/projects/`);
        const data = response.data;
        // Handle both showcase/playground structure and flat array
        let projectList: Project[] = [];
        if (data.showcase || data.playground) {
          // Combine and deduplicate by ID (projects can be in both showcase and playground)
          const combined = [...(data.showcase || []), ...(data.playground || [])];
          const seen = new Set<number>();
          projectList = combined.filter((p: Project) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        } else if (Array.isArray(data.results)) {
          projectList = data.results;
        } else if (Array.isArray(data)) {
          projectList = data;
        }
        setProjects(projectList);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user.username]);

  // Handle opening project in preview tray
  const handleOpenPreview = (project: Project) => {
    if (openProjectPreview) {
      openProjectPreview(project);
    } else {
      // Fallback: navigate to project page if tray context not available
      window.location.href = `/${user.username}/${project.slug}`;
    }
  };

  // Don't show section if user has no projects and not editing
  if (projects.length === 0 && !loading && !isEditing) {
    return null;
  }

  const displayedProjects = showAll ? projects : projects.slice(0, initialDisplayCount);
  const hasMoreProjects = projects.length > initialDisplayCount;

  return (
    <div className="py-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        {projects.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        // Loading skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse rounded overflow-hidden">
              <div className="bg-gray-200 dark:bg-gray-700 aspect-[16/10]" />
              <div className="p-4 bg-gray-100 dark:bg-gray-800">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
          <p className="text-gray-500 dark:text-gray-400">
            No projects yet
          </p>
          {isEditing && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Projects will appear here automatically when you create them
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Projects grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                showDescription={showDescription}
                onOpenPreview={handleOpenPreview}
              />
            ))}
          </div>

          {/* Show more/less button */}
          {hasMoreProjects && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded transition-all duration-200
                  bg-white/70 dark:bg-white/10 backdrop-blur-md
                  text-gray-700 dark:text-gray-300
                  border border-gray-200/60 dark:border-gray-700/60
                  shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]
                  hover:bg-gray-50/80 dark:hover:bg-gray-800/50
                  hover:border-gray-300/80 dark:hover:border-gray-600/80
                  hover:shadow-[0_6px_20px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]
                  hover:scale-[1.02] active:scale-[0.98]"
              >
                {showAll ? (
                  <>
                    <ChevronUpIcon className="w-4 h-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="w-4 h-4" />
                    Show All ({projects.length})
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
