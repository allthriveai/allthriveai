/**
 * useBattleWebSocket Hook
 *
 * Manages WebSocket connection for real-time prompt battles.
 * Handles battle state updates, opponent status, and submission flow.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, logWebSocketUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;

// Battle phases matching backend
export type BattlePhase =
  | 'waiting'
  | 'countdown'
  | 'active'
  | 'generating'
  | 'judging'
  | 'reveal'
  | 'complete';

export type OpponentStatus = 'connected' | 'disconnected' | 'typing' | 'submitted' | 'idle';

export interface Opponent {
  id: number;
  username: string;
  avatarUrl?: string;
  connected: boolean;
  status?: OpponentStatus;
}

export interface ChallengeType {
  key: string;
  name: string;
}

export interface MySubmission {
  id: number;
  promptText: string;
  imageUrl?: string;
  score?: number;
  criteriaScores?: Record<string, number>;
  feedback?: string;
}

export interface BattleState {
  id: number;
  phase: BattlePhase;
  status: string;
  challengeText: string;
  challengeType: ChallengeType | null;
  durationMinutes: number;
  timeRemaining: number | null;
  myConnected: boolean;
  opponent: Opponent;
  mySubmission: MySubmission | null;
  opponentSubmission: MySubmission | null;
  winnerId: number | null;
  matchSource: string;
}

interface WebSocketMessage {
  event: string;
  state?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
  user_id?: number;
  status?: string;
  phase?: BattlePhase;
  duration?: number;
  value?: number;
  submission_id?: number;
  battle_id?: number;
  image_url?: string;
  winner_id?: number | null;
}

interface UseBattleWebSocketOptions {
  battleId: number;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: BattlePhase) => void;
  onMatchComplete?: (winnerId: number | null) => void;
  autoReconnect?: boolean;
}

export function useBattleWebSocket({
  battleId,
  onError,
  onPhaseChange,
  onMatchComplete,
  autoReconnect = true,
}: UseBattleWebSocketOptions) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [opponentStatus, setOpponentStatus] = useState<OpponentStatus>('disconnected');
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectFnRef = useRef<(() => void) | null>(null);
  const isConnectingRef = useRef(false);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onMatchCompleteRef = useRef(onMatchComplete);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onPhaseChangeRef.current = onPhaseChange;
    onMatchCompleteRef.current = onMatchComplete;
  }, [onError, onPhaseChange, onMatchComplete]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Schedule reconnect
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || intentionalCloseRef.current) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onErrorRef.current?.('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts((prev) => prev + 1);
      connectFnRef.current?.();
    }, delay);
  }, [autoReconnect, reconnectAttempts]);

  // Parse server state to client format with defensive null checks
  const parseServerState = useCallback((serverState: Record<string, unknown>): BattleState | null => {
    try {
      const opponent = serverState.opponent as Record<string, unknown> | null;
      const mySubmission = serverState.my_submission as Record<string, unknown> | null;
      const opponentSubmission = serverState.opponent_submission as Record<string, unknown> | null;
      const challengeType = serverState.challenge_type as Record<string, unknown> | null;

      if (!opponent) {
        console.error('[Battle WS] Missing opponent in state');
        return null;
      }

      return {
        id: (serverState.id as number) ?? 0,
        phase: (serverState.phase as BattlePhase) ?? 'waiting',
        status: (serverState.status as string) ?? 'pending',
        challengeText: (serverState.challenge_text as string) ?? '',
        challengeType: challengeType
          ? {
              key: (challengeType.key as string) ?? '',
              name: (challengeType.name as string) ?? '',
            }
          : null,
        durationMinutes: (serverState.duration_minutes as number) ?? 3,
        timeRemaining: serverState.time_remaining as number | null,
        myConnected: (serverState.my_connected as boolean) ?? false,
        opponent: {
          id: (opponent.id as number) ?? 0,
          username: (opponent.username as string) ?? 'Unknown',
          avatarUrl: opponent.avatar_url as string | undefined,
          connected: (opponent.connected as boolean) ?? false,
        },
        mySubmission: mySubmission
          ? {
              id: (mySubmission.id as number) ?? 0,
              promptText: (mySubmission.prompt_text as string) ?? '',
              imageUrl: mySubmission.image_url as string | undefined,
              score: mySubmission.score as number | undefined,
              criteriaScores: mySubmission.criteria_scores as Record<string, number> | undefined,
              feedback: mySubmission.feedback as string | undefined,
            }
          : null,
        opponentSubmission: opponentSubmission
          ? {
              id: (opponentSubmission.id as number) ?? 0,
              promptText: (opponentSubmission.prompt_text as string) ?? '',
              imageUrl: opponentSubmission.image_url as string | undefined,
              score: opponentSubmission.score as number | undefined,
              criteriaScores: opponentSubmission.criteria_scores as Record<string, number> | undefined,
              feedback: opponentSubmission.feedback as string | undefined,
            }
          : null,
        winnerId: serverState.winner_id as number | null,
        matchSource: (serverState.match_source as string) ?? 'unknown',
      };
    } catch (error) {
      console.error('[Battle WS] Failed to parse server state:', error);
      return null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      onErrorRef.current?.('Please log in to join battles');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearTimers();
    setIsConnecting(true);

    // Fetch connection token
    let connectionToken: string;
    try {
      const csrfToken = getCsrfToken();
      const response = await fetch('/api/v1/auth/ws-connection-token/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({
          connection_id: `battle-${battleId}-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;
    } catch (error) {
      console.error('[Battle WS] Failed to fetch connection token:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onErrorRef.current?.('Failed to get connection token. Please try again.');
      return;
    }

    // Connect to WebSocket
    const wsUrl = buildWebSocketUrl(`/ws/battle/${battleId}/`, {
      connection_token: connectionToken,
    });

    logWebSocketUrl(wsUrl, '[Battle WS] Connecting');

    try {
      const ws = new WebSocket(wsUrl);

      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          onErrorRef.current?.('Connection timeout');
          scheduleReconnect();
        }
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        console.log('[Battle WS] Connected');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setIsConnecting(false);
        isConnectingRef.current = false;
        setReconnectAttempts(0);
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('[Battle WS] Message:', data.event, data);

          if (data.event === 'pong') return;

          switch (data.event) {
            case 'battle_state':
              if (data.state) {
                const newState = parseServerState(data.state);
                if (newState) {
                  setBattleState(newState);
                  setOpponentStatus(newState.opponent.connected ? 'connected' : 'disconnected');
                }
              }
              break;

            case 'opponent_status':
              if (data.status) {
                setOpponentStatus(data.status as OpponentStatus);
              }
              break;

            case 'countdown_start':
              setCountdownValue(data.duration || 3);
              onPhaseChangeRef.current?.('countdown');
              break;

            case 'countdown_tick':
              if (typeof data.value === 'number') {
                setCountdownValue(data.value);
              }
              break;

            case 'phase_change':
              if (data.phase) {
                setBattleState((prev) => (prev ? { ...prev, phase: data.phase! } : null));
                onPhaseChangeRef.current?.(data.phase);

                if (data.phase === 'complete') {
                  // Get winnerId from current state
                  setBattleState((prev) => {
                    if (prev) {
                      onMatchCompleteRef.current?.(prev.winnerId);
                    }
                    return prev;
                  });
                }

                // Clear countdown when transitioning to active
                if (data.phase === 'active') {
                  setCountdownValue(null);
                }
              }
              break;

            case 'submission_confirmed':
              console.log('[Battle WS] Submission confirmed:', data.submission_id);
              // Update battleState to reflect submission
              setBattleState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  mySubmission: {
                    id: data.submission_id as number,
                    promptText: '', // Will be populated on next state refresh
                  },
                };
              });
              break;

            case 'image_generating':
              console.log('[Battle WS] Image generating for user:', data.user_id);
              break;

            case 'image_generated':
              console.log('[Battle WS] Image generated:', data.image_url);
              // Update my submission with the image if it's mine
              setBattleState((prev) => {
                if (!prev || !prev.mySubmission) return prev;
                // Check if this is our submission
                if (data.submission_id === prev.mySubmission.id) {
                  return {
                    ...prev,
                    mySubmission: {
                      ...prev.mySubmission,
                      imageUrl: data.image_url as string,
                    },
                  };
                }
                return prev;
              });
              break;

            case 'judging_complete':
              console.log('[Battle WS] Judging complete, winner:', data.winner_id, 'results:', data.results);
              setBattleState((prev) => {
                if (!prev) return null;

                // Update with winner and any results data
                const newState = {
                  ...prev,
                  winnerId: data.winner_id as number | null,
                };

                // If results include submission data, update submissions
                const results = data.results as Array<{
                  submission_id?: number;
                  user_id?: number;
                  score?: number;
                  criteria_scores?: Record<string, number>;
                  feedback?: string;
                }>;

                if (results && Array.isArray(results)) {
                  for (const result of results) {
                    // Update my submission if this is mine
                    if (prev.mySubmission && result.submission_id === prev.mySubmission.id) {
                      newState.mySubmission = {
                        ...prev.mySubmission,
                        score: result.score,
                        criteriaScores: result.criteria_scores,
                        feedback: result.feedback,
                      };
                    }
                  }
                }

                return newState;
              });
              break;

            case 'state_refresh':
              // Server is telling us to request fresh state (after judging/completion)
              console.log('[Battle WS] State refresh requested');
              // Send request_state directly since requestState callback isn't available here
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'request_state' }));
              }
              break;

            case 'battle_complete':
              console.log('[Battle WS] Battle complete, winner:', data.winner_id);
              onMatchCompleteRef.current?.(data.winner_id as number | null);
              break;

            case 'error':
              onErrorRef.current?.(data.error || 'An error occurred');
              break;
          }
        } catch (error) {
          console.error('[Battle WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Battle WS] Error:', error);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        onErrorRef.current?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[Battle WS] Closed:', event.code);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        clearTimers();

        if (event.code === 4001) {
          onErrorRef.current?.('Authentication required. Please log in.');
          return;
        }

        if (!intentionalCloseRef.current) {
          scheduleReconnect();
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[Battle WS] Failed to create WebSocket:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onErrorRef.current?.('Failed to establish WebSocket connection');
      scheduleReconnect();
    }
  }, [
    battleId,
    isAuthenticated,
    authLoading,
    clearTimers,
    startHeartbeat,
    scheduleReconnect,
    parseServerState,
  ]);

  // Store connect function
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setReconnectAttempts(0);
  }, [clearTimers]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
    }
  }, []);

  // Submit prompt
  const submitPrompt = useCallback((promptText: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onErrorRef.current?.('Not connected to battle');
      return false;
    }

    if (!promptText.trim()) {
      onErrorRef.current?.('Prompt cannot be empty');
      return false;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'submit_prompt',
          prompt_text: promptText,
        })
      );
      return true;
    } catch (error) {
      console.error('[Battle WS] Failed to submit prompt:', error);
      onErrorRef.current?.('Failed to submit prompt');
      return false;
    }
  }, []);

  // Request state refresh
  const requestState = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_state' }));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    intentionalCloseRef.current = false;
    connectFnRef.current?.();

    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect when auth loads
  useEffect(() => {
    if (!authLoading && isAuthenticated && !wsRef.current && !isConnectingRef.current) {
      connectFnRef.current?.();
    }
  }, [authLoading, isAuthenticated]);

  return {
    battleState,
    isConnected,
    isConnecting,
    opponentStatus,
    countdownValue,
    reconnectAttempts,
    sendTyping,
    submitPrompt,
    requestState,
    connect,
    disconnect,
  };
}
