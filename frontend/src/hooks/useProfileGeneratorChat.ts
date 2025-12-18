import { useState, useCallback, useRef } from 'react';
import type { ProfileSection } from '@/types/profileSections';
import { uploadImage } from '@/services/upload';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface ProfileChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string; // URL of uploaded image (if any)
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

const WELCOME_MESSAGE = `Hey! I'm here to help create an amazing profile that showcases who you are.

**Tell me a bit about yourself!** What do you do, what are you passionate about, or what would you like people to know about you?

💡 **Pro tip:** You can **drag & drop a screenshot of your LinkedIn profile** and I'll use it to build your profile! (I can't scrape LinkedIn directly, but screenshots work great!)

For example:
- "I'm a full-stack developer who loves building AI tools"
- "I'm a designer exploring the intersection of art and technology"
- "I'm learning to code and documenting my journey"

Share as much or as little as you'd like — I'll use this to craft your profile!`;

export interface UseProfileGeneratorChatReturn {
  state: ProfileGeneratorState;
  sendMessage: (message: string) => Promise<void>;
  sendMessageWithImage: (message: string, imageFile: File) => Promise<void>;
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

  const addUserMessage = useCallback((content: string, imageUrl?: string) => {
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: generateMessageId(),
          role: 'user',
          content,
          timestamp: new Date(),
          imageUrl,
        },
      ],
    }));
  }, [generateMessageId]);

  const streamMessage = useCallback(async (message: string, imageUrl?: string) => {
    setState(prev => ({ ...prev, isStreaming: true, error: null }));
    currentMessageRef.current = '';

    // Build the message content - include image URL if present
    let messageContent = message.trim();
    if (imageUrl) {
      messageContent = `${messageContent}\n\n[Uploaded Image: ${imageUrl}]`;
    }

    const payload = {
      session_id: state.sessionId,
      message: messageContent,
      image_url: imageUrl, // Also send as separate field for backend
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
  }, [state.sessionId, generateMessageId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || state.isStreaming) return;

    // Add user message immediately
    addUserMessage(message);

    // Stream the response
    await streamMessage(message);
  }, [state.isStreaming, addUserMessage, streamMessage]);

  const sendMessageWithImage = useCallback(async (message: string, imageFile: File) => {
    if (state.isStreaming) return;

    // Create a local preview URL for immediate display
    const localPreviewUrl = URL.createObjectURL(imageFile);

    // Add user message with local preview immediately
    addUserMessage(message, localPreviewUrl);

    setState(prev => ({ ...prev, isStreaming: true, error: null }));

    try {
      // Upload the image first
      const uploadResult = await uploadImage(imageFile, 'profile-generator');

      // Clean up local preview URL
      URL.revokeObjectURL(localPreviewUrl);

      // Update the message with the real uploaded URL
      setState(prev => {
        const messages = [...prev.messages];
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMessage) {
          lastUserMessage.imageUrl = uploadResult.url;
        }
        return { ...prev, messages, isStreaming: false };
      });

      // Now stream the message with the image URL
      await streamMessage(message, uploadResult.url);
    } catch (error) {
      console.error('Image upload failed:', error);
      // Clean up local preview URL
      URL.revokeObjectURL(localPreviewUrl);

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to upload image',
        isStreaming: false,
      }));
    }
  }, [state.isStreaming, addUserMessage, streamMessage]);

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
    sendMessageWithImage,
    resetChat,
    applyGeneratedSections,
  };
}
