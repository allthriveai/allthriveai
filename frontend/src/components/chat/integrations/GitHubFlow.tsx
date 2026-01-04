/**
 * GitHubFlow - Self-contained GitHub integration flow component
 *
 * Handles the complete GitHub integration:
 * 1. Connect to GitHub (OAuth)
 * 2. Install GitHub App (select repositories)
 * 3. Select repository to import
 *
 * Features:
 * - Search/filter repositories
 * - Shows repo stats (stars, forks, language)
 * - Loading states
 * - Error handling
 */

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  StarIcon,
  CodeBracketIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { GitHubRepository } from '@/services/github';
import type { IntegrationFlowState } from '../core/types';

interface GitHubFlowProps {
  state: IntegrationFlowState;
  repos: GitHubRepository[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectRepo: (repo: GitHubRepository) => void;
  onConnect: () => void;
  onInstallApp: () => void;
  onBack: () => void;
}

export function GitHubFlow({
  state,
  repos,
  searchQuery,
  onSearchChange,
  onSelectRepo,
  onConnect,
  onInstallApp,
  onBack,
}: GitHubFlowProps) {
  // Filter repos by search query
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const query = searchQuery.toLowerCase();
    return repos.filter((repo) =>
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  }, [repos, searchQuery]);

  // Loading state
  if (state.step === 'loading') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <FontAwesomeIcon icon={faGithub} className="w-6 h-6 text-slate-400 animate-pulse" />
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
          <FontAwesomeIcon icon={faGithub} className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect GitHub</h3>
          <p className="text-sm text-slate-400 mb-6">{state.message}</p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faGithub} />
            Connect GitHub
          </button>
        </div>
      </div>
    );
  }

  // Install app state
  if (state.step === 'install') {
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
          <FontAwesomeIcon icon={faGithub} className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Install GitHub App</h3>
          <p className="text-sm text-slate-400 mb-6">{state.message}</p>
          <button
            onClick={onInstallApp}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faGithub} />
            Install All Thrive App
          </button>
        </div>
      </div>
    );
  }

  // Select repository state
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
            placeholder="Search repositories..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Repository list */}
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filteredRepos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {searchQuery ? 'No repositories found matching your search.' : 'No repositories found.'}
            </p>
          ) : (
            filteredRepos.map((repo) => (
              <button
                key={repo.htmlUrl}
                onClick={() => onSelectRepo(repo)}
                className="w-full p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-lg text-left transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <FontAwesomeIcon
                    icon={faGithub}
                    className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white group-hover:text-cyan-300 truncate">
                      {repo.name}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <CodeBracketIcon className="w-3 h-3" />
                          {repo.language}
                        </span>
                      )}
                      {repo.stars > 0 && (
                        <span className="flex items-center gap-1">
                          <StarIcon className="w-3 h-3" />
                          {repo.stars}
                        </span>
                      )}
                      {repo.isPrivate && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                          Private
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Add more repositories link */}
        <div className="pt-3 border-t border-slate-700/50 text-center">
          <button
            onClick={onInstallApp}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            + Add more repositories
          </button>
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
            <FontAwesomeIcon icon={faGithub} className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm text-red-400 mb-4">{state.error}</p>
          <a
            href="/account/settings/integrations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go to Integration Settings
          </a>
        </div>
      </div>
    );
  }

  return null;
}
