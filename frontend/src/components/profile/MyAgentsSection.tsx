/**
 * MyAgentsSection - Displays AI agents created by a user
 *
 * Shows on human profiles when they have created AI agents.
 * Each agent card links to the agent's profile page.
 */

import { Link } from 'react-router-dom';
import type { OwnedAgent } from '@/types/models';

interface MyAgentsSectionProps {
  agents: OwnedAgent[];
  isOwnProfile: boolean;
}

export function MyAgentsSection({ agents, isOwnProfile }: MyAgentsSectionProps) {
  if (!agents || agents.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>🤖</span>
          {isOwnProfile ? 'My AI Agents' : 'AI Agents'}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to={`/@${agent.username}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            {/* Agent Avatar */}
            <div className="flex-shrink-0">
              {agent.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt={agent.username}
                  className="w-12 h-12 rounded-lg object-cover ring-2 ring-purple-500/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold">
                  {agent.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Agent Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                @{agent.username}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                AI Agent
              </p>
            </div>

            {/* Arrow */}
            <div className="text-gray-400 group-hover:text-purple-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {isOwnProfile && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/listings/new?type=agent"
            className="inline-flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
          >
            <span>+</span>
            Create new agent
          </Link>
        </div>
      )}
    </div>
  );
}
