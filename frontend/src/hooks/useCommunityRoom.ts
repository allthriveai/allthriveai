/**
 * React hook for real-time community room messaging
 *
 * Features:
 * - Two-step WebSocket token exchange (via useWebSocketBase)
 * - Heartbeat (30s ping/pong)
 * - Exponential backoff reconnection
 * - Message limit (prevents memory leaks)
 * - Race condition guard
 * - Error logging via errorHandler
 *
 * Refactored to use useWebSocketBase for connection management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';
import { logError } from '@/utils/errorHandler';
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
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [roomInfo, setRoomInfo] = useState<UseCommunityRoomReturn['roomInfo']>(null);

  // Refs
  const cursorRef = useRef<string | null>(null);
  const onlineUsersRef = useRef<OnlineUser[]>([]);

  // Keep online users ref in sync for closure access
  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  // Handle incoming messages
  const handleMessage = useCallback((rawData: unknown) => {
    try {
      const data = rawData as CommunityWebSocketEvent;

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
            const user = onlineUsersRef.current.find((u) => u.userId === leftEvent.userId);
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
          // Heartbeat response - handled by base hook
          break;

        default:
          // Unknown event type
          break;
      }
    } catch (e) {
      logError('CommunityRoom.parseMessage', e as Error, { roomId });
    }
  }, [roomId]);

  // Handle connection errors
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    logError('CommunityRoom.wsError', new Error(errorMsg), { roomId });
  }, [roomId]);

  // Handle disconnect
  const handleDisconnected = useCallback(() => {
    // State will be reset when room changes via separate useEffect
  }, []);

  // Should we connect?
  const shouldConnect = isAuthenticated && !!roomId;

  // Use the base WebSocket hook
  const { isConnected, isConnecting, send, reconnectAttempts } = useWebSocketBase({
    endpoint: `/ws/community/room/${roomId}/`,
    connectionIdPrefix: 'community-room',
    onMessage: handleMessage,
    onError: handleError,
    onDisconnected: handleDisconnected,
    autoConnect: shouldConnect,
    requiresAuth: true,
  });

  // Derive connection status
  const connectionStatus: ConnectionStatus = isConnected
    ? 'connected'
    : isConnecting
      ? 'connecting'
      : reconnectAttempts >= 5
        ? 'error'
        : 'disconnected';

  // Send message
  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      if (!isConnected) {
        setError('Not connected');
        return;
      }

      const message = {
        type: 'send_message',
        content,
        ...(replyToId && { reply_to_id: replyToId }),
      };

      send(message);
    },
    [isConnected, send]
  );

  // Set typing indicator
  const setTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!isConnected) {
        return;
      }

      send({
        type: 'typing',
        is_typing: isTyping,
      });
    },
    [isConnected, send]
  );

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(() => {
    if (!isConnected || !cursorRef.current) {
      return;
    }

    send({
      type: 'request_history',
      cursor: cursorRef.current,
      limit: 50,
    });
  }, [isConnected, send]);

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
    setTyping: setTypingIndicator,
    loadMoreMessages,
    hasMoreMessages,
    roomInfo,
  };
}
