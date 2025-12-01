/**
 * Shared utilities for project blocks
 */

/**
 * Generate a stable unique ID for blocks.
 * Used for React keys and drag-and-drop tracking.
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
