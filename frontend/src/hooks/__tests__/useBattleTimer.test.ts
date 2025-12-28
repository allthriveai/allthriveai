/**
 * useBattleTimer Hook Tests
 *
 * Tests for the battle timer hook including:
 * - Time formatting (MM:SS)
 * - Countdown behavior
 * - Warning and critical thresholds
 * - Timer expiration callbacks
 * - Server time synchronization
 * - Reset key handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBattleTimer,
  formatTime,
  calculateProgress,
} from '../useBattleTimer';

describe('useBattleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatTime helper', () => {
    it('formats 180 seconds as 3:00', () => {
      expect(formatTime(180)).toBe('3:00');
    });

    it('formats 65 seconds as 1:05', () => {
      expect(formatTime(65)).toBe('1:05');
    });

    it('formats 59 seconds as 0:59', () => {
      expect(formatTime(59)).toBe('0:59');
    });

    it('formats 0 seconds as 0:00', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats null as 0:00', () => {
      expect(formatTime(null)).toBe('0:00');
    });

    it('formats negative values as 0:00', () => {
      expect(formatTime(-5)).toBe('0:00');
    });

    it('pads single-digit seconds with zero', () => {
      expect(formatTime(61)).toBe('1:01');
      expect(formatTime(9)).toBe('0:09');
    });
  });

  describe('calculateProgress helper', () => {
    it('returns 100 when remaining equals total', () => {
      expect(calculateProgress(180, 180)).toBe(100);
    });

    it('returns 50 when half time remains', () => {
      expect(calculateProgress(90, 180)).toBe(50);
    });

    it('returns 0 when no time remains', () => {
      expect(calculateProgress(0, 180)).toBe(0);
    });

    it('returns 0 for null remaining', () => {
      expect(calculateProgress(null, 180)).toBe(0);
    });

    it('returns 0 for zero total', () => {
      expect(calculateProgress(60, 0)).toBe(0);
    });

    it('clamps to 0-100 range', () => {
      expect(calculateProgress(200, 180)).toBe(100);
      expect(calculateProgress(-10, 180)).toBe(0);
    });
  });

  describe('initial state', () => {
    it('returns null time when serverTimeRemaining is null', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: null })
      );

      expect(result.current.timeRemaining).toBeNull();
      expect(result.current.formattedTime).toBe('0:00');
    });

    it('returns null time when serverTimeRemaining is undefined', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: undefined })
      );

      expect(result.current.timeRemaining).toBeNull();
    });

    it('syncs with server time on initial render', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 180 })
      );

      expect(result.current.timeRemaining).toBe(180);
      expect(result.current.formattedTime).toBe('3:00');
    });
  });

  describe('countdown behavior', () => {
    it('counts down every second when active', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 180, isActive: true })
      );

      expect(result.current.timeRemaining).toBe(180);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timeRemaining).toBe(179);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timeRemaining).toBe(178);
    });

    it('does not count down when isActive is false', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 180, isActive: false })
      );

      expect(result.current.timeRemaining).toBe(180);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.timeRemaining).toBe(180);
    });

    it('stops counting at 0', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 2, isActive: true })
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timeRemaining).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timeRemaining).toBe(0);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timeRemaining).toBe(0);
    });
  });

  describe('warning and critical thresholds', () => {
    it('isWarning is true when time <= 30 seconds', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 30 })
      );

      expect(result.current.isWarning).toBe(true);
    });

    it('isWarning is false when time > 30 seconds', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 31 })
      );

      expect(result.current.isWarning).toBe(false);
    });

    it('isCritical is true when time <= 10 seconds', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 10 })
      );

      expect(result.current.isCritical).toBe(true);
    });

    it('isCritical is false when time > 10 seconds', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 11 })
      );

      expect(result.current.isCritical).toBe(false);
    });

    it('uses custom warningThreshold', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 45, warningThreshold: 60 })
      );

      expect(result.current.isWarning).toBe(true);
    });

    it('isWarning and isCritical are false when expired', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 0 })
      );

      expect(result.current.isWarning).toBe(false);
      expect(result.current.isCritical).toBe(false);
      expect(result.current.isExpired).toBe(true);
    });
  });

  describe('expiration', () => {
    it('isExpired is true when time reaches 0', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 1, isActive: true })
      );

      expect(result.current.isExpired).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isExpired).toBe(true);
    });

    it('calls onExpire callback when timer reaches 0', () => {
      const onExpire = vi.fn();
      renderHook(() =>
        useBattleTimer({
          serverTimeRemaining: 1,
          isActive: true,
          onExpire,
        })
      );

      expect(onExpire).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('only calls onExpire once', () => {
      const onExpire = vi.fn();
      renderHook(() =>
        useBattleTimer({
          serverTimeRemaining: 1,
          isActive: true,
          onExpire,
        })
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
    });
  });

  describe('warning callback', () => {
    it('calls onWarning when entering warning zone', () => {
      const onWarning = vi.fn();
      const { result } = renderHook(() =>
        useBattleTimer({
          serverTimeRemaining: 32,
          isActive: true,
          onWarning,
          warningThreshold: 30,
        })
      );

      expect(onWarning).not.toHaveBeenCalled();
      expect(result.current.isWarning).toBe(false);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.timeRemaining).toBe(30);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('only calls onWarning once per warning zone entry', () => {
      const onWarning = vi.fn();
      renderHook(() =>
        useBattleTimer({
          serverTimeRemaining: 32,
          isActive: true,
          onWarning,
          warningThreshold: 30,
        })
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe('server time synchronization', () => {
    it('syncs when serverTimeRemaining prop changes', () => {
      const { result, rerender } = renderHook(
        ({ time }) => useBattleTimer({ serverTimeRemaining: time }),
        { initialProps: { time: 180 } }
      );

      expect(result.current.timeRemaining).toBe(180);

      // Countdown a bit
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.timeRemaining).toBe(175);

      // Server sends new time
      rerender({ time: 170 });

      expect(result.current.timeRemaining).toBe(170);
    });

    it('handles transition from null to number', () => {
      const { result, rerender } = renderHook(
        ({ time }) => useBattleTimer({ serverTimeRemaining: time }),
        { initialProps: { time: null as number | null } }
      );

      expect(result.current.timeRemaining).toBeNull();

      rerender({ time: 120 });

      expect(result.current.timeRemaining).toBe(120);
    });
  });

  describe('resetKey handling', () => {
    it('resets timer when resetKey changes', () => {
      const { result, rerender } = renderHook(
        ({ resetKey, time }) =>
          useBattleTimer({ serverTimeRemaining: time, resetKey }),
        { initialProps: { resetKey: 0, time: 180 } }
      );

      // Countdown
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(result.current.timeRemaining).toBe(150);

      // Reset with same time value but new key
      rerender({ resetKey: 1, time: 180 });

      expect(result.current.timeRemaining).toBe(180);
    });

    it('does not reset when resetKey stays the same', () => {
      const { result, rerender } = renderHook(
        ({ resetKey, time }) =>
          useBattleTimer({ serverTimeRemaining: time, resetKey }),
        { initialProps: { resetKey: 0, time: 180 } }
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(result.current.timeRemaining).toBe(170);

      // Rerender with same key but different unrelated prop
      rerender({ resetKey: 0, time: 180 });

      // Should not reset since key didn't change
      expect(result.current.timeRemaining).toBe(170);
    });
  });

  describe('progress calculation', () => {
    it('returns progress as percentage of 180 seconds', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 90 })
      );

      expect(result.current.progress).toBe(50);
    });

    it('returns 100 at start', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 180 })
      );

      expect(result.current.progress).toBe(100);
    });

    it('returns 0 when expired', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 0 })
      );

      expect(result.current.progress).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles rapid prop changes', () => {
      const { result, rerender } = renderHook(
        ({ time }) => useBattleTimer({ serverTimeRemaining: time }),
        { initialProps: { time: 180 } }
      );

      rerender({ time: 170 });
      rerender({ time: 160 });
      rerender({ time: 150 });

      expect(result.current.timeRemaining).toBe(150);
    });

    it('handles unmount during countdown', () => {
      const { unmount } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 180, isActive: true })
      );

      // Should not throw
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      unmount();

      // Should not throw after unmount
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    });

    it('handles very large time values', () => {
      const { result } = renderHook(() =>
        useBattleTimer({ serverTimeRemaining: 3600 })
      );

      expect(result.current.timeRemaining).toBe(3600);
      expect(result.current.formattedTime).toBe('60:00');
    });
  });
});
