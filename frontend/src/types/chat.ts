/**
 * Chat Message represents a single message in the conversation
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  messageType?: 'text' | 'action' | 'error' | 'suggestion';
}

/**
 * Chat Configuration for different AI agents
 * Each agent can have its own personality, behavior, and initial setup
 */
export interface ChatConfig {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  initialMessage?: string;
  systemPrompt?: string;
  contextWindow?: number;
  responseTimeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Chat Agent Handler - Abstract interface for different agent implementations
 * This allows for different AI providers (LLMs, specialized agents, etc.)
 */
export interface IChatAgent {
  config: ChatConfig;
  handleMessage(userMessage: string, context?: ChatContext): Promise<string>;
  getInitialMessage?(): string;
  validateInput?(input: string): boolean;
  onContextChange?(context: Partial<ChatContext>): void;
}

/**
 * Chat Context carries information about the current conversation
 */
export interface ChatContext {
  userId: string;
  sessionId: string;
  conversationHistory: ChatMessage[];
  agentId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chat Session State - manages the entire conversation
 */
export interface ChatSessionState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
  context: ChatContext;
  config: ChatConfig;
}

/**
 * Agent Factory for creating different agent types
 */
export type AgentFactory = (config: ChatConfig) => IChatAgent;

/**
 * Streaming Response Handler for real-time agent responses
 */
export interface StreamingResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
}
