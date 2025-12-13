/**
 * Tests for AsyncBattleContext
 *
 * Covers:
 * - Initial state with no battles
 * - Fetching and transforming battle data from API
 * - Categorizing battles into yourTurn, theirTurn, judging, pendingInvitations
 * - Computed values (urgentBattles, hasUrgentBattle, mostUrgentBattle)
 * - Actions (extendDeadline, sendReminder, startTurn)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AsyncBattleProvider, useAsyncBattles } from './AsyncBattleContext';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock BattleNotificationProvider
const mockRegisterAsyncCallbacks = vi.fn(() => () => {});
vi.mock('@/components/battles/BattleNotificationProvider', () => ({
  useBattleNotificationContext: vi.fn(() => ({
    registerAsyncCallbacks: mockRegisterAsyncCallbacks,
  })),
}));

// Mock api service
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

// Mock error handler
vi.mock('@/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// Mock useAuth for non-authenticated tests
import { useAuth } from '@/hooks/useAuth';

describe('AsyncBattleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated user
    (useAuth as Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Wrapper component for testing
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AsyncBattleProvider>{children}</AsyncBattleProvider>
  );

  describe('Initial state', () => {
    it('should start with empty battle lists', async () => {
      // Mock API to return empty data
      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
          counts: {
            yourTurn: 0,
            theirTurn: 0,
            judging: 0,
            pendingInvitations: 0,
            totalActive: 0,
          },
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pendingBattles).toEqual([]);
      expect(result.current.urgentBattles).toEqual([]);
      expect(result.current.pendingInvitations).toEqual([]);
      expect(result.current.hasUrgentBattle).toBe(false);
      expect(result.current.mostUrgentBattle).toBeNull();
    });

    it('should not fetch when not authenticated', async () => {
      (useAuth as Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      renderHook(() => useAsyncBattles(), { wrapper });

      // Should not call API when not authenticated
      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe('Battle categorization', () => {
    it('should categorize yourTurn battles correctly', async () => {
      const yourTurnBattle = {
        id: 1,
        opponent: { id: 2, username: 'opponent1', avatarUrl: null },
        challengeText: 'Test challenge',
        challengeType: { key: 'creative', name: 'Creative Writing' },
        status: 'active',
        phase: 'challenger_turn',
        deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
        extensions: { used: 0, max: 2 },
        hasSubmitted: false,
        opponentSubmitted: false,
        createdAt: '2024-01-10T12:00:00Z',
      };

      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [yourTurnBattle],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      expect(result.current.urgentBattles.length).toBe(1);
      expect(result.current.urgentBattles[0].isMyTurn).toBe(true);
      expect(result.current.hasUrgentBattle).toBe(true);
    });

    it('should categorize theirTurn battles correctly', async () => {
      const theirTurnBattle = {
        id: 2,
        opponent: { id: 3, username: 'opponent2', avatarUrl: null },
        challengeText: 'Another challenge',
        challengeType: { key: 'tech', name: 'Tech Challenge' },
        status: 'active',
        phase: 'opponent_turn',
        deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
        extensions: { used: 1, max: 2 },
        hasSubmitted: true,
        opponentSubmitted: false,
        createdAt: '2024-01-10T12:00:00Z',
      };

      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [],
          theirTurn: [theirTurnBattle],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      expect(result.current.urgentBattles.length).toBe(0);
      expect(result.current.pendingBattles[0].isMyTurn).toBe(false);
      expect(result.current.hasUrgentBattle).toBe(false);
    });

    it('should categorize pending invitations correctly', async () => {
      const pendingInvitation = {
        id: 3,
        opponent: null,
        challengeText: 'Invitation challenge',
        challengeType: { key: 'creative', name: 'Creative Writing' },
        status: 'pending_invitation',
        phase: 'waiting',
        deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
        extensions: { used: 0, max: 2 },
        hasSubmitted: false,
        opponentSubmitted: false,
        createdAt: '2024-01-10T12:00:00Z',
        inviteUrl: 'https://example.com/invite/abc123',
        inviteToken: 'abc123',
      };

      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [],
          theirTurn: [],
          judging: [],
          pendingInvitations: [pendingInvitation],
          recentlyCompleted: [],
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      expect(result.current.pendingInvitations.length).toBe(1);
      expect(result.current.pendingInvitations[0].inviteUrl).toBe('https://example.com/invite/abc123');
    });
  });

  describe('Computed values', () => {
    it('should find mostUrgentBattle by earliest deadline', async () => {
      const battle1 = {
        id: 1,
        opponent: { id: 2, username: 'opponent1', avatarUrl: null },
        challengeText: 'Challenge 1',
        challengeType: { key: 'creative', name: 'Creative Writing' },
        status: 'active',
        phase: 'challenger_turn',
        deadlines: { response: '2024-01-20T12:00:00Z', turn: null },
        extensions: { used: 0, max: 2 },
        hasSubmitted: false,
        opponentSubmitted: false,
        createdAt: '2024-01-10T12:00:00Z',
      };

      const battle2 = {
        id: 2,
        opponent: { id: 3, username: 'opponent2', avatarUrl: null },
        challengeText: 'Challenge 2',
        challengeType: { key: 'tech', name: 'Tech Challenge' },
        status: 'active',
        phase: 'challenger_turn',
        deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
        extensions: { used: 0, max: 2 },
        hasSubmitted: false,
        opponentSubmitted: false,
        createdAt: '2024-01-10T12:00:00Z',
      };

      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [battle1, battle2],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.urgentBattles.length).toBe(2);
      });

      // Battle 2 has earlier deadline, should be most urgent
      expect(result.current.mostUrgentBattle?.id).toBe(2);
    });
  });

  describe('Actions', () => {
    it('should extend deadline successfully', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [{
            id: 1,
            opponent: { id: 2, username: 'opponent', avatarUrl: null },
            challengeText: 'Test',
            challengeType: { key: 'test', name: 'Test' },
            status: 'active',
            phase: 'waiting',
            deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
            extensions: { used: 0, max: 2 },
            hasSubmitted: false,
            opponentSubmitted: false,
            createdAt: '2024-01-10T12:00:00Z',
          }],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      mockApiPost.mockResolvedValue({
        data: {
          success: true,
          new_deadline: '2024-01-16T12:00:00Z',
          extensions_remaining: 1,
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.extendDeadline(1);
      });

      expect(success).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith('/battles/1/extend-deadline/');
    });

    it('should send reminder successfully', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [],
          theirTurn: [{
            id: 1,
            opponent: { id: 2, username: 'opponent', avatarUrl: null },
            challengeText: 'Test',
            challengeType: { key: 'test', name: 'Test' },
            status: 'active',
            phase: 'waiting',
            deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
            extensions: { used: 0, max: 2 },
            hasSubmitted: true,
            opponentSubmitted: false,
            createdAt: '2024-01-10T12:00:00Z',
          }],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      mockApiPost.mockResolvedValue({
        data: { success: true },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.sendReminder(1);
      });

      expect(success).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith('/battles/1/send-reminder/');
    });

    it('should start turn successfully', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [{
            id: 1,
            opponent: { id: 2, username: 'opponent', avatarUrl: null },
            challengeText: 'Test',
            challengeType: { key: 'test', name: 'Test' },
            status: 'active',
            phase: 'challenger_turn',
            deadlines: { response: '2024-01-15T12:00:00Z', turn: null },
            extensions: { used: 0, max: 2 },
            hasSubmitted: false,
            opponentSubmitted: false,
            createdAt: '2024-01-10T12:00:00Z',
          }],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      mockApiPost.mockResolvedValue({
        data: {
          status: 'success',
          expiresAt: '2024-01-15T12:03:00Z',
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.urgentBattles.length).toBe(1);
      });

      let startResult: { success: boolean; expiresAt?: string } = { success: false };
      await act(async () => {
        startResult = await result.current.startTurn(1);
      });

      expect(startResult.success).toBe(true);
      expect(startResult.expiresAt).toBe('2024-01-15T12:03:00Z');
      expect(mockApiPost).toHaveBeenCalledWith('/battles/1/start-turn/');
    });
  });

  describe('Error handling', () => {
    it('should handle API error gracefully', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load pending battles');
      });

      expect(result.current.pendingBattles).toEqual([]);
    });

    it('should return false when extendDeadline fails', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
          recentlyCompleted: [],
        },
      });

      mockApiPost.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useAsyncBattles(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.extendDeadline(999);
      });

      expect(success).toBe(false);
    });
  });
});
