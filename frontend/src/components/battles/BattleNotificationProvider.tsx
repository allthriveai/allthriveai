/**
 * BattleNotificationProvider Component
 *
 * Global provider for battle notifications. Wraps the app to enable
 * receiving battle invitations from anywhere on the site.
 * Also handles async battle WebSocket events with registrable callbacks.
 */

import { createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBattleNotifications,
  type BattleInvitation,
  type AsyncBattleNotification,
} from '@/hooks/useBattleNotifications';
import { BattleInviteToastContainer } from './BattleInviteToast';

// Callback types for async battle events
type AsyncBattleCallback = (notification: AsyncBattleNotification) => void;

interface BattleNotificationContextValue {
  isConnected: boolean;
  isAvailable: boolean;
  pendingInvitations: BattleInvitation[];
  updateAvailability: (available: boolean) => void;
  acceptInvitation: (invitationId: number) => void;
  declineInvitation: (invitationId: number) => void;
  dismissInvitation: (invitationId: number) => void;
  // Register async battle callbacks
  registerAsyncCallbacks: (callbacks: {
    onYourTurn?: AsyncBattleCallback;
    onDeadlineWarning?: AsyncBattleCallback;
    onBattleReminder?: AsyncBattleCallback;
    onDeadlineExtended?: AsyncBattleCallback;
    onBattleExpired?: AsyncBattleCallback;
    onBattleForfeit?: AsyncBattleCallback;
    onTurnStarted?: AsyncBattleCallback;
  }) => () => void; // Returns unregister function
}

const BattleNotificationContext = createContext<BattleNotificationContextValue | null>(null);

export function useBattleNotificationContext() {
  const context = useContext(BattleNotificationContext);
  if (!context) {
    throw new Error('useBattleNotificationContext must be used within BattleNotificationProvider');
  }
  return context;
}

interface BattleNotificationProviderProps {
  children: React.ReactNode;
}

export function BattleNotificationProvider({ children }: BattleNotificationProviderProps) {
  const navigate = useNavigate();

  // Store registered async callbacks in a ref to avoid re-renders
  const asyncCallbacksRef = useRef<Map<string, {
    onYourTurn?: AsyncBattleCallback;
    onDeadlineWarning?: AsyncBattleCallback;
    onBattleReminder?: AsyncBattleCallback;
    onDeadlineExtended?: AsyncBattleCallback;
    onBattleExpired?: AsyncBattleCallback;
    onBattleForfeit?: AsyncBattleCallback;
    onTurnStarted?: AsyncBattleCallback;
  }>>(new Map());

  // Handle when our invitation is accepted by the opponent
  const handleInvitationAccepted = useCallback(
    (battleId: number, _opponent: { id: number; username: string }) => {
      navigate(`/battles/${battleId}`);
    },
    [navigate]
  );

  // Create async callback handlers that dispatch to all registered callbacks
  const handleYourTurn = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onYourTurn?.(notification);
    });
  }, []);

  const handleDeadlineWarning = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onDeadlineWarning?.(notification);
    });
  }, []);

  const handleBattleReminder = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onBattleReminder?.(notification);
    });
  }, []);

  const handleDeadlineExtended = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onDeadlineExtended?.(notification);
    });
  }, []);

  const handleBattleExpired = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onBattleExpired?.(notification);
    });
  }, []);

  const handleBattleForfeit = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onBattleForfeit?.(notification);
    });
  }, []);

  const handleTurnStarted = useCallback((notification: AsyncBattleNotification) => {
    asyncCallbacksRef.current.forEach((callbacks) => {
      callbacks.onTurnStarted?.(notification);
    });
  }, []);

  const {
    isConnected,
    isAvailable,
    pendingInvitations,
    updateAvailability,
    acceptInvitation: acceptInvitationWs,
    declineInvitation: declineInvitationWs,
    dismissInvitation,
  } = useBattleNotifications({
    onInvitationAccepted: handleInvitationAccepted,
    onError: (error) => {
      console.error('[BattleNotification] Error:', error);
    },
    // Async battle callbacks
    onYourTurn: handleYourTurn,
    onDeadlineWarning: handleDeadlineWarning,
    onBattleReminder: handleBattleReminder,
    onDeadlineExtended: handleDeadlineExtended,
    onBattleExpired: handleBattleExpired,
    onBattleForfeit: handleBattleForfeit,
    onTurnStarted: handleTurnStarted,
  });

  // Register async callbacks - returns unregister function
  const registerAsyncCallbacks = useCallback((callbacks: {
    onYourTurn?: AsyncBattleCallback;
    onDeadlineWarning?: AsyncBattleCallback;
    onBattleReminder?: AsyncBattleCallback;
    onDeadlineExtended?: AsyncBattleCallback;
    onBattleExpired?: AsyncBattleCallback;
    onBattleForfeit?: AsyncBattleCallback;
    onTurnStarted?: AsyncBattleCallback;
  }) => {
    const id = Math.random().toString(36).slice(2);
    asyncCallbacksRef.current.set(id, callbacks);
    return () => {
      asyncCallbacksRef.current.delete(id);
    };
  }, []);

  // Accept and navigate to battle
  const acceptInvitation = useCallback(
    (invitationId: number) => {
      const invitation = pendingInvitations.find((inv) => inv.invitationId === invitationId);
      if (invitation) {
        acceptInvitationWs(invitationId);
        // Navigate to battle page
        navigate(`/battles/${invitation.battleId}`);
      }
    },
    [acceptInvitationWs, pendingInvitations, navigate]
  );

  // Decline invitation
  const declineInvitation = useCallback(
    (invitationId: number) => {
      declineInvitationWs(invitationId);
    },
    [declineInvitationWs]
  );

  const contextValue = useMemo(
    () => ({
      isConnected,
      isAvailable,
      pendingInvitations,
      updateAvailability,
      acceptInvitation,
      declineInvitation,
      dismissInvitation,
      registerAsyncCallbacks,
    }),
    [
      isConnected,
      isAvailable,
      pendingInvitations,
      updateAvailability,
      acceptInvitation,
      declineInvitation,
      dismissInvitation,
      registerAsyncCallbacks,
    ]
  );

  return (
    <BattleNotificationContext.Provider value={contextValue}>
      {children}
      {/* Global toast container for incoming battle invitations from others */}
      <BattleInviteToastContainer
        invitations={pendingInvitations}
        onAccept={acceptInvitation}
        onDecline={declineInvitation}
        onDismiss={dismissInvitation}
      />
    </BattleNotificationContext.Provider>
  );
}

export default BattleNotificationProvider;
