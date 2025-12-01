/**
 * FeatureGridComponent - Showcase key features/highlights
 */

import type { FeatureGridComponent as FeatureGridComponentType } from '@/types/components';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface FeatureGridComponentProps {
  component: FeatureGridComponentType;
}

export function FeatureGridComponent({ component }: FeatureGridComponentProps) {
  const { data } = component;
  const { title, subtitle, features, columns, variant } = data;

  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  // Cards variant - visual cards with optional images
  if (variant === 'cards') {
    return (
      <section className="py-8">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
        )}

        <div className={`grid ${gridCols[columns]} gap-6`}>
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-200 hover:shadow-lg"
            >
              {feature.image && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              <div className="p-6">
                {feature.icon && !feature.image && (
                  <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                    <span className="text-2xl">{feature.icon}</span>
                  </div>
                )}

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>

                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {feature.description}
                </p>

                {feature.link && (
                  <a
                    href={feature.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    Learn more
                    <ArrowRightIcon className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // List variant - horizontal list with icons
  if (variant === 'list') {
    return (
      <section className="py-8">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50"
            >
              {feature.icon && (
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <span className="text-xl">{feature.icon}</span>
                </div>
              )}

              {feature.image && !feature.icon && (
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
                {feature.link && (
                  <a
                    href={feature.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-600 dark:text-primary-400"
                  >
                    Learn more
                    <ArrowRightIcon className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Icons variant - compact icon-focused grid
  return (
    <section className="py-8">
      {(title || subtitle) && (
        <div className="mb-8 text-center">
          {title && (
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      )}

      <div className={`grid ${gridCols[columns]} gap-8`}>
        {features.map((feature, index) => (
          <div key={index} className="text-center">
            {feature.icon && (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 mb-4">
                <span className="text-3xl">{feature.icon}</span>
              </div>
            )}

            {feature.image && !feature.icon && (
              <div className="inline-block w-14 h-14 rounded-xl overflow-hidden mb-4">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {feature.title}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {feature.description}
            </p>

            {feature.link && (
              <a
                href={feature.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary-600 dark:text-primary-400"
              >
                Learn more
                <ArrowRightIcon className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
