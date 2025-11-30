import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';

/**
 * Detect if a string contains HTML tags
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;

  // Check for common HTML tags that rich text editor produces
  const htmlTagPattern = /<(p|h[1-6]|ul|ol|li|strong|em|a|blockquote|code|pre|br)\b[^>]*>/i;
  return htmlTagPattern.test(content);
}

/**
 * Render content as HTML, handling both markdown and HTML input
 */
export function renderContent(content: string): string {
  if (!content) return '';

  // If content is already HTML, sanitize and return
  if (isHtmlContent(content)) {
    return sanitizeHtml(content);
  }

  // Otherwise, parse as markdown
  const html = marked.parse(content) as string;
  return sanitizeHtml(html);
}

/**
 * Configure marked with default options
 */
export function configureMarked() {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}
