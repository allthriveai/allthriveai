/**
 * useBattleWebSocket Hook
 *
 * Manages WebSocket connection for real-time prompt battles.
 * Handles battle state updates, opponent status, and submission flow.
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';

// Import unified phase types
import type { BattlePhase } from '@/types/battlePhases';

// Re-export for backward compatibility
export type { BattlePhase } from '@/types/battlePhases';

// =============================================================================
// BATTLE LOGGING UTILITY
// =============================================================================

interface BattleLogContext {
  battleId?: number;
  phase?: string;
  userId?: number;
  traceId?: string;
  [key: string]: unknown;
}

/**
 * Generate a short trace ID for tracking related log events
 */
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Structured logging for battle WebSocket events
 */
function logBattle(
  level: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  context: BattleLogContext = {}
): void {
  const timestamp = new Date().toISOString();
  const { battleId, phase, traceId, ...extra } = context;

  const prefix = `[Battle WS${traceId ? `:${traceId}` : ''}]`;
  const battleInfo = battleId ? ` battle=${battleId}` : '';
  const phaseInfo = phase ? ` phase=${phase}` : '';
  const extraInfo = Object.keys(extra).length > 0
    ? ` | ${Object.entries(extra).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`
    : '';

  const message = `${prefix} ${event}${battleInfo}${phaseInfo}${extraInfo}`;

  // Log with structured data for debugging tools
  const logData = { timestamp, event, ...context };

  switch (level) {
    case 'debug':
      console.debug(message, logData);
      break;
    case 'info':
      console.info(message, logData);
      break;
    case 'warn':
      console.warn(message, logData);
      break;
    case 'error':
      console.error(message, logData);
      break;
  }
}

// Custom logger for battle WebSocket (passed to useWebSocketBase)

export type OpponentStatus = 'connected' | 'disconnected' | 'typing' | 'submitted' | 'idle';

export interface Opponent {
  id: number;
  username: string;
  avatarUrl?: string;
  connected: boolean;
  status?: OpponentStatus;
  /** Friend name set by challenger for invitation battles */
  friendName?: string;
}

export interface ChallengeType {
  key: string;
  name: string;
}

export interface MySubmission {
  id: number;
  promptText: string;
  imageUrl?: string;
  score?: number;
  criteriaScores?: Record<string, number>;
  feedback?: string;
}

export interface BattleState {
  id: number;
  phase: BattlePhase;
  status: string;
  challengeText: string;
  challengeType: ChallengeType | null;
  durationMinutes: number;
  timeRemaining: number | null;
  myConnected: boolean;
  opponent: Opponent;
  mySubmission: MySubmission | null;
  opponentSubmission: MySubmission | null;
  winnerId: number | null;
  matchSource: string;
  /** Full invite URL for invitation battles (e.g., https://allthrive.ai/battle/invite/{token}) */
  inviteUrl?: string;
  /** True when battle is viewed by unauthenticated user (public completed battle) */
  isPublicView?: boolean;
  /** Player data for "my" side - used in public view when no user is authenticated */
  myPlayer?: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
  /** Whether it's the current user's turn (for async battles) */
  isMyTurn?: boolean;
  /** Points earned by the current user (50 for winner, 10 for participation) */
  pointsEarned?: number;
}

interface WebSocketMessage {
  event: string;
  state?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
  user_id?: number;
  status?: string;
  phase?: BattlePhase;
  duration?: number;
  value?: number;
  submission_id?: number;
  battle_id?: number;
  image_url?: string;
  winner_id?: number | null;
  results?: any; // Judging results with scores and feedback
}

interface UseBattleWebSocketOptions {
  battleId: number;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: BattlePhase) => void;
  onMatchComplete?: (winnerId: number | null) => void;
  autoReconnect?: boolean;
}

export function useBattleWebSocket({
  battleId,
  onError,
  onPhaseChange,
  onMatchComplete,
  autoReconnect = true,
}: UseBattleWebSocketOptions) {
  const { isLoading: authLoading } = useAuth();

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<OpponentStatus>('disconnected');
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  const traceIdRef = useRef<string>(generateTraceId());
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);

  // Refs for callbacks to avoid stale closures
  const onErrorRef = useRef(onError);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onMatchCompleteRef = useRef(onMatchComplete);

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError;
    onPhaseChangeRef.current = onPhaseChange;
    onMatchCompleteRef.current = onMatchComplete;
  }, [onError, onPhaseChange, onMatchComplete]);

  // Parse server state to client format with defensive null checks
  const parseServerState = useCallback((serverState: Record<string, unknown>): BattleState | null => {
    try {
      const opponent = serverState.opponent as Record<string, unknown> | null;
      const mySubmission = serverState.my_submission as Record<string, unknown> | null;
      const opponentSubmission = serverState.opponent_submission as Record<string, unknown> | null;
      const challengeType = serverState.challenge_type as Record<string, unknown> | null;

      if (!opponent) {
        console.error('[Battle WS] Missing opponent in state');
        return null;
      }

      return {
        id: (serverState.id as number) ?? 0,
        phase: (serverState.phase as BattlePhase) ?? 'waiting',
        status: (serverState.status as string) ?? 'pending',
        challengeText: (serverState.challenge_text as string) ?? '',
        challengeType: challengeType
          ? {
              key: (challengeType.key as string) ?? '',
              name: (challengeType.name as string) ?? '',
            }
          : null,
        durationMinutes: (serverState.duration_minutes as number) ?? 3,
        timeRemaining: serverState.time_remaining as number | null,
        myConnected: (serverState.my_connected as boolean) ?? false,
        opponent: {
          id: (opponent.id as number) ?? 0,
          username: (opponent.username as string) ?? 'Unknown',
          avatarUrl: opponent.avatar_url as string | undefined,
          connected: (opponent.connected as boolean) ?? false,
          friendName: opponent.friend_name as string | undefined,
        },
        mySubmission: mySubmission
          ? {
              id: (mySubmission.id as number) ?? 0,
              promptText: (mySubmission.prompt_text as string) ?? '',
              imageUrl: mySubmission.image_url as string | undefined,
              score: mySubmission.score as number | undefined,
              criteriaScores: mySubmission.criteria_scores as Record<string, number> | undefined,
              feedback: mySubmission.feedback as string | undefined,
            }
          : null,
        opponentSubmission: opponentSubmission
          ? {
              id: (opponentSubmission.id as number) ?? 0,
              promptText: (opponentSubmission.prompt_text as string) ?? '',
              imageUrl: opponentSubmission.image_url as string | undefined,
              score: opponentSubmission.score as number | undefined,
              criteriaScores: opponentSubmission.criteria_scores as Record<string, number> | undefined,
              feedback: opponentSubmission.feedback as string | undefined,
            }
          : null,
        winnerId: serverState.winner_id as number | null,
        matchSource: (serverState.match_source as string) ?? 'unknown',
        inviteUrl: serverState.invite_url as string | undefined,
        isMyTurn: serverState.is_my_turn as boolean | undefined,
        pointsEarned: serverState.points_earned as number | undefined,
      };
    } catch (error) {
      console.error('[Battle WS] Failed to parse server state:', error);
      return null;
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    const traceId = traceIdRef.current;

    try {
      const data = rawData as WebSocketMessage;

      if (data.event === 'pong') return;

      // Log all non-pong events
      logBattle('debug', `ws_event_${data.event}`, {
        battleId,
        traceId,
        eventData: data,
      });

      switch (data.event) {
        case 'battle_state':
          if (data.state) {
            const newState = parseServerState(data.state);
            if (newState) {
              logBattle('info', 'battle_state_received', {
                battleId,
                traceId,
                phase: newState.phase,
                status: newState.status,
                opponentConnected: newState.opponent.connected,
                hasMySubmission: !!newState.mySubmission,
                hasOpponentSubmission: !!newState.opponentSubmission,
                winnerId: newState.winnerId,
                matchSource: newState.matchSource,
              });
              setBattleState(newState);
              setOpponentStatus(newState.opponent.connected ? 'connected' : 'disconnected');
            } else {
              logBattle('error', 'battle_state_parse_failed', { battleId, traceId });
            }
          }
          break;

        case 'opponent_status':
          if (data.status) {
            logBattle('info', 'opponent_status_change', {
              battleId,
              traceId,
              newStatus: data.status,
              userId: data.user_id,
            });
            setOpponentStatus(data.status as OpponentStatus);
          }
          break;

        case 'countdown_start':
          logBattle('info', 'countdown_start', {
            battleId,
            traceId,
            duration: data.duration || 3,
          });
          setCountdownValue(data.duration || 3);
          onPhaseChangeRef.current?.('countdown');
          break;

        case 'countdown_tick':
          if (typeof data.value === 'number') {
            setCountdownValue(data.value);
          }
          break;

        case 'phase_change':
          if (data.phase) {
            logBattle('info', 'phase_change', {
              battleId,
              traceId,
              newPhase: data.phase,
            });
            setBattleState((prev) => (prev ? { ...prev, phase: data.phase! } : null));
            onPhaseChangeRef.current?.(data.phase);

            if (data.phase === 'complete') {
              // Get winnerId from current state
              setBattleState((prev) => {
                if (prev) {
                  logBattle('info', 'battle_complete_from_phase', {
                    battleId,
                    traceId,
                    winnerId: prev.winnerId,
                  });
                  onMatchCompleteRef.current?.(prev.winnerId);
                }
                return prev;
              });
            }

            // Clear countdown when transitioning to active
            if (data.phase === 'active') {
              setCountdownValue(null);
            }
          }
          break;

        case 'submission_confirmed':
          logBattle('info', 'submission_confirmed', {
            battleId,
            traceId,
            submissionId: data.submission_id,
          });
          // Update battleState to reflect submission
          setBattleState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              mySubmission: {
                id: data.submission_id as number,
                promptText: '', // Will be populated on next state refresh
              },
            };
          });
          break;

        case 'image_generating':
          logBattle('info', 'image_generating', {
            battleId,
            traceId,
            submissionId: data.submission_id,
            userId: data.user_id,
          });
          break;

        case 'image_generated':
          logBattle('info', 'image_generated', {
            battleId,
            traceId,
            submissionId: data.submission_id,
            userId: data.user_id,
            hasImageUrl: !!data.image_url,
          });
          // Update my submission with the image if it's mine
          setBattleState((prev) => {
            if (!prev || !prev.mySubmission) return prev;
            // Check if this is our submission
            if (data.submission_id === prev.mySubmission.id) {
              return {
                ...prev,
                mySubmission: {
                  ...prev.mySubmission,
                  imageUrl: data.image_url as string,
                },
              };
            }
            return prev;
          });
          break;

        case 'judging_complete':
          logBattle('info', 'judging_complete', {
            battleId,
            traceId,
            winnerId: data.winner_id,
            resultsCount: Array.isArray(data.results) ? data.results.length : 0,
          });
          setBattleState((prev) => {
            if (!prev) return null;

            // Update with winner and any results data
            const newState = {
              ...prev,
              winnerId: data.winner_id as number | null,
            };

            // If results include submission data, update submissions
            const results = data.results as Array<{
              submission_id?: number;
              user_id?: number;
              score?: number;
              criteria_scores?: Record<string, number>;
              feedback?: string;
            }>;

            if (results && Array.isArray(results)) {
              for (const result of results) {
                logBattle('debug', 'judging_result', {
                  battleId,
                  traceId,
                  submissionId: result.submission_id,
                  userId: result.user_id,
                  score: result.score,
                });
                // Update my submission if this is mine
                if (prev.mySubmission && result.submission_id === prev.mySubmission.id) {
                  newState.mySubmission = {
                    ...prev.mySubmission,
                    score: result.score,
                    criteriaScores: result.criteria_scores,
                    feedback: result.feedback,
                  };
                }
              }
            }

            return newState;
          });
          break;

        case 'state_refresh':
          logBattle('info', 'state_refresh_requested', { battleId, traceId });
          // Server is telling us to request fresh state (after judging/completion)
          if (sendRef.current) {
            sendRef.current({ type: 'request_state' });
          }
          break;

        case 'battle_complete':
          logBattle('info', 'battle_complete', {
            battleId,
            traceId,
            winnerId: data.winner_id,
          });
          onMatchCompleteRef.current?.(data.winner_id as number | null);
          break;

        case 'error':
          logBattle('error', 'server_error', {
            battleId,
            traceId,
            error: data.error,
          });
          onErrorRef.current?.(data.error || 'An error occurred');
          break;
      }
    } catch (error) {
      logBattle('error', 'message_parse_error', {
        battleId,
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [battleId, parseServerState]);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    logBattle('error', 'connection_error', {
      battleId,
      traceId: traceIdRef.current,
      error: errorMsg,
    });
    onErrorRef.current?.(errorMsg);
  }, [battleId]);

  // Handle connection established
  const handleConnected = useCallback(() => {
    logBattle('info', 'websocket_connected', {
      battleId,
      traceId: traceIdRef.current,
    });
  }, [battleId]);

  // Create custom logger for useWebSocketBase
  const battleLogger = useCallback(() => ({
    debug: (message: string, context?: Record<string, unknown>) => {
      logBattle('debug', message, { battleId, traceId: traceIdRef.current, ...context });
    },
    info: (message: string, context?: Record<string, unknown>) => {
      logBattle('info', message, { battleId, traceId: traceIdRef.current, ...context });
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      logBattle('warn', message, { battleId, traceId: traceIdRef.current, ...context });
    },
    error: (message: string, context?: Record<string, unknown>) => {
      logBattle('error', message, { battleId, traceId: traceIdRef.current, ...context });
    },
  }), [battleId]);

  // Should we auto-connect? Always for battles (connects on mount)
  const shouldConnect = !authLoading;

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send, connect, disconnect, reconnectAttempts } = useWebSocketBase({
    endpoint: `/ws/battle/${battleId}/`,
    connectionIdPrefix: `battle-${battleId}`,
    onMessage: handleMessage,
    onError: handleError,
    onConnected: handleConnected,
    autoConnect: shouldConnect,
    autoReconnect,
    requiresAuth: true,
    logger: battleLogger(),
  });

  // Store send function in ref
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (sendRef.current) {
      logBattle('debug', 'sending_typing_indicator', {
        battleId,
        traceId: traceIdRef.current,
        isTyping,
      });
      sendRef.current({ type: 'typing', is_typing: isTyping });
    }
  }, [battleId]);

  // Submit prompt
  const submitPrompt = useCallback((promptText: string): boolean => {
    const traceId = traceIdRef.current;

    logBattle('info', 'submit_prompt_start', {
      battleId,
      traceId,
      promptLength: promptText.length,
    });

    if (!isConnected || !sendRef.current) {
      logBattle('error', 'submit_prompt_failed', {
        battleId,
        traceId,
        reason: 'not_connected',
      });
      onErrorRef.current?.('Not connected to battle');
      return false;
    }

    if (!promptText.trim()) {
      logBattle('warn', 'submit_prompt_failed', {
        battleId,
        traceId,
        reason: 'empty_prompt',
      });
      onErrorRef.current?.('Prompt cannot be empty');
      return false;
    }

    const sent = sendRef.current({
      type: 'submit_prompt',
      prompt_text: promptText,
    });

    if (sent) {
      logBattle('info', 'submit_prompt_sent', {
        battleId,
        traceId,
        promptLength: promptText.length,
      });
    } else {
      logBattle('error', 'submit_prompt_error', {
        battleId,
        traceId,
        reason: 'send_failed',
      });
      onErrorRef.current?.('Failed to submit prompt');
    }

    return sent;
  }, [battleId, isConnected]);

  // Request state refresh
  const requestState = useCallback(() => {
    if (sendRef.current) {
      sendRef.current({ type: 'request_state' });
    }
  }, []);

  return {
    battleState,
    isConnected,
    isConnecting,
    opponentStatus,
    countdownValue,
    reconnectAttempts,
    sendTyping,
    submitPrompt,
    requestState,
    connect,
    disconnect,
  };
}
