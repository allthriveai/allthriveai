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
import { ChatPlusMenu, type IntegrationType } from '@/components/chat/ChatPlusMenu';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import ReactMarkdown from 'react-markdown';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';

function EmberHomeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Feeling options that appear as pills after typing
  const feelingOptions = useMemo(() => [
    { label: 'Get inspired', message: "I want to see what's possible" },
    { label: 'Challenge myself', message: "I'm ready for a challenge" },
    { label: 'Learn something new', message: "I want to grow my skills" },
    { label: 'Connect with others', message: "I want to find my people" },
    { label: 'Share my work', message: "I have something to share" },
    { label: 'Surprise me', message: "Surprise me with something fun!" },
  ], []);

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
  const allMessages = [
    { id: 'ember-greeting', sender: 'ember' as const, content: typedGreeting, isTyping: !isTypingComplete, isGreeting: true },
    ...messages,
  ];

  // Show feeling pills with staggered animation
  const [showPills, setShowPills] = useState(false);

  useEffect(() => {
    if (isTypingComplete && messages.length === 0) {
      // Delay showing pills for a moment after typing completes
      const timer = setTimeout(() => setShowPills(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowPills(false);
    }
  }, [isTypingComplete, messages.length]);

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col relative">
      {/* Chat Container */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full relative z-10">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {/* Messages List */}
          <div className="space-y-4">
            {allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-3">
                    <FontAwesomeIcon icon={faDragon} className="w-4 h-4 text-orange-400" />
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.sender === 'user'
                      ? 'max-w-[85%] bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-br-sm'
                      : 'flex-1 glass-subtle rounded-bl-sm'
                  }`}
                >
                  {message.sender === 'user' ? (
                    <span className="text-base">{message.content}</span>
                  ) : (
                    <div className="text-base text-slate-200">
                      {'isGreeting' in message && message.isGreeting ? (
                        // Greeting message - plain text with cursor
                        <>
                          <span className="whitespace-pre-wrap">{message.content}</span>
                          {'isTyping' in message && message.isTyping && (
                            <span className="inline-block w-0.5 h-4 bg-orange-400 ml-0.5 animate-pulse" />
                          )}
                        </>
                      ) : (
                        // Regular AI message - markdown
                        <div className="prose prose-base prose-invert max-w-none">
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
              <div className="flex justify-start pl-11">
                <div className="flex flex-wrap gap-2 max-w-[85%]">
                  {feelingOptions.map((option, idx) => (
                    <button
                      key={option.label}
                      onClick={() => sendMessage(option.message)}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-3">
                  <FontAwesomeIcon icon={faDragon} className="w-4 h-4 text-orange-400" />
                </div>
                <div className="glass-subtle px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-slate-400">
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
