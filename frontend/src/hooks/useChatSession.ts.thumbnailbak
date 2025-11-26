import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ChatContext, ChatSessionState, IChatAgent } from '@/types/chat';

// Generate UUIDs without external dependency
const generateId = () => crypto.randomUUID();

interface UseChatSessionOptions {
  agent: IChatAgent;
  userId: string;
  onError?: (error: Error) => void;
  onMessageReceived?: (message: ChatMessage) => void;
}

export function useChatSession({
  agent,
  userId,
  onError,
  onMessageReceived,
}: UseChatSessionOptions) {
  const sessionIdRef = useRef(generateId());
  const initialMessageAddedRef = useRef(false);

  const [state, setState] = useState<ChatSessionState>({
    messages: [],
    isLoading: false,
    error: undefined,
    context: {
      userId,
      sessionId: sessionIdRef.current,
      conversationHistory: [],
      agentId: agent.config.agentId,
      metadata: {},
    },
    config: agent.config,
  });

  // Add initial message when agent changes
  useEffect(() => {
    // Reset session when agent changes
    sessionIdRef.current = generateId();
    initialMessageAddedRef.current = false;

    if (agent.getInitialMessage) {
      const initialMessage: ChatMessage = {
        id: generateId(),
        sender: 'agent',
        content: agent.getInitialMessage(),
        timestamp: new Date(),
        messageType: 'text',
      };
      setState({
        messages: [initialMessage],
        isLoading: false,
        error: undefined,
        context: {
          userId,
          sessionId: sessionIdRef.current,
          conversationHistory: [initialMessage],
          agentId: agent.config.agentId,
          metadata: {},
        },
        config: agent.config,
      });
      initialMessageAddedRef.current = true;
    } else {
      // Reset to empty state if no initial message
      setState({
        messages: [],
        isLoading: false,
        error: undefined,
        context: {
          userId,
          sessionId: sessionIdRef.current,
          conversationHistory: [],
          agentId: agent.config.agentId,
          metadata: {},
        },
        config: agent.config,
      });
    }
  }, [agent, userId]);

  const sendMessage = useCallback(
    async (userInput: string) => {
      console.log('useChatSession.sendMessage called with:', userInput);

      if (agent.validateInput && !agent.validateInput(userInput)) {
        const error = new Error('Invalid input for this agent');
        onError?.(error);
        setState((prev) => ({ ...prev, error: error.message }));
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        sender: 'user',
        content: userInput,
        timestamp: new Date(),
        messageType: 'text',
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        context: {
          ...prev.context,
          conversationHistory: [...prev.context.conversationHistory, userMessage],
        },
        isLoading: true,
        error: undefined,
      }));

      onMessageReceived?.(userMessage);

      try {
        const responseContent = await agent.handleMessage(userInput, state.context);

        const agentMessage: ChatMessage = {
          id: generateId(),
          sender: 'agent',
          content: responseContent,
          timestamp: new Date(),
          messageType: 'text',
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, agentMessage],
          context: {
            ...prev.context,
            conversationHistory: [
              ...prev.context.conversationHistory,
              agentMessage,
            ],
          },
          isLoading: false,
          error: undefined,
        }));

        onMessageReceived?.(agentMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    },
    [agent, state.context, onError, onMessageReceived]
  );

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      context: {
        ...prev.context,
        conversationHistory: [],
      },
      error: undefined,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const updateContext = useCallback((context: Partial<ChatContext>) => {
    setState((prev) => ({
      ...prev,
      context: { ...prev.context, ...context },
    }));
    agent.onContextChange?.(context);
  }, [agent]);

  return {
    ...state,
    sendMessage,
    clearMessages,
    clearError,
    updateContext,
  };
}
