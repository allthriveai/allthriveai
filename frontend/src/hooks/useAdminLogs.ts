/**
 * useAdminLogs Hook
 *
 * Manages WebSocket connection for real-time admin log streaming.
 * Handles connection, reconnection, filtering, and log history.
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';
import type {
  LogEntry,
  LogFilters,
  AdminLogsWebSocketMessage,
  UseAdminLogsReturn,
} from '@/types/adminLogs';

// Constants
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
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<LogFilters>(initialFilters);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const filtersRef = useRef(filters);
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);

  // Update refs when values change
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    try {
      const data = rawData as AdminLogsWebSocketMessage;

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
          // Heartbeat response - handled by base hook
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
  }, []);

  // Handle connection established - send initial filters
  const handleConnected = useCallback(() => {
    setError(null);

    // Send initial filters if any
    if (Object.keys(filtersRef.current).length > 0 && sendRef.current) {
      sendRef.current({
        event: 'updateFilters',
        filters: filtersRef.current,
      });
    }
  }, []);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    onErrorRef.current?.(errorMsg);
  }, []);

  // Should we connect?
  const shouldConnect = autoConnect && !authLoading && isAuthenticated && user?.role === 'admin';

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send } = useWebSocketBase({
    endpoint: '/ws/admin/logs/',
    connectionIdPrefix: 'admin-logs',
    onMessage: handleMessage,
    onConnected: handleConnected,
    onError: handleError,
    autoConnect: shouldConnect,
    requiresAuth: true,
  });

  // Store send function in ref for use in callbacks
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Set filters and notify server
  const setFilters = useCallback((newFilters: LogFilters) => {
    setFiltersState(newFilters);

    if (sendRef.current) {
      sendRef.current({
        event: 'updateFilters',
        filters: newFilters,
      });
    }
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);

    if (sendRef.current) {
      sendRef.current({ event: 'clearLogs' });
    }
  }, []);

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
