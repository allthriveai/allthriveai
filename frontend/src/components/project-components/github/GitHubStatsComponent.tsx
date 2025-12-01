/**
 * GitHubStatsComponent - Repository statistics display
 */

import type { GitHubStatsComponent as GitHubStatsComponentType } from '@/types/components';
import {
  StarIcon,
  ArrowPathIcon,
  EyeIcon,
  ExclamationCircleIcon,
  ScaleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface GitHubStatsComponentProps {
  component: GitHubStatsComponentType;
}

export function GitHubStatsComponent({ component }: GitHubStatsComponentProps) {
  const { data } = component;
  const {
    repoUrl,
    repoName,
    owner,
    stars,
    forks,
    watchers,
    issues,
    pullRequests,
    license,
    lastUpdated,
    createdAt,
    variant,
  } = data;

  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Badges variant - compact shields.io style badges
  if (variant === 'badges') {
    return (
      <section className="py-6">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {owner}/{repoName}
          </a>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
            <StarIconSolid className="w-4 h-4" />
            {formatNumber(stars)}
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
            <ArrowPathIcon className="w-4 h-4" />
            {formatNumber(forks)}
          </span>

          {license && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">
              <ScaleIcon className="w-4 h-4" />
              {license}
            </span>
          )}
        </div>
      </section>
    );
  }

  // Compact variant - single row stats
  if (variant === 'compact') {
    return (
      <section className="py-6">
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* GitHub logo */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>

            {/* Repo info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {owner}/{repoName}
              </h3>
              {license && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{license}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <StarIcon className="w-4 h-4" />
                {formatNumber(stars)}
              </span>
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <ArrowPathIcon className="w-4 h-4" />
                {formatNumber(forks)}
              </span>
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <EyeIcon className="w-4 h-4" />
                {formatNumber(watchers)}
              </span>
            </div>
          </div>
        </a>
      </section>
    );
  }

  // Full variant - detailed stats card
  return (
    <section className="py-8">
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {repoName}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {owner}
                </p>
              </a>
            </div>

            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-700/50">
          <StatItem
            icon={<StarIcon className="w-5 h-5" />}
            label="Stars"
            value={formatNumber(stars)}
            color="yellow"
          />
          <StatItem
            icon={<ArrowPathIcon className="w-5 h-5" />}
            label="Forks"
            value={formatNumber(forks)}
            color="blue"
          />
          <StatItem
            icon={<EyeIcon className="w-5 h-5" />}
            label="Watchers"
            value={formatNumber(watchers)}
            color="green"
          />
          <StatItem
            icon={<ExclamationCircleIcon className="w-5 h-5" />}
            label="Issues"
            value={formatNumber(issues)}
            color="red"
          />
        </div>

        {/* Footer */}
        {(license || lastUpdated || createdAt || pullRequests !== undefined) && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
            {license && (
              <span className="flex items-center gap-1.5">
                <ScaleIcon className="w-4 h-4" />
                {license}
              </span>
            )}
            {pullRequests !== undefined && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                {formatNumber(pullRequests)} PRs
              </span>
            )}
            {lastUpdated && (
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" />
                Updated {formatDate(lastUpdated)}
              </span>
            )}
            {createdAt && (
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" />
                Created {formatDate(createdAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'yellow' | 'blue' | 'green' | 'red';
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  const colorClasses = {
    yellow: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
    blue: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    green: 'text-green-500 bg-green-100 dark:bg-green-900/30',
    red: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  };

  return (
    <div className="p-6 text-center">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colorClasses[color]} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
