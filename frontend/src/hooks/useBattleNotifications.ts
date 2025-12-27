/**
 * useBattleNotifications Hook
 *
 * Manages WebSocket connection for receiving real-time battle invitations.
 * Users connect to this when logged in to receive battle challenges from
 * other users looking for opponents.
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';

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

  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<BattleInvitation[]>([]);

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
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);

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

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    try {
      const data = rawData as WebSocketMessage;

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
  }, []);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    onErrorRef.current?.(errorMsg);
  }, []);

  // Should we auto-connect?
  const shouldConnect = autoConnect && !authLoading && isAuthenticated;

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send, connect, disconnect, reconnectAttempts } = useWebSocketBase({
    endpoint: '/ws/battle-notifications/',
    connectionIdPrefix: 'battle-notifications',
    onMessage: handleMessage,
    onError: handleError,
    autoConnect: shouldConnect,
    requiresAuth: true,
    maxReconnectAttempts: 5,
    initialReconnectDelay: 2000,
    maxReconnectDelay: 30000,
    connectionTimeout: 15000,
  });

  // Store send function in ref
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Update availability
  const updateAvailability = useCallback((available: boolean) => {
    if (sendRef.current) {
      sendRef.current({
        type: 'update_availability',
        is_available: available,
      });
    }
  }, []);

  // Respond to invitation
  const respondToInvitation = useCallback(
    (invitationId: number, response: 'accept' | 'decline') => {
      if (sendRef.current) {
        sendRef.current({
          type: 'respond_to_invitation',
          invitation_id: invitationId,
          response,
        });
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
