/**
 * BattleNotificationProvider Component
 *
 * Global provider for battle notifications. Wraps the app to enable
 * receiving battle invitations from anywhere on the site.
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBattleNotifications, type BattleInvitation } from '@/hooks/useBattleNotifications';
import { BattleInviteToastContainer } from './BattleInviteToast';

interface BattleNotificationContextValue {
  isConnected: boolean;
  isAvailable: boolean;
  pendingInvitations: BattleInvitation[];
  updateAvailability: (available: boolean) => void;
  acceptInvitation: (invitationId: number) => void;
  declineInvitation: (invitationId: number) => void;
  dismissInvitation: (invitationId: number) => void;
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

  // Handle when our invitation is accepted by the opponent
  const handleInvitationAccepted = useCallback(
    (battleId: number, opponent: { id: number; username: string }) => {
      console.log(`[BattleNotification] Invitation accepted by ${opponent.username}, navigating to battle ${battleId}`);
      navigate(`/battles/${battleId}`);
    },
    [navigate]
  );

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
  });

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
    }),
    [
      isConnected,
      isAvailable,
      pendingInvitations,
      updateAvailability,
      acceptInvitation,
      declineInvitation,
      dismissInvitation,
    ]
  );

  return (
    <BattleNotificationContext.Provider value={contextValue}>
      {children}
      {/* Global toast container for battle invitations */}
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
