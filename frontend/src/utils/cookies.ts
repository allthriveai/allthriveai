/**
 * Cookie Utilities
 *
 * Functions for reading cookies in the browser.
 */

/**
 * Get a cookie value by name.
 *
 * @param name - The cookie name to retrieve
 * @returns The cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

/**
 * Get the CSRF token from cookies.
 *
 * @returns The CSRF token or null if not found
 */
export function getCsrfToken(): string | null {
  return getCookie('csrftoken');
}
