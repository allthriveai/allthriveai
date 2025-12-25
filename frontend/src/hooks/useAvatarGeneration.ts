/**
 * Hook for avatar generation with WebSocket streaming.
 *
 * Manages the avatar generation flow:
 * 1. Create a session via REST API
 * 2. Connect to WebSocket for streaming generation
 * 3. Send prompts and receive generated images
 * 4. Accept/refine iterations
 * 5. Save final avatar
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, logWebSocketUrl } from '@/utils/websocket';
import { api } from '@/services/api';
import { sessionService } from '@/services/avatarService';
import type {
  AvatarGenerationSession,
  AvatarGenerationIteration,
  CreationMode,
  AvatarWebSocketMessage,
  UserAvatar,
} from '@/types/avatar';

// Constants
const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;
const CONNECTION_TIMEOUT = 15000;
const HEARTBEAT_INTERVAL = 30000;

export interface UseAvatarGenerationOptions {
  onError?: (error: string) => void;
  onAvatarGenerated?: (iteration: AvatarGenerationIteration) => void;
  onAvatarSaved?: (avatar: UserAvatar) => void;
  onAchievementUnlocked?: (achievementKey: string) => void;
}

export interface AvatarGenerationState {
  session: AvatarGenerationSession | null;
  currentIteration: AvatarGenerationIteration | null;
  isConnected: boolean;
  isConnecting: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
}

export function useAvatarGeneration({
  onError,
  onAvatarGenerated,
  onAvatarSaved,
  onAchievementUnlocked,
}: UseAvatarGenerationOptions = {}) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [state, setState] = useState<AvatarGenerationState>({
    session: null,
    currentIteration: null,
    isConnected: false,
    isConnecting: false,
    isGenerating: false,
    isSaving: false,
    error: null,
  });

  // Refs for WebSocket management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  // Use ref for session to avoid stale closures in reconnection logic
  const sessionRef = useRef<AvatarGenerationSession | null>(null);

  // Use refs for callbacks to ensure WebSocket handlers always have latest versions
  const onErrorRef = useRef(onError);
  const onAvatarGeneratedRef = useRef(onAvatarGenerated);
  const onAvatarSavedRef = useRef(onAvatarSaved);
  const onAchievementUnlockedRef = useRef(onAchievementUnlocked);

  // Keep refs in sync with props
  useEffect(() => {
    onErrorRef.current = onError;
    onAvatarGeneratedRef.current = onAvatarGenerated;
    onAvatarSavedRef.current = onAvatarSaved;
    onAchievementUnlockedRef.current = onAchievementUnlocked;
  }, [onError, onAvatarGenerated, onAvatarSaved, onAchievementUnlocked]);

  // Keep sessionRef in sync with state
  useEffect(() => {
    sessionRef.current = state.session;
  }, [state.session]);

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
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Connect to WebSocket for a session
  // Returns a promise that resolves when connected or rejects on error
  const connectWebSocket = useCallback(
    (session: AvatarGenerationSession): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!isAuthenticated || authLoading) {
          reject(new Error('Not authenticated'));
          return;
        }

        // Close existing connection
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        clearTimers();
        setState((prev) => ({ ...prev, isConnecting: true, error: null }));

        // Fetch connection token using api service
        api
          .post<{ connectionToken: string }>('/auth/ws-connection-token/', {
            connectionId: `ws-${session.conversationId}-${Date.now()}`,
          })
          .then((response) => {
            const connectionToken = response.data.connectionToken;

            // Connect with token - use conversationId which already has avatar- prefix
            const wsUrl = buildWebSocketUrl(`/ws/chat/${session.conversationId}/`, {
              connection_token: connectionToken,
            });

            logWebSocketUrl(wsUrl, '[Avatar WebSocket] Creating connection');

            const ws = new WebSocket(wsUrl);

            // Connection timeout
            connectionTimeoutRef.current = setTimeout(() => {
              if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                setState((prev) => ({
                  ...prev,
                  isConnecting: false,
                  error: 'Connection timeout',
                }));
                onErrorRef.current?.('Connection timeout. Please try again.');
                reject(new Error('Connection timeout'));
              }
            }, CONNECTION_TIMEOUT);

            ws.onopen = async () => {
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
              }
              setState((prev) => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
              }));
              reconnectAttemptsRef.current = 0;
              startHeartbeat();

              // Check if session status changed while we were disconnected
              // (e.g., task completed but we missed the WebSocket event)
              try {
                const refreshedSession = await sessionService.getSession(session.id);
                if (refreshedSession.status === 'ready' && refreshedSession.iterations.length > 0) {
                  const latestIteration = refreshedSession.iterations[refreshedSession.iterations.length - 1];
                  setState((prev) => ({
                    ...prev,
                    session: refreshedSession,
                    currentIteration: latestIteration,
                    isGenerating: false,
                  }));
                  onAvatarGeneratedRef.current?.(latestIteration);
                }
              } catch (e) {
                console.warn('Failed to refresh session status:', e);
              }

              resolve(); // Resolve when connected
            };

            ws.onmessage = (event) => {
              try {
                const data: AvatarWebSocketMessage = JSON.parse(event.data);

                // Debug logging for avatar WebSocket messages
                console.log('[Avatar WS] Received message:', data.event, data);

                if (data.event === 'pong') return;

                switch (data.event) {
                  case 'connected':
                    // Connection confirmed
                    break;

                  case 'avatar_task_queued':
                    setState((prev) => ({ ...prev, isGenerating: true }));
                    break;

                  case 'avatar_generating':
                    setState((prev) => ({ ...prev, isGenerating: true }));
                    break;

                  case 'avatar_generated':
                    // New iteration generated
                    console.log('[Avatar WS] avatar_generated:', {
                      imageUrl: data.imageUrl,
                      iterationId: data.iterationId,
                      hasCallback: !!onAvatarGeneratedRef.current,
                    });
                    if (data.imageUrl && data.iterationId) {
                      const iteration: AvatarGenerationIteration = {
                        id: data.iterationId,
                        prompt: '', // Will be filled from session refresh
                        imageUrl: data.imageUrl,
                        order: (data.iterationNumber || 1) - 1,
                        isSelected: false,
                        generationTimeMs: null,
                        createdAt: new Date().toISOString(),
                      };

                      setState((prev) => ({
                        ...prev,
                        currentIteration: iteration,
                        isGenerating: false,
                        session: prev.session
                          ? {
                              ...prev.session,
                              iterations: [...prev.session.iterations, iteration],
                              status: 'ready',
                            }
                          : null,
                      }));

                      console.log('[Avatar WS] Calling onAvatarGenerated callback');
                      onAvatarGeneratedRef.current?.(iteration);
                      console.log('[Avatar WS] Callback called successfully');
                    } else {
                      console.warn('[Avatar WS] Missing imageUrl or iterationId, skipping callback');
                    }
                    break;

                  case 'avatar_error':
                    setState((prev) => ({
                      ...prev,
                      isGenerating: false,
                      error: data.error || 'Generation failed',
                    }));
                    onErrorRef.current?.(data.error || 'Generation failed. Please try again.');
                    break;

                  case 'error':
                    setState((prev) => ({
                      ...prev,
                      isGenerating: false,
                      error: data.error || 'An error occurred',
                    }));
                    onErrorRef.current?.(data.error || 'An error occurred');
                    break;

                  default:
                    break;
                }
              } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
              }
            };

            ws.onerror = (error) => {
              console.error('Avatar WebSocket error:', error);
              setState((prev) => ({
                ...prev,
                isConnected: false,
                isConnecting: false,
              }));
              reject(new Error('WebSocket error'));
            };

            ws.onclose = () => {
              setState((prev) => ({
                ...prev,
                isConnected: false,
                isConnecting: false,
                isGenerating: false,
              }));
              clearTimers();

              // Auto-reconnect if not intentional - use ref to avoid stale closure
              if (
                !intentionalCloseRef.current &&
                reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
              ) {
                const delay = Math.min(
                  INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
                  MAX_RECONNECT_DELAY
                );
                reconnectTimeoutRef.current = setTimeout(() => {
                  reconnectAttemptsRef.current += 1;
                  // Use ref instead of state to avoid stale closure
                  const currentSession = sessionRef.current;
                  if (currentSession) {
                    connectWebSocket(currentSession);
                  }
                }, delay);
              }
            };

            wsRef.current = ws;
          })
          .catch((error) => {
            console.error('[Avatar WebSocket] Failed to fetch connection token:', error);
            setState((prev) => ({
              ...prev,
              isConnecting: false,
              error: 'Failed to connect. Please try again.',
            }));
            onErrorRef.current?.('Failed to connect. Please try again.');
            reject(error);
          });
      });
    },
    [isAuthenticated, authLoading, clearTimers, startHeartbeat]
  );

  // Start a new avatar generation session (or resume existing one)
  const startSession = useCallback(
    async (
      creationMode: CreationMode,
      templateUsed?: string,
      referenceImageUrl?: string
    ) => {
      try {
        setState((prev) => ({ ...prev, error: null, isConnecting: true }));

        // First check if there's an existing "generating" session we should reconnect to
        // (Don't reuse "ready" sessions - user may want a new template)
        const existingSession = await sessionService.getActiveSession();

        if (existingSession && existingSession.status === 'generating') {
          // Reconnect to the in-progress session's WebSocket
          setState((prev) => ({
            ...prev,
            session: existingSession,
            currentIteration: null,
          }));
          await connectWebSocket(existingSession);
          return existingSession;
        }

        // No active session, create a new one
        const session = await sessionService.startSession({
          creationMode,
          templateUsed,
          referenceImageUrl,
        });

        setState((prev) => ({
          ...prev,
          session,
          currentIteration: null,
        }));

        // Connect WebSocket for this session
        await connectWebSocket(session);

        return session;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to start session';
        setState((prev) => ({
          ...prev,
          error: message,
          isConnecting: false,
        }));
        onErrorRef.current?.(message);
        return null;
      }
    },
    [connectWebSocket]
  );

  // Send a prompt to generate an avatar
  const generateAvatar = useCallback(
    (prompt: string, referenceImageUrl?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        onErrorRef.current?.('Not connected. Please try again.');
        return;
      }

      const currentSession = sessionRef.current;
      if (!currentSession) {
        onErrorRef.current?.('No active session');
        return;
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      try {
        wsRef.current.send(
          JSON.stringify({
            message: prompt,
            session_id: currentSession.id,
            reference_image_url: referenceImageUrl,
          })
        );
      } catch (error) {
        console.error('Failed to send message:', error);
        setState((prev) => ({ ...prev, isGenerating: false }));
        onErrorRef.current?.('Failed to send prompt');
      }
    },
    []
  );

  // Accept an iteration and save it as the user's avatar
  const acceptIteration = useCallback(
    async (iterationId: number) => {
      const currentSession = sessionRef.current;
      if (!currentSession) {
        onErrorRef.current?.('No active session');
        return null;
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const updatedSession = await sessionService.acceptIteration(
          currentSession.id,
          iterationId
        );

        setState((prev) => ({
          ...prev,
          session: updatedSession,
          isSaving: false,
        }));

        if (updatedSession.savedAvatar) {
          onAvatarSavedRef.current?.(updatedSession.savedAvatar);

          // Check if this is the user's first AI avatar (for achievement)
          if (user && (user.aiAvatarsCreated === 0 || user.aiAvatarsCreated === 1)) {
            onAchievementUnlockedRef.current?.('prompt_engineer');
          }
        }

        return updatedSession.savedAvatar;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to save avatar';
        setState((prev) => ({ ...prev, error: message, isSaving: false }));
        onErrorRef.current?.(message);
        return null;
      }
    },
    [user]
  );

  // Abandon the current session
  const abandonSession = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    try {
      await sessionService.abandonSession(currentSession.id);
      setState((prev) => ({
        ...prev,
        session: null,
        currentIteration: null,
      }));

      // Close WebSocket
      intentionalCloseRef.current = true;
      wsRef.current?.close();
    } catch (error) {
      console.error('Failed to abandon session:', error);
    }
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isGenerating: false,
    }));
  }, [clearTimers]);

  // Reset state
  const reset = useCallback(() => {
    disconnect();
    setState({
      session: null,
      currentIteration: null,
      isConnected: false,
      isConnecting: false,
      isGenerating: false,
      isSaving: false,
      error: null,
    });
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    // State
    session: state.session,
    currentIteration: state.currentIteration,
    iterations: state.session?.iterations || [],
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isGenerating: state.isGenerating,
    isSaving: state.isSaving,
    error: state.error,

    // Actions
    startSession,
    generateAvatar,
    acceptIteration,
    abandonSession,
    disconnect,
    reset,

    // Helper to check if ready to generate
    isReady: state.isConnected && state.session && !state.isGenerating,
  };
}
