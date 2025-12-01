/**
 * GitHubContributorsComponent - Contributor grid display
 */

import type { GitHubContributorsComponent as GitHubContributorsComponentType } from '@/types/components';

interface GitHubContributorsComponentProps {
  component: GitHubContributorsComponentType;
}

export function GitHubContributorsComponent({ component }: GitHubContributorsComponentProps) {
  const { data } = component;
  const { title, contributors, showContributions, limit, variant } = data;

  // Apply limit if specified
  const displayedContributors = limit
    ? contributors.slice(0, limit)
    : contributors;

  // Grid variant - avatar grid
  if (variant === 'grid') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
          {displayedContributors.map((contributor, index) => (
            <a
              key={index}
              href={contributor.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <div className="relative">
                <img
                  src={contributor.avatarUrl}
                  alt={contributor.username}
                  className="w-12 h-12 rounded-full ring-2 ring-transparent group-hover:ring-primary-500 transition-all"
                />
                {showContributions && contributor.contributions > 0 && (
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary-500 text-white rounded-full">
                    {contributor.contributions > 999
                      ? '999+'
                      : contributor.contributions}
                  </span>
                )}
              </div>
              <span className="mt-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-full group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {contributor.username}
              </span>
            </a>
          ))}
        </div>

        {limit && contributors.length > limit && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            +{contributors.length - limit} more contributors
          </p>
        )}
      </section>
    );
  }

  // List variant - detailed contributor list
  if (variant === 'list') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="space-y-3">
          {displayedContributors.map((contributor, index) => (
            <a
              key={index}
              href={contributor.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-colors"
            >
              <img
                src={contributor.avatarUrl}
                alt={contributor.username}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                  {contributor.username}
                </h4>
                {showContributions && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {contributor.contributions} contributions
                  </p>
                )}
              </div>
              {showContributions && (
                <div className="flex-shrink-0">
                  <ContributionBar
                    contributions={contributor.contributions}
                    maxContributions={Math.max(
                      ...contributors.map((c) => c.contributions)
                    )}
                  />
                </div>
              )}
            </a>
          ))}
        </div>

        {limit && contributors.length > limit && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            +{contributors.length - limit} more contributors
          </p>
        )}
      </section>
    );
  }

  // Avatars variant - compact avatar stack
  return (
    <section className="py-6">
      <div className="flex items-center gap-4">
        {title && (
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title}
          </h3>
        )}

        <div className="flex -space-x-3">
          {displayedContributors.slice(0, 8).map((contributor, index) => (
            <a
              key={index}
              href={contributor.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative hover:z-10 transition-transform hover:scale-110"
              title={`${contributor.username}${
                showContributions
                  ? ` (${contributor.contributions} contributions)`
                  : ''
              }`}
            >
              <img
                src={contributor.avatarUrl}
                alt={contributor.username}
                className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-gray-900"
              />
            </a>
          ))}

          {contributors.length > 8 && (
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 ring-2 ring-white dark:ring-gray-900 text-sm font-medium text-gray-600 dark:text-gray-400">
              +{contributors.length - 8}
            </span>
          )}
        </div>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          {contributors.length} contributors
        </span>
      </div>
    </section>
  );
}

interface ContributionBarProps {
  contributions: number;
  maxContributions: number;
}

function ContributionBar({ contributions, maxContributions }: ContributionBarProps) {
  const percentage = (contributions / maxContributions) * 100;

  return (
    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary-500 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
