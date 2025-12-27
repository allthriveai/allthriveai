/**
 * Regression Tests for useIntelligentChat Race Conditions
 *
 * These tests verify that known race conditions are fixed.
 * Each test represents a bug that has occurred in production.
 *
 * TDD Approach: These tests should FAIL until the bugs are fixed.
 * Once fixed, they stay in the suite forever to prevent regressions.
 *
 * @see /docs/test-strategy-improvement-plan.md for full context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIntelligentChat } from '../useIntelligentChat';

// Mock WebSocket class for testing
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, username: 'testuser' },
  })),
}));

vi.mock('@/utils/chatStorage', () => ({
  loadChatMessages: vi.fn(() => []),
  saveChatMessages: vi.fn(),
  clearChatMessages: vi.fn(),
}));

vi.mock('@/services/personalization', () => ({
  trackInteraction: vi.fn(() => Promise.resolve()),
}));

// Mock fetch for connection token
const mockFetch = vi.fn();

describe('useIntelligentChat - Race Condition Regression Tests', () => {
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

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  /**
   * BUG 1: Duplicate messages appear when WebSocket reconnects
   *
   * Scenario: User sees duplicate messages in chat after a reconnection.
   * Root cause: Message deduplication not working during reconnect flow.
   *
   * Expected: Only 1 message with a given ID should appear, even if sent twice.
   */
  it('REGRESSION: should not show duplicate messages when WebSocket reconnects', async () => {
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-1',
        onError: vi.fn(),
      })
    );

    // Wait for WebSocket to connect
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // Simulate processing started + chunk
    act(() => {
      ws.simulateMessage({ event: 'processing_started' });
    });

    // Send the same chunk twice (simulating reconnect duplicate)
    act(() => {
      ws.simulateMessage({ event: 'chunk', chunk: 'Hello world' });
    });

    // Simulate disconnect and reconnect
    act(() => {
      ws.simulateClose(1006, 'Connection lost');
    });

    // Wait for reconnect attempt
    await vi.advanceTimersByTimeAsync(1000);

    // New WebSocket should be created
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    });

    const ws2 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    act(() => {
      ws2.simulateOpen();
    });

    // Simulate the SAME message coming through again after reconnect
    act(() => {
      ws2.simulateMessage({ event: 'processing_started' });
      ws2.simulateMessage({ event: 'chunk', chunk: 'Hello world' });
      ws2.simulateMessage({ event: 'completed' });
    });

    // ASSERT: Should have only 1 assistant message with this content, not duplicates
    const assistantMessages = result.current.messages.filter(
      (m) => m.sender === 'assistant' && m.content === 'Hello world'
    );

    // This test should FAIL until deduplication is properly implemented
    expect(assistantMessages.length).toBe(1);
  });

  /**
   * BUG 2: Message content jumps/scrambles during streaming
   *
   * Scenario: User sees text jump around or get scrambled as chunks arrive.
   * Root cause: Stale closure in chunk handler - currentMessageRef not updated properly.
   *
   * Expected: Chunks should build content sequentially: "The " + "quick " = "The quick "
   */
  it('REGRESSION: streaming chunks should build content correctly without jumps', async () => {
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-2',
        onError: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // Start streaming
    act(() => {
      ws.simulateMessage({ event: 'processing_started' });
    });

    // Send chunks rapidly - simulating fast streaming
    const chunks = ['The ', 'quick ', 'brown ', 'fox ', 'jumps.'];

    // Send ALL chunks in the same act() block to simulate concurrent updates
    // This is the race condition pattern that causes jumbled text
    act(() => {
      for (const chunk of chunks) {
        ws.simulateMessage({ event: 'chunk', chunk });
      }
    });

    act(() => {
      ws.simulateMessage({ event: 'completed' });
    });

    // ASSERT: Final content should be the full concatenated string
    const assistantMessage = result.current.messages.find((m) => m.sender === 'assistant');

    // This test should FAIL if chunks are processed with stale closures
    expect(assistantMessage?.content).toBe('The quick brown fox jumps.');
  });

  /**
   * BUG 3: Multiple WebSocket connections created on rapid connect calls
   *
   * Scenario: User rapidly clicks connect or navigates, causing multiple sockets.
   * Root cause: No guard against concurrent connection attempts.
   *
   * Expected: Only 1 WebSocket instance should exist after rapid connect calls.
   */
  it('REGRESSION: rapid connect calls should create only 1 socket', async () => {
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-3',
        onError: vi.fn(),
        autoReconnect: false,
      })
    );

    // Wait for initial connection
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const initialCount = MockWebSocket.instances.length;

    // Rapidly call connect() multiple times - simulating rapid user actions
    await act(async () => {
      // Fire off 3 connect calls without waiting
      result.current.connect();
      result.current.connect();
      result.current.connect();
    });

    // Advance timers to allow any pending connections
    await vi.advanceTimersByTimeAsync(100);

    // ASSERT: Should not create additional WebSocket instances
    // This test should FAIL if connection coalescing is not implemented
    expect(MockWebSocket.instances.length).toBe(initialCount);
  });

  /**
   * BUG 4: Learning content cards attach to wrong message
   *
   * Scenario: AI shows learning cards (projects/quizzes) on a different message than intended.
   * Root cause: Race between tool_end and chunk events - content attaches to stale ref.
   *
   * Expected: Learning content metadata should be on the message that triggered the tool.
   */
  it('REGRESSION: learning content attaches to correct message', async () => {
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-4',
        onError: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // Simulate: processing starts, chunks stream, tool returns learning content
    act(() => {
      ws.simulateMessage({ event: 'processing_started' });
      ws.simulateMessage({ event: 'chunk', chunk: 'Here are some projects: ' });
    });

    // Tool starts and ends with learning content
    act(() => {
      ws.simulateMessage({ event: 'tool_start', tool: 'find_content' });
      ws.simulateMessage({
        event: 'tool_end',
        tool: 'find_content',
        output: {
          success: true,
          query: 'AI projects',
          projects: [
            {
              id: 1,
              title: 'Test Project',
              slug: 'test-project',
              description: 'A test project',
              url: '/projects/test-project',
            },
          ],
        },
      });
    });

    // More chunks arrive AFTER tool_end (this is the race condition)
    act(() => {
      ws.simulateMessage({ event: 'chunk', chunk: 'Check them out!' });
      ws.simulateMessage({ event: 'completed' });
    });

    // ASSERT: The last assistant message should have the learning content attached
    const assistantMessages = result.current.messages.filter((m) => m.sender === 'assistant');
    const lastMessage = assistantMessages[assistantMessages.length - 1];

    // This test should FAIL if learning content attaches to wrong message
    expect(lastMessage?.content).toContain('Check them out!');
    expect(lastMessage?.metadata?.learningContent).toBeDefined();
    expect(lastMessage?.metadata?.learningContent?.items?.length).toBeGreaterThan(0);
  });

  /**
   * BUG 5: Chat stops mid-stream silently without error shown to user
   *
   * Scenario: User sends message, sees partial response, then nothing.
   * Root cause: WebSocket send failure not propagated to error callback.
   *
   * Expected: When send fails, onError should be called with a message.
   */
  it('REGRESSION: send failure shows error to user', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-5',
        onError,
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // Override send to throw an error
    ws.send = () => {
      throw new Error('WebSocket send failed');
    };

    // Try to send a message
    act(() => {
      result.current.sendMessage('Hello Ava');
    });

    // ASSERT: onError should be called
    // This test should FAIL if errors are silently swallowed
    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed'));
  });

  /**
   * BUG 6: Stale pending connection creates socket after cancellation
   *
   * Scenario: User disconnects while connection is in progress, but socket still opens.
   * Root cause: No cancellation token for in-flight connection attempts.
   *
   * Expected: After disconnect(), pending connections should be cancelled.
   */
  it('REGRESSION: pending connection attempts do not create sockets after cancellation', async () => {
    const { result } = renderHook(() =>
      useIntelligentChat({
        conversationId: 'test-conv-6',
        onError: vi.fn(),
      })
    );

    // Wait for connection to start (but don't open the socket yet)
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    // Disconnect while connection is pending
    act(() => {
      result.current.disconnect();
    });

    // Now simulate the WebSocket opening (this is the race - socket opens after disconnect)
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // ASSERT: After disconnect, isConnected should remain false
    // even though the socket technically opened
    // This test should FAIL if cancellation is not implemented
    expect(result.current.isConnected).toBe(false);
  });
});
