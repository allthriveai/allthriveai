/**
 * StatsComponent - Key metrics display
 */

import type { StatsComponent as StatsComponentType } from '@/types/components';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface StatsComponentProps {
  component: StatsComponentType;
}

export function StatsComponent({ component }: StatsComponentProps) {
  const { data } = component;
  const { title, stats, variant } = data;

  // Cards variant - large visual cards
  if (variant === 'cards') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {stat.label}
                </span>
                {stat.change && (
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                      stat.change.direction === 'up'
                        ? 'text-green-600 dark:text-green-400'
                        : stat.change.direction === 'down'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {stat.change.direction === 'up' && (
                      <ArrowTrendingUpIcon className="w-4 h-4" />
                    )}
                    {stat.change.direction === 'down' && (
                      <ArrowTrendingDownIcon className="w-4 h-4" />
                    )}
                    {stat.change.direction === 'neutral' && (
                      <MinusIcon className="w-4 h-4" />
                    )}
                    {stat.change.value}%
                  </span>
                )}
              </div>

              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {typeof stat.value === 'number'
                  ? stat.value.toLocaleString()
                  : stat.value}
              </div>

              {stat.description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {stat.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Inline variant - compact horizontal layout
  if (variant === 'inline') {
    return (
      <section className="py-6">
        {title && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </h2>
        )}

        <div className="flex flex-wrap items-center gap-6 md:gap-10">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {typeof stat.value === 'number'
                  ? stat.value.toLocaleString()
                  : stat.value}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stat.label}
              </span>
              {stat.change && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    stat.change.direction === 'up'
                      ? 'text-green-600 dark:text-green-400'
                      : stat.change.direction === 'down'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {stat.change.direction === 'up' && (
                    <ArrowTrendingUpIcon className="w-3 h-3" />
                  )}
                  {stat.change.direction === 'down' && (
                    <ArrowTrendingDownIcon className="w-3 h-3" />
                  )}
                  {stat.change.value}%
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Highlight variant - featured stats with emphasis
  return (
    <section className="py-8">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          {title}
        </h2>
      )}

      <div className="bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 rounded-2xl p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                {typeof stat.value === 'number'
                  ? stat.value.toLocaleString()
                  : stat.value}
              </div>

              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>

              {stat.change && (
                <div
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                    stat.change.direction === 'up'
                      ? 'text-green-600 dark:text-green-400'
                      : stat.change.direction === 'down'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {stat.change.direction === 'up' && (
                    <ArrowTrendingUpIcon className="w-3 h-3" />
                  )}
                  {stat.change.direction === 'down' && (
                    <ArrowTrendingDownIcon className="w-3 h-3" />
                  )}
                  {stat.change.value}%
                </div>
              )}

              {stat.description && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  {stat.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
