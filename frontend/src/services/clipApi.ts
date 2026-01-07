/**
 * Clip Agent API - WebSocket connection for clip generation
 */

import { api } from './api';
import { buildWebSocketUrl } from '@/utils/websocket';
import type { SocialClipContent } from '@/types/clips';

type ClipEventType =
  | 'connected'
  | 'processing'
  | 'clip_generated'
  | 'error'
  | 'pong';

interface ClipEvent {
  event: ClipEventType;
  clip?: SocialClipContent;
  message?: string;
  sessionId?: string;
  timestamp?: string;
  error?: string;
}

type ClipEventHandler = (event: ClipEvent) => void;

/**
 * Get a WebSocket connection token for clip agent
 */
async function getConnectionToken(): Promise<string> {
  const response = await api.post('/auth/ws-connection-token/');
  return response.data.connectionToken;
}

export class ClipAgentConnection {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private eventHandlers: Map<ClipEventType | '*', Set<ClipEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private pingInterval: number | null = null;
  private isConnecting = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Connect to the clip agent WebSocket
   */
  async connect(): Promise<void> {
    // Guard against multiple simultaneous connect calls
    if (this.isConnecting) {
      return Promise.reject(new Error('Connection already in progress'));
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      // Fetch connection token first
      getConnectionToken()
        .then((token) => {
          // Build WebSocket URL with token
          const url = buildWebSocketUrl(`/ws/clip/${this.sessionId}/`, {
            connection_token: token,
          });

          try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
              console.log('[ClipAgent] WebSocket connected');
              this.isConnecting = false;
              this.reconnectAttempts = 0;
              this.startPingInterval();
              this.emit('connected', { event: 'connected', sessionId: this.sessionId });
              resolve();
            };

            this.ws.onclose = (event) => {
              console.log('[ClipAgent] WebSocket closed:', event.code);
              this.stopPingInterval();

              if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`[ClipAgent] Reconnecting (attempt ${this.reconnectAttempts})...`);
                setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
              }
            };

            this.ws.onerror = (error) => {
              console.error('[ClipAgent] WebSocket error:', error);
              this.isConnecting = false;
              reject(error);
            };

            this.ws.onmessage = (event) => {
              try {
                const data: ClipEvent = JSON.parse(event.data);
                this.handleEvent(data);
              } catch (e) {
                console.error('[ClipAgent] Failed to parse message:', e);
              }
            };
          } catch (error) {
            reject(error);
          }
        })
        .catch((error) => {
          console.error('[ClipAgent] Failed to get connection token:', error);
          this.isConnecting = false;
          reject(new Error('Failed to authenticate WebSocket connection'));
        });
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  /**
   * Generate a new clip from a prompt
   * @returns true if message was sent, false if not connected
   */
  generate(prompt: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ClipAgent] WebSocket not connected');
      this.emit('error', { event: 'error', error: 'Not connected to clip agent' });
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'generate',
        prompt,
      })
    );
    return true;
  }

  /**
   * Edit an existing clip with a prompt
   * @returns true if message was sent, false if not connected
   */
  edit(prompt: string, currentClip: SocialClipContent): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ClipAgent] WebSocket not connected');
      this.emit('error', { event: 'error', error: 'Not connected to clip agent' });
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'edit',
        prompt,
        currentClip,
      })
    );
    return true;
  }

  /**
   * Subscribe to events
   */
  on(event: ClipEventType | '*', handler: ClipEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private emit(eventType: ClipEventType, event: ClipEvent): void {
    this.handleEvent({ ...event, event: eventType });
  }

  private handleEvent(event: ClipEvent): void {
    // Notify specific event handlers
    const handlers = this.eventHandlers.get(event.event);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(event));
    }
  }

  private startPingInterval(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

/**
 * Create a new clip agent connection
 */
export function createClipConnection(sessionId?: string): ClipAgentConnection {
  const id = sessionId || `clip-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  return new ClipAgentConnection(id);
}
