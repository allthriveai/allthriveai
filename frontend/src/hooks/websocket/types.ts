/**
 * WebSocket Hook Types
 *
 * Shared type definitions for the WebSocket base hook and its consumers.
 */

/**
 * Configuration options for useWebSocketBase hook.
 */
export interface WebSocketBaseOptions {
  /**
   * The WebSocket endpoint path (e.g., '/ws/chat/123/')
   */
  endpoint: string;

  /**
   * Prefix for the connection ID sent to the server (e.g., 'battle', 'chat')
   */
  connectionIdPrefix: string;

  /**
   * Callback when a message is received from the server.
   * Receives the parsed JSON data.
   */
  onMessage: (data: unknown) => void;

  /**
   * Maximum number of reconnection attempts before giving up.
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Initial delay in ms before first reconnect attempt.
   * Subsequent attempts use exponential backoff.
   * @default 1000
   */
  initialReconnectDelay?: number;

  /**
   * Maximum delay in ms between reconnect attempts.
   * @default 30000
   */
  maxReconnectDelay?: number;

  /**
   * Interval in ms between heartbeat pings.
   * @default 30000
   */
  heartbeatInterval?: number;

  /**
   * Timeout in ms for the initial connection attempt.
   * @default 10000
   */
  connectionTimeout?: number;

  /**
   * Whether to automatically connect on mount.
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Whether to automatically reconnect on disconnect.
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Whether authentication is required for this WebSocket.
   * If true, connection token is fetched before connecting.
   * @default true
   */
  requiresAuth?: boolean;

  /**
   * Callback when connection is established.
   */
  onConnected?: () => void;

  /**
   * Callback when connection is lost.
   */
  onDisconnected?: () => void;

  /**
   * Callback when an error occurs.
   */
  onError?: (error: string) => void;

  /**
   * Callback when a reconnection attempt is scheduled.
   */
  onReconnecting?: (attempt: number, delay: number) => void;

  /**
   * Optional structured logging function for debugging.
   * If not provided, errors are logged to console.
   */
  logger?: WebSocketLogger;
}

/**
 * Return value from useWebSocketBase hook.
 */
export interface WebSocketBaseReturn {
  /**
   * Whether the WebSocket is currently connected.
   */
  isConnected: boolean;

  /**
   * Whether a connection attempt is in progress.
   */
  isConnecting: boolean;

  /**
   * Current number of reconnection attempts.
   */
  reconnectAttempts: number;

  /**
   * Manually initiate a connection.
   */
  connect: () => Promise<void>;

  /**
   * Manually disconnect the WebSocket.
   */
  disconnect: () => void;

  /**
   * Send a message through the WebSocket.
   * Returns true if the message was sent, false if not connected.
   */
  send: (message: unknown) => boolean;
}

/**
 * Structured logger for WebSocket events.
 */
export interface WebSocketLogger {
  debug: (event: string, context?: Record<string, unknown>) => void;
  info: (event: string, context?: Record<string, unknown>) => void;
  warn: (event: string, context?: Record<string, unknown>) => void;
  error: (event: string, context?: Record<string, unknown>) => void;
}

/**
 * Default configuration values.
 */
export const WS_DEFAULTS = {
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  HEARTBEAT_INTERVAL: 30000,
  CONNECTION_TIMEOUT: 10000,
} as const;
