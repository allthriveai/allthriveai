/**
 * LinksComponent - External resources and references
 */

import type { LinksComponent as LinksComponentType } from '@/types/components';
import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlayCircleIcon,
  NewspaperIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface LinksComponentProps {
  component: LinksComponentType;
}

const linkTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  docs: DocumentTextIcon,
  github: CodeBracketIcon,
  demo: PlayCircleIcon,
  video: PlayCircleIcon,
  article: NewspaperIcon,
  book: BookOpenIcon,
  external: LinkIcon,
};

function getLinkIcon(type?: string): React.ComponentType<{ className?: string }> {
  if (!type) return LinkIcon;
  return linkTypeIcons[type] || LinkIcon;
}

export function LinksComponent({ component }: LinksComponentProps) {
  const { data } = component;
  const { title, links, variant } = data;

  // Cards variant - visual cards
  if (variant === 'cards') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((link, index) => {
            const Icon = getLinkIcon(link.type);
            return (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                  {link.icon ? (
                    <span className="text-xl">{link.icon}</span>
                  ) : (
                    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      {link.label}
                    </h4>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {link.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {link.description}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </section>
    );
  }

  // List variant - simple list
  if (variant === 'list') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <ul className="space-y-3">
          {links.map((link, index) => {
            const Icon = getLinkIcon(link.type);
            return (
              <li key={index}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {link.icon ? (
                    <span>{link.icon}</span>
                  ) : (
                    <Icon className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
                  )}
                  <span className="font-medium">{link.label}</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                {link.description && (
                  <p className="ml-8 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {link.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // Compact variant - inline badges
  return (
    <section className="py-8">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {title}
        </h2>
      )}

      <div className="flex flex-wrap gap-3">
        {links.map((link, index) => {
          const Icon = getLinkIcon(link.type);
          return (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {link.icon ? (
                <span>{link.icon}</span>
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="font-medium">{link.label}</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
