/**
 * BattlePage
 *
 * Main page for an active prompt battle.
 * Manages battle state and renders appropriate phase components.
 * Falls back to REST API for completed battles when WebSocket fails.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { api } from '@/services/api';
import { logError } from '@/utils/errorHandler';

import { useBattleWebSocket, type BattleState } from '@/hooks/useBattleWebSocket';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
  BattleArena,
  BattleCountdown,
  GeneratingPhase,
  GuestSignupBanner,
  JudgingReveal,
  WaitingForOpponent,
  type PlayerStatus,
} from '@/components/battles';

export function BattlePage() {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [restBattleState, setRestBattleState] = useState<BattleState | null>(null);
  const [restLoading, setRestLoading] = useState(false);
  const [restError, setRestError] = useState<string | null>(null);
  const [_revealComplete, setRevealComplete] = useState(false);
  const [isRefreshingChallenge, setIsRefreshingChallenge] = useState(false);
  const [localChallengeText, setLocalChallengeText] = useState<string | null>(null);
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);
  const [showGuestSignupModal, setShowGuestSignupModal] = useState(false);

  // Check if user is a guest
  const isGuestUser = user?.isGuest ?? false;

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
  } = useBattleWebSocket({
    battleId: parseInt(battleId || '0', 10),
    onError: handleError,
    onPhaseChange: handlePhaseChange,
    onMatchComplete: handleMatchComplete,
  });

  // Fallback to REST API when WebSocket fails (for completed battles)
  useEffect(() => {
    const fetchBattleViaRest = async () => {
      if (!battleId || wsBattleState || isConnecting || !user) return;

      // Only fetch via REST if WebSocket failed and we don't have state
      setRestLoading(true);
      setRestError(null);

      try {
        const response = await api.get(`/me/battles/${battleId}/`);
        const data = response.data;

        // Determine opponent based on challenger/opponent IDs
        const isChallenger = data.challenger === user.id;
        const opponentData = isChallenger ? data.opponent_data : data.challenger_data;

        // Find my submission and opponent's submission from submissions array
        const submissions = data.submissions || [];
        const mySubmissionData = submissions.find(
          (s: { user: number }) => s.user === user.id
        );
        const opponentSubmissionData = submissions.find(
          (s: { user: number }) => s.user !== user.id
        );

        // Transform REST response to match WebSocket state format
        const transformedState: BattleState = {
          id: data.id,
          phase: data.status === 'completed' ? 'complete' : data.status,
          status: data.status,
          challengeText: data.challenge_text,
          challengeType: data.challenge_type
            ? { key: data.challenge_type.key, name: data.challenge_type.name }
            : null,
          durationMinutes: data.duration_minutes,
          timeRemaining: data.time_remaining,
          myConnected: true,
          opponent: {
            id: opponentData?.id || 0,
            username: opponentData?.username || 'Unknown',
            avatarUrl: opponentData?.avatar_url,
            connected: false,
          },
          mySubmission: mySubmissionData
            ? {
                id: mySubmissionData.id,
                promptText: mySubmissionData.prompt_text,
                imageUrl: mySubmissionData.generated_output_url,
                score: mySubmissionData.score,
                criteriaScores: mySubmissionData.criteria_scores,
                feedback: mySubmissionData.evaluation_feedback,
              }
            : null,
          opponentSubmission: opponentSubmissionData
            ? {
                id: opponentSubmissionData.id,
                promptText: opponentSubmissionData.prompt_text,
                imageUrl: opponentSubmissionData.generated_output_url,
                score: opponentSubmissionData.score,
                criteriaScores: opponentSubmissionData.criteria_scores,
                feedback: opponentSubmissionData.evaluation_feedback,
              }
            : null,
          winnerId: data.winner,
          matchSource: data.match_source || 'unknown',
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

    // Small delay to let WebSocket attempt connection first
    const timeout = setTimeout(fetchBattleViaRest, 2000);
    return () => clearTimeout(timeout);
  }, [battleId, wsBattleState, isConnecting, user]);

  // Use WebSocket state if available, otherwise fallback to REST
  const battleState = wsBattleState || restBattleState;

  // Show guest signup banner when battle completes for guest users
  useEffect(() => {
    if (isGuestUser && battleState?.phase === 'complete') {
      // Check if this is a returning guest (battle already loaded via REST, not just completed)
      // If loaded via REST fallback, show banner immediately
      // If just completed via WebSocket, delay to let reveal animation finish
      if (restBattleState) {
        // Returning guest - show banner immediately
        setShowGuestSignupModal(true);
      } else {
        // Battle just completed - delay to let user see results
        const timer = setTimeout(() => {
          setShowGuestSignupModal(true);
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
    navigate('/battles');
  }, [navigate]);

  // Handle go home
  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Handle challenge refresh (Pip battles only)
  const handleRefreshChallenge = useCallback(async () => {
    if (!battleId) return;

    setIsRefreshingChallenge(true);
    try {
      const response = await api.post(`/me/battles/${battleId}/refresh-challenge/`);
      // API interceptor transforms snake_case to camelCase
      const newChallenge = response.data.challengeText;
      const newTimeRemaining = response.data.timeRemaining;
      setLocalChallengeText(newChallenge);
      setLocalTimeRemaining(newTimeRemaining);
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

  // Loading state
  if (!battleId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Invalid Battle</h2>
            <p className="text-slate-400 mb-4">No battle ID provided.</p>
            <button onClick={() => navigate('/battles')} className="btn-primary">
              Find a Battle
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if ((isConnecting || restLoading) && !battleState) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-cyan-500/30 border-t-cyan-500"
            />
            <p className="text-slate-400">
              {restLoading ? 'Loading battle...' : 'Connecting to battle...'}
            </p>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // Show error if both WebSocket and REST failed
  if (!battleState && restError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center glass-card p-8 max-w-md">
            <ExclamationTriangleIcon className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Failed to Load Battle</h2>
            <p className="text-slate-400 mb-4">{restError}</p>
            <button onClick={() => navigate('/battles')} className="btn-primary">
              Back to Battles
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!battleState) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-cyan-500/30 border-t-cyan-500"
            />
            <p className="text-slate-400">Loading battle...</p>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // Connection error state - only show if WebSocket is disconnected AND we don't have REST fallback data
  // For completed battles loaded via REST, we don't need a WebSocket connection
  if (!isConnected && battleState.phase !== 'complete' && !restBattleState) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center glass-card p-8 max-w-md">
            <ExclamationTriangleIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Connection Lost</h2>
            <p className="text-slate-400 mb-4">
              Attempting to reconnect to the battle...
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/battles')} className="btn-secondary">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Leave Battle
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Current user info
  const currentUser = {
    id: user?.id || 0,
    username: user?.username || 'You',
    avatarUrl: user?.avatarUrl,
  };

  // Render based on phase
  const renderPhaseContent = () => {
    switch (battleState.phase) {
      case 'waiting':
        return (
          <WaitingForOpponent
            opponentUsername={battleState.opponent.username}
            opponentIsAi={battleState.matchSource === 'ai_opponent'}
          />
        );

      case 'countdown':
        return <BattleCountdown value={countdownValue} />;

      case 'active':
        return (
          <>
            {countdownValue !== null && <BattleCountdown value={countdownValue} />}
            <BattleArena
              challengeText={localChallengeText || battleState.challengeText}
              challengeType={battleState.challengeType}
              currentUser={currentUser}
              opponent={{
                id: battleState.opponent.id,
                username: battleState.opponent.username,
                avatarUrl: battleState.opponent.avatarUrl,
                isAi: battleState.matchSource === 'ai_opponent',
              }}
              currentUserStatus={myStatus}
              opponentStatus={mappedOpponentStatus}
              timeRemaining={localTimeRemaining ?? battleState.timeRemaining}
              hasSubmitted={!!battleState.mySubmission}
              onSubmit={handleSubmit}
              onTyping={handleTyping}
              onRefreshChallenge={handleRefreshChallenge}
              isRefreshingChallenge={isRefreshingChallenge}
              isAiOpponent={battleState.matchSource === 'ai_opponent'}
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
      <div className="min-h-screen bg-background">{renderPhaseContent()}</div>

      {/* Guest signup banner - shown after battle completes for guest users */}
      <GuestSignupBanner
        isVisible={showGuestSignupModal}
        onDismiss={() => setShowGuestSignupModal(false)}
        battleResult={battleResult}
      />
    </DashboardLayout>
  );
}

export default BattlePage;
