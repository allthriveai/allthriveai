/**
 * Tests for auth service
 *
 * These tests verify the auth service functions work correctly,
 * including proper API calls and response handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@/types/models';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  ensureCsrfToken: vi.fn(),
}));

// Import after mocking
import { api, ensureCsrfToken } from './api';
import {
  login,
  logout,
  getCurrentUser,
  getUserByUsername,
  refreshToken,
  getUserActivity,
  getActivityInsights,
  updateProfile,
  deactivateAccount,
  deleteAccount,
} from './auth';

// Mock user data - matches User interface from models.ts
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
  totalPoints: 100,
  currentStreak: 5,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('login', () => {
    it('calls login endpoint with credentials', async () => {
      (api.post as any).mockResolvedValue({ data: { data: mockUser } });

      const credentials = { email: 'test@example.com', password: 'password123' };
      const result = await login(credentials);

      expect(api.post).toHaveBeenCalledWith('/auth/login/', credentials);
      expect(result).toEqual(mockUser);
    });

    it('throws on API error', async () => {
      const error = new Error('Invalid credentials');
      (api.post as any).mockRejectedValue(error);

      await expect(login({ email: 'test@example.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('ensures CSRF token and calls logout endpoint', async () => {
      (ensureCsrfToken as any).mockResolvedValue(undefined);
      (api.post as any).mockResolvedValue({});

      await logout();

      expect(ensureCsrfToken).toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledWith('/auth/logout/');
    });

    it('calls ensureCsrfToken before logout', async () => {
      const callOrder: string[] = [];

      (ensureCsrfToken as any).mockImplementation(async () => {
        callOrder.push('csrf');
      });
      (api.post as any).mockImplementation(async () => {
        callOrder.push('logout');
      });

      await logout();

      expect(callOrder).toEqual(['csrf', 'logout']);
    });
  });

  describe('getCurrentUser', () => {
    it('calls me endpoint with skip auth redirect header', async () => {
      (api.get as any).mockResolvedValue({ data: { data: mockUser } });

      const result = await getCurrentUser();

      expect(api.get).toHaveBeenCalledWith('/auth/me/', {
        headers: { 'X-Skip-Auth-Redirect': 'true' },
      });
      expect(result).toEqual(mockUser);
    });

    it('throws when not authenticated', async () => {
      const error = new Error('Not authenticated');
      (api.get as any).mockRejectedValue(error);

      await expect(getCurrentUser()).rejects.toThrow('Not authenticated');
    });
  });

  describe('getUserByUsername', () => {
    it('fetches user by username', async () => {
      (api.get as any).mockResolvedValue({ data: { data: mockUser } });

      const result = await getUserByUsername('testuser');

      expect(api.get).toHaveBeenCalledWith('/users/testuser/');
      expect(result).toEqual(mockUser);
    });

    it('handles special characters in username', async () => {
      (api.get as any).mockResolvedValue({ data: { data: mockUser } });

      await getUserByUsername('user-name_123');

      expect(api.get).toHaveBeenCalledWith('/users/user-name_123/');
    });
  });

  describe('refreshToken', () => {
    it('calls refresh endpoint', async () => {
      (api.post as any).mockResolvedValue({});

      await refreshToken();

      expect(api.post).toHaveBeenCalledWith('/auth/refresh/');
    });
  });

  describe('getUserActivity', () => {
    it('fetches user activity data', async () => {
      const mockActivity = {
        activities: [],
        statistics: {
          totalLogins: 10,
          lastLogin: '2024-01-15T00:00:00Z',
          accountCreated: '2024-01-01T00:00:00Z',
          quizScores: [],
          projectCount: 5,
          totalPoints: 100,
          level: 2,
          currentStreak: 3,
        },
        pointsFeed: [],
      };

      (api.get as any).mockResolvedValue({ data: { data: mockActivity } });

      const result = await getUserActivity();

      expect(api.get).toHaveBeenCalledWith('/me/activity/');
      expect(result).toEqual(mockActivity);
    });
  });

  describe('getActivityInsights', () => {
    it('fetches activity insights', async () => {
      const mockInsights = {
        toolEngagement: [],
        topicInterests: [],
        activityTrends: [],
        pointsByCategory: [],
        insights: [],
        statsSummary: {
          quizzesCompleted: 5,
          projectsCount: 3,
          totalPoints: 500,
          sideQuestsCompleted: 2,
          currentStreak: 7,
          longestStreak: 14,
        },
        gameStats: {
          games: [],
          totalPlays: 0,
        },
      };

      (api.get as any).mockResolvedValue({ data: { data: mockInsights } });

      const result = await getActivityInsights();

      expect(api.get).toHaveBeenCalledWith('/me/activity/insights/');
      expect(result).toEqual(mockInsights);
    });
  });

  describe('updateProfile', () => {
    it('updates profile with partial data', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      (api.patch as any).mockResolvedValue({ data: { data: updatedUser } });

      const result = await updateProfile({ firstName: 'Updated' });

      expect(api.patch).toHaveBeenCalledWith('/auth/me/', { firstName: 'Updated' });
      expect(result).toEqual(updatedUser);
    });

    it('handles multiple fields', async () => {
      const updates = { firstName: 'New', lastName: 'Name', bio: 'Updated bio' };
      (api.patch as any).mockResolvedValue({ data: { data: { ...mockUser, ...updates } } });

      const result = await updateProfile(updates);

      expect(api.patch).toHaveBeenCalledWith('/auth/me/', updates);
      expect(result.firstName).toBe('New');
      expect(result.lastName).toBe('Name');
    });
  });

  describe('deactivateAccount', () => {
    it('deactivates account successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Account deactivated',
        subscriptionCanceled: true,
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await deactivateAccount();

      expect(api.post).toHaveBeenCalledWith('/me/account/deactivate/');
      expect(result.success).toBe(true);
      expect(result.subscriptionCanceled).toBe(true);
    });
  });

  describe('deleteAccount', () => {
    it('deletes account with correct confirmation', async () => {
      const mockResponse = {
        success: true,
        message: 'Account deleted',
        userId: 1,
        email: 'test@example.com',
      };
      (api.post as any).mockResolvedValue({ data: mockResponse });

      const result = await deleteAccount('DELETE MY ACCOUNT');

      expect(api.post).toHaveBeenCalledWith('/me/account/delete/', {
        confirm: 'DELETE MY ACCOUNT',
      });
      expect(result.success).toBe(true);
    });

    it('fails with incorrect confirmation', async () => {
      const error = new Error('Invalid confirmation');
      (api.post as any).mockRejectedValue(error);

      await expect(deleteAccount('wrong confirmation')).rejects.toThrow();
    });
  });
});
