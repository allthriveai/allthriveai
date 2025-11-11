// User model
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  createdAt: string;
}

// Authentication state
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Login form state
export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  errors: {
    email?: string;
    password?: string;
    form?: string;
  };
  isSubmitting: boolean;
}

// Navigation state
export interface NavigationState {
  returnUrl?: string;
  previousPath?: string;
}

// Authentication status enum
export enum AuthStatus {
  Idle = 'idle',
  Loading = 'loading',
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated',
  Error = 'error',
}

// Storage keys
export const StorageKeys = {
  AUTH_STATE: 'auth_state',
  THEME: 'theme',
  REMEMBER_ME: 'remember_me',
} as const;
