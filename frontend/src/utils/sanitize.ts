import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Unsanitized HTML string
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(dirty: string, options?: DOMPurify.Config): string {
  if (!dirty) return '';

  // Default configuration allows common formatting tags
  const defaultConfig: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a',
      'ul', 'ol', 'li', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'hr', 'img', 'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'class'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };

  const config = options || defaultConfig;
  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize plain text (strips all HTML)
 * @param dirty - Unsanitized string
 * @returns Plain text with HTML stripped
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
