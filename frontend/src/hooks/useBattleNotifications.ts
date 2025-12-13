/**
 * useBattleNotifications Hook
 *
 * Manages WebSocket connection for receiving real-time battle invitations.
 * Users connect to this when logged in to receive battle challenges from
 * other users looking for opponents.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl } from '@/utils/websocket';
import { getCsrfToken } from '@/utils/cookies';

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 15000;

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

// Async battle notification types
export interface AsyncBattleNotification {
  event: string;
  battleId: number;
  deadline?: string;
  hoursRemaining?: string;
  winnerId?: number;
  reason?: string;
  fromUserId?: number;
  fromUsername?: string;
  extensionsRemaining?: number;
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
  // Async battle events
  deadline?: string;
  hours_remaining?: string;
  winner_id?: number;
  reason?: string;
  from_user_id?: number;
  from_username?: string;
  extensions_remaining?: number;
  user_id?: number;
  expires_at?: string;
  timed_out_user_id?: number;
  extended_by_user_id?: number;
  new_deadline?: string;
}

interface UseBattleNotificationsOptions {
  onError?: (error: string) => void;
  onInvitationReceived?: (invitation: BattleInvitation) => void;
  onInvitationAccepted?: (battleId: number, opponent: { id: number; username: string }) => void;
  onInvitationDeclined?: (invitationId: number) => void;
  // Async battle callbacks
  onYourTurn?: (notification: AsyncBattleNotification) => void;
  onDeadlineWarning?: (notification: AsyncBattleNotification) => void;
  onBattleReminder?: (notification: AsyncBattleNotification) => void;
  onDeadlineExtended?: (notification: AsyncBattleNotification) => void;
  onBattleExpired?: (notification: AsyncBattleNotification) => void;
  onBattleForfeit?: (notification: AsyncBattleNotification) => void;
  onTurnStarted?: (notification: AsyncBattleNotification) => void;
  autoConnect?: boolean;
}

export function useBattleNotifications({
  onError,
  onInvitationReceived,
  onInvitationAccepted,
  onInvitationDeclined,
  onYourTurn,
  onDeadlineWarning,
  onBattleReminder,
  onDeadlineExtended,
  onBattleExpired,
  onBattleForfeit,
  onTurnStarted,
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
  // Async battle callback refs
  const onYourTurnRef = useRef(onYourTurn);
  const onDeadlineWarningRef = useRef(onDeadlineWarning);
  const onBattleReminderRef = useRef(onBattleReminder);
  const onDeadlineExtendedRef = useRef(onDeadlineExtended);
  const onBattleExpiredRef = useRef(onBattleExpired);
  const onBattleForfeitRef = useRef(onBattleForfeit);
  const onTurnStartedRef = useRef(onTurnStarted);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onInvitationReceivedRef.current = onInvitationReceived;
    onInvitationAcceptedRef.current = onInvitationAccepted;
    onInvitationDeclinedRef.current = onInvitationDeclined;
    // Async battle callbacks
    onYourTurnRef.current = onYourTurn;
    onDeadlineWarningRef.current = onDeadlineWarning;
    onBattleReminderRef.current = onBattleReminder;
    onDeadlineExtendedRef.current = onDeadlineExtended;
    onBattleExpiredRef.current = onBattleExpired;
    onBattleForfeitRef.current = onBattleForfeit;
    onTurnStartedRef.current = onTurnStarted;
  }, [
    onError,
    onInvitationReceived,
    onInvitationAccepted,
    onInvitationDeclined,
    onYourTurn,
    onDeadlineWarning,
    onBattleReminder,
    onDeadlineExtended,
    onBattleExpired,
    onBattleForfeit,
    onTurnStarted,
  ]);

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
        } catch {
          // Heartbeat failed - connection will be handled by onerror/onclose
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
    if (authLoading) return;
    if (!isAuthenticated) return;
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
          connection_id: `battle-notifications-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        // Don't reconnect for auth errors
        if (response.status === 401 || response.status === 403) {
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;

      if (!connectionToken) {
        throw new Error('No connection_token in response');
      }
    } catch {
      setIsConnecting(false);
      isConnectingRef.current = false;
      scheduleReconnect();
      return;
    }

    // Connect to WebSocket
    const wsUrl = buildWebSocketUrl('/ws/battle-notifications/', {
      connection_token: connectionToken,
    });

    return new Promise<void>((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);

        connectionTimeoutRef.current = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            scheduleReconnect();
            resolve();
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
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

            if (data.event === 'pong') return;

            switch (data.event) {
              case 'connected':
                setIsAvailable(data.is_available ?? false);
                break;

              case 'availability_updated':
                setIsAvailable(data.is_available ?? false);
                break;

              case 'battle_invitation':
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
                if (data.invitation_id) {
                  setPendingInvitations((prev) =>
                    prev.filter((inv) => inv.invitationId !== data.invitation_id)
                  );
                }
                break;

              case 'invitation_accepted':
                if (data.battle_id && data.opponent) {
                  onInvitationAcceptedRef.current?.(data.battle_id, data.opponent);
                }
                break;

              case 'invitation_declined':
                if (data.invitation_id) {
                  onInvitationDeclinedRef.current?.(data.invitation_id);
                }
                break;

              // Async battle events
              case 'your_turn':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    deadline: data.expires_at,
                  };
                  onYourTurnRef.current?.(notification);
                }
                break;

              case 'deadline_warning':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    deadline: data.deadline,
                    hoursRemaining: data.hours_remaining,
                  };
                  onDeadlineWarningRef.current?.(notification);
                }
                break;

              case 'battle_reminder':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    fromUserId: data.from_user_id,
                    fromUsername: data.from_username,
                  };
                  onBattleReminderRef.current?.(notification);
                }
                break;

              case 'deadline_extended':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    deadline: data.new_deadline,
                    extensionsRemaining: data.extensions_remaining,
                  };
                  onDeadlineExtendedRef.current?.(notification);
                }
                break;

              case 'battle_expired':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    reason: data.reason,
                  };
                  onBattleExpiredRef.current?.(notification);
                }
                break;

              case 'battle_forfeit':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    winnerId: data.winner_id,
                    reason: data.reason,
                  };
                  onBattleForfeitRef.current?.(notification);
                }
                break;

              case 'turn_started':
                if (data.battle_id) {
                  const notification: AsyncBattleNotification = {
                    event: data.event,
                    battleId: data.battle_id,
                    deadline: data.expires_at,
                  };
                  onTurnStartedRef.current?.(notification);
                }
                break;

              case 'error':
                onErrorRef.current?.(data.error ?? 'An error occurred');
                break;
            }
          } catch {
            // Message parsing failed - ignore malformed messages
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          resolve();
        };

        ws.onclose = (closeEvent) => {
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          clearTimers();

          // Don't reconnect for auth errors
          if (closeEvent.code === 4001) {
            resolve();
            return;
          }

          if (!intentionalCloseRef.current) {
            scheduleReconnect();
          }
          resolve();
        };

        wsRef.current = ws;
      } catch {
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
