import { createContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AuthState } from '@/types/models';
import * as authService from '@/services/auth';
import { ensureCsrfToken } from '@/services/api';
import { setUser as setSentryUser } from '@/utils/sentry';
import { analytics } from '@/utils/analytics';
import { applyStoredReferralCode, hasPendingReferralCode } from '@/services/referral';

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

  // Track if we've already tried to apply a referral code to prevent duplicate attempts
  const referralAppliedRef = useRef(false);

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
      // Update Sentry user context
      setSentryUser({
        id: user.id.toString(),
        email: user.email,
        username: user.username,
      });
      // Identify user in analytics
      analytics.identifyUser(user.id.toString(), {
        email: user.email,
        username: user.username,
        role: user.role,
        tier: user.subscription_tier,
        totalPoints: user.total_points,
      });

      // Apply pending referral code if user just signed up
      // Only try once per session to avoid repeated API calls
      if (!referralAppliedRef.current && hasPendingReferralCode()) {
        referralAppliedRef.current = true;
        try {
          await applyStoredReferralCode();
        } catch (error) {
          console.warn('Failed to apply referral code:', error);
        }
      }
    } catch {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      // Clear Sentry user context
      setSentryUser(null);
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
      // Update Sentry user context
      setSentryUser({
        id: user.id.toString(),
        email: user.email,
        username: user.username,
      });
      // Track login and identify user
      analytics.loginCompleted('email');
      analytics.identifyUser(user.id.toString(), {
        email: user.email,
        username: user.username,
        role: user.role,
        tier: user.subscription_tier,
        totalPoints: user.total_points,
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
      // Clear Sentry user context on login failure
      setSentryUser(null);
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
      // Clear Sentry user context on logout
      setSentryUser(null);
      // Reset analytics tracking
      analytics.reset();
      // Clear all local storage to prevent data leakage between sessions
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Ignore storage errors in restricted contexts
      }
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
      // Update Sentry user context
      setSentryUser({
        id: user.id.toString(),
        email: user.email,
        username: user.username,
      });
    } catch {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      // Clear Sentry user context
      setSentryUser(null);
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
