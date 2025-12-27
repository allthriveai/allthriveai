/**
 * Tests for useWebSocketBase hook
 *
 * Tests connection lifecycle, heartbeat, reconnection, and message handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketBase } from '../useWebSocketBase';
import type { WebSocketBaseOptions } from '../types';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }
}

// Mock fetch for connection token
const mockFetch = vi.fn();

// Mock utilities
vi.mock('@/utils/websocket', () => ({
  buildWebSocketUrl: vi.fn((path: string, params?: Record<string, string>) => {
    const url = `ws://localhost:8000${path}`;
    if (params && Object.keys(params).length > 0) {
      return `${url}?${new URLSearchParams(params).toString()}`;
    }
    return url;
  }),
}));

vi.mock('@/utils/cookies', () => ({
  getCsrfToken: vi.fn(() => 'test-csrf-token'),
}));

describe('useWebSocketBase', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // Default successful token fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ connection_token: 'test-token-123' }),
    });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.WebSocket = originalWebSocket;
  });

  const defaultOptions: WebSocketBaseOptions = {
    endpoint: '/ws/test/',
    connectionIdPrefix: 'test',
    onMessage: vi.fn(),
  };

  describe('connection', () => {
    it('fetches connection token before connecting', async () => {
      renderHook(() => useWebSocketBase(defaultOptions));

      // Wait for async connection to complete
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/ws-connection-token/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': 'test-csrf-token',
        },
        body: expect.stringContaining('"connection_id":"test-'),
      });
    });

    it('builds correct WebSocket URL with token', async () => {
      renderHook(() => useWebSocketBase(defaultOptions));

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      expect(MockWebSocket.instances[0].url).toContain('/ws/test/');
      expect(MockWebSocket.instances[0].url).toContain('connection_token=test-token-123');
    });

    it('sets isConnected after WebSocket opens', async () => {
      const { result } = renderHook(() => useWebSocketBase(defaultOptions));

      // Initially not connected
      expect(result.current.isConnected).toBe(false);

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      // Simulate WebSocket open
      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('calls onConnected callback on successful connection', async () => {
      const onConnected = vi.fn();
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onConnected,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(onConnected).toHaveBeenCalled();
    });

    it('skips auth token when requiresAuth is false', async () => {
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          requiresAuth: false,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(MockWebSocket.instances[0].url).not.toContain('connection_token');
    });

    it('does not auto-connect when autoConnect is false', async () => {
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          autoConnect: false,
        })
      );

      // Give it time to potentially connect
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(MockWebSocket.instances.length).toBe(0);
    });
  });

  describe('heartbeat', () => {
    it('sends ping after connection opens', async () => {
      vi.useFakeTimers();

      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          heartbeatInterval: 1000,
          requiresAuth: false, // Skip auth to simplify test
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      // Advance past heartbeat interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const ws = MockWebSocket.instances[0];
      expect(ws.sentMessages).toContain('{"type":"ping"}');

      vi.useRealTimers();
    });
  });

  describe('messaging', () => {
    it('routes messages to onMessage callback', async () => {
      const onMessage = vi.fn();
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onMessage,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateMessage({ event: 'test', data: 'hello' });
      });

      expect(onMessage).toHaveBeenCalledWith({ event: 'test', data: 'hello' });
    });

    it('ignores pong messages', async () => {
      const onMessage = vi.fn();
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onMessage,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateMessage({ type: 'pong' });
      });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('returns false from send when not connected', () => {
      const { result } = renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          autoConnect: false,
        })
      );

      const sent = result.current.send({ test: 'message' });

      expect(sent).toBe(false);
    });

    it('returns true from send when connected', async () => {
      const { result } = renderHook(() => useWebSocketBase(defaultOptions));

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      let sent: boolean = false;
      act(() => {
        sent = result.current.send({ test: 'message' });
      });

      expect(sent).toBe(true);
      expect(MockWebSocket.instances[0].sentMessages).toContain('{"test":"message"}');
    });
  });

  describe('auth failures', () => {
    it('calls onError when auth fails with 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const onError = vi.fn();
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onError,
        })
      );

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Authentication required')
      );
    });

    it('calls onError when auth fails with 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const onError = vi.fn();
      renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onError,
        })
      );

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Authentication required')
      );
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket connection', async () => {
      const { result } = renderHook(() => useWebSocketBase(defaultOptions));

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('calls onDisconnected callback', async () => {
      const onDisconnected = vi.fn();
      const { result } = renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onDisconnected,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(onDisconnected).toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    it('does not reconnect on intentional close', async () => {
      const onReconnecting = vi.fn();
      const { result } = renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          onReconnecting,
        })
      );

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      const instanceCount = MockWebSocket.instances.length;

      // Intentional disconnect
      act(() => {
        result.current.disconnect();
      });

      // Give time for potential reconnect
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onReconnecting).not.toHaveBeenCalled();
      // Should not create new WebSocket instances
      expect(MockWebSocket.instances.length).toBe(instanceCount);
    });

    it('resets reconnectAttempts on successful connection', async () => {
      const { result } = renderHook(() => useWebSocketBase(defaultOptions));

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(result.current.reconnectAttempts).toBe(0);
    });
  });

  describe('manual connect', () => {
    it('allows manual connection after initial skip', async () => {
      const { result } = renderHook(() =>
        useWebSocketBase({
          ...defaultOptions,
          autoConnect: false,
        })
      );

      expect(MockWebSocket.instances.length).toBe(0);

      await act(async () => {
        await result.current.connect();
      });

      await vi.waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });
    });
  });
});
