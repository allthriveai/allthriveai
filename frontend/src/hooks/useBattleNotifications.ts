/**
 * useBattleNotifications Hook
 *
 * Manages WebSocket connection for receiving real-time battle invitations.
 * Users connect to this when logged in to receive battle challenges from
 * other users looking for opponents.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, getWebSocketBaseUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 15000;

// Debug logging helper
const DEBUG_PREFIX = '[BattleNotifications]';
const debugLog = (message: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`${DEBUG_PREFIX} [${timestamp}] ${message}`, data);
  } else {
    console.log(`${DEBUG_PREFIX} [${timestamp}] ${message}`);
  }
};

const debugWarn = (message: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.warn(`${DEBUG_PREFIX} [${timestamp}] ${message}`, data);
  } else {
    console.warn(`${DEBUG_PREFIX} [${timestamp}] ${message}`);
  }
};

const debugError = (message: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.error(`${DEBUG_PREFIX} [${timestamp}] ${message}`, data);
  } else {
    console.error(`${DEBUG_PREFIX} [${timestamp}] ${message}`);
  }
};

export interface BattleInvitation {
  invitationId: number;
  battleId: number;
  challenger: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
  challengePreview: string;
  message: string;
  timestamp: string;
}

interface WebSocketMessage {
  event: string;
  error?: string;
  timestamp?: string;
  is_available?: boolean;
  // Battle invitation
  invitation_id?: number;
  battle_id?: number;
  challenger?: {
    id: number;
    username: string;
    avatar_url?: string;
  };
  challenge_preview?: string;
  message?: string;
  // Invitation response
  response?: string;
  // Invitation accepted (for challenger)
  opponent?: {
    id: number;
    username: string;
  };
}

interface UseBattleNotificationsOptions {
  onError?: (error: string) => void;
  onInvitationReceived?: (invitation: BattleInvitation) => void;
  onInvitationAccepted?: (battleId: number, opponent: { id: number; username: string }) => void;
  onInvitationDeclined?: (invitationId: number) => void;
  autoConnect?: boolean;
}

export function useBattleNotifications({
  onError,
  onInvitationReceived,
  onInvitationAccepted,
  onInvitationDeclined,
  autoConnect = true,
}: UseBattleNotificationsOptions = {}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<BattleInvitation[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectFnRef = useRef<(() => Promise<void>) | null>(null);
  const isConnectingRef = useRef(false);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const onInvitationReceivedRef = useRef(onInvitationReceived);
  const onInvitationAcceptedRef = useRef(onInvitationAccepted);
  const onInvitationDeclinedRef = useRef(onInvitationDeclined);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onInvitationReceivedRef.current = onInvitationReceived;
    onInvitationAcceptedRef.current = onInvitationAccepted;
    onInvitationDeclinedRef.current = onInvitationDeclined;
  }, [onError, onInvitationReceived, onInvitationAccepted, onInvitationDeclined]);

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
          console.error('[BattleNotifications] Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Schedule reconnect
  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
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
  }, [reconnectAttempts]);

  // Connect to WebSocket
  const connect = useCallback(async (): Promise<void> => {
    debugLog('connect() called', {
      authLoading,
      isAuthenticated,
      currentWsState: wsRef.current?.readyState,
      isConnecting: isConnectingRef.current,
    });

    if (authLoading) {
      debugLog('Skipping connect - auth still loading');
      return;
    }
    if (!isAuthenticated) {
      debugLog('Skipping connect - not authenticated');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      debugLog('Skipping connect - WebSocket already open');
      return;
    }
    if (isConnectingRef.current) {
      debugLog('Skipping connect - already connecting');
      return;
    }

    isConnectingRef.current = true;

    if (wsRef.current) {
      debugLog('Closing existing WebSocket before reconnect', {
        readyState: wsRef.current.readyState,
      });
      wsRef.current.close();
      wsRef.current = null;
    }

    clearTimers();
    setIsConnecting(true);

    // Fetch connection token
    let connectionToken: string;
    try {
      const csrfToken = getCsrfToken();
      debugLog('Fetching connection token', {
        hasCsrfToken: !!csrfToken,
        endpoint: '/api/v1/auth/ws-connection-token/',
      });

      const response = await fetch('/api/v1/auth/ws-connection-token/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({
          connection_id: `battle-notifications-${Date.now()}`,
        }),
      });

      debugLog('Connection token response received', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = '';
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
          errorDetails = errorData.code
            ? ` (${errorData.code}: ${errorData.details || errorData.error})`
            : ` (${errorData.error || 'Unknown error'})`;
        } catch {
          // Response wasn't JSON
        }

        // Log different messages based on status code
        if (response.status === 401 || response.status === 403) {
          debugWarn('Not authenticated, skipping WebSocket connection', { errorData });
          setIsConnecting(false);
          isConnectingRef.current = false;
          return; // Don't reconnect for auth errors
        } else if (response.status === 503) {
          debugWarn(`Service unavailable${errorDetails}, will retry`, { errorData });
        } else {
          debugError(`Failed to fetch connection token: ${response.status}${errorDetails}`, { errorData });
        }

        throw new Error(`Failed to fetch connection token: ${response.status}${errorDetails}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;
      debugLog('Connection token received', {
        hasToken: !!connectionToken,
        tokenLength: connectionToken?.length,
      });

      if (!connectionToken) {
        throw new Error('No connection_token in response');
      }
    } catch (error) {
      debugError('Failed to fetch connection token', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      scheduleReconnect();
      return;
    }

    // Connect to WebSocket
    const wsBaseUrl = getWebSocketBaseUrl();
    const wsUrl = buildWebSocketUrl('/ws/battle-notifications/', {
      connection_token: connectionToken,
    });

    debugLog('Attempting WebSocket connection', {
      wsBaseUrl,
      wsUrl: wsUrl.replace(connectionToken, '[TOKEN]'),
      protocol: wsUrl.split('://')[0],
      host: wsUrl.split('://')[1]?.split('/')[0],
      path: '/ws/battle-notifications/',
    });

    return new Promise<void>((resolve) => {
      try {
        debugLog('Creating WebSocket instance');
        const ws = new WebSocket(wsUrl);
        debugLog('WebSocket instance created', { readyState: ws.readyState });

        connectionTimeoutRef.current = setTimeout(() => {
          debugWarn('Connection timeout reached', {
            readyState: ws.readyState,
            timeout: CONNECTION_TIMEOUT,
          });
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            scheduleReconnect();
            resolve();
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          debugLog('WebSocket OPEN', {
            readyState: ws.readyState,
            url: ws.url.replace(/connection_token=[^&]+/, 'connection_token=[TOKEN]'),
            protocol: ws.protocol,
            extensions: ws.extensions,
          });
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setIsConnected(true);
          setIsConnecting(false);
          isConnectingRef.current = false;
          setReconnectAttempts(0);
          startHeartbeat();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            debugLog('Message received', { event: data.event, data });

            if (data.event === 'pong') return;

            switch (data.event) {
              case 'connected':
                debugLog('Connected event received', { is_available: data.is_available });
                setIsAvailable(data.is_available ?? false);
                break;

              case 'availability_updated':
                debugLog('Availability updated', { is_available: data.is_available });
                setIsAvailable(data.is_available ?? false);
                break;

              case 'battle_invitation':
                debugLog('Battle invitation received', data);
                if (data.invitation_id && data.battle_id && data.challenger) {
                  const invitation: BattleInvitation = {
                    invitationId: data.invitation_id,
                    battleId: data.battle_id,
                    challenger: {
                      id: data.challenger.id,
                      username: data.challenger.username,
                      avatarUrl: data.challenger.avatar_url,
                    },
                    challengePreview: data.challenge_preview ?? '',
                    message: data.message ?? `${data.challenger.username} wants to battle you!`,
                    timestamp: data.timestamp ?? new Date().toISOString(),
                  };
                  setPendingInvitations((prev) => [...prev, invitation]);
                  onInvitationReceivedRef.current?.(invitation);
                }
                break;

              case 'invitation_response_processed':
                debugLog('Invitation response processed', data);
                if (data.invitation_id) {
                  setPendingInvitations((prev) =>
                    prev.filter((inv) => inv.invitationId !== data.invitation_id)
                  );
                }
                break;

              case 'invitation_accepted':
                debugLog('Invitation accepted', data);
                if (data.battle_id && data.opponent) {
                  onInvitationAcceptedRef.current?.(data.battle_id, data.opponent);
                } else {
                  debugWarn('invitation_accepted missing battle_id or opponent', data);
                }
                break;

              case 'invitation_declined':
                debugLog('Invitation declined', data);
                if (data.invitation_id) {
                  onInvitationDeclinedRef.current?.(data.invitation_id);
                }
                break;

              case 'error':
                debugError('Error event from server', data);
                onErrorRef.current?.(data.error ?? 'An error occurred');
                break;

              default:
                debugWarn('Unknown event type', data);
            }
          } catch (error) {
            debugError('Failed to parse message', { error, rawData: event.data });
          }
        };

        ws.onerror = (errorEvent) => {
          // Extract as much info as possible from the error event
          const errorInfo = {
            type: errorEvent.type,
            isTrusted: errorEvent.isTrusted,
            target: {
              url: (errorEvent.target as WebSocket)?.url?.replace(/connection_token=[^&]+/, 'connection_token=[TOKEN]'),
              readyState: (errorEvent.target as WebSocket)?.readyState,
              readyStateLabel: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][(errorEvent.target as WebSocket)?.readyState] || 'UNKNOWN',
              protocol: (errorEvent.target as WebSocket)?.protocol,
              extensions: (errorEvent.target as WebSocket)?.extensions,
              bufferedAmount: (errorEvent.target as WebSocket)?.bufferedAmount,
            },
            // Check if it's an ErrorEvent with more details
            message: (errorEvent as ErrorEvent).message || 'No message available',
            filename: (errorEvent as ErrorEvent).filename || 'N/A',
            lineno: (errorEvent as ErrorEvent).lineno || 'N/A',
            colno: (errorEvent as ErrorEvent).colno || 'N/A',
            error: (errorEvent as ErrorEvent).error || 'No error object',
          };

          debugError('WebSocket ERROR', errorInfo);
          debugError('Full error event object (inspect in console)', errorEvent);

          // Try to provide more context about what might have failed
          const wsTarget = errorEvent.target as WebSocket;
          if (wsTarget.readyState === WebSocket.CONNECTING) {
            debugError('Error occurred during connection - possible causes:', {
              causes: [
                'Server not reachable (wrong URL or server down)',
                'SSL/TLS certificate issue (if using wss://)',
                'CORS/origin issue (server rejected connection)',
                'Network firewall blocking WebSocket',
                'Invalid WebSocket URL format',
              ],
            });
          }

          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          resolve();
        };

        ws.onclose = (closeEvent) => {
          const closeInfo = {
            code: closeEvent.code,
            reason: closeEvent.reason || '(no reason provided)',
            wasClean: closeEvent.wasClean,
            // Common close codes
            codeDescription: {
              1000: 'Normal closure',
              1001: 'Going away (page closed)',
              1002: 'Protocol error',
              1003: 'Unsupported data',
              1005: 'No status received',
              1006: 'Abnormal closure (no close frame)',
              1007: 'Invalid frame payload',
              1008: 'Policy violation',
              1009: 'Message too big',
              1010: 'Missing extension',
              1011: 'Internal error',
              1012: 'Service restart',
              1013: 'Try again later',
              1014: 'Bad gateway',
              1015: 'TLS handshake failure',
              4001: 'Authentication required',
              4003: 'Origin not allowed / Forbidden',
              4004: 'Resource not found',
            }[closeEvent.code] || 'Unknown code',
          };

          debugLog('WebSocket CLOSED', closeInfo);

          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          clearTimers();

          if (closeEvent.code === 4001) {
            debugLog('Auth required - not reconnecting');
            resolve();
            return;
          }

          if (closeEvent.code === 4003) {
            debugWarn('Origin not allowed - check CORS_ALLOWED_ORIGINS on backend');
          }

          if (closeEvent.code === 1006) {
            debugWarn('Abnormal closure (code 1006) - connection was terminated unexpectedly. Possible causes:', {
              causes: [
                'Server closed connection without proper handshake',
                'Network issue or timeout',
                'Server crashed or was restarted',
                'Load balancer/proxy terminated connection',
                'SSL/TLS negotiation failed',
              ],
            });
          }

          if (!intentionalCloseRef.current) {
            debugLog('Scheduling reconnect', {
              attempt: reconnectAttempts + 1,
              maxAttempts: MAX_RECONNECT_ATTEMPTS,
            });
            scheduleReconnect();
          } else {
            debugLog('Intentional close - not reconnecting');
          }
          resolve();
        };

        wsRef.current = ws;
      } catch (error) {
        debugError('Failed to create WebSocket instance', error);
        setIsConnecting(false);
        isConnectingRef.current = false;
        scheduleReconnect();
        resolve();
      }
    });
  }, [isAuthenticated, authLoading, clearTimers, startHeartbeat, scheduleReconnect]);

  // Store connect function
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Reconnect when user returns to the page (mobile tab switching, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to the page - check if we need to reconnect
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          // Reset reconnect attempts for fresh start
          setReconnectAttempts(0);
          connectFnRef.current?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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

  // Update availability
  const updateAvailability = useCallback((available: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_availability',
          is_available: available,
        })
      );
    }
  }, []);

  // Respond to invitation
  const respondToInvitation = useCallback(
    (invitationId: number, response: 'accept' | 'decline') => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'respond_to_invitation',
            invitation_id: invitationId,
            response,
          })
        );
      }
    },
    []
  );

  // Accept invitation
  const acceptInvitation = useCallback(
    (invitationId: number) => {
      respondToInvitation(invitationId, 'accept');
    },
    [respondToInvitation]
  );

  // Decline invitation
  const declineInvitation = useCallback(
    (invitationId: number) => {
      respondToInvitation(invitationId, 'decline');
    },
    [respondToInvitation]
  );

  // Dismiss invitation from UI
  const dismissInvitation = useCallback((invitationId: number) => {
    setPendingInvitations((prev) => prev.filter((inv) => inv.invitationId !== invitationId));
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && !authLoading) {
      intentionalCloseRef.current = false;
      connect();
    }

    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

  }, [isAuthenticated, authLoading, autoConnect]);

  return {
    isConnected,
    isConnecting,
    isAvailable,
    pendingInvitations,
    reconnectAttempts,
    connect,
    disconnect,
    updateAvailability,
    acceptInvitation,
    declineInvitation,
    dismissInvitation,
  };
}
