/**
 * useMatchmaking Hook
 *
 * Manages WebSocket connection for battle matchmaking.
 * Handles queue joining, status updates, and match found notifications.
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';

export type MatchType = 'random' | 'ai' | 'active_user';

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

  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    inQueue: false,
    position: 0,
    expiresAt: null,
  });
  const [isSearching, setIsSearching] = useState(false);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const onMatchFoundRef = useRef(onMatchFound);
  const onQueueUpdateRef = useRef(onQueueUpdate);
  const pendingJoinRef = useRef<PendingJoinRequest | null>(null);
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onMatchFoundRef.current = onMatchFound;
    onQueueUpdateRef.current = onQueueUpdate;
  }, [onError, onMatchFound, onQueueUpdate]);

  // Send pending join request if any
  const sendPendingJoin = useCallback(() => {
    if (pendingJoinRef.current && sendRef.current) {
      const { matchType, challengeTypeKey } = pendingJoinRef.current;
      sendRef.current({
        type: 'join_queue',
        match_type: matchType,
        challenge_type: challengeTypeKey,
      });
      pendingJoinRef.current = null;
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    try {
      const data = rawData as WebSocketMessage;

      if (data.event === 'pong') return;

      switch (data.event) {
        case 'connected':
          // Connection confirmed - send pending join
          sendPendingJoin();
          break;

        case 'queue_joined': {
          setIsSearching(true);
          const joinedStatus: QueueStatus = {
            inQueue: true,
            position: data.position ?? 1,
            expiresAt: data.expires_at ?? null,
          };
          setQueueStatus(joinedStatus);
          onQueueUpdateRef.current?.(joinedStatus);
          break;
        }

        case 'queue_status': {
          const status: QueueStatus = {
            inQueue: data.in_queue ?? false,
            position: data.position ?? 0,
            expiresAt: data.expires_at ?? null,
          };
          setQueueStatus(status);
          setIsSearching(status.inQueue);
          onQueueUpdateRef.current?.(status);
          break;
        }

        case 'queue_left': {
          setIsSearching(false);
          const leftStatus: QueueStatus = {
            inQueue: false,
            position: 0,
            expiresAt: null,
          };
          setQueueStatus(leftStatus);
          onQueueUpdateRef.current?.(leftStatus);
          break;
        }

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

        case 'no_active_users':
          setIsSearching(false);
          setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
          onErrorRef.current?.('No active users available right now. Try again or battle Pip!');
          break;

        case 'error':
          setIsSearching(false);
          onErrorRef.current?.(data.error ?? 'An error occurred');
          break;
      }
    } catch (error) {
      console.error('[Matchmaking] Failed to parse message:', error);
    }
  }, [sendPendingJoin]);

  // Handle connection established
  const handleConnected = useCallback(() => {
    sendPendingJoin();
  }, [sendPendingJoin]);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    onErrorRef.current?.(errorMsg);
  }, []);

  // Handle disconnect
  const handleDisconnected = useCallback(() => {
    setIsSearching(false);
  }, []);

  // Should we auto-connect? No - matchmaking connects on demand
  const shouldConnect = false;

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send, connect, disconnect, reconnectAttempts } = useWebSocketBase({
    endpoint: '/ws/matchmaking/',
    connectionIdPrefix: 'matchmaking',
    onMessage: handleMessage,
    onConnected: handleConnected,
    onError: handleError,
    onDisconnected: handleDisconnected,
    autoConnect: shouldConnect,
    autoReconnect,
    requiresAuth: true,
    maxReconnectAttempts: 3,
    maxReconnectDelay: 10000,
  });

  // Store send function in ref
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Check auth before connecting
  const safeConnect = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      onErrorRef.current?.('Please log in to find battles');
      return;
    }
    await connect();
  }, [authLoading, isAuthenticated, connect]);

  // Join matchmaking queue
  const joinQueue = useCallback(
    async (matchType: MatchType = 'random', challengeTypeKey?: string) => {
      // Store the pending request
      pendingJoinRef.current = { matchType, challengeTypeKey };

      if (isConnected && sendRef.current) {
        // Already connected, send immediately
        sendPendingJoin();
      } else {
        // Need to connect first - the connection handler will send the pending join
        await safeConnect();
      }
    },
    [isConnected, sendPendingJoin, safeConnect]
  );

  // Leave matchmaking queue
  const leaveQueue = useCallback(() => {
    pendingJoinRef.current = null;
    if (sendRef.current) {
      sendRef.current({ type: 'leave_queue' });
    }
    setIsSearching(false);
    setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
  }, []);

  // Request queue status
  const requestQueueStatus = useCallback(() => {
    if (sendRef.current) {
      sendRef.current({ type: 'queue_status' });
    }
  }, []);

  // Quick match against Pip (AI)
  const matchWithPip = useCallback(
    (challengeTypeKey?: string) => {
      return joinQueue('ai', challengeTypeKey);
    },
    [joinQueue]
  );

  // Find random opponent (queue-based)
  const findRandomMatch = useCallback(
    (challengeTypeKey?: string) => {
      return joinQueue('random', challengeTypeKey);
    },
    [joinQueue]
  );

  // Find an active user to battle (sends them a notification)
  const findActiveUser = useCallback(
    (challengeTypeKey?: string) => {
      return joinQueue('active_user', challengeTypeKey);
    },
    [joinQueue]
  );

  // Custom disconnect that also clears pending joins
  const safeDisconnect = useCallback(() => {
    pendingJoinRef.current = null;
    setIsSearching(false);
    setQueueStatus({ inQueue: false, position: 0, expiresAt: null });
    disconnect();
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isSearching,
    queueStatus,
    reconnectAttempts,
    connect: safeConnect,
    disconnect: safeDisconnect,
    joinQueue,
    leaveQueue,
    requestQueueStatus,
    matchWithPip,
    findRandomMatch,
    findActiveUser,
  };
}
