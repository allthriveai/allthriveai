/**
 * FeaturedContentSection - Curated content display for curation bots
 */

import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import type { FeaturedContentSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';
import type { Project } from '@/types/models';
import { api } from '@/services/api';
import { ProjectCard } from '@/components/projects/ProjectCard';

interface FeaturedContentSectionProps {
  content: FeaturedContentSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: FeaturedContentSectionContent) => void;
}

export function FeaturedContentSection({
  content,
  user,
  isEditing,
  onUpdate,
}: FeaturedContentSectionProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allUserProjects, setAllUserProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  const projectIds = content?.projectIds || [];
  const maxItems = content?.maxItems || 6;
  const title = content?.title || 'Curated Picks';
  const layout = content?.layout || 'masonry';

  // Fetch all user content for the picker
  const fetchAllProjects = async () => {
    if (allUserProjects.length > 0) return;
    setPickerLoading(true);
    try {
      const response = await api.get(`/users/${user.username}/projects/`);
      const data = response.data;
      let projectList: Project[] = [];
      if (data.showcase || data.playground) {
        projectList = [...(data.showcase || []), ...(data.playground || [])];
      } else if (Array.isArray(data.results)) {
        projectList = data.results;
      } else if (Array.isArray(data)) {
        projectList = data;
      }
      setAllUserProjects(projectList);
    } catch (error) {
      console.error('Failed to fetch all projects:', error);
    } finally {
      setPickerLoading(false);
    }
  };

  // Fetch content details for featured IDs
  useEffect(() => {
    const fetchProjects = async () => {
      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/users/${user.username}/projects/`);
        const data = response.data;
        let allProjects: Project[] = [];
        if (data.showcase || data.playground) {
          allProjects = [...(data.showcase || []), ...(data.playground || [])];
        } else if (Array.isArray(data.results)) {
          allProjects = data.results;
        } else if (Array.isArray(data)) {
          allProjects = data;
        }
        const featured = projectIds
          .map((id: number) => allProjects.find((p: Project) => p.id === id))
          .filter(Boolean) as Project[];
        setProjects(featured);
        setAllUserProjects(allProjects);
      } catch (error) {
        console.error('Failed to fetch featured content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [projectIds, user.username]);

  const handleRemoveProject = (projectId: number) => {
    if (onUpdate) {
      const newIds = projectIds.filter((id: number) => id !== projectId);
      onUpdate({ ...content, projectIds: newIds });
    }
  };

  const handleToggleProject = (projectId: number) => {
    if (!onUpdate) return;

    if (projectIds.includes(projectId)) {
      const newIds = projectIds.filter((id: number) => id !== projectId);
      onUpdate({ ...content, projectIds: newIds });
    } else if (projectIds.length < maxItems) {
      onUpdate({ ...content, projectIds: [...projectIds, projectId] });
    }
  };

  const handleOpenPicker = () => {
    fetchAllProjects();
    setShowPicker(true);
  };

  // Empty state when not editing
  if (projects.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <NewspaperIcon className="w-6 h-6 text-primary-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
        {isEditing && projectIds.length < maxItems && (
          <button
            onClick={handleOpenPicker}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Content
          </button>
        )}
      </div>

      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4" style={{ columnFill: 'auto' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="break-inside-avoid mb-4 inline-block w-full">
              <div className="animate-pulse rounded-lg overflow-hidden">
                <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 bg-gray-100 dark:bg-gray-800">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <NewspaperIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No curated content yet
          </p>
          {isEditing && (
            <button
              onClick={handleOpenPicker}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Select Content
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            layout === 'list'
              ? 'space-y-4'
              : layout === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'columns-1 sm:columns-2 lg:columns-3 gap-4'
          }
          style={layout === 'masonry' ? { columnFill: 'auto' } : undefined}
        >
          {projects.map(project => (
            <div
              key={project.id}
              className={`relative group ${layout === 'masonry' ? 'break-inside-avoid mb-4 inline-block w-full' : ''}`}
            >
              {isEditing && (
                <button
                  onClick={() => handleRemoveProject(project.id)}
                  className="absolute -top-2 -right-2 z-30 p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
              <ProjectCard
                project={project}
                variant="masonry"
                userAvatarUrl={project.userAvatarUrl || user.avatar_url}
              />
            </div>
          ))}
        </div>
      )}

      {/* Content Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Content
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {projectIds.length} of {maxItems} selected
                </p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : allUserProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    No content found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {allUserProjects.map(project => {
                    const isSelected = projectIds.includes(project.id);
                    const isDisabled = !isSelected && projectIds.length >= maxItems;
                    const imageUrl = project.featuredImageUrl || project.bannerUrl;

                    return (
                      <button
                        key={project.id}
                        onClick={() => handleToggleProject(project.id)}
                        disabled={isDisabled}
                        className={`relative text-left rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-primary-500 ring-2 ring-primary-500/20'
                            : isDisabled
                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {imageUrl ? (
                          <div className="h-24 overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-24 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                            <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                              {project.title.charAt(0)}
                            </span>
                          </div>
                        )}

                        <div className="p-3">
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {project.title}
                          </h4>
                          {project.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                              {project.description}
                            </p>
                          )}
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPicker(false)}
                className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
