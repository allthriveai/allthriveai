import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildWebSocketUrl, logWebSocketUrl } from '@/utils/websocket';
import { saveChatMessages, loadChatMessages, clearChatMessages } from '@/utils/chatStorage';
import { trackInteraction } from '@/services/personalization';
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

/**
 * WebSocket Message Interface
 *
 * NOTE: This interface intentionally uses snake_case for field names.
 * WebSocket messages bypass the axios API interceptor that normally
 * converts snake_case ↔ camelCase. The Django backend sends snake_case
 * directly over the WebSocket connection.
 */
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
    // Orchestration action fields (Ember)
    action?: 'navigate' | 'highlight' | 'open_tray' | 'toast' | 'trigger';
    path?: string;
    target?: string;
    style?: string;
    duration?: number;
    tray?: string;
    context?: Record<string, unknown>;
    variant?: string;
    trigger_action?: string;
    params?: Record<string, unknown>;
    auto_execute?: boolean;
    requires_confirmation?: boolean;
    // Inline game fields
    game_type?: 'snake' | 'quiz' | 'random';
    game_config?: {
      difficulty?: 'easy' | 'medium' | 'hard';
    };
    // Learning content fields
    has_content?: boolean;
    source_type?: string;
    content_type?: string;
    topic?: string;
    topic_display?: string;
    items?: LearningContentItem[];
    // find_learning_content unified tool fields
    query?: string;
    content?: Array<{
      type: string;
      game_type?: string;
      title?: string;
      explanation?: string;
      description?: string;
      url?: string;
      id?: string;
      thumbnail?: string;
      content_type?: string;
      difficulty?: string;
      question_count?: number;
      name?: string;
      slug?: string;
      key_features?: string[];
    }>;
    // get_trending_projects fields
    projects?: Array<{
      id: number;
      title: string;
      slug: string;
      description: string;
      author: string;
      author_avatar_url?: string;
      thumbnail?: string;
      featured_image_url?: string;
      categories?: string[];
      url: string;
    }>;
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

// Avatar template for onboarding
export interface AvatarTemplate {
  id: string;
  label: string;
  icon: string;
  color: string;
  starterPrompt: string;
}

// Path option for onboarding
export interface PathOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
  path: string;
}

// Game types for inline games
export type InlineGameType = 'snake' | 'quiz' | 'ethics' | 'prompt_battle' | 'random';

// Learning content item from backend
export interface LearningContentItem {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  url?: string;
  thumbnail?: string;
  featured_image_url?: string;
  // Author info (for user avatar display)
  author_username?: string;
  author_avatar_url?: string;
  // Project-specific
  key_techniques?: string[];
  complexity_level?: string;
  quality_score?: number;
  // Video-specific
  duration_seconds?: number;
  view_count?: number;
  source_name?: string;
  published_at?: string;
  // Quiz-specific
  difficulty?: string;
  question_count?: number;
  estimated_time?: number;
  // Lesson-specific
  concept_name?: string;
  lesson_type?: string;
  estimated_minutes?: number;
  content_preview?: string;
  // Game-specific
  type?: string;
  game_id?: string;
}

// Project import option types
export type ProjectImportOption = 'integration' | 'url' | 'upload' | 'chrome-extension';

// Profile question option type
export interface ProfileQuestionOption {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

// Profile question config type
export interface ProfileQuestionConfig {
  questionId: string;
  questionType: 'single' | 'multi' | 'this_or_that';
  prompt: string;
  options: ProfileQuestionOption[];
  targetField: string;
  allowMultiple?: boolean;
  followUpPrompt?: string;
}

// Inline action type (for clickable pills in messages)
export interface InlineAction {
  id: string;
  label: string;
  message: string;
  emoji?: string;
}

// Extended metadata for intelligent chat messages
export interface IntelligentChatMetadata {
  type?: 'text' | 'generating' | 'generated_image'
       | 'onboarding_intro' | 'onboarding_avatar_prompt'
       | 'onboarding_avatar_preview' | 'inline_game'
       | 'learning_content' | 'project_import_options' | 'integration_picker'
       | 'profile_question' | 'inline_actions'
       | 'figma_connect' | 'figma_url_input';
  imageUrl?: string;
  filename?: string;
  sessionId?: number;
  iterationNumber?: number;
  // Onboarding-specific fields
  onboardingStep?: 'intro' | 'avatar-create' | 'avatar-preview' | 'complete';
  avatarTemplates?: AvatarTemplate[];
  avatarImageUrl?: string;
  // Inline game fields
  gameType?: InlineGameType;
  gameConfig?: {
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  /** Topic-specific explanation to display before an inline game */
  explanation?: string;
  // Learning content fields
  learningContent?: {
    topic: string;
    topicDisplay: string;
    contentType: string;
    sourceType: string;
    items: LearningContentItem[];
    hasContent: boolean;
    message?: string;
  };
  // Profile question fields
  profileQuestion?: ProfileQuestionConfig;
  // Inline action pills (clickable options in message)
  actions?: InlineAction[];
}

// Use the shared ChatMessage type with extended metadata
export interface ChatMessage extends Omit<SharedChatMessage, 'metadata'> {
  metadata?: IntelligentChatMetadata;
}

// Orchestration action types for Ember
export interface OrchestrationAction {
  action: 'navigate' | 'highlight' | 'open_tray' | 'toast' | 'trigger';
  path?: string;
  message?: string;
  target?: string;
  style?: string;
  duration?: number;
  tray?: string;
  context?: Record<string, unknown>;
  variant?: string;
  trigger_action?: string;
  params?: Record<string, unknown>;
  auto_execute?: boolean;
  requires_confirmation?: boolean;
}

interface UseIntelligentChatOptions {
  conversationId: string;
  onError?: (error: string) => void;
  onProjectCreated?: (projectUrl: string, projectTitle: string) => void;
  onQuotaExceeded?: (info: QuotaExceededInfo) => void;
  onOrchestrationAction?: (action: OrchestrationAction) => void;
  autoReconnect?: boolean;
}

export function useIntelligentChat({
  conversationId,
  onError,
  onProjectCreated,
  onQuotaExceeded,
  onOrchestrationAction,
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
  // Track current tool being executed for UI feedback
  const [currentTool, setCurrentTool] = useState<string | null>(null);

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
  const isCancelledRef = useRef(false); // Track if processing was cancelled
  const pendingContentMessagesRef = useRef<ChatMessage[]>([]); // Content messages to add after streaming completes
  const pendingLearningContentRef = useRef<{
    topicDisplay: string;
    contentType: string;
    sourceType: string;
    items: LearningContentItem[];
    hasContent: boolean;
    // Optional inline game from find_content (consolidated into same message)
    inlineGame?: {
      gameType: 'snake' | 'quiz' | 'ethics' | 'prompt_battle' | 'random';
      gameConfig?: Record<string, unknown>;
      explanation?: string;
    };
  } | null>(null); // Learning content to attach to current message on complete

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
              // Ignore chunks if processing was cancelled
              if (isCancelledRef.current) {
                return;
              }
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
              // Tool execution started - show which tool is running
              if (data.tool) {
                setCurrentTool(data.tool);
              }
              break;

            case 'tool_end':
              // Tool execution completed - clear current tool
              setCurrentTool(null);
              // Check for project creation
              // Handle create_project, import_github_project, and import_from_url
              if ((data.tool === 'create_project' || data.tool === 'import_github_project' || data.tool === 'import_from_url') &&
                  data.output?.success && data.output?.url) {
                // Project was created successfully - trigger callback
                onProjectCreated?.(data.output.url, data.output.title || 'Project');
              }
              // Check for orchestration actions (Ember)
              // These are actions like navigate, highlight, open_tray, toast, trigger
              if (data.output?.action && onOrchestrationAction) {
                const orchestrationAction: OrchestrationAction = {
                  action: data.output.action,
                  path: data.output.path,
                  message: data.output.message,
                  target: data.output.target,
                  style: data.output.style,
                  duration: data.output.duration,
                  tray: data.output.tray,
                  context: data.output.context,
                  variant: data.output.variant,
                  trigger_action: data.output.trigger_action,
                  params: data.output.params,
                  auto_execute: data.output.auto_execute,
                  requires_confirmation: data.output.requires_confirmation,
                };
                onOrchestrationAction(orchestrationAction);
              }
              // Check for inline game launch
              if (data.tool === 'launch_inline_game' && data.output?.game_type) {
                const gameMessageId = `inline-game-${Date.now()}`;
                setMessages((prev) => {
                  // Check for duplicate
                  if (prev.some(m => m.id === gameMessageId)) {
                    return prev;
                  }
                  const newMessages = [
                    ...prev,
                    {
                      id: gameMessageId,
                      content: '', // Game is rendered via metadata
                      sender: 'assistant' as const,
                      timestamp: new Date(),
                      metadata: {
                        type: 'inline_game' as const,
                        gameType: data.output?.game_type,
                        gameConfig: data.output?.game_config,
                      },
                    },
                  ];
                  return newMessages.slice(-MAX_MESSAGES);
                });
                seenMessageIdsRef.current.add(gameMessageId);
              }
              // Check for profile question (ask_profile_question tool)
              if (data.tool === 'ask_profile_question' && data.output?.success) {
                const outputData = data.output as Record<string, unknown>;
                const frontendContent = outputData?._frontend_content as Array<Record<string, unknown>> | undefined;
                if (frontendContent && frontendContent.length > 0) {
                  const questionData = frontendContent[0];
                  if (questionData?.type === 'profile_question') {
                    const questionMessageId = `profile-question-${Date.now()}`;
                    if (!seenMessageIdsRef.current.has(questionMessageId)) {
                      setMessages((prev) => {
                        if (prev.some(m => m.id === questionMessageId)) {
                          return prev;
                        }
                        const newMessages = [
                          ...prev,
                          {
                            id: questionMessageId,
                            content: '', // Question is rendered via metadata
                            sender: 'assistant' as const,
                            timestamp: new Date(),
                            metadata: {
                              type: 'profile_question' as const,
                              profileQuestion: {
                                questionId: questionData.questionId as string,
                                questionType: questionData.questionType as 'single' | 'multi' | 'this_or_that',
                                prompt: questionData.prompt as string,
                                options: questionData.options as Array<{
                                  id: string;
                                  label: string;
                                  emoji?: string;
                                  description?: string;
                                }>,
                                targetField: questionData.targetField as string,
                                allowMultiple: questionData.allowMultiple as boolean | undefined,
                                followUpPrompt: questionData.followUpPrompt as string | undefined,
                              },
                            },
                          },
                        ];
                        return newMessages.slice(-MAX_MESSAGES);
                      });
                      seenMessageIdsRef.current.add(questionMessageId);
                    }
                  }
                }
              }
              // Handle find_content and find_learning_content tools with content array
              // NOTE: Backend returns content array with camelCase keys (from find_content)
              // or _frontend_content for legacy find_learning_content
              {
                // Support both new find_content (camelCase content array) and legacy find_learning_content (_frontend_content)
                const outputData = data.output as Record<string, unknown> | undefined;
                const frontendContent = (outputData?.content || outputData?._frontend_content) as Array<Record<string, unknown>> | undefined;
                // find_content returns projects in a separate 'projects' array (not in content)
                const projectsArray = outputData?.projects as Array<Record<string, unknown>> | undefined;

              if ((data.tool === 'find_content' || data.tool === 'find_learning_content') &&
                  ((frontendContent && frontendContent.length > 0) || (projectsArray && projectsArray.length > 0))) {
                // Support both camelCase (find_content) and snake_case (legacy find_learning_content)
                const contentArray = (frontendContent || []) as Array<{
                  type: string;
                  // Game fields (camelCase from find_content)
                  gameType?: string;
                  game_type?: string;  // Legacy snake_case
                  topicExplanation?: string;
                  // Common fields
                  title?: string;
                  explanation?: string;
                  description?: string;
                  url?: string;
                  id?: string;
                  thumbnail?: string;
                  // Project fields (camelCase)
                  contentType?: string;
                  content_type?: string;  // Legacy snake_case
                  difficulty?: string;
                  questionCount?: number;
                  question_count?: number;  // Legacy snake_case
                  name?: string;
                  slug?: string;
                  keyFeatures?: string[];
                  key_features?: string[];  // Legacy snake_case
                }>;
                const timestamp = Date.now();

                // Build messages OUTSIDE of setMessages to avoid race conditions
                // Check and mark as seen BEFORE building, using a unique key for this event
                const eventKey = `find-learning-${timestamp}`;
                if (seenMessageIdsRef.current.has(eventKey)) {
                  break;
                }
                seenMessageIdsRef.current.add(eventKey);

                // Group items by type for consolidated rendering
                const projectItems: LearningContentItem[] = [];
                const quizItems: LearningContentItem[] = [];
                // Store game info to attach to learning content (consolidated into same message)
                let pendingGameInfo: {
                  gameType: 'snake' | 'quiz' | 'ethics' | 'prompt_battle' | 'random';
                  gameConfig?: Record<string, unknown>;
                  explanation?: string;
                } | undefined;

                contentArray.forEach((item, index) => {
                  const itemId = `${eventKey}-${index}`;

                  // Support both camelCase (find_content) and snake_case (legacy)
                  const gameType = item.gameType || item.game_type;
                  const questionCount = item.questionCount || item.question_count;
                  const explanation = item.topicExplanation || item.explanation;

                  // Handle both inlineGame (new) and inline_game (legacy)
                  // Games from find_content are consolidated into the AssistantMessage (not separate)
                  if (item.type === 'inlineGame' || item.type === 'inline_game') {
                    // Store game info to attach to pendingLearningContentRef later
                    // This keeps the game in the same message as text + cards
                    pendingGameInfo = {
                      gameType: gameType as 'snake' | 'quiz' | 'ethics' | 'prompt_battle' | 'random',
                      gameConfig: {},
                      explanation: explanation,
                    };
                  } else if (item.type === 'projectCard' || item.type === 'project_card') {
                    // Render projects as cards in a grid (AI gives brief intro, cards show details)
                    projectItems.push({
                      id: item.id || itemId,
                      title: item.title || '',
                      description: item.description || '',
                      url: item.url || '',
                      thumbnail: item.thumbnail || '',
                      featured_image_url: item.thumbnail || '',
                      difficulty: item.difficulty,
                      question_count: questionCount,
                    });
                  } else if (item.type === 'quizCard' || item.type === 'quiz_card') {
                    quizItems.push({
                      id: item.id || itemId,
                      title: item.title || '',
                      description: item.description || '',
                      url: item.url || '',
                      thumbnail: item.thumbnail || '',
                      featured_image_url: item.thumbnail || '',
                      difficulty: item.difficulty,
                      question_count: questionCount,
                    });
                  } else if (item.type === 'toolInfo' || item.type === 'tool_info') {
                    // Skip tool_info - the AI's text response already explains the topic
                    // and showing it separately creates duplicate content
                  }
                });

                // Process the separate 'projects' array from find_content response
                // Projects render as cards in a grid - AI gives brief intro text only
                if (projectsArray && projectsArray.length > 0) {
                  projectsArray.forEach((project, index) => {
                    const p = project as {
                      id?: number | string;
                      title?: string;
                      slug?: string;
                      description?: string;
                      author?: string;
                      authorAvatarUrl?: string;
                      author_avatar_url?: string;
                      featuredImageUrl?: string;
                      featured_image_url?: string;
                      thumbnail?: string;
                      categories?: string[];
                      url?: string;
                      contentType?: string;
                      content_type?: string;
                      difficulty?: string;
                    };
                    projectItems.push({
                      id: String(p.id || `${eventKey}-proj-${index}`),
                      title: p.title || '',
                      slug: p.slug,
                      description: p.description || '',
                      url: p.url || '',
                      thumbnail: p.thumbnail || p.featuredImageUrl || p.featured_image_url || '',
                      featured_image_url: p.featuredImageUrl || p.featured_image_url || p.thumbnail || '',
                      author_username: p.author,
                      author_avatar_url: p.authorAvatarUrl || p.author_avatar_url || '',
                      key_techniques: p.categories,
                      difficulty: p.difficulty,
                    });
                  });
                }

                // Store learning content to attach to current assistant message on complete
                // Combine projects and quizzes into a single learning content payload
                // Consolidate learning content: items + game into one message
                const allItems = [...projectItems, ...quizItems];
                if (allItems.length > 0 || pendingGameInfo) {
                  pendingLearningContentRef.current = {
                    topicDisplay: data.output?.query || '',
                    contentType: projectItems.length > 0 ? 'projects' : 'quizzes',
                    sourceType: 'curated',
                    items: allItems,
                    hasContent: allItems.length > 0 || !!pendingGameInfo,
                    // Include game if present (consolidated into same AssistantMessage)
                    inlineGame: pendingGameInfo,
                  };
                }

                // Note: game messages no longer pushed separately - they're consolidated above
              }
              }

              // NOTE: get_trending_projects and get_recommendations tools were removed
              // All project discovery now goes through the unified find_content tool
              // which is handled above (data.tool === 'find_content')

              // Check for profile generation tools - dispatch event for ProfilePage to consume
              if (data.tool === 'generate_profile_sections' || data.tool === 'save_profile_sections') {
                try {
                  // The tool output contains the generated sections
                  const outputData = data.output as Record<string, unknown> | undefined;
                  const sections = outputData?.sections;

                  if (sections && Array.isArray(sections) && sections.length > 0) {
                    // Validate sections have required fields before dispatching
                    const isValidSection = (s: unknown): boolean =>
                      typeof s === 'object' && s !== null &&
                      'id' in s && 'type' in s && typeof (s as Record<string, unknown>).id === 'string';

                    const validSections = sections.filter(isValidSection);

                    if (validSections.length > 0) {
                      // Dispatch custom event for ProfilePage to handle
                      window.dispatchEvent(new CustomEvent('emberProfileSectionsGenerated', {
                        detail: { sections: validSections, toolName: data.tool }
                      }));
                    }
                  }
                } catch (parseError) {
                  console.warn('[Profile] Failed to parse profile sections from tool output:', parseError);
                }
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

              // Attach learning content to the current assistant message (consolidates text + cards in one message)
              if (pendingLearningContentRef.current) {
                const learningContent = pendingLearningContentRef.current;
                pendingLearningContentRef.current = null; // Clear the ref
                setMessages((prev) => {
                  // Find the last assistant message and attach learning content metadata
                  const lastIndex = prev.length - 1;
                  if (lastIndex >= 0 && prev[lastIndex].sender === 'assistant') {
                    const updated = [...prev];
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      metadata: {
                        ...updated[lastIndex].metadata,
                        learningContent: {
                          topic: learningContent.topicDisplay,
                          ...learningContent,
                        },
                      },
                    };
                    return updated;
                  }
                  return prev;
                });
              }

              // Add any other pending content messages (learning content + games now attached to main message)
              // This is kept for backwards compatibility but shouldn't be used by find_content anymore
              if (pendingContentMessagesRef.current.length > 0) {
                const pendingMessages = [...pendingContentMessagesRef.current];
                pendingContentMessagesRef.current = []; // Clear the ref
                setMessages((prev) => [...prev, ...pendingMessages].slice(-MAX_MESSAGES));
              }
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
    // Reset cancelled flag when sending new message
    isCancelledRef.current = false;

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

    // Track conversation interaction for personalization (fire-and-forget)
    // This helps the personalization engine learn from chat interactions
    trackInteraction({
      interactionType: 'conversation',
      metadata: {
        message: content,
        conversationId,
      },
    }).catch((err) => {
      // Silent fail - don't interrupt chat flow for tracking errors
      console.debug('Failed to track conversation interaction:', err);
    });

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
  }, [onError, addMessageWithDedup, conversationId]);

  // Send message with an image through WebSocket (for multimodal messages like LinkedIn screenshots)
  const sendMessageWithImage = useCallback((content: string, imageUrl: string) => {
    // Reset cancelled flag when sending new message
    isCancelledRef.current = false;

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
    // Include image URL indicator in the displayed message
    const userMessage: ChatMessage = {
      id: messageId,
      content,
      sender: 'user',
      timestamp: new Date(),
      metadata: {
        imageUrl, // Store image URL for potential rendering
      },
    };
    addMessageWithDedup(userMessage);

    // Track conversation interaction for personalization (fire-and-forget)
    trackInteraction({
      interactionType: 'conversation',
      metadata: {
        message: content,
        conversationId,
        hasImage: true,
      },
    }).catch((err) => {
      console.debug('Failed to track conversation interaction:', err);
    });

    // Check WebSocket connection AFTER adding user message
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectFnRef.current?.();
      return;
    }

    // Send to WebSocket with image_url
    try {
      wsRef.current.send(JSON.stringify({ message: content, image_url: imageUrl }));
    } catch (error) {
      console.error('Failed to send message with image:', error);
      onError?.('Failed to send message');
    }
  }, [onError, addMessageWithDedup, conversationId]);

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

  // Clear messages for this conversation (local + backend checkpoint)
  const clearMessages = useCallback(async () => {
    setMessages([]);
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Clear from local storage
    clearChatMessages(conversationId);

    // Clear backend checkpoint (LangGraph state)
    try {
      const csrfToken = getCookie('csrftoken');
      const response = await fetch('/api/v1/agents/clear-conversation/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[Chat] Cleared backend conversation checkpoint:', data);
      } else {
        console.warn('[Chat] Failed to clear backend checkpoint:', response.status);
      }
    } catch (error) {
      console.warn('[Chat] Failed to clear backend checkpoint:', error);
    }
  }, [conversationId]);

  // Cancel ongoing AI processing
  const cancelProcessing = useCallback(() => {
    if (!isLoading) return;

    // Set cancelled flag to ignore incoming chunks
    isCancelledRef.current = true;

    // Stop loading state
    setIsLoading(false);

    // Remove any partial assistant message being streamed
    if (currentMessageIdRef.current) {
      setMessages((prev) => prev.filter(m => m.id !== currentMessageIdRef.current));
    }

    // Remove any "generating" type messages (for image generation)
    setMessages((prev) => prev.filter(m => m.metadata?.type !== 'generating'));

    // Clear current message refs
    currentMessageRef.current = '';
    currentMessageIdRef.current = '';

    // Add a system message indicating cancellation
    const cancelMessageId = `cancelled-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: cancelMessageId,
        content: 'Processing cancelled.',
        sender: 'assistant' as const,
        timestamp: new Date(),
      },
    ]);
  }, [isLoading]);

  // Add a local assistant message (not sent to server)
  // Useful for integration flows that show prompts in the chat
  const addLocalMessage = useCallback((content: string, metadata?: IntelligentChatMetadata) => {
    const localMessage: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      sender: 'assistant' as const,
      timestamp: new Date(),
      metadata,
    };
    addMessageWithDedup(localMessage);
  }, [addMessageWithDedup]);

  return {
    messages,
    isConnected,
    isConnecting,
    isLoading,
    currentTool,
    reconnectAttempts,
    sendMessage,
    sendMessageWithImage,
    connect,
    disconnect,
    clearMessages,
    cancelProcessing,
    addLocalMessage,
  };
}
