/**
 * BattlePage
 *
 * Main page for an active prompt battle.
 * Manages battle state and renders appropriate phase components.
 * Falls back to REST API for completed battles when WebSocket fails.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@/services/api';
import { logError } from '@/utils/errorHandler';

import { useBattleWebSocket, type BattleState } from '@/hooks/useBattleWebSocket';
import { useAuth } from '@/hooks/useAuth';
import {
  BATTLE_PHASES,
} from '@/types/battlePhases';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
  BattleArena,
  BattleCountdown,
  ChallengeReadyScreen,
  GeneratingPhase,
  GuestSignupBanner,
  GuestSignupModal,
  JudgingReveal,
  WaitingForOpponent,
  type PlayerStatus,
} from '@/components/battles';
import {
  BattlePageLoading,
  BattlePageError,
  InvalidBattle,
  BattleTimeExpired,
  BattleConnectionLost,
} from '@/components/battles/BattlePageStates';

export function BattlePage() {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [restBattleState, setRestBattleState] = useState<BattleState | null>(null);
  const [restLoading, setRestLoading] = useState(false);
  const [restError, setRestError] = useState<string | null>(null);
  const [_revealComplete, setRevealComplete] = useState(false);
  const [isRefreshingChallenge, setIsRefreshingChallenge] = useState(false);
  const [localChallengeText, setLocalChallengeText] = useState<string | null>(null);
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);
  const [localChallengeType, setLocalChallengeType] = useState<{ key: string; name: string } | null>(null);
  // Reset key to force timer reset when challenge is refreshed
  // This ensures the timer resets even if the time value stays the same (e.g., 180 -> 180)
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [showGuestSignupBanner, setShowGuestSignupBanner] = useState(false);
  const [showGuestSignupModal, setShowGuestSignupModal] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isStartingTurn, setIsStartingTurn] = useState(false);
  // Track if user has clicked "Start My Turn" - used to override isMyTurn from backend
  // This is needed because the backend may not immediately update is_my_turn after the API call
  const [hasStartedMyTurn, setHasStartedMyTurn] = useState(false);
  // Friend name for invitation battles
  const [localFriendName, setLocalFriendName] = useState<string>('');

  // Check if user is a guest
  const isGuestUser = user?.isGuest ?? false;

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle conversion success/error from OAuth redirect
  useEffect(() => {
    const converted = searchParams.get('converted');
    const error = searchParams.get('error');

    if (converted === 'true') {
      // Clear the URL param
      searchParams.delete('converted');
      setSearchParams(searchParams, { replace: true });

      // Clear localStorage backup
      localStorage.removeItem('guest_conversion_battle_id');

      // Refresh user to get updated data
      refreshUser();

      // Show success notification
      setNotification({
        type: 'success',
        message: 'Account created! Your battle data has been saved.',
      });
    }

    if (error) {
      // Clear the URL param
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });

      // Clear localStorage backup
      localStorage.removeItem('guest_conversion_battle_id');

      // Show error notification based on error type
      const errorMessages: Record<string, string> = {
        email_exists: 'That email is already registered. Try signing in instead.',
        no_email: 'Could not get email from provider. Try email/password signup.',
        oauth_failed: 'Sign in failed. Please try again.',
        conversion_failed: 'Account creation failed. Please try again.',
      };
      setNotification({
        type: 'error',
        message: errorMessages[error] || 'Something went wrong. Please try again.',
      });
    }
  }, [searchParams, setSearchParams, refreshUser]);


  const handleError = useCallback((error: string) => {
    logError('Battle error', new Error(error), {
      component: 'BattlePage',
      battleId,
    });
  }, [battleId]);

  const handlePhaseChange = useCallback((_phase: string) => {
    // Phase changes are normal operation, no logging needed
  }, []);

  const handleMatchComplete = useCallback((_winnerId: number | null) => {
    // Match complete is normal operation, no logging needed
  }, []);

  const {
    battleState: wsBattleState,
    isConnected,
    isConnecting,
    opponentStatus,
    countdownValue,
    sendTyping,
    submitPrompt,
    requestState,
  } = useBattleWebSocket({
    battleId: parseInt(battleId || '0', 10),
    onError: handleError,
    onPhaseChange: handlePhaseChange,
    onMatchComplete: handleMatchComplete,
  });

  // Fallback to REST API when WebSocket fails (for completed battles)
  // Now uses public endpoint first, then falls back to authenticated endpoint
  useEffect(() => {
    const fetchBattleViaRest = async () => {
      if (!battleId || wsBattleState || isConnecting) return;

      // Only fetch via REST if WebSocket failed and we don't have state
      setRestLoading(true);
      setRestError(null);

      try {
        // Try public endpoint first (works for completed battles without auth)
        let data;
        let isPublicView = false;

        try {
          const publicResponse = await api.get(`/battles/${battleId}/public/`);
          data = publicResponse.data;
          isPublicView = !user; // Public view if no user logged in
        } catch (publicError) {
          // Public endpoint failed (battle might be in-progress)
          const err = publicError as { response?: { status?: number } };

          // If 403, battle is in progress - need auth
          if (err.response?.status === 403) {
            if (!user) {
              // Redirect to login for in-progress battles
              navigate(`/auth?beta=THRIVE&next=${encodeURIComponent(`/play/prompt-battles/${battleId}`)}`);
              return;
            }
            // User is authenticated, try authenticated endpoint
            const authResponse = await api.get(`/me/battles/${battleId}/`);
            data = authResponse.data;
          } else if (err.response?.status === 404) {
            throw new Error('Battle not found');
          } else {
            throw publicError;
          }
        }

        // For public view of completed battles, we need to pick which player to show as "my" vs "opponent"
        // Default to challenger as the primary view, but if user is logged in, show their perspective
        let myUserId: number;
        let opponentUserId: number;

        if (user) {
          // Authenticated user - show their perspective
          myUserId = user.id;
          const isChallenger = data.challenger === user.id;
          opponentUserId = isChallenger ? data.opponent : data.challenger;
        } else {
          // Public view - show challenger's perspective (first player)
          myUserId = data.challenger;
          opponentUserId = data.opponent;
        }

        // Get user data - handle both camelCase and snake_case from different endpoints
        const challengerData = data.challenger_data || data.challengerData;
        const opponentData = data.opponent_data || data.opponentData;
        const myData = data.challenger === myUserId ? challengerData : opponentData;
        const theirData = data.challenger === myUserId ? opponentData : challengerData;

        // Find submissions from the submissions array
        const submissions = data.submissions || [];
        const mySubmissionData = submissions.find(
          (s: { user: number }) => s.user === myUserId
        );
        const opponentSubmissionData = submissions.find(
          (s: { user: number }) => s.user === opponentUserId
        );

        // Transform REST response to match WebSocket state format
        const transformedState: BattleState = {
          id: data.id,
          phase: data.status === 'completed' ? 'complete' : data.status,
          status: data.status,
          challengeText: data.challenge_text || data.challengeText,
          challengeType: data.challenge_type || data.challengeType
            ? {
                key: (data.challenge_type || data.challengeType).key,
                name: (data.challenge_type || data.challengeType).name,
              }
            : null,
          durationMinutes: data.duration_minutes || data.durationMinutes,
          timeRemaining: data.time_remaining ?? data.timeRemaining ?? 0,
          myConnected: true,
          opponent: {
            id: theirData?.id || opponentUserId || 0,
            username: theirData?.username || 'Unknown',
            avatarUrl: theirData?.avatar_url || theirData?.avatarUrl,
            connected: false,
          },
          mySubmission: mySubmissionData
            ? {
                id: mySubmissionData.id,
                promptText: mySubmissionData.prompt_text || mySubmissionData.promptText,
                imageUrl: mySubmissionData.generated_output_url || mySubmissionData.generatedOutputUrl,
                score: mySubmissionData.score,
                criteriaScores: mySubmissionData.criteria_scores || mySubmissionData.criteriaScores,
                feedback: mySubmissionData.evaluation_feedback || mySubmissionData.evaluationFeedback,
              }
            : null,
          opponentSubmission: opponentSubmissionData
            ? {
                id: opponentSubmissionData.id,
                promptText: opponentSubmissionData.prompt_text || opponentSubmissionData.promptText,
                imageUrl: opponentSubmissionData.generated_output_url || opponentSubmissionData.generatedOutputUrl,
                score: opponentSubmissionData.score,
                criteriaScores: opponentSubmissionData.criteria_scores || opponentSubmissionData.criteriaScores,
                feedback: opponentSubmissionData.evaluation_feedback || opponentSubmissionData.evaluationFeedback,
              }
            : null,
          winnerId: data.winner,
          matchSource: data.match_source || data.matchSource || 'unknown',
          // Include invite URL for invitation battles
          inviteUrl: data.invite_url || data.inviteUrl,
          // Track if this is a public view (for UI adjustments)
          isPublicView,
          // Store my player info for public views (where there's no authenticated user)
          myPlayer: myData
            ? {
                id: myData.id || myUserId,
                username: myData.username || 'Player 1',
                avatarUrl: myData.avatar_url || myData.avatarUrl,
              }
            : undefined,
        };

        setRestBattleState(transformedState);
      } catch (error) {
        logError('Failed to load battle via REST API', error as Error, {
          component: 'BattlePage',
          battleId,
          context: 'REST fallback',
        });
        setRestError('Failed to load battle data');
      } finally {
        setRestLoading(false);
      }
    };

    // Small delay to let WebSocket attempt connection first (only if user is authenticated)
    // For unauthenticated users, fetch immediately via public endpoint
    const delay = user ? 2000 : 100;
    const timeout = setTimeout(fetchBattleViaRest, delay);
    return () => clearTimeout(timeout);
  }, [battleId, wsBattleState, isConnecting, user, navigate]);

  // Use WebSocket state if available, otherwise fallback to REST
  const battleState = wsBattleState || restBattleState;

  // Show guest signup banner when battle completes for guest users
  useEffect(() => {
    if (isGuestUser && battleState?.phase === BATTLE_PHASES.COMPLETE) {
      // Check if this is a returning guest (battle already loaded via REST, not just completed)
      // If loaded via REST fallback, show banner immediately
      // If just completed via WebSocket, delay to let reveal animation finish
      if (restBattleState) {
        // Returning guest - show banner immediately
        setShowGuestSignupBanner(true);
      } else {
        // Battle just completed - delay to let user see results
        const timer = setTimeout(() => {
          setShowGuestSignupBanner(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isGuestUser, battleState?.phase, restBattleState]);

  // Determine battle result for guest signup modal
  const battleResult = useMemo(() => {
    if (!battleState || !user) return undefined;
    if (battleState.winnerId === user.id) return 'win' as const;
    if (battleState.winnerId === null) return 'tie' as const;
    return 'loss' as const;
  }, [battleState, user]);

  // Map backend opponent status to component status
  const mappedOpponentStatus: PlayerStatus = useMemo(() => {
    if (opponentStatus === 'typing') return 'typing';
    if (opponentStatus === 'submitted') return 'submitted';
    if (opponentStatus === 'disconnected') return 'disconnected';
    if (battleState?.opponent.connected) return 'connected';
    return 'idle';
  }, [opponentStatus, battleState?.opponent.connected]);

  // Current user's status
  const myStatus: PlayerStatus = useMemo(() => {
    if (battleState?.mySubmission) return 'submitted';
    if (battleState?.myConnected) return 'connected';
    return 'idle';
  }, [battleState?.mySubmission, battleState?.myConnected]);

  // Handle prompt submission
  const handleSubmit = useCallback(
    (prompt: string) => {
      const success = submitPrompt(prompt);
      if (!success) {
        handleError('Failed to submit prompt. Please try again.');
      } else {
        // Scroll to top so user can see the battle status
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [submitPrompt, handleError]
  );

  // Handle typing indicator
  const handleTyping = useCallback(
    (isTyping: boolean) => {
      sendTyping(isTyping);
    },
    [sendTyping]
  );

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    navigate('/play/prompt-battles');
  }, [navigate]);

  // Handle go home
  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Handle starting turn for invitation battles (challenger starts before opponent joins)
  const handleStartChallengeTurn = useCallback(async () => {
    if (!battleId) return;

    setIsStartingTurn(true);
    try {
      const response = await api.post(`/battles/${battleId}/start-turn/`);
      // API returns { status: 'success' | 'already_started', expires_at, time_remaining }
      const status = response.data.status;
      if (status === 'success' || status === 'already_started') {
        // Set time remaining from API response (in seconds)
        const timeRemaining = response.data.timeRemaining || response.data.time_remaining || 180;
        setLocalTimeRemaining(timeRemaining);
        // Mark that user has started their turn - this prevents showing the "Start My Turn"
        // screen again even if the backend's isMyTurn hasn't updated yet
        setHasStartedMyTurn(true);
        // Request fresh state from WebSocket instead of reloading the page
        // This is smoother and keeps local state intact
        requestState();
      }
    } catch (error) {
      logError('Failed to start turn', error as Error, {
        component: 'BattlePage',
        battleId,
      });
      handleError('Failed to start your turn. Please try again.');
    } finally {
      setIsStartingTurn(false);
    }
  }, [battleId, handleError, requestState]);

  // Handle challenge refresh (Pip battles and invitation battles)
  const handleRefreshChallenge = useCallback(async () => {
    if (!battleId) return;

    setIsRefreshingChallenge(true);
    try {
      const response = await api.post(`/me/battles/${battleId}/refresh-challenge/`);
      // API interceptor transforms snake_case to camelCase
      const newChallenge = response.data.challengeText;
      const newTimeRemaining = response.data.timeRemaining;
      const newChallengeType = response.data.challengeType;
      setLocalChallengeText(newChallenge);
      setLocalTimeRemaining(newTimeRemaining);
      // Increment reset key to force timer reset even if time value is the same
      setTimerResetKey(k => k + 1);
      if (newChallengeType) {
        setLocalChallengeType(newChallengeType);
      }
    } catch (error) {
      logError('Failed to refresh challenge', error as Error, {
        component: 'BattlePage',
        battleId,
      });
      handleError('Failed to refresh challenge. Please try again.');
    } finally {
      setIsRefreshingChallenge(false);
    }
  }, [battleId, handleError]);

  // Navigation helper
  const goToBattles = useCallback(() => navigate('/play/prompt-battles'), [navigate]);

  // Loading state - Invalid battle ID
  if (!battleId) {
    return <InvalidBattle onBack={goToBattles} />;
  }

  // Loading state - Connecting or fetching
  if ((isConnecting || restLoading) && !battleState) {
    return (
      <BattlePageLoading
        message={restLoading ? 'Loading battle...' : 'Connecting to battle...'}
      />
    );
  }

  // Error state - Both WebSocket and REST failed
  if (!battleState && restError) {
    return (
      <BattlePageError
        message={restError}
        onBack={goToBattles}
      />
    );
  }

  // Loading state - No battle state yet
  if (!battleState) {
    return <BattlePageLoading />;
  }

  // Time expired state - check if battle has timed out (show before connection lost)
  const isTimeExpired = battleState.status === 'expired' ||
    (localTimeRemaining !== null && localTimeRemaining <= 0 && battleState.phase === BATTLE_PHASES.ACTIVE);

  if (isTimeExpired && battleState.phase !== BATTLE_PHASES.COMPLETE && battleState.phase !== BATTLE_PHASES.JUDGING) {
    return <BattleTimeExpired onBack={goToBattles} />;
  }

  // Connection error state - only show if WebSocket is disconnected AND we don't have REST fallback data
  // For completed battles loaded via REST, we don't need a WebSocket connection
  if (!isConnected && battleState.phase !== BATTLE_PHASES.COMPLETE && !restBattleState) {
    return <BattleConnectionLost onLeave={goToBattles} />;
  }

  // Current user info - use authenticated user if available, otherwise use battleState.myPlayer for public views
  const currentUser = user
    ? {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
      }
    : battleState?.myPlayer || {
        id: 0,
        username: 'Player 1',
        avatarUrl: undefined,
      };

  // Check if this is an invitation battle where challenger can start early
  const isInvitationBattle = battleState.matchSource === 'invitation';
  const opponentHasNotJoined = battleState.opponent.id === 0;
  const isWaitingInvitationBattle =
    battleState.phase === 'waiting' && isInvitationBattle && opponentHasNotJoined;

  // Check if this user needs to start their turn in an async battle
  // This happens when:
  // 1. It's an invitation (async) battle
  // 2. The battle is in an active phase (challenger has started)
  // 3. It's not the user's turn yet (backend says isMyTurn: false)
  // 4. The user hasn't submitted yet
  // In this case, show them the "Start My Turn" screen instead of the waiting message
  const isActiveAsyncPhase = [
    BATTLE_PHASES.ACTIVE,
    BATTLE_PHASES.CHALLENGER_TURN,
    BATTLE_PHASES.OPPONENT_TURN,
  ].includes(battleState.phase as typeof BATTLE_PHASES.ACTIVE);

  const needsToStartTurn =
    isInvitationBattle &&
    isActiveAsyncPhase &&
    battleState.isMyTurn === false &&
    !battleState.mySubmission &&
    !hasStartedMyTurn; // User hasn't clicked "Start My Turn" yet

  // Render based on phase
  const renderPhaseContent = () => {
    switch (battleState.phase) {
      case 'waiting':
        // For invitation battles where opponent hasn't joined yet,
        // show the challenge ready screen so challenger can start their turn
        if (isWaitingInvitationBattle) {
          // Use invite URL from battle state (includes the proper invite token)
          // Fallback to battle ID only if invite URL is not available (shouldn't happen)
          const currentInviteUrl = battleState.inviteUrl || `${window.location.origin}/battle/invite/${battleId}`;
          return (
            <ChallengeReadyScreen
              challengeText={localChallengeText || battleState.challengeText}
              challengeType={localChallengeType || battleState.challengeType || undefined}
              inviteUrl={currentInviteUrl}
              hasSubmitted={!!battleState.mySubmission}
              onStartTurn={handleStartChallengeTurn}
              isStarting={isStartingTurn}
              onRefreshChallenge={handleRefreshChallenge}
              isRefreshingChallenge={isRefreshingChallenge}
              friendName={localFriendName || battleState.opponent.friendName || ''}
              onFriendNameChange={setLocalFriendName}
              battleId={battleId ? parseInt(battleId) : undefined}
            />
          );
        }
        // Regular waiting for opponent (random matchmaking or accepted invitation)
        return (
          <WaitingForOpponent
            opponentUsername={battleState.opponent.username}
            opponentIsAi={battleState.matchSource === 'ai_opponent'}
          />
        );

      case 'countdown':
        return <BattleCountdown value={countdownValue} />;

      case BATTLE_PHASES.ACTIVE:
      case BATTLE_PHASES.CHALLENGER_TURN:
      case BATTLE_PHASES.OPPONENT_TURN:
        // For async battles where user needs to start their turn, show the start screen
        // This ensures the user's timer starts when THEY click "Start My Turn"
        if (needsToStartTurn) {
          const currentInviteUrl = battleState.inviteUrl || `${window.location.origin}/battle/invite/${battleId}`;
          return (
            <ChallengeReadyScreen
              challengeText={localChallengeText || battleState.challengeText}
              challengeType={localChallengeType || battleState.challengeType || undefined}
              inviteUrl={currentInviteUrl}
              hasSubmitted={false}
              onStartTurn={handleStartChallengeTurn}
              isStarting={isStartingTurn}
              onRefreshChallenge={handleRefreshChallenge}
              isRefreshingChallenge={isRefreshingChallenge}
              hideShareOptions={true}
              friendName={localFriendName || battleState.opponent.friendName || ''}
              onFriendNameChange={setLocalFriendName}
              battleId={battleId ? parseInt(battleId) : undefined}
            />
          );
        }

        // For async battles where user has submitted but opponent hasn't:
        // Show the GeneratingPhase so user can see their image being generated
        // instead of just a "Waiting for opponent..." message
        if (isInvitationBattle && battleState.mySubmission && !battleState.opponentSubmission) {
          return (
            <GeneratingPhase
              myImageGenerating={!battleState.mySubmission.imageUrl}
              opponentImageGenerating={true}
              myImageUrl={battleState.mySubmission.imageUrl}
              opponentUsername={localFriendName || battleState.opponent.friendName || battleState.opponent.username}
              isJudging={false}
            />
          );
        }

        // Active phase and async turn phases all show the battle arena (see isArenaPhase)
        return (
          <>
            {countdownValue !== null && <BattleCountdown value={countdownValue} />}
            <BattleArena
              challengeText={localChallengeText || battleState.challengeText}
              challengeType={battleState.challengeType}
              currentUser={currentUser}
              opponent={{
                id: battleState.opponent.id,
                username: localFriendName || battleState.opponent.friendName || battleState.opponent.username,
                avatarUrl: battleState.opponent.avatarUrl,
                isAi: battleState.matchSource === 'ai_opponent',
              }}
              currentUserStatus={myStatus}
              opponentStatus={mappedOpponentStatus}
              timeRemaining={localTimeRemaining ?? battleState.timeRemaining}
              timerResetKey={timerResetKey}
              hasSubmitted={!!battleState.mySubmission}
              onSubmit={handleSubmit}
              onTyping={handleTyping}
              onRefreshChallenge={handleRefreshChallenge}
              isRefreshingChallenge={isRefreshingChallenge}
              isAiOpponent={battleState.matchSource === 'ai_opponent'}
              isAsyncBattle={isInvitationBattle}
              challengerName={localFriendName || battleState.opponent.friendName || battleState.opponent.username}
              isGuestUser={isGuestUser}
              onSignupClick={() => setShowGuestSignupModal(true)}
              isMyTurn={hasStartedMyTurn || (battleState.isMyTurn ?? true)}
            />
          </>
        );

      case 'generating':
        return (
          <GeneratingPhase
            myImageGenerating={!battleState.mySubmission?.imageUrl}
            opponentImageGenerating={true}
            myImageUrl={battleState.mySubmission?.imageUrl}
            opponentUsername={battleState.opponent.username}
            isJudging={false}
          />
        );

      case 'judging':
      case 'reveal':
        // Use JudgingReveal for animated judging and reveal sequence
        return (
          <JudgingReveal
            mySubmission={battleState.mySubmission}
            opponentSubmission={battleState.opponentSubmission}
            myPlayer={currentUser}
            opponent={{
              id: battleState.opponent.id,
              username: battleState.opponent.username,
              avatarUrl: battleState.opponent.avatarUrl,
              isAi: battleState.matchSource === 'ai_opponent',
            }}
            winnerId={battleState.winnerId}
            isJudging={battleState.phase === 'judging' && !battleState.winnerId}
            onComplete={() => setRevealComplete(true)}
            onPlayAgain={handlePlayAgain}
            onGoHome={handleGoHome}
            challengeText={localChallengeText || battleState.challengeText}
            battleId={battleState.id}
          />
        );

      case 'complete':
        // Use JudgingReveal for the animated reveal sequence
        // It will show action buttons after the animation completes
        return (
          <JudgingReveal
            mySubmission={battleState.mySubmission}
            opponentSubmission={battleState.opponentSubmission}
            myPlayer={currentUser}
            opponent={{
              id: battleState.opponent.id,
              username: battleState.opponent.username,
              avatarUrl: battleState.opponent.avatarUrl,
              isAi: battleState.matchSource === 'ai_opponent',
            }}
            winnerId={battleState.winnerId}
            isJudging={false}
            onComplete={() => setRevealComplete(true)}
            onPlayAgain={handlePlayAgain}
            onGoHome={handleGoHome}
            challengeText={localChallengeText || battleState.challengeText}
            battleId={battleState.id}
          />
        );

      default:
        return (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <p className="text-slate-400">Unknown battle phase: {battleState.phase}</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      {/* Notification banner for conversion success/error */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-0 left-0 right-0 z-50 p-4 ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 border-b border-emerald-500/30'
              : 'bg-rose-500/20 border-b border-rose-500/30'
          }`}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p
              className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-slate-400 hover:text-white"
            >
              <span className="sr-only">Dismiss</span>
              &times;
            </button>
          </div>
        </motion.div>
      )}

      <div className="min-h-screen bg-background">{renderPhaseContent()}</div>

      {/* Guest signup banner - shown after battle completes for guest users */}
      <GuestSignupBanner
        isVisible={showGuestSignupBanner}
        onDismiss={() => setShowGuestSignupBanner(false)}
        onSignupClick={() => {
          setShowGuestSignupBanner(false);
          setShowGuestSignupModal(true);
        }}
        battleResult={battleResult}
      />

      {/* Guest signup modal - opened when user clicks banner */}
      <GuestSignupModal
        isOpen={showGuestSignupModal}
        onClose={() => setShowGuestSignupModal(false)}
        onSuccess={() => {
          // Modal handles refreshUser internally
          setShowGuestSignupModal(false);
        }}
        battleResult={battleResult}
        battleId={battleId}
      />
    </DashboardLayout>
  );
}

export default BattlePage;
