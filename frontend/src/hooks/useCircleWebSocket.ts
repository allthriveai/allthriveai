/**
 * useCircleWebSocket - WebSocket hook for real-time circle activity updates
 * Connects to the circle activity WebSocket and dispatches events
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { CircleActivityEvent, CircleActivityType } from '@/components/thrive-circle/CircleActivityToast';
import type { KudosType } from '@/types/models';

// Constants
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;

interface WebSocketMessage {
  event: string;
  data?: {
    type: CircleActivityType;
    username: string;
    target_username?: string;
    kudos_type?: KudosType;
    message?: string;
    circle_id?: string;
  };
}

interface UseCircleWebSocketOptions {
  circleId?: string;
  onActivity?: (event: CircleActivityEvent) => void;
  enabled?: boolean;
}

// Get CSRF token from cookies
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

export function useCircleWebSocket({
  circleId,
  onActivity,
  enabled = true
}: UseCircleWebSocketOptions) {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!isAuthenticated || !circleId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const csrfToken = getCookie('csrftoken');
    const wsUrl = `${protocol}//${host}/ws/circle/${circleId}/${csrfToken ? `?csrf=${csrfToken}` : ''}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.event === 'circle_activity' && message.data) {
            const activityEvent: CircleActivityEvent = {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: message.data.type,
              username: message.data.username,
              targetUsername: message.data.target_username,
              kudosType: message.data.kudos_type,
              message: message.data.message,
              timestamp: new Date().toISOString(),
            };

            onActivity?.(activityEvent);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearTimers();

        // Attempt reconnect if not intentional close
        if (!intentionalCloseRef.current && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
            MAX_RECONNECT_DELAY
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Error will trigger onclose
      };

      wsRef.current = ws;
    } catch {
      // Connection failed
    }
  }, [isAuthenticated, circleId, enabled, reconnectAttempts, onActivity, clearTimers]);

  // Disconnect
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [clearTimers]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    reconnectAttempts,
    connect,
    disconnect
  };
}

/**
 * Mock hook for development/demo - simulates real-time activity
 * Use this when WebSocket backend isn't available
 */
export function useCircleActivityMock(
  onActivity: (event: CircleActivityEvent) => void,
  enabled = true,
  intervalMs = 8000 // Show a mock event every 8 seconds
) {
  useEffect(() => {
    if (!enabled) return;

    const mockUsernames = ['Sarah', 'Mike', 'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan'];
    const mockKudosTypes: KudosType[] = ['great_project', 'helpful', 'inspiring', 'creative', 'supportive', 'welcome'];
    const mockActivityTypes: CircleActivityType[] = ['kudos_given', 'project_created', 'streak_achieved', 'challenge_progress'];

    const generateMockEvent = (): CircleActivityEvent => {
      const type = mockActivityTypes[Math.floor(Math.random() * mockActivityTypes.length)];
      const username = mockUsernames[Math.floor(Math.random() * mockUsernames.length)];
      const targetUsername = mockUsernames.filter(n => n !== username)[Math.floor(Math.random() * (mockUsernames.length - 1))];

      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        username,
        targetUsername: type === 'kudos_given' ? targetUsername : undefined,
        kudosType: type === 'kudos_given' ? mockKudosTypes[Math.floor(Math.random() * mockKudosTypes.length)] : undefined,
        message: type === 'streak_achieved' ? '7-day' : type === 'level_up' ? 'Blossom' : undefined,
        timestamp: new Date().toISOString(),
      };
    };

    // Initial delay before first mock event
    const initialDelay = setTimeout(() => {
      onActivity(generateMockEvent());
    }, 3000);

    // Regular interval for mock events
    const interval = setInterval(() => {
      onActivity(generateMockEvent());
    }, intervalMs);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [enabled, intervalMs, onActivity]);
}
