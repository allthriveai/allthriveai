/**
 * Chat Core Module
 *
 * The unified chat system using render props pattern.
 * ChatCore is the single source of truth for chat logic.
 */

export { ChatCore } from './ChatCore';
export { ChatMessageList } from './ChatMessageList';
export { ChatInputArea } from './ChatInputArea';

// Types
export type {
  ChatCoreProps,
  ChatCoreState,
  ChatMessageListProps,
  ChatInputAreaProps,
  ChatContext,
  ArchitectureRegenerateContext,
  ProfileGenerateContext,
  AvatarGenerateContext,
  LearningSetupContext,
  PendingAction,
  OnboardingState,
  IntegrationState,
  IntegrationActions,
  IntegrationId,
  IntegrationFlowStep,
  LoadingMessageProps,
  UserMessageProps,
  AssistantMessageProps,
  OrchestrationPromptProps,
  QuotaExceededBannerProps,
  GameMessageProps,
  OnboardingMessageProps,
} from './types';
