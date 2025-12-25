/**
 * ChatMessageList - Scrollable message container with auto-scroll
 *
 * Features:
 * - Auto-scroll to bottom on new messages (unless user scrolled up)
 * - Renders appropriate message component based on message type
 * - Supports generated images, inline games, onboarding steps
 * - Loading indicator with tool status
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserMessage,
  AssistantMessage,
  LoadingMessage,
  GameMessage,
  OnboardingMessage,
  GeneratingImageMessage,
  ProjectImportOptionsMessage,
  IntegrationCardsMessage,
  ProfileQuestionMessage,
  InlineActionsMessage,
  AvatarCreationMessage,
} from '../messages';
import { GeneratedImageMessage } from '../GeneratedImageMessage';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import type { ChatMessageListProps } from './types';
import type { ChatMessage } from '@/hooks/useIntelligentChat';

export function ChatMessageList({
  messages,
  isLoading,
  currentTool,
  onCancelProcessing,
  userAvatarUrl,
  customEmptyState,
  greetingConfig,
  onboarding,
  avatarCreation,
  onCreateProjectFromImage,
  onNavigate,
  autoScroll = true,
  onProjectImportOptionSelect,
  onIntegrationSelect,
  connectionStatus,
  onConnectFigma,
  onFigmaUrlSubmit,
  onProfileQuestionAnswer,
  onInlineActionClick,
  onOpenProjectPreview,
}: ChatMessageListProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  // Handle navigation - close chat and navigate
  const handleNavigate = useCallback((path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  }, [navigate, onNavigate]);

  // Check if user is near bottom of chat
  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 150;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll to track if user has scrolled up
  const handleScroll = useCallback(() => {
    if (autoScroll) {
      setUserHasScrolledUp(!isNearBottom());
    }
  }, [autoScroll, isNearBottom]);

  // Auto-scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (!autoScroll) return;

    if (messages.length > 0 && !userHasScrolledUp) {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, userHasScrolledUp, autoScroll]);

  // Reset scroll state when user sends a message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'user') {
        setUserHasScrolledUp(false);
        setTimeout(() => {
          const container = containerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 50);
      }
    }
  }, [messages.length]);

  // Auto-scroll when avatar creation becomes active
  useEffect(() => {
    if (avatarCreation?.isActive) {
      // Small delay to ensure the component has rendered
      setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }, [avatarCreation?.isActive]);

  // Render a single message based on its type
  const renderMessage = (message: ChatMessage) => {
    const metadata = message.metadata;

    // User message
    if (message.sender === 'user') {
      return <UserMessage content={message.content} variant="neon" avatarUrl={userAvatarUrl} />;
    }

    // Check metadata type for special message types
    if (metadata?.type === 'generating') {
      return <GeneratingImageMessage message={message.content} />;
    }

    if (metadata?.type === 'generated_image' && metadata.imageUrl) {
      return (
        <ChatErrorBoundary resetKey={`generated-image-${message.id}`}>
          <GeneratedImageMessage
            imageUrl={metadata.imageUrl}
            filename={metadata.filename || 'generated-image.png'}
            sessionId={metadata.sessionId}
            iterationNumber={metadata.iterationNumber}
            onCreateProject={onCreateProjectFromImage}
          />
        </ChatErrorBoundary>
      );
    }

    if (metadata?.type === 'inline_game' && metadata.gameType) {
      return (
        <GameMessage
          gameType={metadata.gameType}
          gameConfig={metadata.gameConfig}
          explanation={metadata.explanation}
        />
      );
    }

    if (metadata?.type === 'project_import_options' && onProjectImportOptionSelect) {
      return (
        <ProjectImportOptionsMessage
          onOptionSelect={onProjectImportOptionSelect}
        />
      );
    }

    if (metadata?.type === 'integration_picker' && onIntegrationSelect && connectionStatus) {
      return (
        <IntegrationCardsMessage
          onIntegrationSelect={onIntegrationSelect}
          connectionStatus={connectionStatus}
        />
      );
    }

    if (metadata?.type === 'profile_question' && metadata.profileQuestion && onProfileQuestionAnswer) {
      return (
        <ChatErrorBoundary resetKey={`profile-question-${message.id}`}>
          <ProfileQuestionMessage
            config={metadata.profileQuestion}
            onAnswer={onProfileQuestionAnswer}
          />
        </ChatErrorBoundary>
      );
    }

    if (metadata?.type === 'inline_actions' && metadata.actions && onInlineActionClick) {
      return (
        <InlineActionsMessage
          content={message.content}
          actions={metadata.actions}
          onActionClick={onInlineActionClick}
        />
      );
    }

    // Figma connect message - shows connect button inline
    if (metadata?.type === 'figma_connect' && onConnectFigma) {
      return (
        <AssistantMessage
          content={message.content}
          variant="neon"
          onNavigate={handleNavigate}
          showFigmaConnectButton={true}
          onConnectFigma={onConnectFigma}
        />
      );
    }

    // Figma URL input message - shows URL form inline
    if (metadata?.type === 'figma_url_input' && onFigmaUrlSubmit) {
      return (
        <AssistantMessage
          content={message.content}
          variant="neon"
          onNavigate={handleNavigate}
          showFigmaUrlInput={true}
          onFigmaUrlSubmit={onFigmaUrlSubmit}
        />
      );
    }

    // Regular assistant message (may have attached learning content cards)
    if (message.content) {
      return (
        <AssistantMessage
          content={message.content || ''}
          variant="neon"
          onNavigate={handleNavigate}
          learningContent={metadata?.learningContent}
          onOpenProjectPreview={onOpenProjectPreview}
        />
      );
    }

    return null;
  };

  // Show empty state if no messages and no greeting
  const showEmptyState = messages.length === 0 && !greetingConfig && !onboarding?.isActive && !avatarCreation?.isActive;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-6"
    >
      <div className="space-y-4">
        {/* Onboarding step - shown when onboarding is active */}
        {onboarding?.isActive && <OnboardingMessage onboarding={onboarding} />}

        {/* Custom empty state */}
        {showEmptyState && customEmptyState}

        {/* Messages */}
        {messages.map((message) => {
          // Center game messages, otherwise use normal alignment
          const isGameMessage = message.metadata?.type === 'inline_game';
          const alignment = message.sender === 'user'
            ? 'justify-end'
            : isGameMessage
              ? 'justify-center'
              : 'justify-start';

          return (
            <div
              key={message.id}
              className={`flex ${alignment}`}
            >
              {renderMessage(message)}
            </div>
          );
        })}

        {/* Standalone avatar creation - shown after messages when triggered via AI */}
        {avatarCreation?.isActive && <AvatarCreationMessage avatarCreation={avatarCreation} />}

        {/* Loading indicator */}
        {isLoading && (
          <LoadingMessage
            currentTool={currentTool}
            onCancel={onCancelProcessing}
            variant="neon"
          />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
