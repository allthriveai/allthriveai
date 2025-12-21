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
import { GamePicker, type PlayableGameType } from '../games';
import { GitHubFlow, GitLabFlow, FigmaFlow } from '../integrations';
import { Modal } from '@/components/ui/Modal';
import type { ProjectImportOption, ChatMessage } from '@/hooks/useIntelligentChat';
import type { IntegrationId } from '../core/types';
import { checkGitHubConnection } from '@/services/github';
import { checkGitLabConnection } from '@/services/gitlab';
import { checkFigmaConnection } from '@/services/figma';
import { api } from '@/services/api';
import { getSectionFromFeeling, getSectionColor } from '@/utils/sectionColors';

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
    // Note: 'play' is handled specially to show the game picker
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
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const triggerFileSelectRef = useRef<(() => void) | null>(null);
  const dropFilesRef = useRef<((files: File[]) => void) | null>(null);

  // Page-level drag-and-drop state
  const [isPageDragging, setIsPageDragging] = useState(false);
  const pageDragCounterRef = useRef(0);

  // Local messages for canned responses (share flow)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  // Connection status for integrations
  const [connectionStatus, setConnectionStatus] = useState({
    github: false,
    gitlab: false,
    figma: false,
    youtube: false,
    loading: false,
  });

  // Fetch connection statuses
  const fetchConnectionStatuses = useCallback(async () => {
    setConnectionStatus((prev) => ({ ...prev, loading: true }));
    try {
      const [githubConnected, gitlabConnected, figmaConnected] = await Promise.all([
        checkGitHubConnection(),
        checkGitLabConnection(),
        checkFigmaConnection(),
      ]);

      // Check YouTube via Google OAuth
      let youtubeConnected = false;
      try {
        const response = await api.get('/social/status/google/');
        youtubeConnected = response.data?.data?.connected || response.data?.connected || false;
      } catch {
        youtubeConnected = false;
      }

      setConnectionStatus({
        github: githubConnected,
        gitlab: gitlabConnected,
        figma: figmaConnected,
        youtube: youtubeConnected,
        loading: false,
      });
    } catch (error) {
      logError('EmbeddedChatLayout.fetchConnectionStatuses', error);
      setConnectionStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

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
        // Access extended state for integration flow
        const extendedState = state as typeof state & {
          integrationFlow: ReturnType<typeof import('../integrations').useIntegrationFlow>;
        };
        const integrationFlow = extendedState.integrationFlow;

        // Handle feeling pill click
        const handleFeelingClick = (option: FeelingOption) => {
          if (option.id === 'play') {
            // Show game picker instead of sending a message
            setShowGamePicker(true);
            return;
          }
          if (option.id === 'share') {
            // Intercept "share" pill - show canned response with project import options
            const timestamp = Date.now();

            // Add user message
            const userMessage: ChatMessage = {
              id: `user-share-${timestamp}`,
              content: 'I want to share something I\'ve been working on',
              sender: 'user',
              timestamp: new Date(),
            };

            // Add canned assistant message with project import options
            const assistantMessage: ChatMessage = {
              id: `assistant-import-options-${timestamp}`,
              content: "Great! I'd love to see what you've been creating.",
              sender: 'assistant',
              timestamp: new Date(),
              metadata: {
                type: 'project_import_options',
              },
            };

            setLocalMessages((prev) => [...prev, userMessage, assistantMessage]);
            return;
          }
          if (option.navigateTo) {
            navigate(option.navigateTo);
          } else if (option.message) {
            state.sendMessage(option.message);
          }
        };

        // Handle project import option selection
        const handleProjectImportOptionSelect = (option: ProjectImportOption) => {
          const timestamp = Date.now();

          switch (option) {
            case 'integration': {
              // Show integration picker inline and fetch connection statuses
              fetchConnectionStatuses();
              const integrationMessage: ChatMessage = {
                id: `assistant-integration-picker-${timestamp}`,
                content: '',
                sender: 'assistant',
                timestamp: new Date(),
                metadata: {
                  type: 'integration_picker',
                },
              };
              setLocalMessages((prev) => [...prev, integrationMessage]);
              break;
            }
            case 'url':
              // Send to AI to handle URL import
              state.sendMessage('I want to import a project from a URL');
              break;
            case 'upload':
              // Trigger file picker
              if (triggerFileSelectRef.current) {
                triggerFileSelectRef.current();
              }
              break;
            case 'chrome-extension':
              // Show coming soon modal
              setShowComingSoon(true);
              break;
          }
        };

        // Handle game selection from picker
        const handleGameSelect = (gameType: PlayableGameType) => {
          setShowGamePicker(false);
          // Send message to trigger inline game
          state.sendMessage(`Play ${gameType === 'prompt_battle' ? 'prompt battle' : gameType} game`);
        };

        // Handle integration card selection (from inline integration picker)
        // This triggers the actual OAuth flow / repo picker, not just a message
        const handleIntegrationCardSelect = (integration: IntegrationId) => {
          integrationFlow?.actions.startFlow(integration);
        };

        // Render active integration flow inline (GitHub/GitLab/Figma)
        const renderInlineIntegrationFlow = () => {
          if (!integrationFlow) return null;
          const { state: integrationState } = integrationFlow;

          if (integrationState.activeFlow === 'github') {
            return (
              <div className="flex justify-start">
                <div className="w-full max-w-2xl">
                  <GitHubFlow
                    state={integrationState.github}
                    repos={integrationFlow.githubRepos}
                    searchQuery={integrationFlow.githubSearchQuery}
                    onSearchChange={integrationFlow.setGithubSearchQuery}
                    onSelectRepo={integrationFlow.handleSelectGitHubRepo}
                    onConnect={integrationFlow.handleConnectGitHub}
                    onInstallApp={integrationFlow.handleInstallGitHubApp}
                    onBack={integrationFlow.actions.cancelFlow}
                  />
                </div>
              </div>
            );
          }

          if (integrationState.activeFlow === 'gitlab') {
            return (
              <div className="flex justify-start">
                <div className="w-full max-w-2xl">
                  <GitLabFlow
                    state={integrationState.gitlab}
                    projects={integrationFlow.gitlabProjects}
                    searchQuery={integrationFlow.gitlabSearchQuery}
                    onSearchChange={integrationFlow.setGitlabSearchQuery}
                    onSelectProject={integrationFlow.handleSelectGitLabProject}
                    onConnect={integrationFlow.handleConnectGitLab}
                    onBack={integrationFlow.actions.cancelFlow}
                  />
                </div>
              </div>
            );
          }

          if (integrationState.activeFlow === 'figma') {
            return (
              <div className="flex justify-start">
                <div className="w-full max-w-2xl">
                  <FigmaFlow
                    state={integrationState.figma}
                    onConnect={integrationFlow.handleConnectFigma}
                    onImportUrl={integrationFlow.handleFigmaUrlImport}
                    isFigmaUrl={integrationFlow.isFigmaUrl}
                    onBack={integrationFlow.actions.cancelFlow}
                  />
                </div>
              </div>
            );
          }

          return null;
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
                className="fixed inset-0 z-[100] bg-cyan-500/10 border-4 border-dashed border-cyan-400 flex items-center justify-center pointer-events-none"
                style={{
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-center p-8 rounded-2xl bg-white/80 dark:bg-background/80 border border-cyan-500/30">
                  <div className="text-cyan-600 dark:text-cyan-300 text-2xl font-semibold mb-2">Drop files here</div>
                  <div className="text-cyan-500/70 dark:text-cyan-400/70 text-base">
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
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-600/20 flex items-center justify-center flex-shrink-0 mr-4">
                        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-cyan-500" />
                      </div>
                      <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
                        <div className="text-lg text-slate-700 dark:text-slate-200">
                          <span className="whitespace-pre-wrap">{typedGreeting}</span>
                          {!isTypingComplete && (
                            <span className="inline-block w-0.5 h-5 bg-cyan-500 dark:bg-cyan-400 ml-0.5 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feeling pills */}
                  {showPills && !showGamePicker && (
                    <div className="flex justify-start pl-16">
                      <div className="flex flex-wrap gap-3 max-w-[85%]">
                        {feelingOptions.map((option, idx) => {
                          const sectionId = getSectionFromFeeling(option.id);
                          const sectionColor = getSectionColor(sectionId);
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleFeelingClick(option)}
                              className="px-5 py-2.5 rounded-full text-base font-medium transition-all duration-300
                                border hover:shadow-lg transform hover:scale-105 active:scale-95"
                              style={{
                                animation: `fadeInUp 0.4s ease-out ${idx * 0.1}s both`,
                                background: `linear-gradient(to right, ${sectionColor.gradientFrom}15, ${sectionColor.gradientTo}15)`,
                                borderColor: `${sectionColor.gradientFrom}50`,
                                color: sectionColor.textLight,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = `linear-gradient(to right, ${sectionColor.gradientFrom}25, ${sectionColor.gradientTo}25)`;
                                e.currentTarget.style.borderColor = `${sectionColor.gradientFrom}70`;
                                e.currentTarget.style.boxShadow = `0 0 20px ${sectionColor.gradientFrom}30`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = `linear-gradient(to right, ${sectionColor.gradientFrom}15, ${sectionColor.gradientTo}15)`;
                                e.currentTarget.style.borderColor = `${sectionColor.gradientFrom}50`;
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <span className="dark:hidden">{option.label}</span>
                              <span className="hidden dark:inline" style={{ color: sectionColor.textDark }}>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Game picker (shown when "Play a game" is clicked) */}
                  {showGamePicker && (
                    <div className="flex justify-start pl-16">
                      <div className="max-w-[85%]">
                        <GamePicker
                          onSelectGame={handleGameSelect}
                          onClose={() => setShowGamePicker(false)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Chat messages */}
                  <ChatMessageList
                    messages={[...localMessages, ...state.messages]}
                    isLoading={state.isLoading}
                    currentTool={state.currentTool}
                    onCancelProcessing={state.cancelProcessing}
                    onboarding={state.onboarding}
                    onNavigate={handleNavigate}
                    onProjectImportOptionSelect={handleProjectImportOptionSelect}
                    onIntegrationSelect={handleIntegrationCardSelect}
                    connectionStatus={connectionStatus}
                  />

                  {/* Inline integration flow (GitHub/GitLab/Figma) */}
                  {renderInlineIntegrationFlow()}
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

            {/* Coming Soon Modal for Chrome Extension */}
            <Modal
              isOpen={showComingSoon}
              onClose={() => setShowComingSoon(false)}
              className="!rounded bg-white dark:bg-brand-dark border-slate-200 dark:border-cyan-500/20"
            >
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                  Coming Soon
                </h2>
                <div className="w-16 h-16 mx-auto mb-4 rounded bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
                  <FontAwesomeIcon icon={faDragon} className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Chrome Extension
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  We're working on a Chrome extension to help you save and import content from anywhere on the web. Stay tuned!
                </p>
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="px-6 py-2 rounded bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium hover:from-cyan-600 hover:to-green-600 transition-all shadow-neon"
                >
                  Got it
                </button>
              </div>
            </Modal>
          </div>
        );
      }}
    </ChatCore>
  );
}
