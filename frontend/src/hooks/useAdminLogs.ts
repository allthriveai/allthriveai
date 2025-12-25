/**
 * useAdminLogs Hook
 *
 * Manages WebSocket connection for real-time admin log streaming.
 * Handles connection, reconnection, filtering, and log history.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';
import type {
  LogEntry,
  LogFilters,
  AdminLogsWebSocketMessage,
  UseAdminLogsReturn,
} from '@/types/adminLogs';

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;
const MAX_LOGS = 500;

interface UseAdminLogsOptions {
  initialFilters?: LogFilters;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export function useAdminLogs({
  initialFilters = {},
  onError,
  autoConnect = true,
}: UseAdminLogsOptions = {}): UseAdminLogsReturn {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<LogFilters>(initialFilters);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectFnRef = useRef<(() => void) | null>(null);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const filtersRef = useRef(filters);

  // Update refs when values change
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

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
          wsRef.current.send(JSON.stringify({ event: 'ping' }));
        } catch (err) {
          console.error('[Admin Logs] Failed to send heartbeat:', err);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Ref for reconnect attempts to avoid stale closure
  const reconnectAttemptsRef = useRef(reconnectAttempts);
  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);

  // Schedule reconnect - stable function that reads from refs
  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      const errMsg = 'Max reconnection attempts reached. Please refresh the page.';
      setError(errMsg);
      onErrorRef.current?.(errMsg);
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts((prev) => prev + 1);
      connectFnRef.current?.();
    }, delay);
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    // Don't connect if not authenticated or not admin
    if (!isAuthenticated || user?.role !== 'admin') {
      return;
    }

    // Don't reconnect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    intentionalCloseRef.current = false;

    // Fetch connection token first
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
          connection_id: `admin-logs-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setIsConnecting(false);
          setError('Not authorized');
          return;
        }
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;

      if (!connectionToken) {
        throw new Error('No connection_token in response');
      }
    } catch (err) {
      console.error('[Admin Logs] Failed to fetch connection token:', err);
      setIsConnecting(false);
      setError('Failed to authenticate');
      scheduleReconnect();
      return;
    }

    const wsUrl = buildWebSocketUrl('/ws/admin/logs/', {
      connection_token: connectionToken,
    });

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setIsConnecting(false);
          setError('Connection timeout');
          scheduleReconnect();
        }
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(connectionTimeoutRef.current!);
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        setError(null);
        startHeartbeat();

        // Send initial filters if any
        if (Object.keys(filtersRef.current).length > 0) {
          ws.send(
            JSON.stringify({
              event: 'updateFilters',
              filters: filtersRef.current,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: AdminLogsWebSocketMessage = JSON.parse(event.data);

          switch (data.event) {
            case 'history':
              // Replace logs with history
              if (data.logs) {
                setLogs(data.logs);
              }
              break;

            case 'log':
              // Append new log, maintain max size
              if (data.log) {
                setLogs((prev) => [...prev, data.log!].slice(-MAX_LOGS));
              }
              break;

            case 'error': {
              const errMsg = data.message || 'Unknown error';
              setError(errMsg);
              onErrorRef.current?.(errMsg);
              break;
            }

            case 'pong':
              // Heartbeat response - connection is alive
              break;

            case 'filtersUpdated':
              // Filters acknowledged by server
              break;

            case 'logsCleared':
              // Server acknowledged clear request
              break;
          }
        } catch (err) {
          console.error('[Admin Logs] Failed to parse message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket error');
      };

      ws.onclose = () => {
        clearTimers();
        setIsConnected(false);
        setIsConnecting(false);

        if (!intentionalCloseRef.current) {
          // Unexpected close - attempt reconnect
          scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[Admin Logs] Failed to create WebSocket:', err);
      setIsConnecting(false);
      setError('Failed to connect');
      scheduleReconnect();
    }
  }, [isAuthenticated, user?.role, isConnecting, clearTimers, startHeartbeat, scheduleReconnect]);

  // Store connect function for reconnection
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Set filters and notify server
  const setFilters = useCallback((newFilters: LogFilters) => {
    setFiltersState(newFilters);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'updateFilters',
          filters: newFilters,
        })
      );
    }
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'clearLogs' }));
    }
  }, []);

  // Auto-connect when authenticated and admin
  // Note: Using refs for connect/disconnect to avoid dependency loop
  useEffect(() => {
    if (autoConnect && !authLoading && isAuthenticated && user?.role === 'admin') {
      connectFnRef.current?.();
    }

    return () => {
      // Cleanup on unmount
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [autoConnect, authLoading, isAuthenticated, user?.role, clearTimers]);

  return {
    logs,
    isConnected,
    isConnecting,
    error,
    filters,
    setFilters,
    clearLogs,
  };
}

export default useAdminLogs;
