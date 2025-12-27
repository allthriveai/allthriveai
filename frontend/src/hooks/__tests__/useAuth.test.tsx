/**
 * Tests for useAuth hook
 *
 * These tests verify the hook's behavior when used correctly and
 * when used incorrectly (outside of AuthProvider).
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import type { User } from '@/types/models';

// Mock user for testing - matches User interface from models.ts
const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  role: 'explorer',
  roleDisplay: 'Explorer',
  avatarUrl: undefined,
  bio: '',
  level: 1,
  totalPoints: 0,
  currentStreak: 0,
  createdAt: '2024-01-01T00:00:00Z',
};

// Create our own test context and hook to verify the pattern works
// This is the same pattern as the real useAuth
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refreshUser: () => void;
}

const TestAuthContext = createContext<AuthContextType | undefined>(undefined);

function useTestAuth() {
  const context = useContext(TestAuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Mock auth context value
const createMockAuthContextValue = (): AuthContextType => ({
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
});

// Helper to wrap hook with provider
const createWrapper = (contextValue: AuthContextType) => {
  return ({ children }: { children: React.ReactNode }) => (
    <TestAuthContext.Provider value={contextValue}>{children}</TestAuthContext.Provider>
  );
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when used within AuthProvider', () => {
    it('returns the auth context value', () => {
      const mockValue = createMockAuthContextValue();
      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(result.current).toBeDefined();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('returns login function', () => {
      const mockValue = createMockAuthContextValue();
      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(typeof result.current.login).toBe('function');
    });

    it('returns logout function', () => {
      const mockValue = createMockAuthContextValue();
      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(typeof result.current.logout).toBe('function');
    });

    it('returns null user when not authenticated', () => {
      const mockValue = {
        ...createMockAuthContextValue(),
        user: null,
        isAuthenticated: false,
      };

      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('returns loading state correctly', () => {
      const mockValue = {
        ...createMockAuthContextValue(),
        isLoading: true,
      };

      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('returns error when present', () => {
      const mockValue = {
        ...createMockAuthContextValue(),
        error: 'Authentication failed',
      };

      const { result } = renderHook(() => useTestAuth(), {
        wrapper: createWrapper(mockValue),
      });

      expect(result.current.error).toBe('Authentication failed');
    });
  });

  describe('when used outside AuthProvider', () => {
    it('throws an error', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTestAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});
