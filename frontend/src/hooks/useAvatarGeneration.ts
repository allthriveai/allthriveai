/**
 * Hook for avatar generation with WebSocket streaming.
 *
 * Manages the avatar generation flow:
 * 1. Create a session via REST API
 * 2. Connect to WebSocket for streaming generation
 * 3. Send prompts and receive generated images
 * 4. Accept/refine iterations
 * 5. Save final avatar
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';
import { sessionService } from '@/services/avatarService';
import type {
  AvatarGenerationSession,
  AvatarGenerationIteration,
  CreationMode,
  AvatarWebSocketMessage,
  UserAvatar,
} from '@/types/avatar';

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

  // Track the current conversation ID for WebSocket endpoint
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Use refs for callbacks to ensure handlers always have latest versions
  const onErrorRef = useRef(onError);
  const onAvatarGeneratedRef = useRef(onAvatarGenerated);
  const onAvatarSavedRef = useRef(onAvatarSaved);
  const onAchievementUnlockedRef = useRef(onAchievementUnlocked);
  const sessionRef = useRef<AvatarGenerationSession | null>(null);
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);

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

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    try {
      const data = rawData as AvatarWebSocketMessage;

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

            onAvatarGeneratedRef.current?.(iteration);
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
    } catch {
      // Parse error - message format unexpected
    }
  }, []);

  // Handle connection established
  const handleConnected = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isConnected: true,
      isConnecting: false,
    }));

    // Check if session status changed while we were disconnected
    const currentSession = sessionRef.current;
    if (currentSession) {
      try {
        const refreshedSession = await sessionService.getSession(currentSession.id);
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
      } catch {
        // Session refresh failure - not critical
      }
    }
  }, []);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    setState((prev) => ({
      ...prev,
      isConnecting: false,
      error: errorMsg,
    }));
    onErrorRef.current?.(errorMsg);
  }, []);

  // Handle disconnect
  const handleDisconnected = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isGenerating: false,
    }));
  }, []);

  // Should we connect? Only if we have a conversationId
  const shouldConnect = isAuthenticated && !authLoading && !!conversationId;

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send, disconnect: wsDisconnect } = useWebSocketBase({
    endpoint: conversationId ? `/ws/chat/${conversationId}/` : '/ws/chat/placeholder/',
    connectionIdPrefix: 'avatar',
    onMessage: handleMessage,
    onConnected: handleConnected,
    onError: handleError,
    onDisconnected: handleDisconnected,
    autoConnect: shouldConnect,
    requiresAuth: true,
    maxReconnectAttempts: 3,
    maxReconnectDelay: 10000,
    connectionTimeout: 15000,
  });

  // Store send function in ref
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Sync WebSocket state with local state
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isConnected,
      isConnecting,
    }));
  }, [isConnected, isConnecting]);

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
        const existingSession = await sessionService.getActiveSession();

        if (existingSession && existingSession.status === 'generating') {
          // Reconnect to the in-progress session's WebSocket
          setState((prev) => ({
            ...prev,
            session: existingSession,
            currentIteration: null,
          }));
          setConversationId(existingSession.conversationId);
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

        // Set conversation ID to trigger WebSocket connection
        setConversationId(session.conversationId);

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
    []
  );

  // Send a prompt to generate an avatar
  const generateAvatar = useCallback(
    (prompt: string, referenceImageUrl?: string) => {
      if (!isConnected || !sendRef.current) {
        onErrorRef.current?.('Not connected. Please try again.');
        return;
      }

      const currentSession = sessionRef.current;
      if (!currentSession) {
        onErrorRef.current?.('No active session');
        return;
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const sent = sendRef.current({
        message: prompt,
        session_id: currentSession.id,
        reference_image_url: referenceImageUrl,
      });

      if (!sent) {
        setState((prev) => ({ ...prev, isGenerating: false }));
        onErrorRef.current?.('Failed to send prompt');
      }
    },
    [isConnected]
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

      // Disconnect WebSocket
      wsDisconnect();
      setConversationId(null);
    } catch {
      // Abandon failure - session will be cleaned up by backend
    }
  }, [wsDisconnect]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    wsDisconnect();
    setConversationId(null);
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isGenerating: false,
    }));
  }, [wsDisconnect]);

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
