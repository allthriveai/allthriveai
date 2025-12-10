import { useState, useCallback, useRef } from 'react';
import type { ProfileSection } from '@/types/profileSections';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface ProfileChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ProfileGeneratorState {
  sessionId: string | null;
  messages: ProfileChatMessage[];
  isStreaming: boolean;
  error: string | null;
  generatedSections: ProfileSection[] | null;
  isComplete: boolean;
  currentTool: string | null;
}

// Helper to get CSRF token from cookies
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

const WELCOME_MESSAGE = `Hey! I'm here to help create an amazing profile that showcases your work.

I'll ask you a couple of quick questions to understand what makes you unique, then I'll analyze your projects and create personalized profile sections for you.

**What would you like to highlight most on your profile?**

For example:
- Your technical skills and expertise
- Specific projects you're proud of
- Your learning journey and growth
- Your creative or artistic work`;

export interface UseProfileGeneratorChatReturn {
  state: ProfileGeneratorState;
  sendMessage: (message: string) => Promise<void>;
  resetChat: () => void;
  applyGeneratedSections: () => ProfileSection[] | null;
}

export function useProfileGeneratorChat(): UseProfileGeneratorChatReturn {
  const [state, setState] = useState<ProfileGeneratorState>(() => ({
    sessionId: `profile-gen-${Date.now()}`,
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
    generatedSections: null,
    isComplete: false,
    currentTool: null,
  }));

  const currentMessageRef = useRef<string>('');
  const messageIdRef = useRef<number>(0);

  const generateMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}-${Date.now()}`;
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: generateMessageId(),
          role: 'user',
          content,
          timestamp: new Date(),
        },
      ],
    }));
  }, [generateMessageId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || state.isStreaming) return;

    // Add user message immediately
    addUserMessage(message);

    setState(prev => ({ ...prev, isStreaming: true, error: null }));
    currentMessageRef.current = '';

    const payload = {
      session_id: state.sessionId,
      message: message.trim(),
    };

    try {
      const csrfToken = getCookie('csrftoken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_URL}/profile/generate/stream/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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
                setState((prev): ProfileGeneratorState => {
                  const lastMessage = prev.messages[prev.messages.length - 1];

                  if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('streaming-')) {
                    // Update existing streaming message
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
                        role: 'assistant' as const,
                        content: currentMessageRef.current,
                        timestamp: new Date(),
                      }
                    ];
                    return { ...prev, messages: newMessages };
                  }
                });
              } else if (data.type === 'tool_start') {
                setState(prev => ({ ...prev, currentTool: data.tool }));
              } else if (data.type === 'tool_end') {
                setState(prev => ({ ...prev, currentTool: null }));
              } else if (data.type === 'sections_generated') {
                // Profile sections have been generated
                setState(prev => ({
                  ...prev,
                  generatedSections: data.sections,
                }));
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
                    sessionId: data.session_id || prev.sessionId,
                    isStreaming: false,
                    isComplete: prev.generatedSections !== null,
                    currentTool: null,
                  };
                });

                currentMessageRef.current = '';
              } else if (data.type === 'error') {
                setState(prev => ({
                  ...prev,
                  error: data.message,
                  isStreaming: false,
                  currentTool: null,
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
      console.error('Profile generator stream error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection error',
        isStreaming: false,
        currentTool: null,
      }));
    }
  }, [state.sessionId, state.isStreaming, addUserMessage, generateMessageId]);

  const resetChat = useCallback(() => {
    setState({
      sessionId: `profile-gen-${Date.now()}`,
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
      generatedSections: null,
      isComplete: false,
      currentTool: null,
    });
    currentMessageRef.current = '';
  }, []);

  const applyGeneratedSections = useCallback(() => {
    return state.generatedSections;
  }, [state.generatedSections]);

  return {
    state,
    sendMessage,
    resetChat,
    applyGeneratedSections,
  };
}
