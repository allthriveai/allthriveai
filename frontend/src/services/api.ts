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

// Response interceptor - transform data to camelCase, handle retries, and handle errors
api.interceptors.response.use(
  (response) => {
    // Debug: log pagination fields before transformation
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      console.log('[API Interceptor] BEFORE transform - keys:', Object.keys(response.data));
      console.log('[API Interceptor] BEFORE transform - next:', response.data.next);
    }

    // Transform response data from snake_case to camelCase
    if (response.data && typeof response.data === 'object') {
      response.data = keysToCamel(response.data);
    }

    // Debug: log pagination fields after transformation
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      console.log('[API Interceptor] AFTER transform - keys:', Object.keys(response.data));
      console.log('[API Interceptor] AFTER transform - next:', response.data.next);
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
        details: (responseData?.details as Record<string, unknown>) || responseData, // Include full response data
        statusCode: error.response.status,
      };

      // Handle 401 - token expired, redirect to auth
      // Skip redirect if:
      // 1. The request has the X-Skip-Auth-Redirect header
      // 2. We're already redirecting (prevent multiple redirects)
      // 3. We're already on the auth page
      const skipRedirect = error.config?.headers?.['X-Skip-Auth-Redirect'] === 'true';
      if (error.response.status === 401 && !skipRedirect && !isRedirectingToAuth) {
        const currentPath = window.location.pathname;
        // Public paths: /auth, /explore, and user profiles (/:username)
        // User profiles are single-segment paths that aren't known routes
        const knownRoutes = ['/auth', '/about', '/about-us', '/styleguide', '/learn', '/quick-quizzes', '/tools', '/play', '/thrive-circle', '/account', '/dashboard'];
        const isKnownRoute = knownRoutes.some(route => currentPath === route || currentPath.startsWith(route + '/') || currentPath.startsWith(route + '?'));
        // Check if it's a user profile path (single segment that's not a known route)
        const isUserProfile = /^\/[a-zA-Z0-9_-]+$/.test(currentPath) && !isKnownRoute;
        const isPublicPath = currentPath === '/auth' || currentPath.startsWith('/explore') || isUserProfile;

        if (!isPublicPath) {
          // Set flag to prevent multiple redirects from concurrent requests
          isRedirectingToAuth = true;

          // Clear any stale auth state
          try {
            sessionStorage.removeItem('auth_state');
          } catch {
            // Ignore storage errors
          }

          // Redirect to auth with return URL
          window.location.href = `/auth?returnUrl=${encodeURIComponent(currentPath)}`;
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
