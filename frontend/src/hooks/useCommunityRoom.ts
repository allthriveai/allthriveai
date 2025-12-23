/**
 * React hook for real-time community room messaging
 *
 * Features:
 * - Two-step WebSocket token exchange
 * - Heartbeat (30s ping/pong)
 * - Exponential backoff reconnection
 * - Message limit (prevents memory leaks)
 * - Race condition guard
 * - Error logging via errorHandler
 *
 * Based on existing patterns from useIntelligentChat.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl } from '@/utils/websocket';
import { logError } from '@/utils/errorHandler';
import { getConnectionToken } from '@/services/community';
import type {
  Message,
  OnlineUser,
  CommunityWebSocketEvent,
  RoomStateEvent,
  NewMessageEvent,
  TypingEvent,
  UserJoinedEvent,
  UserLeftEvent,
  MessageHistoryEvent,
  ErrorEvent,
} from '@/types/community';

// Constants per COMMUNITY_MESSAGING_PLAN.md
const MAX_MESSAGES = 100;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseCommunityRoomReturn {
  // State
  messages: Message[];
  onlineUsers: OnlineUser[];
  typingUsers: string[];
  connectionStatus: ConnectionStatus;
  error: string | null;

  // Actions
  sendMessage: (content: string, replyToId?: string) => void;
  setTyping: (isTyping: boolean) => void;
  loadMoreMessages: () => void;
  hasMoreMessages: boolean;

  // Room info
  roomInfo: {
    id: string;
    name: string;
    description: string;
    icon: string;
    memberCount: number;
  } | null;
}

export function useCommunityRoom(roomId: string | null): UseCommunityRoomReturn {
  const { isAuthenticated } = useAuth();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [roomInfo, setRoomInfo] = useState<UseCommunityRoomReturn['roomInfo']>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);

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

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!roomId || !isAuthenticated || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Step 1: Get connection token
      const token = await getConnectionToken();

      // Step 2: Build WebSocket URL with token
      const wsUrl = buildWebSocketUrl(`/ws/community/room/${roomId}/`, {
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
          const data = JSON.parse(event.data) as CommunityWebSocketEvent;

          switch (data.event) {
            case 'room_state': {
              const stateEvent = data as RoomStateEvent;
              setMessages(stateEvent.messages);
              setOnlineUsers(stateEvent.onlineUsers);
              setRoomInfo({
                id: stateEvent.room.id,
                name: stateEvent.room.name,
                description: stateEvent.room.description,
                icon: stateEvent.room.icon,
                memberCount: stateEvent.room.memberCount,
              });
              break;
            }

            case 'new_message': {
              const msgEvent = data as NewMessageEvent;
              setMessages((prev) => {
                const newMessages = [...prev, msgEvent.message];
                // Limit messages to prevent memory leaks
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

            case 'user_joined': {
              const joinEvent = data as UserJoinedEvent;
              setOnlineUsers((prev) => [
                ...prev.filter((u) => u.userId !== joinEvent.userId),
                { userId: joinEvent.userId, username: joinEvent.username },
              ]);
              break;
            }

            case 'user_left': {
              const leftEvent = data as UserLeftEvent;
              setOnlineUsers((prev) => prev.filter((u) => u.userId !== leftEvent.userId));
              setTypingUsers((prev) => {
                const user = onlineUsers.find((u) => u.userId === leftEvent.userId);
                return user ? prev.filter((u) => u !== user.username) : prev;
              });
              break;
            }

            case 'message_history': {
              const historyEvent = data as MessageHistoryEvent;
              setMessages((prev) => [...historyEvent.messages, ...prev].slice(-MAX_MESSAGES));
              setHasMoreMessages(historyEvent.hasMore);
              cursorRef.current = historyEvent.cursor;
              break;
            }

            case 'error': {
              const errorEvent = data as ErrorEvent;
              setError(errorEvent.message);
              logError('CommunityRoom.wsMessage', new Error(errorEvent.message), { roomId });
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
          logError('CommunityRoom.parseMessage', e as Error, { roomId });
        }
      };

      ws.onerror = (event) => {
        logError('CommunityRoom.wsError', new Error('WebSocket error'), { roomId, event });
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
      logError('CommunityRoom.connect', e as Error, { roomId });
    }
  }, [roomId, isAuthenticated, cleanup, onlineUsers]);

  // Send message
  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected');
        return;
      }

      const message = {
        type: 'send_message',
        content,
        ...(replyToId && { reply_to_id: replyToId }),
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

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !cursorRef.current) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'request_history',
        cursor: cursorRef.current,
        limit: 50,
      })
    );
  }, []);

  // Connect when roomId changes
  useEffect(() => {
    if (roomId && isAuthenticated) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [roomId, isAuthenticated, connect, cleanup]);

  // Reset state when room changes
  useEffect(() => {
    setMessages([]);
    setOnlineUsers([]);
    setTypingUsers([]);
    setError(null);
    setHasMoreMessages(false);
    setRoomInfo(null);
    cursorRef.current = null;
  }, [roomId]);

  return {
    messages,
    onlineUsers,
    typingUsers,
    connectionStatus,
    error,
    sendMessage,
    setTyping,
    loadMoreMessages,
    hasMoreMessages,
    roomInfo,
  };
}
