import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Project } from '@/types/models';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface ProjectsGridProps {
  projects: Project[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
}

export function ProjectsGrid({
  projects,
  isLoading = false,
  emptyMessage = 'No projects found',
  emptyIcon,
}: ProjectsGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          {emptyIcon || <SparklesIcon className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />}
          <p className="text-lg text-gray-600 dark:text-gray-400">{emptyMessage}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Try adjusting your filters or search query
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-4 gap-4" style={{ columnFill: 'auto' }}>
      {projects.map((project) => (
        <div key={project.id} className="break-inside-avoid mb-4 inline-block w-full">
          <ProjectCard
            project={project}
            variant="masonry"
            userAvatarUrl={project.userAvatarUrl}
          />
        </div>
      ))}
    </div>
  );
}
