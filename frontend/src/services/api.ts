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

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
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

// Response interceptor - transform data to camelCase and handle errors
api.interceptors.response.use(
  (response) => {
    // Transform response data from snake_case to camelCase
    if (response.data && typeof response.data === 'object') {
      response.data = keysToCamel(response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // Preserve the full response for debugging
      const apiError: ApiError = {
        success: false,
        error: error.response.data?.error || error.message || 'An error occurred',
        details: error.response.data?.details || error.response.data, // Include full response data
        statusCode: error.response.status,
      };

      // Handle 401 - token expired, redirect to login
      if (error.response.status === 401) {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/' && currentPath !== '/about') {
          window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
        }
      }

      return Promise.reject(apiError);
    }

    // Network error or no response
    const networkError: ApiError = {
      success: false,
      error: 'Network error. Please check your connection.',
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
