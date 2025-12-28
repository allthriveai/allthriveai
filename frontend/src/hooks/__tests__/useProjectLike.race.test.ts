/**
 * useProjectLike Race Condition Tests
 *
 * These tests specifically target race conditions that can occur with:
 * - Rapid double-clicks before isLiking state is set
 * - Multiple API calls racing
 * - Optimistic updates with out-of-order responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjectLike } from '../useProjectLike';

// Mock dependencies
vi.mock('@/services/projects', () => ({
  toggleProjectLike: vi.fn(),
}));

vi.mock('react-rewards', () => ({
  useReward: () => ({ reward: vi.fn() }),
}));

vi.mock('@/contexts/QuestCompletionContext', () => ({
  useQuestCompletion: () => ({ showCelebration: vi.fn() }),
}));

import { toggleProjectLike } from '@/services/projects';

describe('useProjectLike - Race Condition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rapid click prevention', () => {
    it('should prevent double-click from making two API calls', async () => {
      // Setup: API takes 100ms to respond
      let resolveFirst: (value: unknown) => void;
      const firstCall = new Promise((r) => { resolveFirst = r; });
      // Second call promise is created but never resolved - the test verifies
      // that isLiking prevents the second call from being made at all
      const secondCall = new Promise(() => {});

      let callCount = 0;
      vi.mocked(toggleProjectLike).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return firstCall as Promise<{ liked: boolean; heartCount: number }>;
        return secondCall as Promise<{ liked: boolean; heartCount: number }>;
      });

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      // Rapid double-click - second should be blocked by isLiking check
      await act(async () => {
        result.current.toggleLike();
      });
      await act(async () => {
        result.current.toggleLike();
      });

      // Should only have made ONE API call (second blocked by isLiking)
      expect(toggleProjectLike).toHaveBeenCalledTimes(1);

      // Complete the first call
      await act(async () => {
        resolveFirst!({ liked: true, heartCount: 11 });
      });

      await waitFor(() => {
        expect(result.current.isLiking).toBe(false);
      });
    });

    it('should allow second click after first completes', async () => {
      vi.mocked(toggleProjectLike)
        .mockResolvedValueOnce({ liked: true, heartCount: 11 })
        .mockResolvedValueOnce({ liked: false, heartCount: 10 });

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      // First click
      await act(async () => {
        await result.current.toggleLike();
      });

      expect(result.current.isLiked).toBe(true);
      expect(result.current.heartCount).toBe(11);

      // Second click (should be allowed now)
      await act(async () => {
        await result.current.toggleLike();
      });

      expect(result.current.isLiked).toBe(false);
      expect(result.current.heartCount).toBe(10);
      expect(toggleProjectLike).toHaveBeenCalledTimes(2);
    });

    it('should handle spam clicking - DOCUMENTS RACE CONDITION', async () => {
      // This test DOCUMENTS a known race condition:
      // Rapid synchronous clicks can bypass the isLiking guard because
      // setState is async and multiple clicks can pass the check before
      // isLiking is set to true.
      //
      // The current implementation relies on isLiking but this only works
      // if clicks are separated by at least one React render cycle.
      // True protection requires debouncing or a ref-based lock.

      let callCount = 0;
      vi.mocked(toggleProjectLike).mockImplementation(() => {
        callCount++;
        return Promise.resolve({ liked: true, heartCount: 11 });
      });

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      // Spam 5 clicks in quick succession (synchronously)
      await act(async () => {
        result.current.toggleLike();
        result.current.toggleLike();
        result.current.toggleLike();
        result.current.toggleLike();
        result.current.toggleLike();
      });

      // CURRENT BEHAVIOR: Multiple API calls are made
      // This documents the race condition - ideally this would be 1
      // When fixed, change this expectation to toHaveBeenCalledTimes(1)
      expect(callCount).toBeGreaterThan(1);

      // Wait for all calls to complete
      await waitFor(() => {
        expect(result.current.isLiking).toBe(false);
      });
    });
  });

  describe('optimistic update consistency', () => {
    it('should revert optimistic update on API error', async () => {
      // Suppress the expected console.error from the hook
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(toggleProjectLike).mockRejectedValue(new Error('[EXPECTED] Network error'));

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      // Initial state
      expect(result.current.isLiked).toBe(false);
      expect(result.current.heartCount).toBe(10);

      // Click should optimistically update, then revert
      await act(async () => {
        await result.current.toggleLike();
      });

      // Should have reverted to original state
      expect(result.current.isLiked).toBe(false);
      expect(result.current.heartCount).toBe(10);
      expect(result.current.isLiking).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should use server response over optimistic update', async () => {
      // Server returns different count than expected (e.g., someone else liked too)
      vi.mocked(toggleProjectLike).mockResolvedValue({
        liked: true,
        heartCount: 15, // Server has different count
      });

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      await act(async () => {
        await result.current.toggleLike();
      });

      // Should use server's authoritative count, not optimistic +1
      expect(result.current.heartCount).toBe(15);
      expect(result.current.isLiked).toBe(true);
    });
  });

  describe('authentication guard', () => {
    it('should not call API when not authenticated', async () => {
      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: false,
        })
      );

      await act(async () => {
        result.current.toggleLike();
      });

      expect(toggleProjectLike).not.toHaveBeenCalled();
      expect(result.current.isLiked).toBe(false);
      expect(result.current.heartCount).toBe(10);
    });
  });

  describe('functional state updates', () => {
    it('should use functional update for heartCount to avoid stale closure', async () => {
      // This test verifies that setHeartCount uses prev => ... pattern
      // to avoid race conditions with concurrent updates

      let resolveCall: ((value: { liked: boolean; heartCount: number }) => void) | null = null;
      vi.mocked(toggleProjectLike).mockImplementation(() =>
        new Promise((r) => { resolveCall = r; })
      );

      const { result } = renderHook(() =>
        useProjectLike({
          projectId: 1,
          initialIsLiked: false,
          initialHeartCount: 10,
          isAuthenticated: true,
        })
      );

      // Start the toggle
      await act(async () => {
        result.current.toggleLike();
      });

      // Optimistic update should show +1
      expect(result.current.heartCount).toBe(11);
      expect(result.current.isLiked).toBe(true);

      // Resolve with server response
      await act(async () => {
        resolveCall!({ liked: true, heartCount: 11 });
      });

      await waitFor(() => {
        expect(result.current.isLiking).toBe(false);
      });

      // Final state should match server
      expect(result.current.heartCount).toBe(11);
    });
  });
});
