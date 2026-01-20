/**
 * useEchoChat Hook
 * US-017: WebSocket hook for Echo Creator Coach chat
 *
 * Manages WebSocket connection for AI-powered content brainstorming
 * with streaming responses, tool execution, and idea suggestions.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';
import type { ChatMessage } from '@/types/chat';
import type { SuggestedIdea, Platform } from '@/types/contentEngine';

/**
 * Idea data structure from WebSocket events
 *
 * NOTE: Uses snake_case for field names because WebSocket messages
 * bypass the axios API interceptor that normally converts snake_case ↔ camelCase.
 */
interface IdeaData {
  id?: number;
  idea_id?: number;
  success?: boolean;
  title?: string;
  description?: string;
  hook?: string;
  pillar_id?: number;
  pillar_name?: string;
  platforms?: Platform[];
  message?: string;
  error?: string;
}

/**
 * WebSocket Message Interface for Echo events
 *
 * NOTE: Uses snake_case for field names because WebSocket messages
 * bypass the axios API interceptor that normally converts snake_case ↔ camelCase.
 */
interface EchoWebSocketMessage {
  event: string;
  conversation_id?: string;
  task_id?: string;
  chunk?: string;
  error?: string;
  timestamp?: string;
  message?: string;
  // Tool-related fields
  tool?: string;
  // idea_suggested events use 'idea' field, tool_end uses 'output'
  idea?: IdeaData;
  output?: IdeaData;
}

/**
 * Chat message with Echo-specific metadata
 */
export interface EchoChatMessage extends Omit<ChatMessage, 'metadata'> {
  metadata?: {
    type?: 'text' | 'generating' | 'idea_suggestion' | 'error' | 'system';
    suggestedIdea?: SuggestedIdea;
    toolName?: string;
  };
}

interface UseEchoChatOptions {
  sessionId: string;
  onError?: (error: string) => void;
  onIdeaSaved?: (ideaId: number, title: string) => void;
  autoReconnect?: boolean;
}

interface UseEchoChatReturn {
  messages: EchoChatMessage[];
  sendMessage: (content: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  isTyping: boolean;
  suggestedIdea: SuggestedIdea | null;
  currentTool: string | null;
  reconnectAttempts: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearMessages: () => void;
  clearSuggestedIdea: () => void;
}

const MAX_MESSAGE_LENGTH = 10000;
const RESPONSE_TIMEOUT_MS = 60000;
const MAX_MESSAGES = 100;

export function useEchoChat({
  sessionId,
  onError,
  onIdeaSaved,
  autoReconnect = true,
}: UseEchoChatOptions): UseEchoChatReturn {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<EchoChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedIdea, setSuggestedIdea] = useState<SuggestedIdea | null>(null);
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const currentMessageRef = useRef<string>('');
  const currentMessageIdRef = useRef<string>('');
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendRef = useRef<((message: unknown) => boolean) | null>(null);
  const pendingSendQueueRef = useRef<string[]>([]);

  // Callback refs to avoid stale closures
  const onErrorRef = useRef(onError);
  const onIdeaSavedRef = useRef(onIdeaSaved);

  useEffect(() => {
    onErrorRef.current = onError;
    onIdeaSavedRef.current = onIdeaSaved;
  }, [onError, onIdeaSaved]);

  // Helper to clear the response timeout
  const clearResponseTimeout = useCallback(() => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }, []);

  // Helper to start the response timeout
  const startResponseTimeout = useCallback(() => {
    clearResponseTimeout();
    responseTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onErrorRef.current?.('Response timed out. Please try again.');
    }, RESPONSE_TIMEOUT_MS);
  }, [clearResponseTimeout]);

  // Helper to add a message with deduplication
  const addMessageWithDedup = useCallback((newMessage: EchoChatMessage) => {
    if (seenMessageIdsRef.current.has(newMessage.id)) {
      return;
    }
    seenMessageIdsRef.current.add(newMessage.id);
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMessage.id)) {
        return prev;
      }
      const newMessages = [...prev, newMessage];
      return newMessages.slice(-MAX_MESSAGES);
    });
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (rawData: unknown) => {
      try {
        const data = rawData as EchoWebSocketMessage;

        // Ignore pong responses
        if (data.event === 'pong') {
          return;
        }

        switch (data.event) {
          case 'connected':
            // Connection confirmed
            break;

          case 'task_queued':
          case 'processing_started':
            setIsTyping(true);
            startResponseTimeout();
            currentMessageIdRef.current = `msg-${Date.now()}`;
            currentMessageRef.current = '';
            break;

          case 'chunk':
            // Reset timeout since we're receiving data
            startResponseTimeout();
            if (data.chunk) {
              if (!currentMessageIdRef.current) {
                currentMessageIdRef.current = `msg-${Date.now()}`;
                currentMessageRef.current = '';
              }
              currentMessageRef.current += data.chunk;

              setMessages((prev) => {
                const filteredPrev = prev.filter(
                  (m) => m.metadata?.type !== 'generating'
                );
                const existingIndex = filteredPrev.findIndex(
                  (m) => m.id === currentMessageIdRef.current
                );
                if (existingIndex >= 0) {
                  const updated = [...filteredPrev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    content: currentMessageRef.current,
                  };
                  return updated;
                } else {
                  const newMessages = [
                    ...filteredPrev,
                    {
                      id: currentMessageIdRef.current,
                      content: currentMessageRef.current,
                      sender: 'assistant' as const,
                      timestamp: new Date(),
                    },
                  ];
                  return newMessages.slice(-MAX_MESSAGES);
                }
              });
            }
            break;

          case 'tool_start':
            startResponseTimeout();
            if (data.tool) {
              setCurrentTool(data.tool);
            }
            break;

          case 'tool_end':
            startResponseTimeout();
            setCurrentTool(null);

            // Check for save_idea tool completion
            if (
              data.tool === 'save_idea' &&
              data.output?.success &&
              data.output?.idea_id
            ) {
              onIdeaSavedRef.current?.(
                data.output.idea_id,
                data.output.title || 'New Idea'
              );
              // Clear suggested idea since it was saved
              setSuggestedIdea(null);
            }
            break;

          case 'idea_suggested': {
            // Echo is suggesting an idea to save
            // Backend sends 'idea' field, but also support 'output' for compatibility
            const ideaData = data.idea || data.output;
            if (ideaData) {
              const idea: SuggestedIdea = {
                title: ideaData.title || '',
                description: ideaData.description,
                hook: ideaData.hook,
                pillarId: ideaData.pillar_id,
                pillarName: ideaData.pillar_name,
                platforms: ideaData.platforms,
              };
              setSuggestedIdea(idea);

              // Also add as a special message in chat
              const ideaMessageId = `idea-suggestion-${Date.now()}`;
              addMessageWithDedup({
                id: ideaMessageId,
                content: '',
                sender: 'assistant',
                timestamp: new Date(),
                metadata: {
                  type: 'idea_suggestion',
                  suggestedIdea: idea,
                },
              });
            } else {
              // Neither 'idea' nor 'output' field exists
              console.warn('idea_suggested event missing idea/output data:', data);
            }
            break;
          }

          case 'complete':
          case 'completed':
            clearResponseTimeout();
            setIsTyping(false);
            currentMessageRef.current = '';
            currentMessageIdRef.current = '';
            break;

          case 'error': {
            clearResponseTimeout();
            setIsTyping(false);
            currentMessageRef.current = '';
            currentMessageIdRef.current = '';

            // Add error as system message
            const errorMessageId = `error-${Date.now()}`;
            addMessageWithDedup({
              id: errorMessageId,
              content: data.error || 'An error occurred',
              sender: 'assistant',
              timestamp: new Date(),
              metadata: {
                type: 'error',
              },
            });

            onErrorRef.current?.(data.error || 'An error occurred');
            break;
          }

          default:
            // Unknown event, ignore
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [startResponseTimeout, clearResponseTimeout, addMessageWithDedup]
  );

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    onErrorRef.current?.(errorMsg);
  }, []);

  // Handle connected - drain any queued outbound messages
  const handleConnected = useCallback(() => {
    const sendFn = sendRef.current;
    if (!sendFn) return;
    const q = pendingSendQueueRef.current;
    while (q.length) {
      const content = q.shift()!;
      const sent = sendFn({ message: content });
      if (!sent) {
        q.unshift(content);
        break;
      }
    }
  }, []);

  // Handle disconnect - clear partial messages
  const handleDisconnected = useCallback(() => {
    setIsTyping(false);
    currentMessageRef.current = '';
    currentMessageIdRef.current = '';
  }, []);

  // Should we auto-connect?
  const shouldConnect = !authLoading && isAuthenticated;

  // Use the base WebSocket hook
  // Connect to ws://localhost:8000/ws/chat/{sessionId}/
  // Note: sessionId should already be prefixed with 'echo-' by the caller
  const {
    isConnected,
    isConnecting,
    send,
    connect,
    disconnect,
    reconnectAttempts,
  } = useWebSocketBase({
    endpoint: `/ws/chat/${sessionId}/`,
    connectionIdPrefix: sessionId,
    onMessage: handleMessage,
    onConnected: handleConnected,
    onError: handleError,
    onDisconnected: handleDisconnected,
    autoConnect: shouldConnect,
    autoReconnect,
    requiresAuth: true,
  });

  // Store send function in ref
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Send message through WebSocket
  const sendMessage = useCallback(
    (content: string) => {
      // Validate message length
      if (content.length > MAX_MESSAGE_LENGTH) {
        onErrorRef.current?.(
          `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
        );
        return;
      }

      // Generate a unique ID for this message
      const messageId = `user-${Date.now()}-${content.slice(0, 20).replace(/\s/g, '')}`;

      // Check for duplicate (rapid double-click prevention)
      if (seenMessageIdsRef.current.has(messageId)) {
        return;
      }

      // Add user message to chat immediately
      const userMessage: EchoChatMessage = {
        id: messageId,
        content,
        sender: 'user',
        timestamp: new Date(),
      };
      addMessageWithDedup(userMessage);

      // Check WebSocket connection
      if (!isConnected || !sendRef.current) {
        pendingSendQueueRef.current.push(content);
        connect();
        return;
      }

      // Send to WebSocket
      const sent = sendRef.current({ message: content });
      if (!sent) {
        onErrorRef.current?.('Failed to send message');
      }
    },
    [isConnected, connect, addMessageWithDedup]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    seenMessageIdsRef.current.clear();
    setSuggestedIdea(null);
  }, []);

  // Clear suggested idea
  const clearSuggestedIdea = useCallback(() => {
    setSuggestedIdea(null);
  }, []);

  // Limit dedup Set size
  useEffect(() => {
    const MAX_SEEN_IDS = 500;
    if (seenMessageIdsRef.current.size > MAX_SEEN_IDS) {
      const idsArray = Array.from(seenMessageIdsRef.current);
      seenMessageIdsRef.current = new Set(idsArray.slice(-MAX_SEEN_IDS));
    }
  }, [messages]);

  // Clear dedup Set on unmount
  useEffect(() => {
    return () => {
      seenMessageIdsRef.current.clear();
      clearResponseTimeout();
    };
  }, [clearResponseTimeout]);

  return {
    messages,
    sendMessage,
    isConnected,
    isConnecting,
    isTyping,
    suggestedIdea,
    currentTool,
    reconnectAttempts,
    connect,
    disconnect,
    clearMessages,
    clearSuggestedIdea,
  };
}
