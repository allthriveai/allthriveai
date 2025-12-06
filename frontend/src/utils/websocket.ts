/**
 * WebSocket Configuration Utility
 *
 * ARCHITECTURE DECISION: Direct WebSocket Connection
 * ================================================
 * We use DIRECT WebSocket connections to the backend (localhost:8000 in dev,
 * production URL in prod) rather than proxying through Vite.
 *
 * Why direct connection:
 * 1. Production parity - production won't have a Vite proxy
 * 2. Easier debugging - no proxy layer to troubleshoot
 * 3. Industry standard - Django Channels expects direct connections
 * 4. Simpler architecture - fewer moving parts
 *
 * Configuration:
 * - VITE_WS_URL: Full WebSocket URL (e.g., "ws://localhost:8000")
 *   - Development default: ws://localhost:8000
 *   - Production: wss://api.allthrive.ai (or your production domain)
 *
 * The /api proxy in vite.config.ts is still used for REST API calls,
 * but WebSocket connections go directly to the backend.
 */

/**
 * Get the WebSocket base URL for connecting to the backend.
 *
 * Priority:
 * 1. VITE_WS_URL environment variable (explicit configuration)
 * 2. Default: ws://localhost:8000 for development
 *
 * @returns The WebSocket base URL without trailing slash
 */
export function getWebSocketBaseUrl(): string {
  // Explicit WebSocket URL takes priority
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.replace(/\/$/, '');
  }

  // Default for local development: direct connection to backend
  // In production, VITE_WS_URL should be set to the production WebSocket URL
  return 'ws://localhost:8000';
}

/**
 * Build a complete WebSocket URL for a given path.
 *
 * @param path - The WebSocket path (e.g., "/ws/chat/project-123/")
 * @param queryParams - Optional query parameters
 * @returns Complete WebSocket URL
 *
 * @example
 * buildWebSocketUrl('/ws/chat/project-123/', { connection_token: 'abc123' })
 * // => "ws://localhost:8000/ws/chat/project-123/?connection_token=abc123"
 */
export function buildWebSocketUrl(
  path: string,
  queryParams?: Record<string, string>
): string {
  const baseUrl = getWebSocketBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  let url = `${baseUrl}${normalizedPath}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams(queryParams);
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Log WebSocket URL for debugging (masks sensitive tokens).
 *
 * @param url - The WebSocket URL to log
 * @param prefix - Optional prefix for the log message
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function logWebSocketUrl(_url: string, _prefix = '[WebSocket]'): void {
  // No-op in production - logging suppressed for cleaner console output
}
