/**
 * LearningChatPanel - Sidebar chat panel for learning paths
 *
 * A focused chat panel that appears alongside curriculum content,
 * allowing users to ask questions about lessons while viewing them.
 *
 * Features:
 * - Shows current lesson context in header
 * - Auto-sends initial message with lesson context
 * - Uses ChatCore for WebSocket management
 * - Compact design for sidebar placement
 */

import { useState, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDragon,
  faTimes,
  faBook,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  ChatCore,
  ChatMessageList,
  ChatInputArea,
} from '@/components/chat/core';

// Lesson context passed from the learning path page
export interface LessonContext {
  lessonTitle: string;
  explanation: string;
  examples?: Array<{ title: string; description: string; code?: string }>;
  practicePrompt?: string;
  keyConcepts?: string[];
}

export interface LearningChatPanelProps {
  context: LessonContext | null;
  pathTitle: string;
  pathSlug: string;
  onClose?: () => void;
}

export function LearningChatPanel({
  context,
  pathTitle,
  pathSlug,
  onClose,
}: LearningChatPanelProps) {
  const { user } = useAuth();
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const lastContextRef = useRef<string | null>(null);

  // Generate a stable conversation ID for this learning path
  const conversationId = useMemo(() => {
    return `learn-${pathSlug}-${user?.id || 'anon'}`;
  }, [pathSlug, user?.id]);

  // Build initial message with lesson context
  const buildInitialMessage = (lessonContext: LessonContext) => {
    const parts = [
      `I'm studying "${lessonContext.lessonTitle}" from my ${pathTitle} learning path.`,
    ];

    if (lessonContext.practicePrompt) {
      parts.push(`\n\nThe practice challenge is: ${lessonContext.practicePrompt}`);
      parts.push('\n\nCan you help me work through this?');
    } else {
      parts.push('\n\nCan you help me understand this concept better?');
    }

    return parts.join('');
  };

  return (
    <ChatCore
      conversationId={conversationId}
      context="learn"
      enableOnboarding={false}
    >
      {(state) => {
        // Auto-send initial message when context changes
        const contextKey = context?.lessonTitle || '';
        if (context && contextKey !== lastContextRef.current && !hasAutoSent) {
          lastContextRef.current = contextKey;
          setHasAutoSent(true);
          // Delay to avoid state update during render
          setTimeout(() => {
            state.sendMessage(buildInitialMessage(context));
          }, 100);
        }

        // Reset auto-sent when context changes to a new lesson
        if (context && contextKey !== lastContextRef.current) {
          setHasAutoSent(false);
        }

        return (
          <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faDragon} className="w-4 h-4 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-white text-sm">Ask Ember</h2>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
                    <FontAwesomeIcon icon={faBook} className="text-[10px]" />
                    <span className="truncate">{context?.lessonTitle || pathTitle}</span>
                  </div>
                </div>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  aria-label="Close chat"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>

            {/* Connection status */}
            <div className="px-4 py-1.5 border-b border-white/5">
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    state.isConnected
                      ? 'bg-green-400'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="text-gray-500">
                  {state.isConnected ? 'Ready to help' : 'Connecting...'}
                </span>
              </div>
            </div>

            {/* Quick context chips (key concepts) */}
            {context?.keyConcepts && context.keyConcepts.length > 0 && (
              <div className="px-4 py-2 border-b border-white/5">
                <div className="flex flex-wrap gap-1">
                  {context.keyConcepts.slice(0, 4).map((concept, i) => (
                    <button
                      key={i}
                      onClick={() => state.sendMessage(`Explain ${concept} in more detail`)}
                      className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-full hover:bg-cyan-500/20 transition-colors"
                    >
                      {concept}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3">
              <ChatMessageList
                messages={state.messages}
                isLoading={state.isLoading}
                currentTool={state.currentTool}
                onCancelProcessing={state.cancelProcessing}
                userAvatarUrl={user?.avatarUrl}
                customEmptyState={
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center mb-3">
                      <FontAwesomeIcon icon={faDragon} className="text-orange-400" />
                    </div>
                    <p className="text-gray-400 text-sm">
                      Ask me anything about this lesson!
                    </p>
                  </div>
                }
              />
            </div>

            {/* Input */}
            <ChatInputArea
              onSendMessage={state.sendMessage}
              isLoading={state.isLoading}
              isUploading={state.isUploading}
              onCancelUpload={state.cancelUpload}
              placeholder="Ask about this lesson..."
              enableAttachments={false}
            />
          </div>
        );
      }}
    </ChatCore>
  );
}

export default LearningChatPanel;
