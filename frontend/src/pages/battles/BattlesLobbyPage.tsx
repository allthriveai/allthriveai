/**
 * BattlesLobbyPage
 *
 * Entry point for Prompt Battles - matchmaking screen.
 * Users can choose to battle Pip (AI) or find an active opponent.
 */

import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useMatchmaking, type MatchFoundData } from '@/hooks/useMatchmaking';
import { MatchmakingScreen } from '@/components/battles';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { logError } from '@/utils/errorHandler';
import { useQuestTracking } from '@/hooks/useQuestTracking';

export function BattlesLobbyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for URL param to auto-open human battle modal
  const openHumanModal = searchParams.get('openHumanModal') === 'true';

  // Quest tracking for page visit
  const { trackPage } = useQuestTracking();
  useEffect(() => {
    trackPage('/play/prompt-battles', 'Prompt Battles');
  }, [trackPage]);

  const handleError = useCallback((error: string) => {
    logError('Matchmaking error', new Error(error), {
      component: 'BattlesLobbyPage',
      context: 'matchmaking',
    });
    // Errors are handled by the MatchmakingScreen component via onError callback
  }, []);

  const handleMatchFound = useCallback(
    (data: MatchFoundData) => {
      // Navigate to the battle
      navigate(`/play/prompt-battles/${data.battleId}`);
    },
    [navigate]
  );

  const {
    isConnecting,
    isSearching,
    queueStatus,
    matchWithPip,
    findActiveUser,
    leaveQueue,
  } = useMatchmaking({
    onError: handleError,
    onMatchFound: handleMatchFound,
  });

  // Use findActiveUser for "Find Opponent" - this notifies active users
  const handleFindOpponent = useCallback(() => {
    findActiveUser();
  }, [findActiveUser]);

  return (
    <DashboardLayout>
      <MatchmakingScreen
        isSearching={isSearching}
        queueStatus={queueStatus}
        isConnecting={isConnecting}
        onMatchWithPip={matchWithPip}
        onFindRandomMatch={handleFindOpponent}
        onLeaveQueue={leaveQueue}
        initialOpenHumanModal={openHumanModal}
      />
    </DashboardLayout>
  );
}

export default BattlesLobbyPage;
