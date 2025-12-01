/**
 * PromptComponent - Prompt showcase or highlight
 */

import type { PromptComponent as PromptComponentType } from '@/types/components';

interface PromptComponentProps {
  component: PromptComponentType;
}

export function PromptComponent({ component }: PromptComponentProps) {
  const { data } = component;
  const { prompt, author, authorTitle, authorImage, source, sourceUrl, variant } = data;

  // Simple variant - minimal prompt display
  if (variant === 'simple') {
    return (
      <section className="py-8">
        <blockquote className="border-l-4 border-primary-500 pl-6">
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 italic">
            "{prompt}"
          </p>
          {(author || source) && (
            <footer className="mt-4">
              {author && (
                <cite className="not-italic font-medium text-gray-900 dark:text-white">
                  {author}
                </cite>
              )}
              {authorTitle && (
                <span className="text-gray-500 dark:text-gray-400">
                  {' '}
                  - {authorTitle}
                </span>
              )}
              {source && (
                <span className="text-gray-500 dark:text-gray-400">
                  {author ? ', ' : ''}
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      {source}
                    </a>
                  ) : (
                    source
                  )}
                </span>
              )}
            </footer>
          )}
        </blockquote>
      </section>
    );
  }

  // Card variant - styled card with optional author image
  if (variant === 'card') {
    return (
      <section className="py-8">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-8">
          <svg
            className="w-10 h-10 text-primary-500/30 mb-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
          </svg>

          <blockquote>
            <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300">
              {prompt}
            </p>
          </blockquote>

          {(author || source) && (
            <footer className="mt-6 flex items-center gap-4">
              {authorImage && (
                <img
                  src={authorImage}
                  alt={author || ''}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                {author && (
                  <cite className="not-italic font-semibold text-gray-900 dark:text-white block">
                    {author}
                  </cite>
                )}
                {authorTitle && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {authorTitle}
                  </span>
                )}
                {source && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 block">
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {source}
                      </a>
                    ) : (
                      source
                    )}
                  </span>
                )}
              </div>
            </footer>
          )}
        </div>
      </section>
    );
  }

  // Hero variant - large, visually prominent prompt
  const gradientFrom = data.gradientFrom || 'violet-600';
  const gradientTo = data.gradientTo || 'indigo-600';

  return (
    <section className="py-8">
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-${gradientFrom} to-${gradientTo} px-8 py-16 md:px-16 md:py-20`}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <svg
            className="absolute top-8 left-8 w-24 h-24 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <blockquote>
            <p className="text-2xl md:text-3xl lg:text-4xl text-white font-medium leading-relaxed">
              "{prompt}"
            </p>
          </blockquote>

          {(author || source) && (
            <footer className="mt-8 flex flex-col items-center gap-4">
              {authorImage && (
                <img
                  src={authorImage}
                  alt={author || ''}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
                />
              )}
              <div>
                {author && (
                  <cite className="not-italic font-semibold text-white block">
                    {author}
                  </cite>
                )}
                {authorTitle && (
                  <span className="text-white/80">{authorTitle}</span>
                )}
                {source && (
                  <span className="text-white/80 block">
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white underline"
                      >
                        {source}
                      </a>
                    ) : (
                      source
                    )}
                  </span>
                )}
              </div>
            </footer>
          )}
        </div>
      </div>
    </section>
  );
}
