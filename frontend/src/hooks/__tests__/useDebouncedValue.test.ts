/**
 * Tests for useDebouncedValue hook
 *
 * These tests verify debouncing behavior, including:
 * - Initial value is returned immediately
 * - Value updates after delay
 * - Rapid changes only trigger one final update
 * - Cleanup on unmount
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial render', () => {
    it('returns the initial value immediately', () => {
      const { result } = renderHook(() => useDebouncedValue('initial', 300));

      expect(result.current).toBe('initial');
    });

    it('works with different types', () => {
      const { result: stringResult } = renderHook(() => useDebouncedValue('string', 300));
      const { result: numberResult } = renderHook(() => useDebouncedValue(42, 300));
      const { result: objectResult } = renderHook(() => useDebouncedValue({ key: 'value' }, 300));
      const { result: arrayResult } = renderHook(() => useDebouncedValue([1, 2, 3], 300));
      const { result: nullResult } = renderHook(() => useDebouncedValue(null, 300));

      expect(stringResult.current).toBe('string');
      expect(numberResult.current).toBe(42);
      expect(objectResult.current).toEqual({ key: 'value' });
      expect(arrayResult.current).toEqual([1, 2, 3]);
      expect(nullResult.current).toBeNull();
    });
  });

  describe('debouncing behavior', () => {
    it('updates value after specified delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      );

      expect(result.current).toBe('initial');

      // Update the value
      rerender({ value: 'updated', delay: 300 });

      // Value should not have changed yet
      expect(result.current).toBe('initial');

      // Advance time by 299ms - still not updated
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(result.current).toBe('initial');

      // Advance by 1 more ms - now it updates
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe('updated');
    });

    it('only updates once for rapid successive changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'a' } }
      );

      // Rapid changes
      rerender({ value: 'b' });
      act(() => vi.advanceTimersByTime(100));

      rerender({ value: 'c' });
      act(() => vi.advanceTimersByTime(100));

      rerender({ value: 'd' });
      act(() => vi.advanceTimersByTime(100));

      // Value should still be 'a' (initial) - not enough time passed
      expect(result.current).toBe('a');

      // Wait for full delay from last change
      act(() => vi.advanceTimersByTime(300));

      // Now should be 'd' (the last value)
      expect(result.current).toBe('d');
    });

    it('uses default delay of 300ms when not specified', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      // Advance by 299ms - not yet
      act(() => vi.advanceTimersByTime(299));
      expect(result.current).toBe('initial');

      // Advance by 1 more ms - now
      act(() => vi.advanceTimersByTime(1));
      expect(result.current).toBe('updated');
    });

    it('respects custom delay values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebouncedValue(value, delay),
        { initialProps: { value: 'initial', delay: 1000 } }
      );

      rerender({ value: 'updated', delay: 1000 });

      // At 500ms - not yet
      act(() => vi.advanceTimersByTime(500));
      expect(result.current).toBe('initial');

      // At 999ms - still not
      act(() => vi.advanceTimersByTime(499));
      expect(result.current).toBe('initial');

      // At 1000ms - now
      act(() => vi.advanceTimersByTime(1));
      expect(result.current).toBe('updated');
    });
  });

  describe('cleanup', () => {
    it('clears timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' } }
      );

      // Trigger a timer
      rerender({ value: 'updated' });

      // Unmount should clear the timer
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('clears previous timeout when value changes', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'a' } }
      );

      rerender({ value: 'b' });
      rerender({ value: 'c' });

      // Should have cleared timeouts
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 0),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      // With 0 delay, should update on next tick
      act(() => vi.advanceTimersByTime(0));
      expect(result.current).toBe('updated');
    });

    it('handles same value re-render', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'same' } }
      );

      // Re-render with same value
      rerender({ value: 'same' });

      act(() => vi.advanceTimersByTime(300));

      // Value should still be 'same'
      expect(result.current).toBe('same');
    });

    it('handles empty string', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: '' });

      act(() => vi.advanceTimersByTime(300));

      expect(result.current).toBe('');
    });

    it('handles undefined', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' as string | undefined } }
      );

      rerender({ value: undefined });

      act(() => vi.advanceTimersByTime(300));

      expect(result.current).toBeUndefined();
    });
  });
});
