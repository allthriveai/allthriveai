/**
 * Admin Log Streaming Types
 *
 * Types for real-time log streaming in admin dashboard.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type LogService = 'web' | 'celery' | 'celery-beat';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: LogService;
  message: string;
  userId?: number | null;
  requestId?: string | null;
  raw?: string;
}

export interface LogFilters {
  level?: LogLevel;
  service?: LogService;
  startTime?: string;
  endTime?: string;
  userId?: number;
  requestId?: string;
  pattern?: string;
}

export interface AdminLogsWebSocketMessage {
  event: 'history' | 'log' | 'error' | 'pong' | 'filtersUpdated' | 'logsCleared';
  logs?: LogEntry[];
  log?: LogEntry;
  message?: string;
  timestamp?: string;
  filters?: LogFilters;
}

export interface UseAdminLogsReturn {
  logs: LogEntry[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  filters: LogFilters;
  setFilters: (filters: LogFilters) => void;
  clearLogs: () => void;
}
