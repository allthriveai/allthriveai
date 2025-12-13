import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, logWebSocketUrl } from '@/utils/websocket';
import { saveChatMessages, loadChatMessages, clearChatMessages } from '@/utils/chatStorage';
import type { ChatMessage as SharedChatMessage } from '@/types/chat';

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
  // Quota exceeded fields
  reason?: string;
  subscription?: {
    tier?: string;
    ai_requests?: {
      limit?: number;
      used?: number;
      remaining?: number;
    };
    tokens?: {
      balance?: number;
    };
  };
  can_purchase_tokens?: boolean;
  upgrade_url?: string;
}

export interface QuotaExceededInfo {
  reason: string;
  tier: string;
  aiRequestsLimit: number;
  aiRequestsUsed: number;
  aiRequestsRemaining: number;
  tokenBalance: number;
  canPurchaseTokens: boolean;
  upgradeUrl: string;
}

// Extended metadata for intelligent chat messages
export interface IntelligentChatMetadata {
  type?: 'text' | 'generating' | 'generated_image';
  imageUrl?: string;
  filename?: string;
  sessionId?: number;
  iterationNumber?: number;
}

// Use the shared ChatMessage type with extended metadata
export interface ChatMessage extends Omit<SharedChatMessage, 'metadata'> {
  metadata?: IntelligentChatMetadata;
}

interface UseIntelligentChatOptions {
  conversationId: string;
  onError?: (error: string) => void;
  onProjectCreated?: (projectUrl: string, projectTitle: string) => void;
  onQuotaExceeded?: (info: QuotaExceededInfo) => void;
  autoReconnect?: boolean;
}

export function useIntelligentChat({
  conversationId,
  onError,
  onProjectCreated,
  onQuotaExceeded,
  autoReconnect = true
}: UseIntelligentChatOptions) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // Initialize messages from localStorage with limit to prevent memory issues
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Only load from storage on initial render, with size limit
    const loaded = loadChatMessages(conversationId);
    return loaded.slice(-100); // Limit to last 100 messages on load
  });
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
  const seenMessageIdsRef = useRef<Set<string>>(new Set()); // Track seen message IDs for deduplication
  const lastConversationIdRef = useRef<string>(conversationId); // Track conversation changes for cleanup

  // Helper to add a message with deduplication
  const addMessageWithDedup = useCallback((newMessage: ChatMessage) => {
    // Check if we've already seen this message ID
    if (seenMessageIdsRef.current.has(newMessage.id)) {
      return;
    }

    // Mark as seen
    seenMessageIdsRef.current.add(newMessage.id);

    setMessages((prev) => {
      // Also check in existing messages array (belt and suspenders)
      if (prev.some(m => m.id === newMessage.id)) {
        return prev;
      }
      const newMessages = [...prev, newMessage];
      // Limit message history to prevent memory issues
      return newMessages.slice(-MAX_MESSAGES);
    });
  }, []);

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
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      onError?.('Please log in to use chat');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    // Use ref-based lock to prevent race conditions with React StrictMode
    if (isConnecting || isConnectingRef.current) {
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
        throw new Error(`Failed to fetch connection token: ${response.status}`);
      }

      const data = await response.json();
      connectionToken = data.connection_token;
    } catch (error) {
      console.error('[WebSocket] Failed to fetch connection token:', error);
      setIsConnecting(false);
      isConnectingRef.current = false;
      onError?.('Failed to get connection token. Please try again.');
      return;
    }

    // Step 2: Connect to WebSocket with connection token
    // Uses direct connection to backend (see src/utils/websocket.ts for architecture docs)
    const wsUrl = buildWebSocketUrl(`/ws/chat/${conversationId}/`, {
      connection_token: connectionToken,
    });

    logWebSocketUrl(wsUrl, '[WebSocket] Creating connection');
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
                // If no message ID exists (e.g., error from image generation), create one
                if (!currentMessageIdRef.current) {
                  currentMessageIdRef.current = `msg-${Date.now()}`;
                  currentMessageRef.current = '';
                }
                currentMessageRef.current += data.chunk;

                // Update or add the assistant message
                setMessages((prev) => {
                  // First, remove any "generating" type message since this chunk replaces it
                  const filteredPrev = prev.filter(m => m.metadata?.type !== 'generating');

                  const existingIndex = filteredPrev.findIndex(m => m.id === currentMessageIdRef.current);
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
                    // Limit message history to prevent memory issues
                    return newMessages.slice(-MAX_MESSAGES);
                  }
                });
              }
              break;

            case 'tool_start':
              // Tool execution started - could show a loading indicator
              break;

            case 'tool_end':
              // Tool execution completed - check for project creation
              // Handle both create_project and import_github_project
              if ((data.tool === 'create_project' || data.tool === 'import_github_project') &&
                  data.output?.success && data.output?.url) {
                // Project was created successfully - trigger callback
                onProjectCreated?.(data.output.url, data.output.title || 'Project');
              }
              break;

            case 'image_generating': {
              // Image generation started - show generating indicator
              // Use a stable ID for generating state to prevent duplicates
              const generatingId = `generating-${conversationId}`;
              // Remove any existing generating message first, then add new one
              setMessages((prev) => {
                const filtered = prev.filter(m => m.id !== generatingId);
                return [
                  ...filtered,
                  {
                    id: generatingId,
                    content: data.message || 'Creating your image with Nano Banana...',
                    sender: 'assistant' as const,
                    timestamp: new Date(),
                    metadata: { type: 'generating' },
                  },
                ];
              });
              break;
            }

            case 'image_generated': {
              // Image generated successfully - replace generating indicator with image
              // Use session_id and iteration for a stable, unique ID
              const imageMessageId = `generated-image-${data.session_id || 'unknown'}-${data.iteration_number || Date.now()}`;
              setMessages((prev) => {
                // Remove the generating indicator and check for duplicate
                const filtered = prev.filter(m =>
                  m.metadata?.type !== 'generating' && m.id !== imageMessageId
                );
                return [
                  ...filtered,
                  {
                    id: imageMessageId,
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
              // Track this message ID as seen
              seenMessageIdsRef.current.add(imageMessageId);
              setIsLoading(false);
              break;
            }

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

            case 'quota_exceeded': {
              // User has exceeded their AI usage limit
              setIsLoading(false);
              currentMessageRef.current = '';
              currentMessageIdRef.current = '';

              // Build quota info object for callback
              const quotaInfo: QuotaExceededInfo = {
                reason: data.reason || 'AI request limit exceeded',
                tier: data.subscription?.tier || 'Free',
                aiRequestsLimit: data.subscription?.ai_requests?.limit || 0,
                aiRequestsUsed: data.subscription?.ai_requests?.used || 0,
                aiRequestsRemaining: data.subscription?.ai_requests?.remaining || 0,
                tokenBalance: data.subscription?.tokens?.balance || 0,
                canPurchaseTokens: data.can_purchase_tokens || false,
                upgradeUrl: data.upgrade_url || '/settings/billing',
              };

              // Call the quota exceeded callback if provided
              onQuotaExceeded?.(quotaInfo);

              // Also show error message
              onError?.(data.error || 'You\'ve reached your AI usage limit. Please upgrade your plan or purchase tokens.');
              break;
            }

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

    // Generate a unique ID for this message using timestamp + content hash
    const messageId = `user-${Date.now()}-${content.slice(0, 20).replace(/\s/g, '')}`;

    // Check for duplicate (rapid double-click prevention)
    if (seenMessageIdsRef.current.has(messageId)) {
      return;
    }

    // Always add user message to chat immediately for instant feedback
    // This ensures the user sees their message even if WebSocket is connecting
    const userMessage: ChatMessage = {
      id: messageId,
      content,
      sender: 'user',
      timestamp: new Date(),
    };
    addMessageWithDedup(userMessage);

    // Check WebSocket connection AFTER adding user message
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Don't show alarming error - just try to reconnect silently
      // The connection status indicator shows "Offline" which is enough feedback
      connectFnRef.current?.();
      return;
    }

    // Send to WebSocket
    try {
      wsRef.current.send(JSON.stringify({ message: content }));
    } catch (error) {
      console.error('Failed to send message:', error);
      onError?.('Failed to send message');
    }
  }, [onError, addMessageWithDedup]);

  // Clear dedup Set when conversation changes to prevent memory leak
  useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      seenMessageIdsRef.current.clear();
      lastConversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  // Limit dedup Set size to prevent unbounded growth (keep last 500 IDs)
  useEffect(() => {
    const MAX_SEEN_IDS = 500;
    if (seenMessageIdsRef.current.size > MAX_SEEN_IDS) {
      const idsArray = Array.from(seenMessageIdsRef.current);
      seenMessageIdsRef.current = new Set(idsArray.slice(-MAX_SEEN_IDS));
    }
  }, [messages]);

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
      // Clear dedup Set on unmount to free memory
      seenMessageIdsRef.current.clear();
    };

  }, []); // Only run on mount/unmount

  // Retry connection when auth finishes loading
  useEffect(() => {
    if (!authLoading && isAuthenticated && !wsRef.current && !isConnecting) {
      connectFnRef.current?.();
    }
  }, [authLoading, isAuthenticated, isConnecting]);

  // Reconnect when user returns to the page (mobile tab switching, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to the page - check if we need to reconnect
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          // Reset reconnect attempts for fresh start
          setReconnectAttempts(0);
          connectFnRef.current?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Debounced save to localStorage - prevents excessive writes during streaming
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedConversationRef = useRef<string>(conversationId);

  useEffect(() => {
    // Clear pending save if conversation changes
    if (lastSavedConversationRef.current !== conversationId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      lastSavedConversationRef.current = conversationId;
    }

    // Only save if we have messages (don't clear on unmount)
    if (messages.length > 0) {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce: wait 1 second after last message change before saving
      saveTimeoutRef.current = setTimeout(() => {
        saveChatMessages(conversationId, messages);
      }, 1000);
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, conversationId]);

  // Clear messages for this conversation
  const clearMessages = useCallback(() => {
    setMessages([]);
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Clear from storage using already-imported function
    clearChatMessages(conversationId);
  }, [conversationId]);

  return {
    messages,
    isConnected,
    isConnecting,
    isLoading,
    reconnectAttempts,
    sendMessage,
    connect,
    disconnect,
    clearMessages,
  };
}
