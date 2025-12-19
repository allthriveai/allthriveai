// Error boundary
export { ChatErrorBoundary } from './ChatErrorBoundary';

// Unified chat architecture
export { ChatSidebar, type ChatSidebarProps } from './ChatSidebar';
export { ChatCore, ChatMessageList, ChatInputArea } from './core';
export { EmbeddedChatLayout, SidebarChatLayout } from './layouts';
export type {
  ChatCoreProps,
  ChatCoreState,
  ChatContext,
  ChatMessageListProps,
  ChatInputAreaProps,
} from './core';

// Message components
export {
  LoadingMessage,
  UserMessage,
  AssistantMessage,
  OrchestrationPrompt,
  QuotaExceededBanner,
  GameMessage,
  OnboardingMessage,
} from './messages';

// Integration components
export {
  useIntegrationFlow,
  GitHubFlow,
  GitLabFlow,
  FigmaFlow,
  IntegrationPicker,
} from './integrations';
