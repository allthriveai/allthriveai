import { useState, useCallback, useRef } from 'react';

export type ChatStep =
  | 'welcome'
  | 'email'
  | 'username_suggest'
  | 'username_custom'
  | 'name'
  | 'password'
  | 'profile_bio'
  | 'values'
  | 'first_action'
  | 'complete';

export type ChatMode = 'signup' | 'login' | 'oauth_setup';

export type FirstAction = 'upload_project' | 'explore' | 'prompt_battle';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AuthChatState {
  sessionId: string | null;
  step: ChatStep;
  mode: ChatMode;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  suggestedUsername: string | null;
  firstAction: FirstAction | null;
}

export interface UseAuthChatStreamReturn {
  state: AuthChatState;
  startChat: () => Promise<void>;
  submitEmail: (email: string) => Promise<void>;
  acceptUsername: () => Promise<void>;
  rejectUsername: () => Promise<void>;
  submitUsername: (username: string) => Promise<void>;
  submitName: (firstName: string, lastName: string) => Promise<void>;
  submitPassword: (password: string) => Promise<void>;
  submitBio: (bio: string) => Promise<void>;
  skipBio: () => Promise<void>;
  agreeToValues: () => Promise<void>;
  selectFirstAction: (action: FirstAction) => Promise<void>;
  clearError: () => void;
  beginEmailEntry: () => void;
}

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const WELCOME_MESSAGE = `Hey there! 👋 I'm here to help you get started with All Thrive.

Whether you're here to share your AI creations, learn new skills, or just explore what others are building - you're in the right place.

Let's get you set up. How would you like to sign in?`;

export function useAuthChatStream(): UseAuthChatStreamReturn {
  const [state, setState] = useState<AuthChatState>(() => ({
    sessionId: null,
    step: 'welcome',
    mode: 'signup',
    messages: [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      },
    ],
    isStreaming: false,
    error: null,
    suggestedUsername: null,
    firstAction: null,
  }));

  const currentMessageRef = useRef<string>('');
  const messageIdRef = useRef<number>(0);

  const generateMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}-${Date.now()}`;
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: generateMessageId(),
          role,
          content,
          timestamp: new Date(),
        },
      ],
    }));
  }, [generateMessageId]);

  const addAssistantMessage = useCallback((content: string) => {
    addMessage('assistant', content);
  }, [addMessage]);

  const streamChat = useCallback(async (action: string, data?: Record<string, unknown>) => {
    setState(prev => ({ ...prev, isStreaming: true, error: null }));
    currentMessageRef.current = '';

    const payload = {
      session_id: state.sessionId,
      action,
      data,
    };

    try {
      const response = await fetch(`${API_URL}/auth/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'token') {
                currentMessageRef.current += data.content;
                setState(prev => {
                  const lastMessage = prev.messages[prev.messages.length - 1];

                  if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('streaming-')) {
                    // Update existing streaming message - create new array with updated message
                    const newMessages = [
                      ...prev.messages.slice(0, -1),
                      {
                        ...lastMessage,
                        content: currentMessageRef.current,
                      }
                    ];
                    return { ...prev, messages: newMessages };
                  } else {
                    // Create new streaming message
                    const newMessages = [
                      ...prev.messages,
                      {
                        id: 'streaming-' + Date.now(),
                        role: 'assistant',
                        content: currentMessageRef.current,
                        timestamp: new Date(),
                      }
                    ];
                    return { ...prev, messages: newMessages };
                  }
                });
              } else if (data.type === 'complete') {
                // Finalize streaming message
                setState(prev => {
                  const messages = [...prev.messages];
                  const lastMessage = messages[messages.length - 1];

                  if (lastMessage && lastMessage.id.startsWith('streaming-')) {
                    messages[messages.length - 1] = {
                      ...lastMessage,
                      id: generateMessageId(),
                    };
                  }

                  return {
                    ...prev,
                    messages,
                    step: data.step,
                    mode: data.mode,
                    sessionId: data.session_id || prev.sessionId,
                    suggestedUsername: data.suggested_username || prev.suggestedUsername,
                    isStreaming: false,
                  };
                });

                // Request backend to issue cookies now that flow is complete
                if (data.step === 'complete') {
                  try {
                    await fetch(`${API_URL}/auth/chat/finalize/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ session_id: data.session_id }),
                    });
                  } catch (e) {
                    console.error('Finalize auth chat failed:', e);
                  }
                }

                currentMessageRef.current = '';
              } else if (data.type === 'error') {
                setState(prev => ({
                  ...prev,
                  error: data.message,
                  isStreaming: false,
                }));
                currentMessageRef.current = '';
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection error',
        isStreaming: false,
      }));
    }
  }, [state.sessionId, generateMessageId]);

  const startChat = useCallback(async () => {
    await streamChat('start');
  }, [streamChat]);

  const submitEmail = useCallback(async (email: string) => {
    addMessage('user', email);
    await streamChat('submit_email', { email });
  }, [streamChat, addMessage]);

  const acceptUsername = useCallback(async () => {
    addMessage('user', `I'll use @${state.suggestedUsername}`);
    await streamChat('accept_username');
  }, [streamChat, addMessage, state.suggestedUsername]);

  const rejectUsername = useCallback(async () => {
    addMessage('user', 'I\'d like to choose my own username');
    await streamChat('reject_username');
  }, [streamChat, addMessage]);

  const submitUsername = useCallback(async (username: string) => {
    addMessage('user', `@${username}`);
    await streamChat('submit_username', { username });
  }, [streamChat, addMessage]);

  const submitName = useCallback(async (firstName: string, lastName: string) => {
    addMessage('user', `${firstName} ${lastName}`);
    await streamChat('submit_name', { first_name: firstName, last_name: lastName });
  }, [streamChat, addMessage]);

  const submitPassword = useCallback(async (password: string) => {
    addMessage('user', '••••••••');
    await streamChat('submit_password', { password });
  }, [streamChat, addMessage]);

  const submitBio = useCallback(async (bio: string) => {
    addMessage('user', bio);
    await streamChat('submit_bio', { bio });
  }, [streamChat, addMessage]);

  const skipBio = useCallback(async () => {
    addMessage('user', 'I\'ll add this later');
    await streamChat('skip_bio');
  }, [streamChat, addMessage]);

  const agreeToValues = useCallback(async () => {
    addMessage('user', 'I agree to the community values');
    await streamChat('agree_values');
  }, [streamChat, addMessage]);

  const selectFirstAction = useCallback(async (action: FirstAction) => {
    const labels: Record<FirstAction, string> = {
      upload_project: 'I want to upload a project',
      explore: 'I want to explore what others have built',
      prompt_battle: 'I want to join a prompt battle',
    };
    addMessage('user', labels[action]);
    setState(prev => ({ ...prev, firstAction: action }));
    await streamChat('select_first_action', { action });
  }, [streamChat, addMessage]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const beginEmailEntry = useCallback(() => {
    addAssistantMessage('Great choice! What\'s your email address?');
    setState(prev => ({ ...prev, step: 'email' }));
  }, [addAssistantMessage]);

  return {
    state,
    startChat,
    submitEmail,
    acceptUsername,
    rejectUsername,
    submitUsername,
    submitName,
    submitPassword,
    submitBio,
    skipBio,
    agreeToValues,
    selectFirstAction,
    clearError,
    beginEmailEntry,
  };
}
