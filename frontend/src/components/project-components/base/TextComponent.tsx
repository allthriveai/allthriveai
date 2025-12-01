/**
 * TextComponent - Rich text content block
 */

import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import type { TextComponent as TextComponentType } from '@/types/components';

interface TextComponentProps {
  component: TextComponentType;
}

export function TextComponent({ component }: TextComponentProps) {
  const { data } = component;
  const { title, content, variant } = data;

  const renderedContent = sanitizeHtml(marked.parse(content) as string);

  // Prose variant - standard readable text
  if (variant === 'prose') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div
          className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </section>
    );
  }

  // Centered variant - centered text for emphasis
  if (variant === 'centered') {
    return (
      <section className="py-12 text-center">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div
          className="prose dark:prose-invert max-w-2xl mx-auto prose-headings:font-bold prose-a:text-primary-600 dark:prose-a:text-primary-400"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </section>
    );
  }

  // Highlight variant - emphasized content box
  return (
    <section className="py-8">
      <div className="bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 rounded-2xl p-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div
          className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary-600 dark:prose-a:text-primary-400"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </div>
    </section>
  );
}
