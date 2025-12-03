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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white/5 border border-white/10 aspect-[4/3]" />
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

      {/* Projects Grid - 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.slice(0, 6).map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            variant="masonry"
            userAvatarUrl={project.userAvatarUrl}
          />
        ))}
      </div>

      {/* Show more link if there are more projects */}
      {projects.length > 6 && (
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
