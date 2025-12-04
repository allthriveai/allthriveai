/**
 * useMatchmaking Hook
 *
 * Manages WebSocket connection for battle matchmaking.
 * Handles queue joining, status updates, and match found notifications.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, logWebSocketUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';

// Constants
const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;

export type MatchType = 'random' | 'ai';

export interface MatchedOpponent {
  id: number;
  username: string;
  isAi: boolean;
}

export interface QueueStatus {
  inQueue: boolean;
  position: number;
  expiresAt: string | null;
}

export interface MatchFoundData {
  battleId: number;
  opponent: MatchedOpponent;
}

interface WebSocketMessage {
  event: string;
  error?: string;
  timestamp?: string;
  // Queue events
  position?: number;
  expires_at?: string;
  in_queue?: boolean;
  // Match found events
  battle_id?: number;
  opponent?: {
    id: number;
    username: string;
    is_ai: boolean;
  };
}

interface UseMatchmakingOptions {
  onError?: (error: string) => void;
  onMatchFound?: (data: MatchFoundData) => void;
  onQueueUpdate?: (status: QueueStatus) => void;
  autoReconnect?: boolean;
}

// Pending queue join request
interface PendingJoinRequest {
  matchType: MatchType;
  challengeTypeKey?: string;
}

export function useMatchmaking({
  onError,
  onMatchFound,
  onQueueUpdate,
  autoReconnect = true,
}: UseMatchmakingOptions = {}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    inQueue: false,
    position: 0,
    expiresAt: null,
  });
  const [isSearching, setIsSearching] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectFnRef = useRef<(() => Promise<void>) | null>(null);
  const isConnectingRef = useRef(false);
  const pendingJoinRef = useRef<PendingJoinRequest | null>(null);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const onMatchFoundRef = useRef(onMatchFound);
  const onQueueUpdateRef = useRef(onQueueUpdate);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onMatchFoundRef.current = onMatchFound;
    onQueueUpdateRef.current = onQueueUpdate;
  }, [onError, onMatchFound, onQueueUpdate]);

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
          console.error('[Matchmaking] Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Schedule reconnect
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || intentionalCloseRef.current) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onErrorRef.current?.('Connection lost. Please try again.');
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

  // Send pending join request if any
  const sendPendingJoin = useCallback(() => {
    if (pendingJoinRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      const { matchType, challengeTypeKey } = pendingJoinRef.current;
      wsRef.current.send(
        JSON.stringify({
          type: 'join_queue',
          match_type: matchType,
          challenge_type: challengeTypeKey,
        })
      );
      pendingJoinRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async (): Promise<void> => {
    if (authLoading) return;
    if (!isAuthenticated) {
      onErrorRef.current?.('Please log in to find battles');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Already connected, send pending join if any
      sendPendingJoin();
      return;
    }
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
          connection_id: `matchmaking-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;
    } catch (error) {
      console.error('[Matchmaking] Failed to fetch connection token:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onErrorRef.current?.('Failed to connect. Please try again.');
      return;
    }

    // Connect to WebSocket
    const wsUrl = buildWebSocketUrl('/ws/matchmaking/', {
      connection_token: connectionToken,
    });

    logWebSocketUrl(wsUrl, '[Matchmaking] Connecting');

    return new Promise<void>((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);

        connectionTimeoutRef.current = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            onErrorRef.current?.('Connection timeout');
            scheduleReconnect();
            resolve();
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          console.log('[Matchmaking] Connected');
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setIsConnected(true);
          setIsConnecting(false);
          isConnectingRef.current = false;
          setReconnectAttempts(0);
          startHeartbeat();

          // Send pending join request
          sendPendingJoin();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            console.log('[Matchmaking] Message:', data.event, data);

            if (data.event === 'pong') return;

            switch (data.event) {
              case 'connected':
                // Connection confirmed
                break;

              case 'queue_joined':
                setIsSearching(true);
                const joinedStatus: QueueStatus = {
                  inQueue: true,
                  position: data.position ?? 1,
                  expiresAt: data.expires_at ?? null,
                };
                setQueueStatus(joinedStatus);
                onQueueUpdateRef.current?.(joinedStatus);
                break;

              case 'queue_status':
                const status: QueueStatus = {
                  inQueue: data.in_queue ?? false,
                  position: data.position ?? 0,
                  expiresAt: data.expires_at ?? null,
                };
                setQueueStatus(status);
                setIsSearching(status.inQueue);
                onQueueUpdateRef.current?.(status);
                break;

              case 'queue_left':
                setIsSearching(false);
                const leftStatus: QueueStatus = {
                  inQueue: false,
                  position: 0,
                  expiresAt: null,
                };
                setQueueStatus(leftStatus);
                onQueueUpdateRef.current?.(leftStatus);
                break;

              case 'match_found':
                setIsSearching(false);
                setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
                if (data.battle_id && data.opponent) {
                  onMatchFoundRef.current?.({
                    battleId: data.battle_id,
                    opponent: {
                      id: data.opponent.id,
                      username: data.opponent.username,
                      isAi: data.opponent.is_ai ?? false,
                    },
                  });
                }
                break;

              case 'queue_timeout':
                setIsSearching(false);
                setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
                onErrorRef.current?.('Queue timed out. Please try again.');
                break;

              case 'error':
                setIsSearching(false);
                onErrorRef.current?.(data.error ?? 'An error occurred');
                break;
            }
          } catch (error) {
            console.error('[Matchmaking] Failed to parse message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[Matchmaking] Error:', error);
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          onErrorRef.current?.('Connection error');
          resolve();
        };

        ws.onclose = (event) => {
          console.log('[Matchmaking] Closed:', event.code);
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          setIsSearching(false);
          clearTimers();

          if (event.code === 4001) {
            onErrorRef.current?.('Authentication required. Please log in.');
            resolve();
            return;
          }

          if (!intentionalCloseRef.current) {
            scheduleReconnect();
          }
          resolve();
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[Matchmaking] Failed to create WebSocket:', error);
        setIsConnecting(false);
        isConnectingRef.current = false;
        onErrorRef.current?.('Failed to establish connection');
        scheduleReconnect();
        resolve();
      }
    });
  }, [
    isAuthenticated,
    authLoading,
    clearTimers,
    startHeartbeat,
    scheduleReconnect,
    sendPendingJoin,
  ]);

  // Store connect function
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();
    pendingJoinRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsSearching(false);
    setReconnectAttempts(0);
  }, [clearTimers]);

  // Join matchmaking queue
  const joinQueue = useCallback(
    async (matchType: MatchType = 'random', challengeTypeKey?: string) => {
      // Store the pending request
      pendingJoinRef.current = { matchType, challengeTypeKey };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Already connected, send immediately
        sendPendingJoin();
      } else {
        // Need to connect first - the connection handler will send the pending join
        await connectFnRef.current?.();
      }
    },
    [sendPendingJoin]
  );

  // Leave matchmaking queue
  const leaveQueue = useCallback(() => {
    pendingJoinRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_queue' }));
    }
    setIsSearching(false);
    setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
  }, []);

  // Request queue status
  const requestQueueStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'queue_status' }));
    }
  }, []);

  // Quick match against Pip (AI)
  const matchWithPip = useCallback(
    (challengeTypeKey?: string) => {
      return joinQueue('ai', challengeTypeKey);
    },
    [joinQueue]
  );

  // Find random opponent
  const findRandomMatch = useCallback(
    (challengeTypeKey?: string) => {
      return joinQueue('random', challengeTypeKey);
    },
    [joinQueue]
  );

  // Cleanup on unmount (but don't auto-connect on mount)
  useEffect(() => {
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

  return {
    isConnected,
    isConnecting,
    isSearching,
    queueStatus,
    reconnectAttempts,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    requestQueueStatus,
    matchWithPip,
    findRandomMatch,
  };
}
