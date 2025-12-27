/**
 * useCircleWebSocket - WebSocket hook for real-time circle activity updates
 *
 * Connects to the circle activity WebSocket and dispatches events.
 * Uses useWebSocketBase for connection management.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocketBase } from '@/hooks/websocket';
import type { CircleActivityEvent, CircleWebSocketActivityType, KudosType } from '@/types/models';

interface WebSocketMessage {
  event: string;
  data?: {
    type: CircleWebSocketActivityType;
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

export function useCircleWebSocket({
  circleId,
  onActivity,
  enabled = true
}: UseCircleWebSocketOptions) {
  const { isAuthenticated } = useAuth();

  // Keep callback ref to avoid stale closures
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  // Handle incoming messages
  const handleMessage = useCallback((data: unknown) => {
    const message = data as WebSocketMessage;

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

      onActivityRef.current?.(activityEvent);
    }
  }, []);

  // Should we connect?
  const shouldConnect = isAuthenticated && !!circleId && enabled;

  // Use the base WebSocket hook
  // Note: Circle WebSocket uses CSRF token in query params, not connection token auth
  const { isConnected, reconnectAttempts, connect, disconnect } = useWebSocketBase({
    endpoint: `/ws/circle/${circleId}/`,
    connectionIdPrefix: 'circle',
    onMessage: handleMessage,
    autoConnect: shouldConnect,
    requiresAuth: true, // Uses connection token auth
  });

  // Reconnect when auth state or circleId changes
  useEffect(() => {
    if (shouldConnect) {
      connect();
    } else {
      disconnect();
    }
  }, [shouldConnect, connect, disconnect]);

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
    const mockActivityTypes: CircleWebSocketActivityType[] = ['kudos_given', 'project_created', 'streak_achieved', 'challenge_progress'];

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
