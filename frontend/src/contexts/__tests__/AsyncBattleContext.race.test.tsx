/**
 * AsyncBattleContext Race Condition Tests
 *
 * These tests specifically target race conditions that can occur with:
 * - State updates after unmount (pending API calls completing)
 * - Polling cleanup on logout
 * - WebSocket callback handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AsyncBattleProvider, useAsyncBattles } from '../AsyncBattleContext';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Capture WebSocket callbacks
let capturedCallbacks: Record<string, (notification: unknown) => void> = {};
const mockUnregister = vi.fn();
vi.mock('@/components/battles/BattleNotificationProvider', () => ({
  useBattleNotificationContext: () => ({
    registerAsyncCallbacks: (callbacks: Record<string, (notification: unknown) => void>) => {
      capturedCallbacks = callbacks;
      return mockUnregister;
    },
  }),
}));

// Mock API
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('@/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// Helper for empty response
const emptyBattlesResponse = {
  data: { yourTurn: [], theirTurn: [], judging: [], pendingInvitations: [] },
};

// Helper for battle with data
const battleWithDataResponse = {
  data: {
    yourTurn: [
      {
        id: 1,
        opponent: { id: 2, username: 'opponent', avatarUrl: null },
        challengeText: 'Test',
        challengeType: null,
        status: 'my_turn',
        phase: 'waiting',
        deadlines: { response: '2025-01-01T00:00:00Z' },
        extensions: { used: 0, max: 2 },
        hasSubmitted: false,
        opponentSubmitted: false,
        createdAt: '2024-12-01T00:00:00Z',
      },
    ],
    theirTurn: [],
    judging: [],
    pendingInvitations: [],
  },
};

const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AsyncBattleProvider>{children}</AsyncBattleProvider>;
  };
};

describe('AsyncBattleContext - Race Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallbacks = {};

    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    // Default API responses - resolve immediately
    mockApiGet.mockResolvedValue(emptyBattlesResponse);
    mockApiPost.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('unmount cleanup', () => {
    it('should not throw when API resolves after unmount', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a delayed promise
      let resolveApi: (value: unknown) => void;
      mockApiGet.mockImplementationOnce(() => new Promise(r => { resolveApi = r; }));

      const { result, unmount } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      // Unmount before API resolves
      unmount();

      // Resolve after unmount - should not throw
      await act(async () => {
        resolveApi!(battleWithDataResponse);
      });

      // Should not have logged "unmounted component" error
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('unmounted')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should unregister WebSocket callbacks on unmount', async () => {
      const { unmount } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      // Wait for render cycle
      await act(async () => {
        await Promise.resolve();
      });

      unmount();

      expect(mockUnregister).toHaveBeenCalled();
    });
  });

  describe('WebSocket callback handling', () => {
    it('should remove battle on expiration callback', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      // Simulate expiration via WebSocket
      act(() => {
        capturedCallbacks.onBattleExpired?.({ battleId: 1 });
      });

      expect(result.current.pendingBattles.length).toBe(0);
    });

    it('should update deadline on extension callback', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      // Simulate deadline extension via WebSocket
      act(() => {
        capturedCallbacks.onDeadlineExtended?.({
          battleId: 1,
          deadline: '2025-02-01T00:00:00Z',
          extensionsRemaining: 1,
        });
      });

      expect(result.current.pendingBattles[0].deadline).toBe('2025-02-01T00:00:00Z');
      expect(result.current.pendingBattles[0].extensionsRemaining).toBe(1);
    });

    it('should handle forfeit callback', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      // Simulate forfeit via WebSocket
      act(() => {
        capturedCallbacks.onBattleForfeit?.({ battleId: 1 });
      });

      expect(result.current.pendingBattles.length).toBe(0);
    });
  });

  describe('logout state cleanup', () => {
    it('should clear battles when user logs out', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result, rerender } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      // User logs out
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(0);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('action handlers with state updates', () => {
    it('should handle extendDeadline action', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      mockApiPost.mockResolvedValueOnce({
        data: {
          success: true,
          newDeadline: '2025-02-01T00:00:00Z',
          extensionsRemaining: 1,
        },
      });

      let success = false;
      await act(async () => {
        success = await result.current.extendDeadline(1);
      });

      expect(success).toBe(true);
      expect(result.current.pendingBattles[0].deadline).toBe('2025-02-01T00:00:00Z');
    });

    it('should handle cancelBattle action', async () => {
      mockApiGet.mockResolvedValue(battleWithDataResponse);

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(1);
      });

      mockApiPost.mockResolvedValueOnce({ data: { success: true } });

      let success = false;
      await act(async () => {
        success = await result.current.cancelBattle(1);
      });

      expect(success).toBe(true);
      expect(result.current.pendingBattles.length).toBe(0);
    });
  });

  describe('computed values', () => {
    it('should filter urgent battles correctly', async () => {
      // Set a fixed "now" for this test
      const realDateNow = Date.now;
      Date.now = () => new Date('2024-12-15T12:00:00Z').getTime();

      mockApiGet.mockResolvedValue({
        data: {
          yourTurn: [
            {
              id: 1,
              opponent: { id: 2, username: 'opponent1', avatarUrl: null },
              challengeText: 'Future deadline - urgent',
              challengeType: null,
              status: 'my_turn',
              phase: 'waiting',
              deadlines: { response: '2025-01-01T00:00:00Z' },
              extensions: { used: 0, max: 2 },
              hasSubmitted: false,
              opponentSubmitted: false,
              createdAt: '2024-12-01T00:00:00Z',
            },
            {
              id: 2,
              opponent: { id: 3, username: 'opponent2', avatarUrl: null },
              challengeText: 'Past deadline - not urgent',
              challengeType: null,
              status: 'my_turn',
              phase: 'waiting',
              deadlines: { response: '2024-12-01T00:00:00Z' },
              extensions: { used: 0, max: 2 },
              hasSubmitted: false,
              opponentSubmitted: false,
              createdAt: '2024-11-01T00:00:00Z',
            },
          ],
          theirTurn: [],
          judging: [],
          pendingInvitations: [],
        },
      });

      const { result } = renderHook(() => useAsyncBattles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.pendingBattles.length).toBe(2);
      });

      // Only battle 1 should be urgent (my turn + future deadline)
      expect(result.current.urgentBattles.length).toBe(1);
      expect(result.current.urgentBattles[0].id).toBe(1);
      expect(result.current.hasUrgentBattle).toBe(true);
      expect(result.current.mostUrgentBattle?.id).toBe(1);

      // Restore Date.now
      Date.now = realDateNow;
    });
  });
});
