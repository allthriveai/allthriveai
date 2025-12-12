/**
 * Linkify - Renders text with URLs converted to clickable links
 *
 * Automatically detects URLs in text and renders them as anchor tags.
 * Preserves whitespace and line breaks.
 */

import { Fragment, useMemo } from 'react';

interface LinkifyProps {
  children: string;
  className?: string;
  linkClassName?: string;
}

// URL regex pattern - matches http(s) URLs
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;

export function Linkify({ children, className, linkClassName }: LinkifyProps) {
  const parts = useMemo(() => {
    if (!children) return [];

    const result: Array<{ type: 'text' | 'link'; content: string }> = [];
    let lastIndex = 0;

    children.replace(URL_REGEX, (match, _url, index) => {
      // Add text before the URL
      if (index > lastIndex) {
        result.push({ type: 'text', content: children.slice(lastIndex, index) });
      }

      // Add the URL
      result.push({ type: 'link', content: match });
      lastIndex = index + match.length;

      return match;
    });

    // Add remaining text after the last URL
    if (lastIndex < children.length) {
      result.push({ type: 'text', content: children.slice(lastIndex) });
    }

    return result;
  }, [children]);

  const defaultLinkClassName =
    'text-primary-600 dark:text-primary-400 hover:underline break-all';

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            href={part.content}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName || defaultLinkClassName}
          >
            {part.content}
          </a>
        ) : (
          <Fragment key={index}>{part.content}</Fragment>
        )
      )}
    </span>
  );
}
