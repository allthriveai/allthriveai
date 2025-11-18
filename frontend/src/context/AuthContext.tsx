import { createContext, useState, useEffect, ReactNode } from 'react';
import type { AuthState } from '@/types/models';
import * as authService from '@/services/auth';
import { ensureCsrfToken } from '@/services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check authentication status on mount
  useEffect(() => {
    async function initAuth() {
      await ensureCsrfToken();
      await checkAuth();
    }
    initAuth();
  }, []);

  async function checkAuth() {
    try {
      const user = await authService.getCurrentUser();
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }

  async function login(email: string, password: string, rememberMe = false) {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authService.login({ email, password, rememberMe });
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = (error && typeof error === 'object' && 'error' in error) 
        ? String(error.error) 
        : 'Login failed';
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  }

  async function logout() {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      await authService.logout();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = (error && typeof error === 'object' && 'error' in error) 
        ? String(error.error) 
        : 'Logout failed';
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }

  async function refreshUser() {
    try {
      const user = await authService.getCurrentUser();
      setAuthState((prev) => ({
        ...prev,
        user,
        isAuthenticated: true,
      }));
    } catch {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Export context for hooks/useAuth.ts  
export { AuthContext };
