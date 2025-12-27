/**
 * useWebSocketBase Hook
 *
 * A reusable base hook for WebSocket connections with:
 * - Connection token authentication
 * - Automatic heartbeat
 * - Exponential backoff reconnection
 * - Configurable callbacks
 *
 * This hook consolidates common WebSocket logic used across multiple
 * feature-specific hooks (battles, chat, matchmaking, etc.).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { buildWebSocketUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';
import type { WebSocketBaseOptions, WebSocketBaseReturn } from './types';
import { WS_DEFAULTS } from './types';

/**
 * Base hook for WebSocket connections.
 *
 * Provides connection management, heartbeat, and reconnection logic
 * that can be shared across feature-specific WebSocket hooks.
 *
 * @example
 * ```tsx
 * const { isConnected, send } = useWebSocketBase({
 *   endpoint: `/ws/chat/${roomId}/`,
 *   connectionIdPrefix: 'chat',
 *   onMessage: (data) => handleMessage(data),
 *   onError: (error) => toast.error(error),
 * });
 * ```
 */
export function useWebSocketBase(options: WebSocketBaseOptions): WebSocketBaseReturn {
  const {
    endpoint,
    connectionIdPrefix,
    onMessage,
    maxReconnectAttempts = WS_DEFAULTS.MAX_RECONNECT_ATTEMPTS,
    initialReconnectDelay = WS_DEFAULTS.INITIAL_RECONNECT_DELAY,
    maxReconnectDelay = WS_DEFAULTS.MAX_RECONNECT_DELAY,
    heartbeatInterval = WS_DEFAULTS.HEARTBEAT_INTERVAL,
    connectionTimeout = WS_DEFAULTS.CONNECTION_TIMEOUT,
    autoConnect = true,
    autoReconnect = true,
    requiresAuth = true,
    onConnected,
    onDisconnected,
    onError,
    onReconnecting,
    logger,
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Refs for callbacks to avoid stale closures
  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  const onReconnectingRef = useRef(onReconnecting);
  const loggerRef = useRef(logger);

  // Update callback refs when they change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onErrorRef.current = onError;
    onReconnectingRef.current = onReconnecting;
    loggerRef.current = logger;
  }, [onMessage, onConnected, onDisconnected, onError, onReconnecting, logger]);

  // Log helper
  const log = useCallback(
    (level: 'debug' | 'info' | 'warn' | 'error', event: string, context?: Record<string, unknown>) => {
      const ctx = { endpoint, ...context };
      if (loggerRef.current) {
        loggerRef.current[level](event, ctx);
      } else if (level === 'error') {
        console.error(`[WebSocket] ${event}`, ctx);
      }
    },
    [endpoint]
  );

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
          log('error', 'heartbeat_failed', { error: String(error) });
        }
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, log]);

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(
    (attempts: number, connectFn: () => Promise<void>) => {
      if (!autoReconnect || intentionalCloseRef.current) {
        return;
      }

      if (attempts >= maxReconnectAttempts) {
        log('warn', 'max_reconnect_attempts_reached', { attempts });
        onErrorRef.current?.('Connection lost. Please refresh the page to reconnect.');
        return;
      }

      const delay = Math.min(initialReconnectDelay * Math.pow(2, attempts), maxReconnectDelay);
      log('info', 'scheduling_reconnect', { attempt: attempts + 1, delay });
      onReconnectingRef.current?.(attempts + 1, delay);

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1);
        connectFn();
      }, delay);
    },
    [autoReconnect, maxReconnectAttempts, initialReconnectDelay, maxReconnectDelay, log]
  );

  // Connect to WebSocket
  const connect = useCallback(async (): Promise<void> => {
    // Guard against multiple simultaneous connection attempts
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('debug', 'connect_skipped', { reason: 'already_connected' });
      return;
    }
    if (isConnectingRef.current) {
      log('debug', 'connect_skipped', { reason: 'already_connecting' });
      return;
    }

    isConnectingRef.current = true;
    intentionalCloseRef.current = false;
    setIsConnecting(true);

    log('info', 'connect_start', { reconnectAttempts });

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearTimers();

    // Fetch connection token if authentication is required
    let connectionToken: string | undefined;
    if (requiresAuth) {
      try {
        log('debug', 'fetching_connection_token');

        const csrfToken = getCsrfToken();
        const response = await fetch('/api/v1/auth/ws-connection-token/', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
          },
          body: JSON.stringify({
            connection_id: `${connectionIdPrefix}-${Date.now()}`,
          }),
        });

        if (response.status === 401 || response.status === 403) {
          log('warn', 'auth_failed', { status: response.status });
          setIsConnecting(false);
          isConnectingRef.current = false;
          onErrorRef.current?.('Authentication required. Please log in.');
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch connection token: ${response.status}`);
        }

        const data = await response.json();
        connectionToken = data.connection_token;
        log('debug', 'connection_token_received');
      } catch (error) {
        log('error', 'connection_token_error', { error: String(error) });
        setIsConnecting(false);
        isConnectingRef.current = false;
        onErrorRef.current?.('Failed to establish connection. Please try again.');
        return;
      }
    }

    // Build WebSocket URL
    const queryParams = connectionToken ? { connection_token: connectionToken } : undefined;
    const wsUrl = buildWebSocketUrl(endpoint, queryParams);

    log('info', 'websocket_connecting');

    try {
      const ws = new WebSocket(wsUrl);

      // Connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          log('warn', 'connection_timeout');
          ws.close();
          setIsConnecting(false);
          isConnectingRef.current = false;
          scheduleReconnect(reconnectAttempts, connect);
        }
      }, connectionTimeout);

      ws.onopen = () => {
        log('info', 'connected');
        clearTimeout(connectionTimeoutRef.current!);
        connectionTimeoutRef.current = null;
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        isConnectingRef.current = false;

        startHeartbeat();
        onConnectedRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Ignore pong responses
          if (data.type === 'pong' || data.event === 'pong') {
            return;
          }

          onMessageRef.current(data);
        } catch (error) {
          log('error', 'message_parse_error', { error: String(error) });
        }
      };

      ws.onclose = (event) => {
        log('info', 'disconnected', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        clearTimers();

        onDisconnectedRef.current?.();

        // Attempt reconnect if not intentional close
        if (!intentionalCloseRef.current) {
          scheduleReconnect(reconnectAttempts, connect);
        }
      };

      ws.onerror = (event) => {
        log('error', 'websocket_error', { event: String(event) });
        // Error will trigger onclose
      };

      wsRef.current = ws;
    } catch (error) {
      log('error', 'connection_failed', { error: String(error) });
      setIsConnecting(false);
      isConnectingRef.current = false;
      onErrorRef.current?.('Failed to connect. Please try again.');
    }
  }, [
    endpoint,
    connectionIdPrefix,
    requiresAuth,
    connectionTimeout,
    reconnectAttempts,
    clearTimers,
    startHeartbeat,
    scheduleReconnect,
    log,
  ]);

  // Disconnect
  const disconnect = useCallback(() => {
    log('info', 'disconnect_requested');
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    isConnectingRef.current = false;
  }, [clearTimers, log]);

  // Send message
  const send = useCallback(
    (message: unknown): boolean => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        log('warn', 'send_failed', { reason: 'not_connected' });
        return false;
      }

      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        wsRef.current.send(payload);
        return true;
      } catch (error) {
        log('error', 'send_error', { error: String(error) });
        return false;
      }
    },
    [log]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
    // Only run on mount/unmount, not when connect/disconnect change

  }, [autoConnect, endpoint]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempts,
    connect,
    disconnect,
    send,
  };
}
