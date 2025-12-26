/**
 * Frontend Logger Service
 *
 * Provides structured logging that:
 * - Shows output in browser console during development
 * - Sends ERROR level logs to backend for admin log stream
 * - Silences verbose logs in production
 *
 * Usage:
 *   import { logger } from '@/services/logger';
 *   logger.info('User action', { userId: 123 });
 *   logger.error('Failed to load', { error: err.message });
 *
 * Global Error Capture:
 *   Call initGlobalErrorCapture() once at app startup to automatically
 *   capture console.error calls and unhandled errors.
 */

import { api } from './api';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  url: string;
  userAgent: string;
}

// Check if we're in development mode
const isDev = import.meta.env.DEV;

// Queue for batching error logs to backend
let errorQueue: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 10;

/**
 * Flush queued error logs to backend
 */
async function flushErrorQueue(): Promise<void> {
  if (errorQueue.length === 0) return;

  const entries = [...errorQueue];
  errorQueue = [];

  try {
    await api.post('/system/client-logs/', { logs: entries });
  } catch {
    // If sending fails, don't retry - avoid infinite loops
    // Backend logs will capture the important errors anyway
  }
}

/**
 * Schedule flush of error queue
 */
function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushErrorQueue();
  }, FLUSH_INTERVAL);
}

/**
 * Queue an error log for sending to backend
 */
function queueErrorLog(entry: LogEntry): void {
  errorQueue.push(entry);

  if (errorQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushErrorQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/**
 * Format message for console output
 */
function formatForConsole(level: LogLevel, message: string, context?: LogContext): string {
  const prefix = `[${level.toUpperCase()}]`;
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Logger instance
 */
export const logger = {
  /**
   * Debug level - only shown in development console, never sent to backend
   */
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(formatForConsole('debug', message, context));
    }
  },

  /**
   * Info level - shown in development console, not sent to backend
   */
  info(message: string, context?: LogContext): void {
    if (isDev) {
      console.info(formatForConsole('info', message, context));
    }
  },

  /**
   * Warning level - shown in console, not sent to backend
   */
  warn(message: string, context?: LogContext): void {
    if (isDev) {
      console.warn(formatForConsole('warn', message, context));
    }
  },

  /**
   * Error level - always shown in console, sent to backend for admin logs
   */
  error(message: string, context?: LogContext): void {
    // Always log errors to console
    console.error(formatForConsole('error', message, context));

    // Send to backend for admin log stream
    const entry = createEntry('error', message, context);
    queueErrorLog(entry);
  },

  /**
   * Flush any pending logs immediately (call on page unload)
   */
  flush(): void {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushErrorQueue();
  },
};

// Flush logs before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logger.flush();
  });
}

// Store original console.error
const originalConsoleError = console.error;
let globalErrorCaptureInitialized = false;

/**
 * Initialize global error capture to automatically send errors to backend.
 * Call once at app startup.
 *
 * This captures:
 * - All console.error calls (intercepts and forwards to backend)
 * - Unhandled promise rejections
 * - Uncaught exceptions
 */
export function initGlobalErrorCapture(): void {
  if (globalErrorCaptureInitialized || typeof window === 'undefined') {
    return;
  }
  globalErrorCaptureInitialized = true;

  // Intercept console.error to send to backend
  console.error = (...args: unknown[]) => {
    // Call original console.error
    originalConsoleError.apply(console, args);

    // Format message for backend
    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    // Queue for backend (skip if message is from our own logger to avoid loops)
    if (!message.includes('[ERROR]')) {
      const entry = createEntry('error', message, {
        source: 'console.error',
      });
      queueErrorLog(entry);
    }
  };

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? `Unhandled rejection: ${reason.message}` : `Unhandled rejection: ${String(reason)}`;

    const entry = createEntry('error', message, {
      source: 'unhandledrejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    queueErrorLog(entry);
  });

  // Capture uncaught exceptions
  window.addEventListener('error', (event) => {
    const message = `Uncaught error: ${event.message}`;

    const entry = createEntry('error', message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    queueErrorLog(entry);
  });
}

export default logger;
