/**
 * MobileSageBottomSheet - Mobile-optimized Sage chat bottom sheet
 *
 * A collapsible bottom sheet that provides access to Sage on mobile devices.
 * Appears on /learn page and learning path detail pages.
 *
 * Features:
 * - Three height states: collapsed (56px), half (50vh), full (100vh - safe area)
 * - Swipe gestures for state transitions
 * - Portal rendering for proper z-index layering
 * - Reuses ChatCore for all chat functionality
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faBook } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';
import { useBottomSheetGesture, type BottomSheetState } from '@/hooks/useBottomSheetGesture';
import {
  ChatCore,
  ChatMessageList,
  ChatInputArea,
} from '@/components/chat/core';
import { LearningChatPlusMenu, type LearningMenuAction } from './LearningChatPlusMenu';
import type { LessonContext } from './LearningChatPanel';

// Height values for each state (collapsed includes safe area padding)
const HEIGHTS = {
  collapsed: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  half: '50vh',
  full: 'calc(100vh - env(safe-area-inset-top, 0px))',
} as const;

export interface MobileSageBottomSheetProps {
  // Chat configuration
  conversationId: string;
  context?: 'learn' | 'lesson';

  // For lesson context (from LearningPathDetailPage)
  lessonContext?: LessonContext | null;
  pathTitle?: string;
  pathSlug?: string;

  // For learn page
  learningSetupContext?: {
    topic?: string;
    level?: string;
  } | null;
}

export function MobileSageBottomSheet({
  conversationId,
  context = 'learn',
  lessonContext,
  pathTitle,
  pathSlug: _pathSlug,
  learningSetupContext: _learningSetupContext,
}: MobileSageBottomSheetProps) {
  const { user } = useAuth();
  const [sheetState, setSheetState] = useState<BottomSheetState>('collapsed');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileSelectTriggerRef = useRef<(() => void) | null>(null);

  // Use gesture hook for swipe handling
  useBottomSheetGesture({
    sheetRef,
    scrollContainerRef,
    currentState: sheetState,
    onStateChange: setSheetState,
    onDragOffsetChange: setDragOffset,
    onDraggingChange: setIsDragging,
    isEnabled: true,
  });

  // Store file select trigger from ChatInputArea
  const setFileSelectTrigger = useCallback((trigger: () => void) => {
    fileSelectTriggerRef.current = trigger;
  }, []);

  // Handle header tap - toggle between collapsed and half
  const handleHeaderTap = useCallback(() => {
    setSheetState((prev) => (prev === 'collapsed' ? 'half' : 'collapsed'));
  }, []);

  // Handle backdrop tap - collapse
  const handleBackdropTap = useCallback(() => {
    setSheetState('collapsed');
  }, []);

  // Get height style based on current state
  const heightStyle = useMemo(() => {
    const baseHeight = HEIGHTS[sheetState];
    // When dragging, apply offset (all heights are now CSS calc/string values)
    if (isDragging && dragOffset !== 0) {
      return `calc(${baseHeight} - ${dragOffset}px)`;
    }
    return baseHeight;
  }, [sheetState, isDragging, dragOffset]);

  // Get subtitle text
  const subtitle = useMemo(() => {
    if (lessonContext?.lessonTitle) {
      return lessonContext.lessonTitle;
    }
    if (pathTitle) {
      return pathTitle;
    }
    return 'How can I help you learn?';
  }, [lessonContext, pathTitle]);

  // Build initial message for lesson context
  const buildInitialMessage = useCallback((lContext: LessonContext) => {
    const parts = [
      `I'm studying "${lContext.lessonTitle}"${pathTitle ? ` from my ${pathTitle} learning path` : ''}.`,
    ];

    if (lContext.practicePrompt) {
      parts.push(`\n\nThe practice challenge is: ${lContext.practicePrompt}`);
      parts.push('\n\nCan you help me work through this?');
    } else {
      parts.push('\n\nCan you help me understand this concept better?');
    }

    return parts.join('');
  }, [pathTitle]);

  // Only render on mobile (lg:hidden equivalent)
  // We use CSS to hide on desktop, but also check window width for performance
  const content = (
    <>
      {/* Backdrop - visible when expanded */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          sheetState !== 'collapsed' && !isDragging
            ? 'bg-black/30 opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{
          opacity: isDragging ? Math.max(0, 1 - Math.abs(dragOffset) / 300) : undefined,
        }}
        onClick={handleBackdropTap}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-slate-900 rounded-t-2xl shadow-[0_-4px_30px_rgba(0,0,0,0.15)] flex flex-col ${
          isDragging ? '' : 'transition-[height] duration-300 ease-out'
        }`}
        style={{
          height: heightStyle,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal={sheetState !== 'collapsed'}
        aria-label="Ask Sage"
      >
        {/* Drag handle visual indicator */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header - always visible, tappable */}
        <button
          onClick={handleHeaderTap}
          className="flex items-center justify-between px-4 py-2 flex-shrink-0 w-full text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/sage-avatar.png"
              alt="Sage"
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                Ask Sage
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 truncate">
                {context === 'lesson' && (
                  <FontAwesomeIcon icon={faBook} className="text-[10px]" />
                )}
                <span className="truncate max-w-[200px]">{subtitle}</span>
              </div>
            </div>
          </div>
          <FontAwesomeIcon
            icon={faChevronUp}
            className={`text-slate-400 transition-transform duration-300 ${
              sheetState !== 'collapsed' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Expanded content - only render when not collapsed for performance */}
        {sheetState !== 'collapsed' && (
          <ChatCore
            conversationId={conversationId}
            context="learn"
            enableOnboarding={false}
          >
            {(state) => {
              // Build and send initial message for lesson context if needed
              // Note: This is handled in the parent or we skip auto-send on mobile

              return (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Connection status */}
                  <div className="px-4 py-1.5 border-y border-slate-100 dark:border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          state.isConnected
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-amber-500 dark:bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span className="text-slate-500 dark:text-gray-500">
                        {state.isConnected ? 'Ready to help' : 'Connecting...'}
                      </span>
                    </div>
                  </div>

                  {/* Quick context chips (key concepts) - only in lesson context */}
                  {context === 'lesson' &&
                    lessonContext?.keyConcepts &&
                    lessonContext.keyConcepts.length > 0 && (
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                        <div className="flex flex-wrap gap-1">
                          {lessonContext.keyConcepts.slice(0, 4).map((concept, i) => (
                            <button
                              key={i}
                              onClick={() =>
                                state.sendMessage(`Explain ${concept} in more detail`)
                              }
                              className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-500/20 transition-colors"
                            >
                              {concept}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Messages - scrollable */}
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-3 overscroll-y-contain"
                  >
                    <ChatMessageList
                      messages={state.messages}
                      isLoading={state.isLoading}
                      currentTool={state.currentTool}
                      onCancelProcessing={state.cancelProcessing}
                      userAvatarUrl={user?.avatarUrl}
                      customEmptyState={
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                          <img
                            src="/sage-avatar.png"
                            alt="Sage"
                            className="w-16 h-16 rounded-full mb-3"
                          />
                          <p className="text-slate-500 dark:text-gray-400 text-sm">
                            {context === 'lesson'
                              ? 'Ask me anything about this lesson!'
                              : 'What would you like to learn about?'}
                          </p>
                          {context === 'lesson' && lessonContext && (
                            <button
                              onClick={() =>
                                state.sendMessage(buildInitialMessage(lessonContext))
                              }
                              className="mt-3 px-4 py-2 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                            >
                              Help me with this lesson
                            </button>
                          )}
                        </div>
                      }
                    />
                  </div>

                  {/* Input area */}
                  <ChatInputArea
                    onSendMessage={state.sendMessage}
                    isLoading={state.isLoading}
                    isUploading={state.isUploading}
                    onCancelUpload={state.cancelUpload}
                    placeholder={
                      context === 'lesson'
                        ? 'Ask about this lesson...'
                        : 'What do you want to learn?'
                    }
                    enableAttachments={true}
                    onFileSelectRef={setFileSelectTrigger}
                    prefix={
                      <LearningChatPlusMenu
                        disabled={state.isLoading}
                        onAction={(action: LearningMenuAction) => {
                          switch (action) {
                            case 'upload-file':
                              fileSelectTriggerRef.current?.();
                              break;
                            case 'ask-help':
                              state.sendMessage(
                                "What can you help me with while I'm learning?"
                              );
                              break;
                            case 'clear-conversation':
                              state.clearMessages();
                              break;
                          }
                        }}
                      />
                    }
                  />
                </div>
              );
            }}
          </ChatCore>
        )}
      </div>
    </>
  );

  // Render using portal to document body
  return createPortal(content, document.body);
}

export default MobileSageBottomSheet;
