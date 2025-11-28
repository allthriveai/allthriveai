import { useState, useCallback, useRef } from 'react';

export type ChatStep =
  | 'welcome'
  | 'email'
  | 'username_suggest'
  | 'username_custom'
  | 'name'
  | 'password'
  | 'interests'
  | 'values'
  | 'agreement'
  | 'complete';

export type ChatMode = 'signup' | 'login' | 'oauth_setup';

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
  submitInterests: (interests: string[]) => Promise<void>;
  agreeToValues: () => Promise<void>;
  clearError: () => void;
  beginEmailEntry: () => void;
}

// Re-export for convenience
export type { ChatMessage };

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const WELCOME_TEXT = 'Welcome to All Thrive. We are glad you are here.';

export function useAuthChatStream(): UseAuthChatStreamReturn {
  const [state, setState] = useState<AuthChatState>(() => ({
    sessionId: null,
    step: 'welcome',
    mode: 'signup',
    messages: [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: WELCOME_TEXT,
        timestamp: new Date(),
      },
    ],
    isStreaming: false,
    error: null,
    suggestedUsername: null,
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
    addMessage('user', 'Yes');
    await streamChat('accept_username');
  }, [streamChat, addMessage]);

  const rejectUsername = useCallback(async () => {
    addMessage('user', 'No, I\'ll choose my own');
    await streamChat('reject_username');
  }, [streamChat, addMessage]);

  const submitUsername = useCallback(async (username: string) => {
    addMessage('user', username);
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

  const submitInterests = useCallback(async (interests: string[]) => {
    const labels: Record<string, string> = {
      explore: 'Explore',
      share_skills: 'Share my skills',
      invest: 'Invest in AI projects',
      mentor: 'Mentor others',
    };
    const selectedLabels = interests.map(i => labels[i] || i);
    addMessage('user', selectedLabels.join(', '));
    await streamChat('submit_interests', { interests });
  }, [streamChat, addMessage]);

  const agreeToValues = useCallback(async () => {
    addMessage('user', 'Yes, I agree');
    await streamChat('agree_values');
  }, [streamChat, addMessage]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const beginEmailEntry = useCallback(() => {
    // Move UI to the email input step without hitting the backend yet
    setState(prev => ({ ...prev, step: 'email' }));
  }, []);

  return {
    state,
    startChat,
    submitEmail,
    acceptUsername,
    rejectUsername,
    submitUsername,
    submitName,
    submitPassword,
    submitInterests,
    agreeToValues,
    clearError,
    beginEmailEntry,
  };
}
