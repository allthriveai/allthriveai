import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Simple cookie reader for CSRF token (mirrors frontend/src/services/api.ts)
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

// Constants
const MAX_MESSAGE_LENGTH = 10000;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 10000; // 10 seconds

export interface WebSocketMessage {
  event: string;
  conversation_id?: string;
  task_id?: string;
  chunk?: string;
  error?: string;
  timestamp?: string;
  message?: string;
  // Image generation fields
  image_url?: string;
  filename?: string;
  session_id?: number;
  iteration_number?: number;
  // Tool-related fields
  tool?: string;
  output?: {
    success?: boolean;
    project_id?: number;
    slug?: string;
    url?: string;
    title?: string;
    message?: string;
    error?: string;
  };
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    type?: 'text' | 'generating' | 'generated_image';
    imageUrl?: string;
    filename?: string;
    sessionId?: number;
    iterationNumber?: number;
  };
}

interface UseIntelligentChatOptions {
  conversationId: string;
  onError?: (error: string) => void;
  onProjectCreated?: (projectUrl: string, projectTitle: string) => void;
  autoReconnect?: boolean;
}

export function useIntelligentChat({
  conversationId,
  onError,
  onProjectCreated,
  autoReconnect = true
}: UseIntelligentChatOptions) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Constants
  const MAX_MESSAGES = 100; // Limit message history to prevent memory issues

  const wsRef = useRef<WebSocket | null>(null);
  const currentMessageRef = useRef<string>('');
  const currentMessageIdRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectFnRef = useRef<(() => void) | null>(null);
  const isConnectingRef = useRef(false); // Ref-based lock to prevent duplicate connections

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

  // Start heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearTimers]);

  // Reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || intentionalCloseRef.current) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onError?.('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectFnRef.current?.();
    }, delay);
  }, [autoReconnect, reconnectAttempts, onError]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    console.log('[WebSocket] Attempting connection...', { isAuthenticated, authLoading, conversationId, isConnecting, isConnectingRef: isConnectingRef.current });
    if (authLoading) {
      console.log('[WebSocket] Waiting for auth to load...');
      return;
    }
    if (!isAuthenticated) {
      console.warn('[WebSocket] Not authenticated, aborting connection');
      onError?.('Please log in to use chat');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('[WebSocket] Already connected');
      return;
    }
    // Use ref-based lock to prevent race conditions with React StrictMode
    if (isConnecting || isConnectingRef.current) {
      console.warn('[WebSocket] Connection already in progress (ref check)');
      return;
    }

    // Set ref lock immediately (sync) before any async operations
    isConnectingRef.current = true;

    // Clear existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearTimers();
    setIsConnecting(true);

    // Step 1: Fetch connection token from backend
    console.log('[WebSocket] Fetching connection token...');
    let connectionToken: string;
    try {
      const csrfToken = getCookie('csrftoken');

      const response = await fetch('/api/v1/auth/ws-connection-token/', {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookie
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        body: JSON.stringify({
          connection_id: `chat-${conversationId}-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        // Helpful for debugging in devtools
        console.error('[WebSocket] ws-connection-token failed with status', response.status);
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;
      console.log('[WebSocket] Connection token received');
    } catch (error) {
      console.error('[WebSocket] Failed to fetch connection token:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onError?.('Failed to get connection token. Please try again.');
      return;
    }

    // Step 2: Connect to WebSocket with connection token
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // WebSocket connects directly to backend
    const wsHost = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8000';
    const wsUrl = `${protocol}//${wsHost}/ws/chat/${conversationId}/?connection_token=${connectionToken}`;

    console.log('[WebSocket] Creating connection to:', wsUrl.replace(/connection_token=[^&]+/, 'connection_token=***'));
    try {
      const ws = new WebSocket(wsUrl);

      // Connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          onError?.('Connection timeout');
          scheduleReconnect();
        }
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        console.log('[WebSocket] Connection opened');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setIsConnecting(false);
        isConnectingRef.current = false;
        setReconnectAttempts(0); // Reset on successful connection
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          // Ignore pong responses from server
          if (data.event === 'pong') {
            return;
          }

          switch (data.event) {
            case 'connected':
              // Connection confirmed
              break;

            case 'task_queued':
              setIsLoading(true);
              break;

            case 'processing_started':
              setIsLoading(true);
              // Create a new assistant message
              currentMessageIdRef.current = `msg-${Date.now()}`;
              currentMessageRef.current = '';
              break;

            case 'chunk':
              // Append chunk to current message
              if (data.chunk) {
                currentMessageRef.current += data.chunk;

                // Update or add the assistant message
                setMessages((prev) => {
                  const existingIndex = prev.findIndex(m => m.id === currentMessageIdRef.current);
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      content: currentMessageRef.current,
                    };
                    return updated;
                  } else {
                    const newMessages = [
                      ...prev,
                      {
                        id: currentMessageIdRef.current,
                        content: currentMessageRef.current,
                        sender: 'assistant' as const,
                        timestamp: new Date(),
                      },
                    ];
                    // Limit message history to prevent memory issues
                    return newMessages.slice(-MAX_MESSAGES);
                  }
                });
              }
              break;

            case 'tool_start':
              // Tool execution started - could show a loading indicator
              console.log(`[WebSocket] Tool started: ${data.tool}`);
              break;

            case 'tool_end':
              // Tool execution completed - check for project creation
              console.log(`[WebSocket] Tool ended: ${data.tool}`, data.output);
              // Handle both create_project and import_github_project
              if ((data.tool === 'create_project' || data.tool === 'import_github_project') &&
                  data.output?.success && data.output?.url) {
                // Project was created successfully - trigger callback
                onProjectCreated?.(data.output.url, data.output.title || 'Project');
              }
              break;

            case 'image_generating':
              // Image generation started - show generating indicator
              console.log('[WebSocket] Image generation started');
              setMessages((prev) => [
                ...prev,
                {
                  id: `generating-${Date.now()}`,
                  content: data.message || 'Creating your image with Nano Banana...',
                  sender: 'assistant' as const,
                  timestamp: new Date(),
                  metadata: { type: 'generating' },
                },
              ]);
              break;

            case 'image_generated':
              // Image generated successfully - replace generating indicator with image
              console.log('[WebSocket] Image generated:', data.image_url, 'session:', data.session_id, 'iteration:', data.iteration_number);
              setMessages((prev) => {
                // Remove the generating indicator
                const filtered = prev.filter(m => m.metadata?.type !== 'generating');
                return [
                  ...filtered,
                  {
                    id: `generated-image-${Date.now()}`,
                    content: '', // No text content, just the image
                    sender: 'assistant' as const,
                    timestamp: new Date(),
                    metadata: {
                      type: 'generated_image',
                      imageUrl: data.image_url,
                      filename: data.filename,
                      sessionId: data.session_id,
                      iterationNumber: data.iteration_number,
                    },
                  },
                ];
              });
              setIsLoading(false);
              break;

            case 'completed':
              setIsLoading(false);
              currentMessageRef.current = '';
              currentMessageIdRef.current = '';
              break;

            case 'error':
              setIsLoading(false);
              currentMessageRef.current = '';
              currentMessageIdRef.current = '';
              onError?.(data.error || 'An error occurred');
              break;

            default:
              // Unknown event, ignore
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        setIsLoading(false);
        clearTimers();

        // Clear partial message on disconnect
        currentMessageRef.current = '';
        currentMessageIdRef.current = '';

        // Check for authentication failure (code 4001)
        if (event.code === 4001) {
          onError?.('Authentication required. Please log in to use chat.');
          return; // Don't attempt reconnect for auth failures
        }

        // Attempt reconnect if not intentional close
        if (!intentionalCloseRef.current) {
          scheduleReconnect();
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onError?.('Failed to establish WebSocket connection');
      scheduleReconnect();
    }
  }, [conversationId, isAuthenticated, authLoading, isConnecting, onError, startHeartbeat, scheduleReconnect, clearTimers]);

  // Store connect function in ref via effect to avoid assignment during render
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setReconnectAttempts(0);
  }, [clearTimers]);

  // Send message through WebSocket
  const sendMessage = useCallback((content: string) => {
    // Validate message length
    if (content.length > MAX_MESSAGE_LENGTH) {
      onError?.(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.('WebSocket is not connected');
      return;
    }

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      // Limit message history to prevent memory issues
      return newMessages.slice(-MAX_MESSAGES);
    });

    // Send to WebSocket
    try {
      wsRef.current.send(JSON.stringify({ message: content }));
    } catch (error) {
      console.error('Failed to send message:', error);
      onError?.('Failed to send message');
    }
  }, [onError]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    intentionalCloseRef.current = false;
    connectFnRef.current?.();

    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount

  // Retry connection when auth finishes loading
  useEffect(() => {
    if (!authLoading && isAuthenticated && !wsRef.current && !isConnecting) {
      console.log('[WebSocket] Auth loaded, attempting connection');
      connectFnRef.current?.();
    }
  }, [authLoading, isAuthenticated, isConnecting]);

  return {
    messages,
    isConnected,
    isConnecting,
    isLoading,
    reconnectAttempts,
    sendMessage,
    connect,
    disconnect,
  };
}
