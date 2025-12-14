/**
 * AsyncBattleContext
 *
 * Manages state for asynchronous prompt battles:
 * - Fetches pending battles via REST API
 * - Tracks urgent battles (where it's my turn)
 * - Listens to WebSocket events for async updates
 * - Provides actions: extend deadline, send reminder, start turn
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBattleNotificationContext } from '@/components/battles/BattleNotificationProvider';
import type { AsyncBattleNotification } from '@/hooks/useBattleNotifications';
import { api } from '@/services/api';
import { logError } from '@/utils/errorHandler';

// Battle data from REST API
export interface AsyncBattle {
  id: number;
  opponent: {
    id: number | null;
    username: string;
    avatarUrl?: string;
  } | null;
  /** Display name for opponent (friend name if set by challenger, otherwise username) */
  opponentDisplayName?: string;
  challengeText: string;
  challengeType: {
    key: string;
    name: string;
  } | null;
  isMyTurn: boolean;
  deadline: string;
  turnExpiresAt?: string;
  extensionsRemaining: number;
  canSendReminder: boolean;
  status: 'my_turn' | 'their_turn' | 'judging' | 'completed' | 'pending_invitation';
  phase: string;
  hasSubmitted: boolean;
  opponentSubmitted: boolean;
  createdAt: string;
  // For pending invitations
  inviteUrl?: string;
  inviteToken?: string;
}

// Raw battle from backend API (camelCase from response interceptor)
interface RawAsyncBattle {
  id: number;
  opponent: {
    id: number | null;
    username: string;
    avatarUrl?: string;
  } | null;
  opponentDisplayName?: string;
  challengeText: string;
  challengeType: {
    key: string;
    name: string;
  } | null;
  status: string;
  phase: string;
  deadlines: {
    response?: string;
    turn?: string;
  };
  extensions: {
    used: number;
    max: number;
  };
  hasSubmitted: boolean;
  opponentSubmitted: boolean;
  createdAt: string;
  // For pending invitations
  inviteUrl?: string;
  inviteToken?: string;
}

// Battle history item (includes completed battles)
export interface BattleHistoryItem {
  id: number;
  challenger: { id: number; username: string; avatarUrl?: string };
  opponent: { id: number; username: string; avatarUrl?: string } | null;
  challengeText: string;
  challengeType: { key: string; name: string } | null;
  status: string;
  winner: { id: number; username: string } | null;
  createdAt: string;
  completedAt?: string;
  /** Display name for opponent (friend name if set by challenger, otherwise username) */
  opponentDisplayName?: string;
  /** Friend name set by challenger for invitation battles */
  friendName?: string;
}

interface BattleHistoryResponse {
  battles: BattleHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AsyncBattleContextValue {
  // State
  pendingBattles: AsyncBattle[];
  urgentBattles: AsyncBattle[]; // Battles where it's my turn
  pendingInvitations: AsyncBattle[]; // Invitations waiting for acceptance
  isLoading: boolean;
  error: string | null;

  // Actions
  refreshBattles: () => Promise<void>;
  extendDeadline: (battleId: number) => Promise<boolean>;
  sendReminder: (battleId: number) => Promise<boolean>;
  startTurn: (battleId: number) => Promise<{ success: boolean; expiresAt?: string }>;
  cancelBattle: (battleId: number) => Promise<boolean>;
  bulkDeleteBattles: (battleIds: number[]) => Promise<{ deleted: number; failed: Array<{ id: number; reason: string }> }>;
  fetchBattleHistory: (options?: { status?: string; page?: number; pageSize?: number }) => Promise<BattleHistoryResponse>;

  // For banner display
  hasUrgentBattle: boolean;
  mostUrgentBattle: AsyncBattle | null;
}

const AsyncBattleContext = createContext<AsyncBattleContextValue | null>(null);

export function useAsyncBattles() {
  const context = useContext(AsyncBattleContext);
  if (!context) {
    throw new Error('useAsyncBattles must be used within AsyncBattleProvider');
  }
  return context;
}

// Polling interval - 2 minutes for background refresh
const POLL_INTERVAL = 2 * 60 * 1000;

interface AsyncBattleProviderProps {
  children: ReactNode;
}

export function AsyncBattleProvider({ children }: AsyncBattleProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { registerAsyncCallbacks } = useBattleNotificationContext();

  const [pendingBattles, setPendingBattles] = useState<AsyncBattle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to transform raw battle data from API (already camelCase from response interceptor)
  const transformBattle = (b: RawAsyncBattle, isMyTurn: boolean): AsyncBattle => ({
    id: b.id,
    opponent: b.opponent ? {
      id: b.opponent.id,
      username: b.opponent.username,
      avatarUrl: b.opponent.avatarUrl,
    } : null,
    opponentDisplayName: b.opponentDisplayName,
    challengeText: b.challengeText,
    challengeType: b.challengeType,
    isMyTurn,
    deadline: b.deadlines?.response || b.deadlines?.turn || '',
    turnExpiresAt: b.deadlines?.turn,
    extensionsRemaining: (b.extensions?.max || 2) - (b.extensions?.used || 0),
    canSendReminder: !isMyTurn && !b.opponentSubmitted,
    status: b.status as 'my_turn' | 'their_turn' | 'judging' | 'completed' | 'pending_invitation',
    phase: b.phase,
    hasSubmitted: b.hasSubmitted,
    opponentSubmitted: b.opponentSubmitted,
    createdAt: b.createdAt,
    inviteUrl: b.inviteUrl,
    inviteToken: b.inviteToken,
  });

  // Fetch pending battles from REST API
  const fetchPendingBattles = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.get('/battles/pending/');
      const data = response.data;

      // Backend returns camelCase keys after response interceptor transformation
      // { yourTurn: [], theirTurn: [], judging: [], pendingInvitations: [], recentlyCompleted: [], counts: {} }
      const yourTurn: RawAsyncBattle[] = data.yourTurn || [];
      const theirTurn: RawAsyncBattle[] = data.theirTurn || [];
      const judging: RawAsyncBattle[] = data.judging || [];
      const pendingInvites: RawAsyncBattle[] = data.pendingInvitations || [];

      // Combine all active battles (including pending invitations)
      const allBattles: AsyncBattle[] = [
        ...yourTurn.map((b) => transformBattle(b, true)),
        ...theirTurn.map((b) => transformBattle(b, false)),
        ...judging.map((b) => transformBattle(b, false)),
        ...pendingInvites.map((b) => transformBattle(b, false)),
      ];

      setPendingBattles(allBattles);
      setError(null);
    } catch (err) {
      logError('AsyncBattle.fetchPendingBattles', err);
      setError('Failed to load pending battles');
    }
  }, [isAuthenticated]);

  // Initial fetch and polling
  const refreshBattles = useCallback(async () => {
    setIsLoading(true);
    await fetchPendingBattles();
    setIsLoading(false);
  }, [fetchPendingBattles]);

  // Handle WebSocket events for async battles
  const handleYourTurn = useCallback(
    (notification: AsyncBattleNotification) => {
      // Refresh the list when it becomes our turn
      fetchPendingBattles();
      console.log('[AsyncBattle] Your turn notification:', notification);
    },
    [fetchPendingBattles]
  );

  const handleDeadlineWarning = useCallback(
    (notification: AsyncBattleNotification) => {
      // Could show a toast here
      console.log('[AsyncBattle] Deadline warning:', notification);
    },
    []
  );

  const handleBattleReminder = useCallback(
    (notification: AsyncBattleNotification) => {
      // Could show a toast here
      console.log('[AsyncBattle] Battle reminder from:', notification.fromUsername);
    },
    []
  );

  const handleDeadlineExtended = useCallback(
    (notification: AsyncBattleNotification) => {
      // Update the battle's deadline in state
      setPendingBattles((prev) =>
        prev.map((battle) =>
          battle.id === notification.battleId
            ? {
                ...battle,
                deadline: notification.deadline ?? battle.deadline,
                extensionsRemaining: notification.extensionsRemaining ?? battle.extensionsRemaining,
              }
            : battle
        )
      );
    },
    []
  );

  const handleBattleExpired = useCallback(
    (notification: AsyncBattleNotification) => {
      // Remove the battle from the list
      setPendingBattles((prev) =>
        prev.filter((battle) => battle.id !== notification.battleId)
      );
    },
    []
  );

  const handleBattleForfeit = useCallback(
    (notification: AsyncBattleNotification) => {
      // Remove the battle from the list (it's now completed)
      setPendingBattles((prev) =>
        prev.filter((battle) => battle.id !== notification.battleId)
      );
      console.log('[AsyncBattle] Battle forfeit:', notification);
    },
    []
  );

  const handleTurnStarted = useCallback(
    (notification: AsyncBattleNotification) => {
      // Update the battle's turn state
      setPendingBattles((prev) =>
        prev.map((battle) =>
          battle.id === notification.battleId
            ? {
                ...battle,
                turnExpiresAt: notification.deadline,
              }
            : battle
        )
      );
    },
    []
  );

  // Register callbacks with BattleNotificationProvider for WebSocket events
  useEffect(() => {
    const unregister = registerAsyncCallbacks({
      onYourTurn: handleYourTurn,
      onDeadlineWarning: handleDeadlineWarning,
      onBattleReminder: handleBattleReminder,
      onDeadlineExtended: handleDeadlineExtended,
      onBattleExpired: handleBattleExpired,
      onBattleForfeit: handleBattleForfeit,
      onTurnStarted: handleTurnStarted,
    });
    return unregister;
  }, [
    registerAsyncCallbacks,
    handleYourTurn,
    handleDeadlineWarning,
    handleBattleReminder,
    handleDeadlineExtended,
    handleBattleExpired,
    handleBattleForfeit,
    handleTurnStarted,
  ]);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      refreshBattles();
    }
  }, [isAuthenticated, authLoading, refreshBattles]);

  // Clear state and polling when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear any existing polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Reset state to prevent stale data
      setPendingBattles([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Set up polling
  useEffect(() => {
    if (!isAuthenticated) return;

    pollIntervalRef.current = setInterval(() => {
      fetchPendingBattles();
    }, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, fetchPendingBattles]);

  // Action: Extend deadline
  const extendDeadline = useCallback(
    async (battleId: number): Promise<boolean> => {
      try {
        const response = await api.post(`/battles/${battleId}/extend-deadline/`);
        if (response.data.success) {
          setPendingBattles((prev) =>
            prev.map((battle) =>
              battle.id === battleId
                ? {
                    ...battle,
                    // API interceptor converts snake_case to camelCase
                    deadline: response.data.newDeadline,
                    extensionsRemaining: response.data.extensionsRemaining,
                  }
                : battle
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        logError('AsyncBattle.extendDeadline', err, { battleId });
        return false;
      }
    },
    []
  );

  // Action: Send reminder
  const sendReminder = useCallback(async (battleId: number): Promise<boolean> => {
    try {
      const response = await api.post(`/battles/${battleId}/send-reminder/`);
      if (response.data.success) {
        setPendingBattles((prev) =>
          prev.map((battle) =>
            battle.id === battleId
              ? { ...battle, canSendReminder: false }
              : battle
          )
        );
        return true;
      }
      return false;
    } catch (err) {
      logError('AsyncBattle.sendReminder', err, { battleId });
      return false;
    }
  }, []);

  // Action: Start turn (begin 3-minute timer)
  const startTurn = useCallback(
    async (battleId: number): Promise<{ success: boolean; expiresAt?: string }> => {
      try {
        const response = await api.post(`/battles/${battleId}/start-turn/`);
        // API interceptor converts snake_case to camelCase
        // Backend returns status: 'success' | 'already_started' | 'error'
        if (response.data.status === 'success' || response.data.status === 'already_started') {
          setPendingBattles((prev) =>
            prev.map((battle) =>
              battle.id === battleId
                ? {
                    ...battle,
                    turnExpiresAt: response.data.expiresAt,
                  }
                : battle
            )
          );
          return { success: true, expiresAt: response.data.expiresAt };
        }
        return { success: false };
      } catch (err) {
        logError('AsyncBattle.startTurn', err, { battleId });
        return { success: false };
      }
    },
    []
  );

  // Action: Cancel battle (only for pending invitations or battles where user hasn't submitted)
  const cancelBattle = useCallback(async (battleId: number): Promise<boolean> => {
    try {
      await api.post(`/battles/${battleId}/cancel/`);
      // Remove the battle from state
      setPendingBattles((prev) => prev.filter((battle) => battle.id !== battleId));
      return true;
    } catch (err) {
      logError('AsyncBattle.cancelBattle', err, { battleId });
      return false;
    }
  }, []);

  // Action: Bulk delete battles
  const bulkDeleteBattles = useCallback(
    async (battleIds: number[]): Promise<{ deleted: number; failed: Array<{ id: number; reason: string }> }> => {
      try {
        const response = await api.post('/battles/bulk-delete/', { battle_ids: battleIds });
        // Remove successfully deleted battles from pending state
        const deletedIds = new Set(
          battleIds.filter((id) => !response.data.failed?.some((f: { id: number }) => f.id === id))
        );
        setPendingBattles((prev) => prev.filter((battle) => !deletedIds.has(battle.id)));
        return {
          deleted: response.data.deleted || 0,
          failed: response.data.failed || [],
        };
      } catch (err) {
        logError('AsyncBattle.bulkDeleteBattles', err, { battleIds });
        return { deleted: 0, failed: battleIds.map((id) => ({ id, reason: 'Request failed' })) };
      }
    },
    []
  );

  // Action: Fetch battle history with pagination
  const fetchBattleHistory = useCallback(
    async (options?: { status?: string; page?: number; pageSize?: number }) => {
      try {
        const params = new URLSearchParams();
        if (options?.status) params.append('status', options.status);
        if (options?.page) params.append('page', options.page.toString());
        if (options?.pageSize) params.append('page_size', options.pageSize.toString());

        const response = await api.get(`/battles/my-history/?${params.toString()}`);
        return {
          battles: response.data.battles || [],
          total: response.data.total || 0,
          page: response.data.page || 1,
          pageSize: response.data.pageSize || 20,
          totalPages: response.data.totalPages || 1,
        };
      } catch (err) {
        logError('AsyncBattle.fetchBattleHistory', err);
        return { battles: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    []
  );

  // Computed values
  const urgentBattles = useMemo(
    () => pendingBattles.filter((b) => {
      // Must be my turn
      if (!b.isMyTurn) return false;
      // Exclude expired battles (deadline has passed)
      if (b.deadline && new Date(b.deadline).getTime() < Date.now()) return false;
      return true;
    }),
    [pendingBattles]
  );

  const pendingInvitations = useMemo(
    () => pendingBattles.filter((b) => b.status === 'pending_invitation'),
    [pendingBattles]
  );

  const hasUrgentBattle = urgentBattles.length > 0;

  const mostUrgentBattle = useMemo(() => {
    if (urgentBattles.length === 0) return null;
    // Sort by deadline (earliest first)
    return [...urgentBattles].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )[0];
  }, [urgentBattles]);

  const contextValue = useMemo(
    () => ({
      pendingBattles,
      urgentBattles,
      pendingInvitations,
      isLoading,
      error,
      refreshBattles,
      extendDeadline,
      sendReminder,
      startTurn,
      cancelBattle,
      bulkDeleteBattles,
      fetchBattleHistory,
      hasUrgentBattle,
      mostUrgentBattle,
    }),
    [
      pendingBattles,
      urgentBattles,
      pendingInvitations,
      isLoading,
      error,
      refreshBattles,
      extendDeadline,
      sendReminder,
      startTurn,
      cancelBattle,
      bulkDeleteBattles,
      fetchBattleHistory,
      hasUrgentBattle,
      mostUrgentBattle,
    ]
  );

  return (
    <AsyncBattleContext.Provider value={contextValue}>
      {children}
    </AsyncBattleContext.Provider>
  );
}

export default AsyncBattleProvider;
