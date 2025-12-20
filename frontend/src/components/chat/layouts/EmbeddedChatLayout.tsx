/**
 * EmbeddedChatLayout - Full-page chat layout for EmberHomePage
 *
 * Features:
 * - Typewriter greeting animation
 * - Feeling pills based on user preferences
 * - Full-page embedded design (not a sidebar)
 * - Neon Glass aesthetic
 * - Integrates with ChatCore via render props
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmberOnboarding } from '@/hooks/useEmberOnboarding';
import { getPersonalizationSettings } from '@/services/personalization';
import { logError } from '@/utils/errorHandler';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import { ChatCore, ChatMessageList, ChatInputArea } from '../core';
import { ChatPlusMenu, type IntegrationType } from '../ChatPlusMenu';
import { OrchestrationPrompt, QuotaExceededBanner } from '../messages';

// Feeling options that show based on user's signup interests
interface FeelingOption {
  id: string;
  label: string;
  signupFeatures: string[];
  message?: string;
  navigateTo?: string;
  // Contextual weights for personalization
  timeOfDay?: ('morning' | 'afternoon' | 'evening')[];
  dayOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
  priority?: number; // Higher = more likely to show
  // Conditional display flags
  requiresNoAvatar?: boolean; // Only show if user has no avatar
}

const FEELING_OPTIONS: FeelingOption[] = [
  {
    id: 'share',
    label: 'Share something I\'ve been working on',
    signupFeatures: ['portfolio'],
    message: 'I want to share something I\'ve been working on',
    timeOfDay: ['afternoon', 'evening'],
    priority: 3,
  },
  {
    id: 'play',
    label: 'Play a game',
    signupFeatures: ['battles'],
    message: 'I want to play a game',
    timeOfDay: ['afternoon', 'evening'],
    dayOfWeek: [0, 5, 6], // Weekends and Friday
    priority: 2,
  },
  {
    id: 'challenge',
    label: 'See this week\'s challenge',
    signupFeatures: ['challenges'],
    message: "Show me this week's challenge",
    dayOfWeek: [1, 2, 3], // Early week for fresh challenges
    priority: 4,
  },
  {
    id: 'learn',
    label: 'Learn something new',
    signupFeatures: ['microlearning', 'learning'],
    message: 'I want to learn something new about AI',
    timeOfDay: ['morning', 'afternoon'],
    priority: 3,
  },
  {
    id: 'marketplace',
    label: 'Sell a product or service',
    signupFeatures: ['marketplace'],
    message: 'I want to sell a product or service',
    timeOfDay: ['morning', 'afternoon'],
    dayOfWeek: [1, 2, 3, 4], // Weekdays
    priority: 2,
  },
  {
    id: 'explore',
    label: 'Explore what others are making',
    signupFeatures: ['community'],
    message: 'Show me what others are making',
    priority: 3,
  },
  {
    id: 'connect',
    label: 'Connect with others',
    signupFeatures: ['community'],
    message: 'Help me find people to connect with',
    priority: 3,
  },
  {
    id: 'personalize',
    label: 'Personalize my experience',
    signupFeatures: ['personalize'],
    message: 'Help me personalize my AllThrive experience',
    priority: 1,
  },
  {
    id: 'trending',
    label: 'What\'s trending today?',
    signupFeatures: ['community', 'portfolio'],
    message: 'Show me what\'s trending today',
    priority: 2,
  },
  {
    id: 'quick-win',
    label: 'Give me a quick win',
    signupFeatures: ['microlearning', 'battles'],
    message: 'I want a quick win to start my day',
    timeOfDay: ['morning'],
    priority: 4,
  },
  {
    id: 'avatar',
    label: 'Make my avatar',
    signupFeatures: ['personalize', 'portfolio', 'community'],
    message: 'Help me create my avatar',
    priority: 5, // High priority to encourage profile completion
    requiresNoAvatar: true,
  },
];

// Maximum pills to show at once
const MAX_PILLS_SHOWN = 4;

// Get contextual score for a pill based on time/day
function getPillContextScore(option: FeelingOption): number {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  let score = option.priority || 1;

  // Time of day bonus
  if (option.timeOfDay) {
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    if (option.timeOfDay.includes(timeOfDay)) {
      score += 2;
    }
  }

  // Day of week bonus
  if (option.dayOfWeek && option.dayOfWeek.includes(day)) {
    score += 2;
  }

  // Add some randomness for variety (0-1.5 bonus)
  score += Math.random() * 1.5;

  return score;
}

// Shuffle array using Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface EmbeddedChatLayoutProps {
  conversationId: string;
}

// Helper component to handle effects that need to run inside ChatCore
function ChatStateEffects({
  messagesLength,
  isTypingComplete,
  isOnboardingActive,
  setHasMessages,
  setShowPills,
}: {
  messagesLength: number;
  isTypingComplete: boolean;
  isOnboardingActive: boolean;
  setHasMessages: (value: boolean) => void;
  setShowPills: (value: boolean) => void;
}) {
  // Track if we have messages
  useEffect(() => {
    setHasMessages(messagesLength > 0);
  }, [messagesLength, setHasMessages]);

  // Show pills after typing completes (if no messages and no onboarding)
  useEffect(() => {
    if (isTypingComplete && messagesLength === 0 && !isOnboardingActive) {
      const timer = setTimeout(() => setShowPills(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowPills(false);
    }
  }, [isTypingComplete, messagesLength, isOnboardingActive, setShowPills]);

  return null;
}

export function EmbeddedChatLayout({ conversationId }: EmbeddedChatLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [excitedFeatures, setExcitedFeatures] = useState<string[]>([]);
  const triggerFileSelectRef = useRef<(() => void) | null>(null);
  const dropFilesRef = useRef<((files: File[]) => void) | null>(null);

  // Page-level drag-and-drop state
  const [isPageDragging, setIsPageDragging] = useState(false);
  const pageDragCounterRef = useRef(0);

  // Page-level drag handlers
  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pageDragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsPageDragging(true);
    }
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pageDragCounterRef.current--;
    if (pageDragCounterRef.current === 0) {
      setIsPageDragging(false);
    }
  }, []);

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPageDragging(false);
    pageDragCounterRef.current = 0;

    // Forward files to the input area's drop handler
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && dropFilesRef.current) {
      const files = Array.from(e.dataTransfer.files);
      dropFilesRef.current(files);
    }
  }, []);

  // Fetch user's personalization settings on mount
  useEffect(() => {
    getPersonalizationSettings()
      .then((settings) => {
        setExcitedFeatures(settings.excitedFeatures || []);
      })
      .catch((error) => {
        // Log error but use defaults - personalization is non-critical
        logError('EmbeddedChatLayout.getPersonalizationSettings', error);
      });
  }, []);

  // Check if user has already personalized
  const { isAdventureComplete } = useEmberOnboarding();
  const hasPersonalized = isAdventureComplete('personalize');

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Generate Ember's greeting message
  const greetingMessage = useMemo(() => {
    const name = user?.firstName || user?.username || 'there';
    const greeting = getGreeting();

    const greetingTemplates = [
      `${greeting}, ${name}! What's on your mind today?`,
      `${greeting}, ${name}! Ready to create something amazing?`,
      `${greeting}, ${name}! What would you like to explore?`,
      `${greeting}, ${name}! I'm here whenever you need me.`,
      `${greeting}, ${name}! What can I help you with today?`,
      `${greeting}, ${name}! Let's make something happen.`,
    ];

    const randomIndex = Math.floor(Math.random() * greetingTemplates.length);
    return greetingTemplates[randomIndex];
  }, [user?.firstName, user?.username]);

  // Typewriter effect for the greeting
  const [typedGreeting, setTypedGreeting] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);

  useEffect(() => {
    if (hasMessages) {
      setTypedGreeting(greetingMessage);
      setIsTypingComplete(true);
      return;
    }

    let index = 0;
    setTypedGreeting('');
    setIsTypingComplete(false);

    const typeNextChar = () => {
      if (index < greetingMessage.length) {
        setTypedGreeting(greetingMessage.slice(0, index + 1));
        index++;
        const delay = Math.random() * 20 + 25;
        setTimeout(typeNextChar, delay);
      } else {
        setIsTypingComplete(true);
      }
    };

    const startDelay = setTimeout(typeNextChar, 500);
    return () => clearTimeout(startDelay);
  }, [greetingMessage, hasMessages]);

  // Check if user has an avatar
  const hasAvatar = Boolean(user?.avatarUrl);

  // Filter and rotate feeling options based on user's signup interests and context
  const feelingOptions = useMemo((): FeelingOption[] => {
    const getOption = (id: string) => FEELING_OPTIONS.find((o) => o.id === id)!;

    // Get all matching options based on signup features
    let matchingOptions = FEELING_OPTIONS.filter((option) =>
      option.signupFeatures.some((feature) => excitedFeatures.includes(feature))
    );

    // Fallback if no features match
    if (matchingOptions.length === 0) {
      matchingOptions = [getOption('play'), getOption('explore'), getOption('learn'), getOption('share')];
    }

    // Remove personalize if already completed
    if (hasPersonalized) {
      matchingOptions = matchingOptions.filter((o) => o.id !== 'personalize');
    } else {
      // Add personalize if not in list and not completed
      const hasPersonalizeOption = matchingOptions.some((o) => o.id === 'personalize');
      if (!hasPersonalizeOption) {
        matchingOptions.push(getOption('personalize'));
      }
    }

    // Filter out avatar pill if user already has an avatar
    if (hasAvatar) {
      matchingOptions = matchingOptions.filter((o) => !o.requiresNoAvatar);
    } else {
      // Add avatar pill if not in list and user doesn't have one
      const hasAvatarOption = matchingOptions.some((o) => o.id === 'avatar');
      if (!hasAvatarOption) {
        matchingOptions.push(getOption('avatar'));
      }
    }

    // Score each option based on context (time, day, priority)
    const scoredOptions = matchingOptions.map((option) => ({
      option,
      score: getPillContextScore(option),
    }));

    // Sort by score (highest first)
    scoredOptions.sort((a, b) => b.score - a.score);

    // Take top N options
    const topOptions = scoredOptions.slice(0, MAX_PILLS_SHOWN).map((s) => s.option);

    // Shuffle the final selection for visual variety
    return shuffleArray(topOptions);
  }, [excitedFeatures, hasPersonalized, hasAvatar]);

  // Show feeling pills with animation
  const [showPills, setShowPills] = useState(false);

  return (
    <ChatCore
      conversationId={conversationId}
      enableOnboarding={true}
      onProjectCreated={(url) => navigate(url)}
    >
      {(state) => {
        // Handle feeling pill click
        const handleFeelingClick = (option: FeelingOption) => {
          if (option.navigateTo) {
            navigate(option.navigateTo);
          } else if (option.message) {
            state.sendMessage(option.message);
          }
        };

        // Handle integration selection from plus menu
        const handleIntegrationSelect = (type: IntegrationType) => {
          if (type === 'clear-conversation') {
            state.clearMessages();
            setTypedGreeting('');
            setIsTypingComplete(false);
            return;
          }

          // Handle upload-media by triggering file picker
          if (type === 'upload-media') {
            if (triggerFileSelectRef.current) {
              triggerFileSelectRef.current();
            }
            return;
          }

          const messageMap: Partial<Record<IntegrationType, string>> = {
            'github': 'I want to import a project from GitHub',
            'gitlab': 'I want to import a project from GitLab',
            'figma': 'I want to import a design from Figma',
            'youtube': 'I want to import a YouTube video as a project',
            'import-url': 'I want to import a project from a URL',
            'create-visual': 'Help me create an image or infographic',
            'describe': 'I want to describe a project to create',
            'ask-help': 'I need help with something',
            'create-product': 'I want to create a product',
          };
          const message = messageMap[type];
          if (message) state.sendMessage(message);
        };

        // Handle internal navigation
        const handleNavigate = (path: string) => {
          navigate(path);
        };

        // Wrap sendMessage to intercept slash commands
        const handleSendMessage = (message: string, attachments?: File[]) => {
          // Handle /clear command
          if (message.trim().toLowerCase() === '/clear') {
            state.clearMessages();
            setTypedGreeting('');
            setIsTypingComplete(false);
            return;
          }
          // Pass through to normal send
          state.sendMessage(message, attachments);
        };

        return (
          <div
            className="min-h-[calc(100vh-12rem)] flex flex-col relative"
            onDragEnter={handlePageDragEnter}
            onDragLeave={handlePageDragLeave}
            onDragOver={handlePageDragOver}
            onDrop={handlePageDrop}
          >
            {/* Page-level drag overlay */}
            {isPageDragging && (
              <div
                className="fixed inset-0 z-[100] bg-orange-500/10 border-4 border-dashed border-orange-400 flex items-center justify-center pointer-events-none"
                style={{
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-center p-8 rounded-2xl bg-white/80 dark:bg-background/80 border border-orange-500/30">
                  <div className="text-orange-600 dark:text-orange-300 text-2xl font-semibold mb-2">Drop files here</div>
                  <div className="text-orange-500/70 dark:text-orange-400/70 text-base">
                    Images, videos, and documents supported
                  </div>
                </div>
              </div>
            )}

            {/* Effects handler - handles useEffect properly as a component */}
            <ChatStateEffects
              messagesLength={state.messages.length}
              isTypingComplete={isTypingComplete}
              isOnboardingActive={state.onboarding?.isActive || false}
              setHasMessages={setHasMessages}
              setShowPills={setShowPills}
            />
            <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto py-6">
                <div className="space-y-4">
                  {/* Greeting message (when no onboarding) */}
                  {!state.onboarding?.isActive && (
                    <div className="flex justify-start">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
                        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
                        <div className="text-lg text-slate-700 dark:text-slate-200">
                          <span className="whitespace-pre-wrap">{typedGreeting}</span>
                          {!isTypingComplete && (
                            <span className="inline-block w-0.5 h-5 bg-orange-500 dark:bg-orange-400 ml-0.5 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feeling pills */}
                  {showPills && (
                    <div className="flex justify-start pl-16">
                      <div className="flex flex-wrap gap-3 max-w-[85%]">
                        {feelingOptions.map((option, idx) => (
                          <button
                            key={option.id}
                            onClick={() => handleFeelingClick(option)}
                            className="px-5 py-2.5 rounded-full text-base font-medium transition-all duration-300
                              bg-gradient-to-r from-orange-500/10 to-amber-500/10
                              border border-orange-500/30
                              text-orange-600 dark:text-orange-300 hover:text-orange-500 dark:hover:text-orange-200
                              hover:border-orange-400/50 hover:from-orange-500/20 hover:to-amber-500/20
                              hover:shadow-[0_0_20px_rgba(251,146,60,0.3)]
                              transform hover:scale-105 active:scale-95"
                            style={{
                              animation: `fadeInUp 0.4s ease-out ${idx * 0.1}s both`,
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat messages */}
                  <ChatMessageList
                    messages={state.messages}
                    isLoading={state.isLoading}
                    currentTool={state.currentTool}
                    onCancelProcessing={state.cancelProcessing}
                    onboarding={state.onboarding}
                    onNavigate={handleNavigate}
                  />
                </div>
              </div>

              {/* Pending action confirmation */}
              {state.pendingAction && (
                <OrchestrationPrompt
                  action={state.pendingAction}
                  onConfirm={state.confirmPendingAction}
                  onCancel={state.cancelPendingAction}
                  variant="neon"
                />
              )}

              {/* Quota exceeded banner */}
              {state.quotaExceeded && (
                <QuotaExceededBanner
                  info={state.quotaExceeded}
                  onDismiss={state.dismissQuotaExceeded}
                  onNavigate={handleNavigate}
                  variant="neon"
                />
              )}

              {/* Input Area */}
              <ChatInputArea
                onSendMessage={handleSendMessage}
                isLoading={state.isLoading}
                isUploading={state.isUploading}
                onCancelUpload={state.cancelUpload}
                placeholder="Message Ember..."
                enableAttachments={true}
                onFileSelectRef={(fn) => { triggerFileSelectRef.current = fn; }}
                onDropFilesRef={(fn) => { dropFilesRef.current = fn; }}
                prefix={
                  <ChatPlusMenu
                    onIntegrationSelect={handleIntegrationSelect}
                    disabled={state.isLoading}
                    isOpen={plusMenuOpen}
                    onOpenChange={setPlusMenuOpen}
                  />
                }
              />
            </div>

            {/* Connection status */}
            {!state.isConnected && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 glass-subtle border border-amber-500/30 rounded-full text-amber-600 dark:text-amber-300 text-sm flex items-center gap-2 z-50">
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                Reconnecting...
              </div>
            )}
          </div>
        );
      }}
    </ChatCore>
  );
}
