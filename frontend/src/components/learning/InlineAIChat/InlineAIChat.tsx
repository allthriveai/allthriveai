/**
 * InlineAIChat Component
 *
 * Chat-style interface for ai_prompt exercises.
 * Connects to the real Sage AI via WebSocket for intelligent, contextual responses.
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane,
  faSpinner,
  faCheck,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import { ChatCore } from '@/components/chat/core';
import type { ChatCoreState } from '@/components/chat/core/types';
import type { Exercise } from '../SimulatedTerminal/types';
import type { SkillLevel } from '@/services/personalization';

interface InlineAIChatProps {
  exercise: Exercise;
  skillLevel: SkillLevel;
  /** Unique ID for the lesson/exercise to create isolated conversation */
  lessonId?: string;
  /** Learning path slug for conversation context */
  pathSlug?: string;
  onComplete?: (stats: { hintsUsed: number; attempts: number; timeSpentMs: number }) => void;
  onAskForHelp?: () => void;
}

/** Props for the inner chat UI component */
interface InlineChatUIProps {
  state: ChatCoreState;
  exercise: Exercise;
  levelContent: { instructions?: string; hints: string[] };
  localInput: string;
  setLocalInput: (value: string) => void;
  isCompleted: boolean;
  setIsCompleted: (value: boolean) => void;
  attempts: number;
  setAttempts: React.Dispatch<React.SetStateAction<number>>;
  startTime: number;
  onComplete?: InlineAIChatProps['onComplete'];
  buildContextMessage: (userMessage: string) => string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Inner component that safely uses hooks (not inside render props)
 */
function InlineChatUI({
  state,
  exercise,
  levelContent,
  localInput,
  setLocalInput,
  isCompleted,
  setIsCompleted,
  attempts,
  setAttempts,
  startTime,
  onComplete,
  buildContextMessage,
  inputRef,
  messagesContainerRef,
}: InlineChatUIProps) {
  // Filter to only show text messages (not tool outputs, etc.)
  const displayMessages = useMemo(
    () => state.messages.filter(
      (m) => m.content && typeof m.content === 'string' && m.content.trim()
    ),
    [state.messages]
  );

  // Scroll to bottom of messages container (not the whole page)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [displayMessages.length, messagesContainerRef]);

  // Track completion after first AI response
  useEffect(() => {
    const hasAssistantResponse = displayMessages.some(m => m.sender === 'assistant');
    if (hasAssistantResponse && !isCompleted) {
      setIsCompleted(true);
      onComplete?.({
        hintsUsed: 0,
        attempts: attempts,
        timeSpentMs: Date.now() - startTime,
      });
    }
  }, [displayMessages, isCompleted, setIsCompleted, onComplete, attempts, startTime]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim() || state.isLoading) return;

    const userMessage = localInput.trim();
    setLocalInput('');
    setAttempts((prev) => prev + 1);

    // For the first message, include exercise context
    // For follow-up messages, send as-is (Sage has context from the conversation)
    const messageToSend = displayMessages.length === 0
      ? buildContextMessage(userMessage)
      : userMessage;

    state.sendMessage(messageToSend);
  }, [localInput, state, setLocalInput, setAttempts, displayMessages.length, buildContextMessage]);

  const handleReset = useCallback(() => {
    state.clearMessages();
    setIsCompleted(false);
    setAttempts(0);
    inputRef.current?.focus();
  }, [state, setIsCompleted, setAttempts, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <img
            src="/sage-avatar.png"
            alt="Sage"
            className="w-6 h-6 rounded-full"
          />
          <span className="font-medium text-slate-900 dark:text-white">Try It With Sage</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state.isConnected
                ? 'bg-green-500'
                : 'bg-amber-500 animate-pulse'
            }`}
            title={state.isConnected ? 'Connected' : 'Connecting...'}
          />
          {isCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 text-emerald-500 text-sm"
            >
              <FontAwesomeIcon icon={faCheck} />
              <span>Completed</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700">
        <p className="text-slate-700 dark:text-slate-300 text-sm">
          {levelContent.instructions || exercise.scenario}
        </p>
      </div>

      {/* Chat Messages */}
      <div ref={messagesContainerRef} className="min-h-[120px] max-h-[300px] overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {displayMessages.map((message, index) => {
            // Strip context prefix from user messages for cleaner display
            let displayContent = message.content;
            if (message.sender === 'user') {
              // Remove the inline exercise context we added
              if (displayContent.startsWith('[INLINE EXERCISE')) {
                const parts = displayContent.split('\n\n');
                displayContent = parts.slice(1).join('\n\n') || displayContent;
              } else if (displayContent.startsWith('[Exercise Context:')) {
                const parts = displayContent.split('\n\n');
                displayContent = parts.slice(1).join('\n\n') || displayContent;
              }
            }

            return (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'assistant' && (
                  <img
                    src="/sage-avatar.png"
                    alt="Sage"
                    className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    message.sender === 'user'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {message.sender === 'assistant' ? (
                    // Render markdown for assistant messages
                    <div className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 max-w-none">
                      <ReactMarkdown
                        components={{
                          // Keep links simple in inline chat
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:underline"
                            >
                              {children}
                            </a>
                          ),
                          // Compact paragraphs
                          p: ({ children }) => (
                            <p className="my-1 last:mb-0 first:mt-0">{children}</p>
                          ),
                          // Compact lists
                          ul: ({ children }) => (
                            <ul className="my-1 pl-4 list-disc">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="my-1 pl-4 list-decimal">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="my-0.5">{children}</li>
                          ),
                          // Bold
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                          // Code
                          code: ({ children, className }) => {
                            const isInline = !className;
                            if (isInline) {
                              return (
                                <code className="bg-slate-100 dark:bg-slate-600 px-1 py-0.5 rounded text-xs">
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <code className="block bg-slate-100 dark:bg-slate-600 p-2 rounded text-xs overflow-x-auto">
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {displayContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    // Plain text for user messages
                    <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading indicator */}
        {state.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <img
              src="/sage-avatar.png"
              alt="Sage"
              className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
            />
            <div className="bg-white dark:bg-slate-700 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 text-slate-500">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                <span className="text-sm">
                  {state.currentTool ? `Using ${state.currentTool}...` : 'Thinking...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state prompt */}
        {displayMessages.length === 0 && !state.isLoading && (
          <div className="text-center text-slate-500 dark:text-slate-400 py-4">
            <p className="text-sm">Type your response below to chat with Sage</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={2}
            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm"
          />
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={!localInput.trim() || state.isLoading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={state.isLoading ? faSpinner : faPaperPlane} className={state.isLoading ? 'animate-spin' : ''} />
            </button>
            {displayMessages.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                title="Start over"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
      </form>
    </div>
  );
}

export function InlineAIChat({
  exercise,
  skillLevel,
  lessonId,
  pathSlug,
  onComplete,
}: InlineAIChatProps) {
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [localInput, setLocalInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Get content for current skill level
  const levelContent = useMemo(() =>
    exercise.contentByLevel?.[skillLevel] ||
    exercise.contentByLevel?.beginner ||
    { instructions: exercise.scenario, hints: [] },
    [exercise.contentByLevel, exercise.scenario, skillLevel]
  );

  // Generate a stable conversation ID for this exercise
  // Using exercise ID + lesson ID to isolate conversations per exercise
  const conversationId = useMemo(() => {
    const exerciseId = exercise.scenario?.slice(0, 30).replace(/\W/g, '-') || 'exercise';
    const lessonPart = lessonId || 'lesson';
    const pathPart = pathSlug || 'path';
    return `inline-${pathPart}-${lessonPart}-${exerciseId}-${user?.id || 'anon'}`;
  }, [exercise.scenario, lessonId, pathSlug, user?.id]);

  // Build context message to send to Sage
  // This tells Sage to stay focused on the exercise and not search for projects
  const buildContextMessage = useCallback((userMessage: string) => {
    const contextParts = [
      `[INLINE EXERCISE - Stay focused on this specific exercise. Do NOT use find_content or show projects.]`,
      `[Exercise: "${levelContent.instructions || exercise.scenario}"]`,
      '',
      userMessage,
    ];
    return contextParts.join('\n');
  }, [levelContent.instructions, exercise.scenario]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ChatCore
      conversationId={conversationId}
      context="learn"
      enableOnboarding={false}
    >
      {(state) => (
        <InlineChatUI
          state={state}
          exercise={exercise}
          levelContent={levelContent}
          localInput={localInput}
          setLocalInput={setLocalInput}
          isCompleted={isCompleted}
          setIsCompleted={setIsCompleted}
          attempts={attempts}
          setAttempts={setAttempts}
          startTime={startTime}
          onComplete={onComplete}
          buildContextMessage={buildContextMessage}
          inputRef={inputRef}
          messagesContainerRef={messagesContainerRef}
        />
      )}
    </ChatCore>
  );
}
