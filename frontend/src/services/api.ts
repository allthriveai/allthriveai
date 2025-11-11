import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/api';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for httpOnly cookies
});

// Request interceptor - add auth tokens if needed
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Headers are already set up for cookies
    // CSRF token will be handled by Django middleware
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const apiError: ApiError = {
        success: false,
        error: error.response.data?.error || error.message || 'An error occurred',
        details: error.response.data?.details,
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

export { api };
