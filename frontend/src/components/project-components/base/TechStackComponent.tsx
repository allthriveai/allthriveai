/**
 * TechStackComponent - Technologies and tools used
 */

import type { TechStackComponent as TechStackComponentType } from '@/types/components';

interface TechStackComponentProps {
  component: TechStackComponentType;
}

export function TechStackComponent({ component }: TechStackComponentProps) {
  const { data } = component;
  const { title, technologies, showCategories, variant } = data;

  // Group technologies by category if enabled
  const groupedTech = showCategories
    ? technologies.reduce((acc, tech) => {
        const category = tech.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(tech);
        return acc;
      }, {} as Record<string, typeof technologies>)
    : { all: technologies };

  // Grid variant - logo grid
  if (variant === 'grid') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        {Object.entries(groupedTech).map(([category, techs]) => (
          <div key={category} className="mb-8 last:mb-0">
            {showCategories && category !== 'all' && (
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                {category}
              </h3>
            )}

            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {techs.map((tech, index) => (
                <TechItem key={index} tech={tech} variant="grid" />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  // List variant - detailed list with descriptions
  if (variant === 'list') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        {Object.entries(groupedTech).map(([category, techs]) => (
          <div key={category} className="mb-8 last:mb-0">
            {showCategories && category !== 'all' && (
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                {category}
              </h3>
            )}

            <div className="space-y-3">
              {techs.map((tech, index) => (
                <TechItem key={index} tech={tech} variant="list" />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  // Chips variant - compact inline chips
  return (
    <section className="py-8">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {title}
        </h2>
      )}

      {Object.entries(groupedTech).map(([category, techs]) => (
        <div key={category} className="mb-6 last:mb-0">
          {showCategories && category !== 'all' && (
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {category}
            </h3>
          )}

          <div className="flex flex-wrap gap-2">
            {techs.map((tech, index) => (
              <TechItem key={index} tech={tech} variant="chips" />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

interface TechItemProps {
  tech: TechStackComponentType['data']['technologies'][0];
  variant: 'grid' | 'list' | 'chips';
}

function TechItem({ tech, variant }: TechItemProps) {
  const content = (
    <>
      {variant === 'grid' && (
        <div className="flex flex-col items-center p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-colors group">
          {tech.logoUrl ? (
            <img
              src={tech.logoUrl}
              alt={tech.name}
              className="w-10 h-10 object-contain mb-2"
            />
          ) : tech.icon ? (
            <span className="text-3xl mb-2">{tech.icon}</span>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2">
              <span className="text-lg font-bold text-gray-400">
                {tech.name.charAt(0)}
              </span>
            </div>
          )}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center line-clamp-1">
            {tech.name}
          </span>
        </div>
      )}

      {variant === 'list' && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-colors">
          {tech.logoUrl ? (
            <img
              src={tech.logoUrl}
              alt={tech.name}
              className="w-10 h-10 object-contain"
            />
          ) : tech.icon ? (
            <span className="text-2xl">{tech.icon}</span>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-400">
                {tech.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {tech.name}
            </h4>
            {tech.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                {tech.description}
              </p>
            )}
          </div>
        </div>
      )}

      {variant === 'chips' && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          {tech.logoUrl && (
            <img
              src={tech.logoUrl}
              alt=""
              className="w-4 h-4 object-contain"
            />
          )}
          {tech.icon && !tech.logoUrl && <span>{tech.icon}</span>}
          {tech.name}
        </span>
      )}
    </>
  );

  if (tech.url) {
    return (
      <a
        href={tech.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
}
