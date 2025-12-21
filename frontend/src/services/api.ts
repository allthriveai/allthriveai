/**
 * API Client Configuration
 *
 * IMPORTANT: Case Convention
 * ==========================
 * This module automatically transforms API request/response data:
 * - Requests: camelCase → snake_case (for Django backend)
 * - Responses: snake_case → camelCase (for TypeScript frontend)
 *
 * Therefore, ALL TypeScript interfaces for API data MUST use camelCase:
 *
 *   WRONG: interface User { first_name: string; created_at: string }
 *   RIGHT: interface User { firstName: string; createdAt: string }
 *
 * ESLint will warn about snake_case in type properties.
 * See: eslint.config.js → @typescript-eslint/naming-convention
 *
 * EXCEPTIONS:
 * - The `content` field in Project requests is skipped (backend expects camelCase)
 * - WebSocket messages are NOT transformed (see useIntelligentChat.ts)
 * - URL query parameters must be manually converted (use keysToSnake)
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/api';
import { keysToCamel, keysToSnake } from '@/utils/caseTransform';

// Simple cookie reader for CSRF token
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Start with 1 second
  maxRetryDelay: 10000, // Max 10 seconds
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, Rate limit, Server errors
};

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
  // Don't retry if there's no response (handled separately for network errors)
  if (!error.response) {
    // Retry network errors (ECONNRESET, ETIMEDOUT, etc.)
    return error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ECONNABORTED' ||
           error.message.includes('Network Error');
  }

  // Don't retry non-idempotent requests by default (POST, PUT, DELETE)
  // unless explicitly marked as safe to retry
  const method = error.config?.method?.toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  if (!isIdempotent) {
    return false;
  }

  return RETRY_CONFIG.retryableStatusCodes.includes(error.response.status);
}

// Calculate delay with exponential backoff and jitter
function getRetryDelay(retryCount: number): number {
  const baseDelay = RETRY_CONFIG.retryDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
  return Math.min(baseDelay + jitter, RETRY_CONFIG.maxRetryDelay);
}

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for httpOnly cookies
});

// Request interceptor - attach CSRF token and transform data to snake_case
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const method = (config.method || 'get').toLowerCase();
    const needsCsrf = ['post', 'put', 'patch', 'delete'].includes(method);

    if (needsCsrf) {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken && config.headers) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    // Transform request data from camelCase to snake_case
    // Skip transformation for FormData (used for file uploads)
    // Skip transformation inside 'content' field (backend expects camelCase there)
    if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
      config.data = keysToSnake(config.data, ['content']);
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Flag to prevent multiple concurrent redirects to auth page
let isRedirectingToAuth = false;

// Promise-based lock for token refresh to prevent race conditions
// When refresh is in progress, all 401 requests wait on this promise
let refreshPromise: Promise<void> | null = null;

// Response interceptor - transform data to camelCase, handle retries, and handle errors
api.interceptors.response.use(
  (response) => {
    // Transform response data from snake_case to camelCase
    if (response.data && typeof response.data === 'object') {
      response.data = keysToCamel(response.data);
    }

    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;

    // Initialize retry count if not present
    if (config && !('__retryCount' in config)) {
      (config as InternalAxiosRequestConfig & { __retryCount: number }).__retryCount = 0;
    }

    const retryCount = config ? (config as InternalAxiosRequestConfig & { __retryCount: number }).__retryCount : 0;

    // Check if we should retry
    if (config && isRetryableError(error) && retryCount < RETRY_CONFIG.maxRetries) {
      (config as InternalAxiosRequestConfig & { __retryCount: number }).__retryCount = retryCount + 1;

      // Wait before retrying
      const delay = getRetryDelay(retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the request
      return api.request(config);
    }

    if (error.response) {
      // Preserve the full response for debugging
      const responseData = error.response.data as Record<string, unknown> | undefined;
      const apiError: ApiError = {
        success: false,
        error: (responseData?.error as string) || error.message || 'An error occurred',
        details: (responseData?.details as Record<string, string[]>) || undefined,
        statusCode: error.response.status,
      };

      // Handle 401 - token expired, attempt refresh then redirect to auth
      // Skip refresh/redirect if:
      // 1. The request has the X-Skip-Auth-Redirect header
      // 2. We're already redirecting (prevent multiple redirects)
      // 3. The failing request is the refresh endpoint itself (prevent infinite loops)
      const skipRedirect = error.config?.headers?.['X-Skip-Auth-Redirect'] === 'true';
      const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');

      if (error.response.status === 401 && !skipRedirect && !isRedirectingToAuth && !isRefreshEndpoint) {
        const currentPath = window.location.pathname;
        // Public paths: /, /auth, /explore, /pricing, /privacy, /terms, /pitch, /perks, /marketplace, and user profiles (/:username)
        const knownRoutes = ['/auth', '/about', '/about-us', '/styleguide', '/learn', '/quizzes', '/tools', '/play', '/thrive-circle', '/account', '/dashboard'];
        const isKnownRoute = knownRoutes.some(route => currentPath === route || currentPath.startsWith(route + '/') || currentPath.startsWith(route + '?'));
        const isUserProfile = /^\/[a-zA-Z0-9_-]+$/.test(currentPath) && !isKnownRoute;
        const isPublicPath = currentPath === '/' || currentPath === '/auth' || currentPath.startsWith('/about') || currentPath.startsWith('/explore') || currentPath === '/pricing' || currentPath === '/privacy' || currentPath === '/terms' || currentPath === '/pitch' || currentPath === '/perks' || currentPath === '/marketplace' || currentPath.startsWith('/battle/invite/') || isUserProfile;

        if (!isPublicPath) {
          // If a refresh is already in progress, wait for it then retry
          if (refreshPromise) {
            try {
              await refreshPromise;
              // Refresh succeeded, retry the original request
              return api(error.config!);
            } catch {
              // Refresh failed, error will be handled below
              return Promise.reject(apiError);
            }
          }

          // Start token refresh with Promise-based lock
          refreshPromise = (async () => {
            try {
              // Attempt to refresh the token
              await api.post('/auth/refresh/');
              // Success! Token refreshed.
            } catch (refreshError) {
              // Refresh failed - redirect to auth
              isRedirectingToAuth = true;

              // Clear any stale auth state
              try {
                sessionStorage.removeItem('auth_state');
                // Clear all localStorage to prevent data leakage
                localStorage.clear();
              } catch {
                // Ignore storage errors
              }

              // Log for observability
              console.warn('Token refresh failed, redirecting to auth:', refreshError);

              // Redirect to auth with return URL
              window.location.href = `/auth?returnUrl=${encodeURIComponent(currentPath)}`;
              throw refreshError;
            }
          })();

          try {
            await refreshPromise;
            // Retry the original request
            return api(error.config!);
          } catch {
            return Promise.reject(apiError);
          } finally {
            // Clear the refresh promise so future 401s can try again
            refreshPromise = null;
          }
        }
      }

      // Handle 403 - Forbidden (user doesn't have permission)
      if (error.response.status === 403) {
        apiError.error = (responseData?.error as string) || 'You do not have permission to access this resource';
      }

      return Promise.reject(apiError);
    }

    // Network error or no response
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const networkError: ApiError = {
      success: false,
      error: isOffline
        ? 'You are offline. Please check your internet connection.'
        : 'Network error. Please check your connection and try again.',
      statusCode: 0,
    };

    return Promise.reject(networkError);
  }
);

// Function to ensure CSRF token is fetched
export async function ensureCsrfToken(): Promise<void> {
  // Check if we already have a CSRF token
  if (getCookie('csrftoken')) {
    return;
  }

  // Fetch CSRF token from backend
  try {
    await api.get('/auth/csrf/');
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
}

export { api };
