/**
 * BattlesLobbyPage
 *
 * Entry point for Prompt Battles - matchmaking screen.
 * Users can choose to battle Pip (AI) or find a random opponent.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMatchmaking, type MatchFoundData } from '@/hooks/useMatchmaking';
import { MatchmakingScreen } from '@/components/battles';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

export function BattlesLobbyPage() {
  const navigate = useNavigate();

  const handleError = useCallback((error: string) => {
    console.error('[Matchmaking] Error:', error);
    // Could show toast notification here
  }, []);

  const handleMatchFound = useCallback(
    (data: MatchFoundData) => {
      console.log('[Matchmaking] Match found!', data);
      // Navigate to the battle
      navigate(`/battles/${data.battleId}`);
    },
    [navigate]
  );

  const {
    isConnecting,
    isSearching,
    queueStatus,
    matchWithPip,
    findRandomMatch,
    leaveQueue,
  } = useMatchmaking({
    onError: handleError,
    onMatchFound: handleMatchFound,
  });

  return (
    <DashboardLayout>
      <MatchmakingScreen
        isSearching={isSearching}
        queueStatus={queueStatus}
        isConnecting={isConnecting}
        onMatchWithPip={matchWithPip}
        onFindRandomMatch={findRandomMatch}
        onLeaveQueue={leaveQueue}
      />
    </DashboardLayout>
  );
}

export default BattlesLobbyPage;
