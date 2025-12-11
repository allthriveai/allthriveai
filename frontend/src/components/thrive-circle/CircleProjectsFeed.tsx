/**
 * CircleProjectsFeed - Projects from circle members with Neon Glass aesthetic
 * Uses the existing ProjectCard component in masonry variant
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Project } from '@/types/models';

interface CircleProjectsFeedProps {
  projects: Project[];
  isLoading?: boolean;
}

export function CircleProjectsFeed({ projects, isLoading }: CircleProjectsFeedProps) {
  if (isLoading) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shadow-neon">
            <FontAwesomeIcon icon={faSpinner} spin className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Circle Projects</h3>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="break-inside-avoid animate-pulse rounded-xl bg-white/5 border border-white/10 aspect-[4/3]" />
          ))}
        </div>
      </div>
    );
  }

  // Hide completely if no projects
  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <FontAwesomeIcon icon={faRocket} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Circle Projects</h3>
          <p className="text-xs text-slate-500">
            <span className="text-purple-400">{projects.length}</span> projects from your circle
          </p>
        </div>
      </div>

      {/* Projects Masonry Grid */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
        {projects.slice(0, 8).map((project) => (
          <div key={project.id} className="break-inside-avoid">
            <ProjectCard
              project={project}
              variant="masonry"
              userAvatarUrl={project.userAvatarUrl}
            />
          </div>
        ))}
      </div>

      {/* Show more link if there are more projects */}
      {projects.length > 8 && (
        <div className="mt-4 text-center">
          <a
            href="/explore"
            className="text-sm text-cyan-bright hover:text-cyan-neon transition-colors"
          >
            View all {projects.length} projects →
          </a>
        </div>
      )}

      {/* Circuit connector decoration */}
      <div className="circuit-connector mt-4 opacity-20" />
    </div>
  );
}
