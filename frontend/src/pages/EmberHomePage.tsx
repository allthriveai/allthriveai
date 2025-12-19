/**
 * EmberHomePage - Agentic chat experience for authenticated users
 *
 * A focused chat interface with Ember (the dragon guide).
 * Uses the Neon Glass design system.
 * Wrapped in DashboardLayout for header/footer.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIntelligentChat, type OrchestrationAction } from '@/hooks/useIntelligentChat';
import { useOrchestrationActions } from '@/hooks/useOrchestrationActions';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import { useEmberOnboarding } from '@/hooks/useEmberOnboarding';
import { ChatPlusMenu, type IntegrationType } from '@/components/chat/ChatPlusMenu';
import {
  OnboardingIntroMessage,
  AvatarTemplateSelector,
  AvatarPreviewMessage,
} from '@/components/chat/onboarding';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getPersonalizationSettings } from '@/services/personalization';
import ReactMarkdown from 'react-markdown';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';

// Feeling options that show based on user's signup interests (excitedFeatures)
// Each option maps to specific signup features and triggers different actions
interface FeelingOption {
  id: string;
  label: string;
  signupFeatures: string[]; // Which excitedFeatures trigger this option
  message?: string; // Message to send to Ember
  navigateTo?: string; // URL to navigate to instead of sending message
}

const FEELING_OPTIONS: FeelingOption[] = [
  // portfolio → Share something I've been working on → Project tools
  {
    id: 'share',
    label: 'Share something I\'ve been working on',
    signupFeatures: ['portfolio'],
    message: 'I want to share something I\'ve been working on',
  },
  // battles → Play a game → Navigate to /side-quests
  {
    id: 'play',
    label: 'Play a game',
    signupFeatures: ['battles'],
    navigateTo: '/side-quests',
  },
  // challenges → See this week's challenge → Navigate to /challenge
  {
    id: 'challenge',
    label: 'See this week\'s challenge',
    signupFeatures: ['challenges'],
    navigateTo: '/challenge',
  },
  // microlearning, learning → Learn something new → Learning tools
  {
    id: 'learn',
    label: 'Learn something new',
    signupFeatures: ['microlearning', 'learning'],
    message: 'I want to learn something new about AI',
  },
  // marketplace → Sell a product or service → Coming soon
  {
    id: 'marketplace',
    label: 'Sell a product or service',
    signupFeatures: ['marketplace'],
    message: 'I want to sell a product or service',
  },
  // investing → Explore what others are making → Navigate to explore feed
  {
    id: 'explore',
    label: 'Explore what others are making',
    signupFeatures: ['investing'],
    navigateTo: '/explore?tab=new',
  },
  // community → Connect with others → Navigate to /thrive-circle
  {
    id: 'connect',
    label: 'Connect with others',
    signupFeatures: ['community'],
    navigateTo: '/thrive-circle',
  },
  // personalize → Personalize my experience → Profile generation, quiz
  {
    id: 'personalize',
    label: 'Personalize my experience',
    signupFeatures: ['personalize'],
    message: 'Help me personalize my AllThrive experience',
  },
];

function EmberHomeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [excitedFeatures, setExcitedFeatures] = useState<string[]>([]);

  // Fetch user's personalization settings on mount
  useEffect(() => {
    getPersonalizationSettings()
      .then((settings) => {
        setExcitedFeatures(settings.excitedFeatures || []);
      })
      .catch(() => {
        // Silently fail - will use defaults
      });
  }, []);

  // Generate a unique conversation ID for this session
  const [conversationId] = useState(() => `ember-home-${Date.now()}`);

  // Orchestration actions for Ember
  const {
    executeAction: executeOrchestrationAction,
    pendingAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useOrchestrationActions();

  // Handle orchestration action from AI
  const handleOrchestrationAction = useCallback((action: OrchestrationAction) => {
    executeOrchestrationAction(action);
  }, [executeOrchestrationAction]);

  // Intelligent chat hook
  const {
    messages,
    isConnected,
    isLoading,
    currentTool,
    sendMessage,
  } = useIntelligentChat({
    conversationId,
    onOrchestrationAction: handleOrchestrationAction,
    onProjectCreated: (url) => {
      navigate(url);
    },
  });

  // Onboarding chat integration
  const onboarding = useOnboardingChat();

  // Check if user has already personalized (to show different option)
  const { isAdventureComplete } = useEmberOnboarding();
  const hasPersonalized = isAdventureComplete('personalize');

  // Auto-scroll to bottom only when there are actual conversation messages
  useEffect(() => {
    // Only scroll if user has sent messages (not just the greeting)
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Ensure page starts at top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  // Handle integration selection from plus menu
  const handleIntegrationSelect = (type: IntegrationType) => {
    const messageMap: Partial<Record<IntegrationType, string>> = {
      'github': 'I want to import a project from GitHub',
      'gitlab': 'I want to import a project from GitLab',
      'figma': 'I want to import a design from Figma',
      'youtube': 'I want to import a YouTube video as a project',
      'import-url': 'I want to import a project from a URL',
      'create-visual': 'Help me create an image or infographic',
      'upload-media': 'I want to upload media to create a project',
      'describe': 'I want to describe a project to create',
      'ask-help': 'I need help with something',
      'create-product': 'I want to create a product',
    };
    const message = messageMap[type];
    if (message) sendMessage(message);
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Filter feeling options based on user's signup interests (excitedFeatures)
  const feelingOptions = useMemo((): FeelingOption[] => {
    // Helper to get option by id
    const getOption = (id: string) => FEELING_OPTIONS.find((o) => o.id === id)!;

    // Filter options to those matching user's signup features
    const matchingOptions = FEELING_OPTIONS.filter((option) =>
      option.signupFeatures.some((feature) => excitedFeatures.includes(feature))
    );

    // If user has no matching features, show defaults: play, explore, personalize/learn
    if (matchingOptions.length === 0) {
      const defaults = [getOption('play'), getOption('explore')];
      // If already personalized, show "Learn something new" instead
      defaults.push(hasPersonalized ? getOption('learn') : getOption('personalize'));
      return defaults;
    }

    // If user has already personalized, remove that option and add "Learn" instead if not present
    if (hasPersonalized) {
      const filtered = matchingOptions.filter((o) => o.id !== 'personalize');
      const hasLearn = filtered.some((o) => o.id === 'learn');
      if (!hasLearn) {
        filtered.push(getOption('learn'));
      }
      return filtered;
    }

    // Otherwise, always include "Personalize my experience" if not already there
    const hasPersonalizeOption = matchingOptions.some((o) => o.id === 'personalize');
    if (!hasPersonalizeOption) {
      matchingOptions.push(getOption('personalize'));
    }

    return matchingOptions;
  }, [excitedFeatures, hasPersonalized]);

  // Handle clicking a feeling option - either navigate or send message
  const handleFeelingClick = useCallback(
    (option: FeelingOption) => {
      if (option.navigateTo) {
        navigate(option.navigateTo);
      } else if (option.message) {
        sendMessage(option.message);
      }
    },
    [navigate, sendMessage]
  );

  // Generate Ember's greeting message - focused on feelings, not features
  const greetingMessage = useMemo(() => {
    const name = user?.firstName || user?.username || 'there';
    const greeting = getGreeting();
    return `${greeting}, ${name}! How are you feeling about AI today? Whether you're curious, excited, or maybe a little overwhelmed - I'm here to help you thrive.`;
  }, [user?.firstName, user?.username]);

  // Typewriter effect for the greeting
  const [typedGreeting, setTypedGreeting] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  useEffect(() => {
    if (messages.length > 0) {
      // If user has already sent a message, show full greeting immediately
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
        // Vary speed slightly for natural feel
        const delay = Math.random() * 20 + 25; // 25-45ms per character
        setTimeout(typeNextChar, delay);
      } else {
        setIsTypingComplete(true);
      }
    };

    // Start typing after a short delay
    const startDelay = setTimeout(typeNextChar, 500);
    return () => clearTimeout(startDelay);
  }, [greetingMessage, messages.length]);

  // Combine Ember's initial greeting with conversation messages
  // Skip the greeting when onboarding is active - onboarding has its own intro
  const allMessages = onboarding.isOnboardingActive
    ? messages
    : [
        { id: 'ember-greeting', sender: 'ember' as const, content: typedGreeting, isTyping: !isTypingComplete, isGreeting: true },
        ...messages,
      ];

  // Show feeling pills with staggered animation
  // Don't show pills when onboarding is active
  const [showPills, setShowPills] = useState(false);

  useEffect(() => {
    if (isTypingComplete && messages.length === 0 && !onboarding.isOnboardingActive) {
      // Delay showing pills for a moment after typing completes
      const timer = setTimeout(() => setShowPills(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowPills(false);
    }
  }, [isTypingComplete, messages.length, onboarding.isOnboardingActive]);

  // Render onboarding message based on step
  const renderOnboardingStep = () => {
    switch (onboarding.currentStep) {
      case 'intro':
        return (
          <OnboardingIntroMessage
            username={onboarding.username}
            onContinue={onboarding.handleIntroComplete}
            onSkip={onboarding.handleIntroSkip}
          />
        );
      case 'avatar-create':
        return (
          <AvatarTemplateSelector
            selectedTemplate={onboarding.selectedTemplate}
            onSelectTemplate={onboarding.handleSelectTemplate}
            prompt={onboarding.avatarPrompt}
            onPromptChange={onboarding.handlePromptChange}
            onGenerate={onboarding.handleGenerateAvatar}
            onSkip={onboarding.handleSkipAvatar}
            isGenerating={onboarding.isAvatarGenerating}
            isConnecting={onboarding.isAvatarConnecting}
            error={onboarding.avatarError}
            referenceImageUrl={onboarding.referenceImageUrl || undefined}
            onReferenceImageChange={onboarding.handleReferenceImageChange}
          />
        );
      case 'avatar-preview':
        return onboarding.generatedAvatarUrl ? (
          <AvatarPreviewMessage
            imageUrl={onboarding.generatedAvatarUrl}
            onAccept={onboarding.handleAcceptAvatar}
            onRefine={onboarding.handleRefineAvatar}
            onSkip={onboarding.handleSkipPreview}
            isAccepting={onboarding.isAvatarSaving}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col relative">
      {/* Chat Container - matches header/footer max-w-7xl */}
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto py-6">
          {/* Messages List */}
          <div className="space-y-4">
            {/* Onboarding step - shown when onboarding is active */}
            {onboarding.isOnboardingActive && renderOnboardingStep()}

            {/* Regular messages */}
            {allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender !== 'user' && (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
                    <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
                  </div>
                )}
                <div
                  className={`px-5 py-4 rounded-2xl ${
                    message.sender === 'user'
                      ? 'max-w-[85%] bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-br-sm'
                      : 'flex-1 glass-subtle rounded-bl-sm'
                  }`}
                >
                  {message.sender === 'user' ? (
                    <span className="text-lg">{message.content}</span>
                  ) : (
                    <div className="text-lg text-slate-200">
                      {'isGreeting' in message && message.isGreeting ? (
                        // Greeting message - plain text with cursor
                        <>
                          <span className="whitespace-pre-wrap">{message.content}</span>
                          {'isTyping' in message && message.isTyping && (
                            <span className="inline-block w-0.5 h-5 bg-orange-400 ml-0.5 animate-pulse" />
                          )}
                        </>
                      ) : (
                        // Regular AI message - markdown
                        <div className="prose prose-lg prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Feeling pills - appear after greeting types */}
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
                        text-orange-300 hover:text-orange-200
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

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
                  <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
                </div>
                <div className="glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-base text-slate-400">
                      {currentTool ? 'Working on it...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Pending action confirmation */}
        {pendingAction && (
          <div className="mx-4 mb-2 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="w-5 h-5 text-cyan-bright" />
              <p className="text-sm font-medium text-cyan-bright">Confirm action</p>
            </div>
            <p className="text-slate-300 text-sm mb-4">{pendingAction.description}</p>
            <div className="flex gap-3">
              <button onClick={confirmPendingAction} className="btn-primary flex-1 text-sm py-2">
                Yes
              </button>
              <button onClick={cancelPendingAction} className="btn-secondary flex-1 text-sm py-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Input Area - Fixed at Bottom */}
        <div className="p-4 border-t border-white/5 bg-background/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex gap-3 items-center">
            <ChatPlusMenu
              onIntegrationSelect={handleIntegrationSelect}
              disabled={isLoading}
              isOpen={plusMenuOpen}
              onOpenChange={setPlusMenuOpen}
            />
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message Ember..."
                disabled={isLoading}
                className="input-glass w-full pr-12"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRightIcon className="w-4 h-4 text-cyan-bright" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 glass-subtle border border-amber-500/30 rounded-full text-amber-300 text-sm flex items-center gap-2 z-50">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Reconnecting...
        </div>
      )}
    </div>
  );
}

export default function EmberHomePage() {
  return (
    <DashboardLayout>
      <EmberHomeContent />
    </DashboardLayout>
  );
}
