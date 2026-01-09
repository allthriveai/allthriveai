/**
 * ClipCreatorChatPanel - Chat panel for creating social clips
 *
 * Users chat with the Clip agent to create and refine animated clips.
 * The agent guides users through a conversational flow:
 * 1. Discovery: Questions about audience/goal
 * 2. Hook: Refining the opening hook
 * 3. Story: Building the transcript
 * 4. Generate: Creating the final clip
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faPaperPlane,
  faSpinner,
  faCircleExclamation,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

import type { SocialClipContent } from '@/types/clips';
import type { BrandVoiceMinimal } from '@/types/models';
import {
  createClipConnection,
  type ClipAgentConnection,
  type ConversationPhase,
  type SceneTranscript,
  type ClipEvent,
} from '@/services/clipApi';
import { getBrandVoicesMinimal } from '@/services/brandVoice';

// Initial message for new conversations
const INITIAL_MESSAGE = {
  id: '1',
  role: 'assistant' as const,
  content: `Hey! I'm your clip creator assistant. Tell me what topic you'd like to create a social clip about.

For example:
- "Explain RAG in 30 seconds for LinkedIn"
- "Create a quick tip about prompt engineering"
- "Make a comparison between ChatGPT and Claude"

What would you like to create?`,
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  options?: string[]; // Clickable options for the user
}

export interface ClipCreatorChatPanelProps {
  onClipUpdate: (clipData: SocialClipContent) => void;
}

export function ClipCreatorChatPanel({ onClipUpdate }: ClipCreatorChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<SocialClipContent | null>(null);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>('discovery');
  const [transcript, setTranscript] = useState<SceneTranscript[]>([]);
  const [brandVoices, setBrandVoices] = useState<BrandVoiceMinimal[]>([]);
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<ClipAgentConnection | null>(null);

  // Fetch brand voices on mount
  useEffect(() => {
    getBrandVoicesMinimal()
      .then((voices) => {
        setBrandVoices(voices);
        // Auto-select default brand voice if one exists
        const defaultVoice = voices.find((v) => v.isDefault);
        if (defaultVoice) {
          setSelectedBrandVoiceId(defaultVoice.id);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch brand voices:', err);
      });
  }, []);

  // Connect to WebSocket on mount
  useEffect(() => {
    const connection = createClipConnection();
    connectionRef.current = connection;

    // Set up event handlers
    connection.on('connected', (event: ClipEvent) => {
      setIsConnected(true);
      setConnectionError(null);
      if (event.phase) {
        setConversationPhase(event.phase);
      }
    });

    connection.on('processing', () => {
      setIsLoading(true);
    });

    // Handle conversation response (no clip yet)
    connection.on('conversation', (event: ClipEvent) => {
      setIsLoading(false);

      if (event.phase) {
        setConversationPhase(event.phase);
      }
      if (event.transcript) {
        setTranscript(event.transcript);
      }

      if (event.message) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: event.message,
          options: event.options,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    });

    // Handle clip generated
    connection.on('clip_generated', (event: ClipEvent) => {
      setIsLoading(false);

      if (event.phase) {
        setConversationPhase(event.phase);
      }
      if (event.transcript) {
        setTranscript(event.transcript);
      }

      if (event.clip) {
        setCurrentClip(event.clip);
        onClipUpdate(event.clip);
      }

      if (event.message) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: event.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    });

    connection.on('error', (event: ClipEvent) => {
      setIsLoading(false);
      setConnectionError(event.message || event.error || 'Unknown error');

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: event.message || event.error || 'Something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    });

    // Connect
    connection.connect().catch((err) => {
      console.error('Failed to connect to clip agent:', err);
      setConnectionError('Failed to connect. Using offline mode.');
    });

    // Cleanup on unmount
    return () => {
      connection.disconnect();
    };
  }, [onClipUpdate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSend = useCallback(
    (messageText?: string) => {
      const text = messageText || inputValue.trim();
      if (!text || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      // Send to WebSocket if connected
      if (connectionRef.current?.isConnected()) {
        if (currentClip) {
          // Edit existing clip
          connectionRef.current.edit(text, currentClip);
        } else if (messages.length <= 1) {
          // First message - start new conversation with optional brand voice
          connectionRef.current.generate(text, selectedBrandVoiceId ?? undefined);
        } else {
          // Continue conversation
          connectionRef.current.sendMessage(text);
        }
      } else {
        // Fallback: Use mock data if not connected
        setTimeout(() => {
          const mockClip = getMockClip();
          setCurrentClip(mockClip);
          onClipUpdate(mockClip);

          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: getMockResponse(mockClip),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setIsLoading(false);
        }, 1500);
      }
    },
    [inputValue, isLoading, currentClip, onClipUpdate, messages.length, selectedBrandVoiceId]
  );

  // Handle clicking an option button
  const handleOptionClick = useCallback(
    (option: string) => {
      handleSend(option);
    },
    [handleSend]
  );

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get phase indicator text
  const getPhaseText = () => {
    switch (conversationPhase) {
      case 'discovery':
        return 'Getting to know your goals';
      case 'hook':
        return 'Crafting your hook';
      case 'story':
        return 'Building your story';
      case 'ready_to_generate':
        return 'Ready to generate';
      case 'generating':
        return 'Creating your clip';
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="text-cyan-400" />
        </div>
        <div>
          <h2 className="font-semibold text-primary text-sm">Clip Creator</h2>
          <p className="text-xs text-muted">Chat to create your clip</p>
        </div>
      </div>

      {/* Connection & Phase status */}
      <div className="px-4 py-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            {connectionError ? (
              <>
                <FontAwesomeIcon icon={faCircleExclamation} className="text-yellow-400" />
                <span className="text-yellow-400">Offline mode</span>
              </>
            ) : isConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-muted">Connected</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-muted">Connecting...</span>
              </>
            )}
          </div>
          {getPhaseText() && (
            <div className="text-xs text-cyan-400/70">{getPhaseText()}</div>
          )}
        </div>
      </div>

      {/* Brand Voice Selector */}
      {brandVoices.length > 0 && (
        <div className="px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <label htmlFor="brand-voice-select" className="text-xs text-muted whitespace-nowrap">
              Brand Voice:
            </label>
            <select
              id="brand-voice-select"
              value={selectedBrandVoiceId ?? ''}
              onChange={(e) => setSelectedBrandVoiceId(e.target.value ? Number(e.target.value) : null)}
              disabled={messages.length > 1}
              className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-primary focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">No brand voice</option>
              {brandVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.toneDisplay})
                </option>
              ))}
            </select>
          </div>
          {messages.length > 1 && (
            <p className="text-xs text-muted/60 mt-1">
              Brand voice is locked after starting a conversation
            </p>
          )}
        </div>
      )}

      {/* Transcript preview (when available) */}
      {transcript.length > 0 && (
        <div className="px-4 py-2 border-b border-white/5 bg-white/2">
          <div className="text-xs text-muted mb-1">Story so far:</div>
          <div className="space-y-1">
            {transcript.map((scene, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-cyan-400 font-mono">{scene.scene}.</span>
                <span className="text-secondary">{scene.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-4 py-3 text-sm
                  ${
                    message.role === 'user'
                      ? 'bg-cyan-500/20 text-primary'
                      : 'bg-white/5 text-secondary'
                  }
                `}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>

            {/* Clickable options */}
            {message.options && message.options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 pl-2">
                {message.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(option)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-muted">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                <span className="text-sm">
                  {conversationPhase === 'generating' || conversationPhase === 'ready_to_generate'
                    ? 'Generating your video...'
                    : 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        {/* Approve button when ready */}
        {conversationPhase === 'ready_to_generate' && transcript.length > 0 && !isLoading && (
          <div className="mb-3">
            <button
              onClick={() => connectionRef.current?.approve()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-green-500 text-slate-900 font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <FontAwesomeIcon icon={faCheck} />
              Generate Video
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentClip
                  ? 'Describe changes to your clip...'
                  : conversationPhase === 'ready_to_generate'
                    ? 'Or type to make changes...'
                    : 'Type your response...'
              }
              rows={1}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-primary placeholder-muted resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-green-500 flex items-center justify-center text-slate-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Fallback mock clip for offline mode
function getMockClip(): SocialClipContent {
  return {
    template: 'explainer',
    scenes: [
      {
        id: 'hook-1',
        type: 'hook',
        timing: { start: 0, end: 4500 },
        content: {
          headline: 'Your chatbot is lying to users',
          body: 'RAG fixes this.',
          visual: {
            type: 'icon',
            icon: 'robot',
            size: 'large',
            animation: 'bounce',
          },
        },
      },
      {
        id: 'point-1',
        type: 'point',
        timing: { start: 4500, end: 14500 },
        content: {
          headline: 'What is RAG?',
          body: 'Retrieval-Augmented Generation connects your AI to real data sources.',
          bullets: ['Vector databases', 'Semantic search', 'Contextual responses'],
          visual: {
            type: 'icon',
            icon: 'database',
            size: 'medium',
            animation: 'fade',
          },
        },
      },
      {
        id: 'point-2',
        type: 'point',
        timing: { start: 14500, end: 24500 },
        content: {
          headline: 'How it works',
          visual: {
            type: 'icon',
            icon: 'gears',
            size: 'medium',
            animation: 'pulse',
          },
          code: `query = "How do I reset my password?"
docs = vector_db.search(query, k=3)
context = "\\n".join(docs)
response = llm.generate(query, context)`,
          codeLanguage: 'python',
        },
      },
      {
        id: 'point-3',
        type: 'point',
        timing: { start: 24500, end: 34500 },
        content: {
          headline: 'Why it matters',
          body: 'Your AI becomes accurate, up-to-date, and trustworthy.',
          visual: {
            type: 'icon',
            icon: 'shield',
            size: 'medium',
            animation: 'zoom',
          },
          bullets: ['No more hallucinations', 'Real-time data', 'Source citations'],
        },
      },
      {
        id: 'cta-1',
        type: 'cta',
        timing: { start: 34500, end: 39000 },
        content: {
          headline: 'Follow for more AI tips',
          body: 'allthriveai.com',
          visual: {
            type: 'image',
            src: '/all-thrvie-logo.png',
            size: 'medium',
          },
        },
      },
    ],
    duration: 39000,
    style: {
      primaryColor: '#22D3EE',
      accentColor: '#10B981',
    },
  };
}

function getMockResponse(clip: SocialClipContent): string {
  const scenes = clip.scenes;
  const hook = scenes.find((s) => s.type === 'hook');
  const points = scenes.filter((s) => s.type === 'point' || s.type === 'example');
  const cta = scenes.find((s) => s.type === 'cta');

  const parts = [`I've created your clip! Here's the breakdown:\n`];

  if (hook) {
    parts.push(`**Hook:** "${hook.content.headline}"`);
  }

  if (points.length > 0) {
    parts.push('\n**Key Points:**');
    points.forEach((p, i) => {
      parts.push(`${i + 1}. ${p.content.headline}`);
    });
  }

  if (cta) {
    parts.push(`\n**CTA:** "${cta.content.headline}"`);
  }

  parts.push(`\n**Duration:** ${(clip.duration / 1000).toFixed(1)} seconds`);
  parts.push("\nThe preview is now playing! Let me know if you'd like to:");
  parts.push('- Change the hook or make it more attention-grabbing');
  parts.push('- Add, remove, or reorder points');
  parts.push('- Adjust the pacing or timing');
  parts.push('- Change the visual style or add icons');

  return parts.join('\n');
}
