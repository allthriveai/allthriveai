/**
 * Tests for useBattleNotifications hook
 *
 * Covers:
 * - Handling 401/403 errors and preventing reconnection
 * - Handling missing connection_token in response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBattleNotifications } from './useBattleNotifications';

// Mock the useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock WebSocket utilities
vi.mock('@/utils/websocket', () => ({
  buildWebSocketUrl: vi.fn((path: string, params: Record<string, string>) => {
    const queryString = new URLSearchParams(params).toString();
    return `ws://test.com${path}?${queryString}`;
  }),
  logWebSocketUrl: vi.fn(),
}));

// Mock cookies utility
vi.mock('@/utils/cookies', () => ({
  getCsrfToken: vi.fn(() => 'test-csrf-token'),
}));

describe('useBattleNotifications', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Create mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Authentication error handling', () => {
    it('should handle 401 error and prevent reconnection', async () => {
      // Mock fetch to return 401
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });

      // Verify console warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[BattleNotifications] Not authenticated, skipping WebSocket connection'
      );

      // Verify fetch was only called once (no reconnection attempts)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 403 error and prevent reconnection', async () => {
      // Mock fetch to return 403
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });

      // Verify console warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[BattleNotifications] Not authenticated, skipping WebSocket connection'
      );

      // Verify fetch was only called once (no reconnection attempts)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 503 error (service unavailable)', async () => {
      // Mock fetch to return 503
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Cache service unavailable',
          code: 'CACHE_UNAVAILABLE',
        }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the initial connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify console warning was logged with service unavailable message
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[BattleNotifications] Service unavailable')
      );

      // Verify hook is not connected but may retry
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });

      // Wait for a reconnect attempt (should happen after 2 seconds)
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2);
        },
        { timeout: 4000 }
      );

      // Verify reconnect attempts are incrementing
      expect(result.current.reconnectAttempts).toBeGreaterThan(0);
    });
  });

  describe('Missing connection_token handling', () => {
    it('should handle missing connection_token in response', async () => {
      // Mock fetch to return 200 but without connection_token
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          expires_in: 60,
          connection_id: 'test-connection-id',
          // connection_token is missing!
        }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify error was logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          '[BattleNotifications] Failed to fetch connection token:',
          expect.objectContaining({
            message: 'No connection_token in response',
          })
        );
      });

      // Verify hook state shows not connected
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });

      // Verify a reconnect is scheduled (fetch should be called again after delay)
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2);
        },
        { timeout: 4000 }
      );
    });

    it('should handle empty connection_token in response', async () => {
      // Mock fetch to return 200 but with empty connection_token
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          connection_token: '', // Empty token
          expires_in: 60,
          connection_id: 'test-connection-id',
        }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify error was logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          '[BattleNotifications] Failed to fetch connection token:',
          expect.objectContaining({
            message: 'No connection_token in response',
          })
        );
      });

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should handle null connection_token in response', async () => {
      // Mock fetch to return 200 but with null connection_token
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          connection_token: null, // Null token
          expires_in: 60,
          connection_id: 'test-connection-id',
        }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify error handling
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          '[BattleNotifications] Failed to fetch connection token:',
          expect.anything()
        );
      });

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });
    });
  });

  describe('Error response parsing', () => {
    it('should handle error response with code and details', async () => {
      // Mock fetch to return 500 with structured error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Token generation failed',
          code: 'TOKEN_GENERATION_ERROR',
          details: 'Redis timeout',
        }),
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify error was logged with details
      expect(console.error).toHaveBeenCalled();

      // Check that at least one of the error calls contains the status code
      const errorCalls = (console.error as any).mock.calls;
      const hasStatusCode = errorCalls.some((call: any[]) =>
        call.some((arg: any) =>
          typeof arg === 'string' && arg.includes('500')
        )
      );
      expect(hasStatusCode).toBe(true);

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should handle non-JSON error responses', async () => {
      // Mock fetch to return 500 with non-JSON response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const { result } = renderHook(() =>
        useBattleNotifications({
          autoConnect: true,
        })
      );

      // Wait for the connection attempt
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/v1/auth/ws-connection-token/',
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
            })
          );
        },
        { timeout: 3000 }
      );

      // Verify error was handled gracefully
      expect(console.error).toHaveBeenCalled();

      // Verify hook state
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.isConnected).toBe(false);
      });
    });
  });
});
