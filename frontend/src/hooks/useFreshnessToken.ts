import { useRef } from 'react';

/**
 * Generates a new freshness token on every component mount.
 * Token stays stable during re-renders (for pagination consistency) but
 * regenerates on navigation (for fresh content on each page visit).
 *
 * Used to ensure the explore feed shows different content each time
 * the user visits /explore, while maintaining consistent ordering
 * during infinite scroll pagination.
 */
export function useFreshnessToken(): string {
  const tokenRef = useRef<string | null>(null);

  if (tokenRef.current === null) {
    tokenRef.current = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  return tokenRef.current;
}
