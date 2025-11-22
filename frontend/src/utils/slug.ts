/**
 * Generate a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns A URL-safe slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-]+/g, '')
    // Remove multiple consecutive hyphens
    .replace(/\-\-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '');
}
