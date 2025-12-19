/**
 * GitLabFlow - Self-contained GitLab integration flow component
 *
 * Handles the complete GitLab integration:
 * 1. Connect to GitLab (OAuth)
 * 2. Select project to import
 *
 * Features:
 * - Search/filter projects
 * - Shows project stats (stars, visibility)
 * - Loading states
 * - Error handling
 */

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGitlab } from '@fortawesome/free-brands-svg-icons';
import {
  StarIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import type { GitLabProject } from '@/services/gitlab';
import type { IntegrationFlowState } from '../core/types';

interface GitLabFlowProps {
  state: IntegrationFlowState;
  projects: GitLabProject[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectProject: (project: GitLabProject) => void;
  onConnect: () => void;
  onBack: () => void;
}

export function GitLabFlow({
  state,
  projects,
  searchQuery,
  onSearchChange,
  onSelectProject,
  onConnect,
  onBack,
}: GitLabFlowProps) {
  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.fullName.toLowerCase().includes(query) ||
      (project.description && project.description.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  // Loading state
  if (state.step === 'loading') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <FontAwesomeIcon icon={faGitlab} className="w-6 h-6 text-orange-400 animate-pulse" />
          <span className="text-sm text-slate-400">{state.message}</span>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-700/30 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Connect state
  if (state.step === 'connect') {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="text-center py-6">
          <FontAwesomeIcon icon={faGitlab} className="w-12 h-12 text-orange-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect GitLab</h3>
          <p className="text-sm text-slate-400 mb-6">{state.message}</p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faGitlab} />
            Connect GitLab
          </button>
        </div>
      </div>
    );
  }

  // Select project state
  if (state.step === 'select') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>
          <span className="text-xs text-slate-500">{state.message}</span>
        </div>

        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Project list */}
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {searchQuery ? 'No projects found matching your search.' : 'No projects found.'}
            </p>
          ) : (
            filteredProjects.map((project) => (
              <button
                key={project.htmlUrl}
                onClick={() => onSelectProject(project)}
                className="w-full p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-lg text-left transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {project.avatarUrl ? (
                    <img
                      src={project.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded bg-slate-700 flex-shrink-0"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faGitlab}
                      className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white group-hover:text-orange-300 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {project.fullName}
                    </div>
                    {project.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        {project.isPrivate ? (
                          <>
                            <LockClosedIcon className="w-3 h-3" />
                            Private
                          </>
                        ) : (
                          <>
                            <GlobeAltIcon className="w-3 h-3" />
                            Public
                          </>
                        )}
                      </span>
                      {project.stars > 0 && (
                        <span className="flex items-center gap-1">
                          <StarIcon className="w-3 h-3" />
                          {project.stars}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faGitlab} className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm text-red-400">{state.error}</p>
        </div>
      </div>
    );
  }

  return null;
}
