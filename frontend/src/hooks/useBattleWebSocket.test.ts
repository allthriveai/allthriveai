/**
 * useBattleWebSocket Hook Tests
 *
 * Comprehensive tests for the battle WebSocket hook including:
 * - Connection lifecycle
 * - State parsing and updates
 * - Message handling
 * - Submission flow
 * - Reconnection logic
 * - Error handling
 * - Pip (AI opponent) battles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBattleWebSocket, type BattleState as _BattleState } from './useBattleWebSocket';

// Mock useAuth hook
const mockUseAuth = vi.fn(() => ({
  isAuthenticated: true,
  isLoading: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock WebSocket URL builder
vi.mock('@/utils/websocket', () => ({
  buildWebSocketUrl: vi.fn((path: string, params: Record<string, string>) =>
    `ws://localhost${path}?${new URLSearchParams(params).toString()}`
  ),
}));

// Mock CSRF token getter
vi.mock('@/utils/cookies', () => ({
  getCsrfToken: vi.fn(() => 'mock-csrf-token'),
}));

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static lastInstance: MockWebSocket | null = null;

  readyState = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  url: string;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    MockWebSocket.lastInstance = this;
  }

  send(data: string) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: 'Normal closure', wasClean: true });
  }

  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(code = 1000, reason = 'Normal closure') {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Mock fetch for connection token
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Store original WebSocket
const OriginalWebSocket = global.WebSocket;

describe('useBattleWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    MockWebSocket.lastInstance = null;

    // Mock successful auth
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    // Mock successful token fetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ connection_token: 'mock-connection-token' }),
    });

    // Replace global WebSocket
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = OriginalWebSocket;
  });

  describe('Connection Lifecycle', () => {
    it('should start in connecting state', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });

    it('should fetch connection token on mount', async () => {
      renderHook(() => useBattleWebSocket({ battleId: 123 }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/auth/ws-connection-token/',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
          })
        );
      });
    });

    it('should connect to WebSocket with token', async () => {
      renderHook(() => useBattleWebSocket({ battleId: 123 }));

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      expect(MockWebSocket.lastInstance!.url).toContain('/ws/battle/123/');
      expect(MockWebSocket.lastInstance!.url).toContain('connection_token=mock-connection-token');
    });

    it('should set isConnected true when WebSocket opens', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should disconnect on unmount', async () => {
      const { unmount } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      const ws = MockWebSocket.lastInstance!;
      unmount();

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it('should not connect when auth is loading', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      renderHook(() => useBattleWebSocket({ battleId: 123 }));

      // Give time for potential async operations
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(MockWebSocket.lastInstance).toBeNull();
    });
  });

  describe('Battle State Parsing', () => {
    const mockServerState = {
      id: 123,
      phase: 'active',
      status: 'active',
      challenge_text: 'Create an amazing image',
      challenge_type: { key: 'creative', name: 'Creative' },
      duration_minutes: 3,
      time_remaining: 180,
      my_connected: true,
      match_source: 'ai_opponent',
      opponent: {
        id: 99,
        username: 'Pip',
        avatar_url: 'https://example.com/pip.jpg',
        connected: true,
        friend_name: null,
      },
      my_submission: null,
      opponent_submission: null,
      winner_id: null,
      invite_url: null,
      is_my_turn: true,
    };

    it('should parse and store battle state', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: mockServerState,
        });
      });

      expect(result.current.battleState).not.toBeNull();
      expect(result.current.battleState?.id).toBe(123);
      expect(result.current.battleState?.phase).toBe('active');
      expect(result.current.battleState?.challengeText).toBe('Create an amazing image');
      expect(result.current.battleState?.matchSource).toBe('ai_opponent');
    });

    it('should parse opponent data correctly', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: mockServerState,
        });
      });

      expect(result.current.battleState?.opponent).toEqual({
        id: 99,
        username: 'Pip',
        avatarUrl: 'https://example.com/pip.jpg',
        connected: true,
        friendName: undefined,
      });
    });

    it('should parse submission data correctly', async () => {
      const stateWithSubmission = {
        ...mockServerState,
        my_submission: {
          id: 1,
          prompt_text: 'My creative prompt',
          image_url: 'https://example.com/my-image.jpg',
          score: 85,
          criteria_scores: { creativity: 90, technique: 80 },
          feedback: 'Great work!',
        },
      };

      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: stateWithSubmission,
        });
      });

      expect(result.current.battleState?.mySubmission).toEqual({
        id: 1,
        promptText: 'My creative prompt',
        imageUrl: 'https://example.com/my-image.jpg',
        score: 85,
        criteriaScores: { creativity: 90, technique: 80 },
        feedback: 'Great work!',
      });
    });

    it('should handle missing opponent gracefully', async () => {
      const stateWithoutOpponent = {
        ...mockServerState,
        opponent: null,
      };

      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: stateWithoutOpponent,
        });
      });

      // Should not crash, but state should be null due to missing opponent
      expect(result.current.battleState).toBeNull();
    });
  });

  describe('Message Handling', () => {
    it('should handle opponent_status event', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'opponent_status',
          status: 'typing',
          user_id: 99,
        });
      });

      expect(result.current.opponentStatus).toBe('typing');
    });

    it('should handle countdown_start event', async () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, onPhaseChange })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'countdown_start',
          duration: 3,
        });
      });

      expect(result.current.countdownValue).toBe(3);
      expect(onPhaseChange).toHaveBeenCalledWith('countdown');
    });

    it('should handle countdown_tick event', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'countdown_tick',
          value: 2,
        });
      });

      expect(result.current.countdownValue).toBe(2);
    });

    it('should handle phase_change event', async () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, onPhaseChange })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Set initial state
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'waiting',
            status: 'pending',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 180,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
          },
        });
      });

      // Trigger phase change
      act(() => {
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'phase_change',
          phase: 'active',
        });
      });

      expect(result.current.battleState?.phase).toBe('active');
      expect(onPhaseChange).toHaveBeenCalledWith('active');
    });

    it('should handle submission_confirmed event', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Set initial state
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'active',
            status: 'active',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 180,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
            my_submission: null,
          },
        });
      });

      // Confirm submission
      act(() => {
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'submission_confirmed',
          submission_id: 456,
        });
      });

      expect(result.current.battleState?.mySubmission).toEqual({
        id: 456,
        promptText: '',
      });
    });

    it('should handle image_generated event', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Set initial state with submission
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'generating',
            status: 'active',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 0,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
            my_submission: { id: 456, prompt_text: 'My prompt' },
          },
        });
      });

      // Image generated
      act(() => {
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'image_generated',
          submission_id: 456,
          user_id: 1,
          image_url: 'https://example.com/generated.jpg',
        });
      });

      expect(result.current.battleState?.mySubmission?.imageUrl).toBe(
        'https://example.com/generated.jpg'
      );
    });

    it('should handle judging_complete event', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Set initial state
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'judging',
            status: 'judging',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 0,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
            my_submission: { id: 456, prompt_text: 'My prompt' },
            opponent_submission: { id: 457, prompt_text: 'Pip prompt' },
          },
        });
      });

      // Judging complete
      act(() => {
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'judging_complete',
          winner_id: 1,
          results: [
            { submission_id: 456, user_id: 1, score: 85, feedback: 'Great!' },
            { submission_id: 457, user_id: 99, score: 75, feedback: 'Good!' },
          ],
        });
      });

      expect(result.current.battleState?.winnerId).toBe(1);
      expect(result.current.battleState?.mySubmission?.score).toBe(85);
      expect(result.current.battleState?.mySubmission?.feedback).toBe('Great!');
    });

    it('should handle battle_complete event', async () => {
      const onMatchComplete = vi.fn();
      renderHook(() =>
        useBattleWebSocket({ battleId: 123, onMatchComplete })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_complete',
          winner_id: 1,
        });
      });

      expect(onMatchComplete).toHaveBeenCalledWith(1);
    });

    it('should handle error event', async () => {
      const onError = vi.fn();
      renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'error',
          error: 'Something went wrong',
        });
      });

      expect(onError).toHaveBeenCalledWith('Something went wrong');
    });

    it('should ignore pong events', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'pong',
        });
      });

      // Should not affect state
      expect(result.current.battleState).toBeNull();
    });
  });

  describe('Submission Flow', () => {
    it('should send typing indicator', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      act(() => {
        result.current.sendTyping(true);
      });

      const sentMessages = MockWebSocket.lastInstance!.sentMessages;
      expect(sentMessages).toContainEqual(
        JSON.stringify({ type: 'typing', is_typing: true })
      );
    });

    it('should submit prompt successfully', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      let success: boolean = false;
      act(() => {
        success = result.current.submitPrompt('My creative prompt');
      });

      expect(success).toBe(true);
      const sentMessages = MockWebSocket.lastInstance!.sentMessages;
      expect(sentMessages).toContainEqual(
        JSON.stringify({ type: 'submit_prompt', prompt_text: 'My creative prompt' })
      );
    });

    it('should fail to submit when not connected', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      // Don't simulate open

      let success: boolean = true;
      act(() => {
        success = result.current.submitPrompt('My creative prompt');
      });

      expect(success).toBe(false);
      expect(onError).toHaveBeenCalledWith('Not connected to battle');
    });

    it('should fail to submit empty prompt', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      let success: boolean = true;
      act(() => {
        success = result.current.submitPrompt('   ');
      });

      expect(success).toBe(false);
      expect(onError).toHaveBeenCalledWith('Prompt cannot be empty');
    });

    it('should request state refresh', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      act(() => {
        result.current.requestState();
      });

      const sentMessages = MockWebSocket.lastInstance!.sentMessages;
      expect(sentMessages).toContainEqual(
        JSON.stringify({ type: 'request_state' })
      );
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnect on unexpected close', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, autoReconnect: true })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      const firstWs = MockWebSocket.lastInstance!;
      act(() => {
        firstWs.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate unexpected close
      act(() => {
        firstWs.simulateClose(1006, 'Abnormal closure');
      });

      expect(result.current.isConnected).toBe(false);

      // Advance timer to trigger reconnect
      await act(async () => {
        vi.advanceTimersByTime(1000); // Initial delay
      });

      expect(result.current.reconnectAttempts).toBe(1);
    });

    it('should use exponential backoff for reconnection', async () => {
      renderHook(() =>
        useBattleWebSocket({ battleId: 123, autoReconnect: true })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        const ws = MockWebSocket.lastInstance!;
        act(() => {
          ws.simulateOpen();
        });
        act(() => {
          ws.simulateClose(1006, 'Abnormal closure');
        });

        // Advance timer - each reconnect should take longer
        await act(async () => {
          vi.advanceTimersByTime(1000 * Math.pow(2, i));
        });
      }

      expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    });

    it('should stop reconnecting after max attempts', async () => {
      const onError = vi.fn();
      const { result: _result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, autoReconnect: true, onError })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Simulate 5 failures (max attempts)
      for (let i = 0; i < 5; i++) {
        const ws = MockWebSocket.lastInstance!;
        act(() => {
          ws.simulateOpen();
        });
        act(() => {
          ws.simulateClose(1006, 'Abnormal closure');
        });

        await act(async () => {
          vi.advanceTimersByTime(30000); // Max delay
        });
      }

      // Try one more
      act(() => {
        MockWebSocket.lastInstance!.simulateClose(1006, 'Abnormal closure');
      });

      expect(onError).toHaveBeenCalledWith(
        'Max reconnection attempts reached. Please refresh the page.'
      );
    });

    it('should not reconnect on intentional close', async () => {
      const { result, unmount: _unmount } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, autoReconnect: true })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      const instanceCount = MockWebSocket.instances.length;

      // Intentional disconnect
      act(() => {
        result.current.disconnect();
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have created new WebSocket
      expect(MockWebSocket.instances.length).toBe(instanceCount);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123, autoReconnect: true })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Simulate failure and reconnect
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });
      act(() => {
        MockWebSocket.lastInstance!.simulateClose(1006, 'Abnormal closure');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.reconnectAttempts).toBe(1);

      // New connection succeeds
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(1);
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      expect(result.current.reconnectAttempts).toBe(0);
    });
  });

  describe('Authentication Errors', () => {
    it('should handle 401 from token fetch', async () => {
      const onError = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Please log in to join battles');
      });
    });

    it('should handle 403 from token fetch', async () => {
      const onError = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Please log in to join battles');
      });
    });

    it('should handle auth required WebSocket close code', async () => {
      const onError = vi.fn();
      renderHook(() =>
        useBattleWebSocket({ battleId: 123, onError })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateClose(4001, 'Authentication required');
      });

      expect(onError).toHaveBeenCalledWith('Authentication required. Please log in.');
    });
  });

  describe('Heartbeat', () => {
    it('should send ping periodically when connected', async () => {
      renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
      });

      // Advance time to trigger heartbeat
      act(() => {
        vi.advanceTimersByTime(30000); // HEARTBEAT_INTERVAL
      });

      const sentMessages = MockWebSocket.lastInstance!.sentMessages;
      expect(sentMessages).toContainEqual(JSON.stringify({ type: 'ping' }));
    });
  });

  describe('Pip Battle Specific', () => {
    it('should correctly identify AI opponent', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'active',
            status: 'active',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 180,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
          },
        });
      });

      expect(result.current.battleState?.matchSource).toBe('ai_opponent');
      expect(result.current.battleState?.opponent.username).toBe('Pip');
    });

    it('should handle Pip submission during generating phase', async () => {
      const { result } = renderHook(() =>
        useBattleWebSocket({ battleId: 123 })
      );

      await waitFor(() => {
        expect(MockWebSocket.lastInstance).not.toBeNull();
      });

      // Set state with both submissions
      act(() => {
        MockWebSocket.lastInstance!.simulateOpen();
        MockWebSocket.lastInstance!.simulateMessage({
          event: 'battle_state',
          state: {
            id: 123,
            phase: 'generating',
            status: 'active',
            challenge_text: 'Test',
            duration_minutes: 3,
            time_remaining: 0,
            my_connected: true,
            match_source: 'ai_opponent',
            opponent: { id: 99, username: 'Pip', connected: true },
            my_submission: { id: 456, prompt_text: 'My prompt' },
            opponent_submission: { id: 457, prompt_text: 'Pip generated prompt' },
          },
        });
      });

      expect(result.current.battleState?.mySubmission).not.toBeNull();
      expect(result.current.battleState?.opponentSubmission).not.toBeNull();
    });
  });
});
