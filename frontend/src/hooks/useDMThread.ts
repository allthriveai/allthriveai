/**
 * React hook for real-time DM messaging
 *
 * Features:
 * - Two-step WebSocket token exchange
 * - Heartbeat (30s ping/pong)
 * - Exponential backoff reconnection
 * - Message limit (prevents memory leaks)
 * - Race condition guard
 *
 * Based on useCommunityRoom.ts patterns
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl } from '@/utils/websocket';
import { logError } from '@/utils/errorHandler';
import { getConnectionToken, getDMThread } from '@/services/community';
import type { Message, DirectMessageThread } from '@/types/community';

// Constants
const MAX_MESSAGES = 100;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface DMWebSocketEvent {
  event: string;
  timestamp?: string;
}

interface NewMessageEvent extends DMWebSocketEvent {
  event: 'new_message';
  message: Message;
}

interface TypingEvent extends DMWebSocketEvent {
  event: 'typing';
  userId: string;
  username: string;
  isTyping: boolean;
}

interface ErrorEvent extends DMWebSocketEvent {
  event: 'error';
  message: string;
}

export interface UseDMThreadReturn {
  // State
  messages: Message[];
  typingUsers: string[];
  connectionStatus: ConnectionStatus;
  error: string | null;
  threadInfo: DirectMessageThread | null;

  // Actions
  sendMessage: (content: string) => void;
  setTyping: (isTyping: boolean) => void;
}

export function useDMThread(threadId: string | null): UseDMThreadReturn {
  const { isAuthenticated } = useAuth();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [threadInfo, setThreadInfo] = useState<DirectMessageThread | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  // Load thread info and messages via REST API first
  const loadThreadInfo = useCallback(async () => {
    if (!threadId) return;

    try {
      const thread = await getDMThread(threadId);
      setThreadInfo(thread);
    } catch (e) {
      logError('DMThread.loadThreadInfo', e as Error, { threadId });
    }
  }, [threadId]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!threadId || !isAuthenticated || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Step 1: Get connection token
      const token = await getConnectionToken();

      // Step 2: Build WebSocket URL with token
      const wsUrl = buildWebSocketUrl(`/ws/community/dm/${threadId}/`, {
        connection_token: token,
      });

      // Step 3: Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;

        // Start heartbeat
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DMWebSocketEvent;

          switch (data.event) {
            case 'new_message': {
              const msgEvent = data as NewMessageEvent;
              setMessages((prev) => {
                const newMessages = [...prev, msgEvent.message];
                return newMessages.slice(-MAX_MESSAGES);
              });
              break;
            }

            case 'typing': {
              const typingEvent = data as TypingEvent;
              setTypingUsers((prev) => {
                if (typingEvent.isTyping) {
                  return prev.includes(typingEvent.username)
                    ? prev
                    : [...prev, typingEvent.username];
                } else {
                  return prev.filter((u) => u !== typingEvent.username);
                }
              });
              break;
            }

            case 'error': {
              const errorEvent = data as ErrorEvent;
              setError(errorEvent.message);
              logError('DMThread.wsMessage', new Error(errorEvent.message), { threadId });
              break;
            }

            case 'pong':
              // Heartbeat response - no action needed
              break;

            default:
              // Unknown event type
              break;
          }
        } catch (e) {
          logError('DMThread.parseMessage', e as Error, { threadId });
        }
      };

      ws.onerror = (event) => {
        logError('DMThread.wsError', new Error('WebSocket error'), { threadId, event });
        setError('Connection error');
      };

      ws.onclose = (event) => {
        cleanup();
        setConnectionStatus('disconnected');
        isConnectingRef.current = false;

        // Attempt reconnection with exponential backoff
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionStatus('error');
          setError('Failed to connect after multiple attempts');
        }
      };
    } catch (e) {
      isConnectingRef.current = false;
      setConnectionStatus('error');
      setError('Failed to connect');
      logError('DMThread.connect', e as Error, { threadId });
    }
  }, [threadId, isAuthenticated, cleanup]);

  // Send message
  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected');
        return;
      }

      const message = {
        type: 'send_message',
        content,
      };

      wsRef.current.send(JSON.stringify(message));
    },
    []
  );

  // Set typing indicator
  const setTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
      })
    );
  }, []);

  // Load thread info and connect when threadId changes
  useEffect(() => {
    if (threadId && isAuthenticated) {
      loadThreadInfo();
      connect();
    }

    return () => {
      cleanup();
    };
  }, [threadId, isAuthenticated, connect, cleanup, loadThreadInfo]);

  // Reset state when thread changes
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    setError(null);
    setThreadInfo(null);
  }, [threadId]);

  return {
    messages,
    typingUsers,
    connectionStatus,
    error,
    threadInfo,
    sendMessage,
    setTyping,
  };
}
