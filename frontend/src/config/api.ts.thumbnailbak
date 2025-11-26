// API configuration
// In browser, requests go directly to the backend (no proxy needed)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  battleInvitations: {
    create: `${API_BASE_URL}/me/battle-invitations/create_invitation/`,
  },
};

// Helper function for API calls with credentials
export const apiFetch = (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};
