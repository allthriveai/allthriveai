/**
 * Clip Agent API - WebSocket connection for clip generation
 *
 * Supports conversational flow with phases:
 * - discovery: Initial questions about audience/goal
 * - hook: Refining the opening hook
 * - story: Building the transcript
 * - ready_to_generate: Final review before generating
 * - generating: Creating the clip
 */

import { api } from './api';
import { buildWebSocketUrl } from '@/utils/websocket';
import type { SocialClipContent } from '@/types/clips';

// Conversation phases
export type ConversationPhase =
  | 'discovery'
  | 'hook'
  | 'story'
  | 'ready_to_generate'
  | 'generating';

// Scene transcript entry
export interface SceneTranscript {
  scene: number;
  type: 'hook' | 'point' | 'cta';
  text: string;
}

// User preferences gathered during conversation
export interface UserPreferences {
  topic?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  keyTakeaway?: string;
}

type ClipEventType =
  | 'connected'
  | 'processing'
  | 'conversation' // AI responded (no clip yet)
  | 'clip_generated'
  | 'error'
  | 'pong';

export interface ClipEvent {
  event: ClipEventType;
  clip?: SocialClipContent;
  message?: string;
  sessionId?: string;
  timestamp?: string;
  error?: string;
  // Conversation state
  phase?: ConversationPhase;
  transcript?: SceneTranscript[];
  preferences?: UserPreferences;
  options?: string[]; // Clickable options for user
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

  // Conversation state (synced from server)
  private _phase: ConversationPhase = 'discovery';
  private _transcript: SceneTranscript[] = [];
  private _preferences: UserPreferences = {};

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Getters for conversation state
  get phase(): ConversationPhase {
    return this._phase;
  }
  get transcript(): SceneTranscript[] {
    return this._transcript;
  }
  get preferences(): UserPreferences {
    return this._preferences;
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
   * Start a new clip conversation
   * @param prompt - The initial prompt/topic for the clip
   * @param brandVoiceId - Optional brand voice ID for personalization
   * @returns true if message was sent, false if not connected
   */
  generate(prompt: string, brandVoiceId?: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ClipAgent] WebSocket not connected');
      this.emit('error', { event: 'error', error: 'Not connected to clip agent' });
      return false;
    }

    // Reset local state for new conversation
    this._phase = 'discovery';
    this._transcript = [];
    this._preferences = {};

    const message: { type: string; prompt: string; brandVoiceId?: number } = {
      type: 'generate',
      prompt,
    };

    if (brandVoiceId) {
      message.brandVoiceId = brandVoiceId;
    }

    this.ws.send(JSON.stringify(message));
    return true;
  }

  /**
   * Continue the conversation (answer questions, provide feedback)
   * @returns true if message was sent, false if not connected
   */
  sendMessage(prompt: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ClipAgent] WebSocket not connected');
      this.emit('error', { event: 'error', error: 'Not connected to clip agent' });
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'message',
        prompt,
      })
    );
    return true;
  }

  /**
   * Approve the transcript and generate the clip
   * @returns true if message was sent, false if not connected
   */
  approve(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ClipAgent] WebSocket not connected');
      this.emit('error', { event: 'error', error: 'Not connected to clip agent' });
      return false;
    }

    this.ws.send(
      JSON.stringify({
        type: 'approve',
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
    // Update local conversation state from server
    if (event.phase) {
      this._phase = event.phase;
    }
    if (event.transcript) {
      this._transcript = event.transcript;
    }
    if (event.preferences) {
      this._preferences = event.preferences;
    }

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
