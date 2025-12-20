/**
 * Shared types for the unified chat core components
 */

import type { ReactNode } from 'react';
import type { ChatMessage, QuotaExceededInfo, OrchestrationAction, InlineGameType } from '@/hooks/useIntelligentChat';
import type { PendingAction } from '@/hooks/useOrchestrationActions';
import type { LearningGoal } from '@/types/models';

// Re-export for convenience
export type { ChatMessage, QuotaExceededInfo, OrchestrationAction, InlineGameType, PendingAction };

// Chat context determines which quick actions to show
export type ChatContext = 'learn' | 'explore' | 'project' | 'default';

// Architecture regeneration context - triggers initial message about fixing architecture
export interface ArchitectureRegenerateContext {
  projectId: number;
  projectTitle: string;
}

// Learning setup context - shows learning goal selection before chat
export interface LearningSetupContext {
  needsSetup: boolean;
  onSelectGoal: (goal: LearningGoal) => void;
  onSkip: () => void;
  isPending: boolean;
}

// Onboarding step types
export type OnboardingStep = 'intro' | 'avatar-create' | 'avatar-preview' | 'complete';

// Avatar template for onboarding
export interface AvatarTemplate {
  id: string;
  label: string;
  icon: string;
  color: string;
  starterPrompt: string;
}

// Onboarding state exposed by ChatCore
export interface OnboardingState {
  isActive: boolean;
  currentStep: OnboardingStep;
  username: string;
  // Avatar creation
  selectedTemplate: string | null;
  avatarPrompt: string;
  referenceImageUrl: string | null;
  generatedAvatarUrl: string | null;
  // Status flags
  isAvatarConnecting: boolean;
  isAvatarGenerating: boolean;
  isAvatarSaving: boolean;
  avatarError: string | null;
  // Handlers
  handleIntroComplete: () => void;
  handleIntroSkip: () => void;
  handleSelectTemplate: (templateId: string) => void;
  handlePromptChange: (prompt: string) => void;
  handleReferenceImageChange: (url: string | null) => void;
  handleGenerateAvatar: () => void;
  handleSkipAvatar: () => void;
  handleAcceptAvatar: () => void;
  handleRefineAvatar: () => void;
  handleSkipPreview: () => void;
}

// Integration flow state machine steps
export type IntegrationFlowStep = 'idle' | 'loading' | 'connect' | 'install' | 'select' | 'importing';

// Integration types
export type IntegrationId = 'github' | 'gitlab' | 'figma' | 'youtube';

// Integration state for a single integration
export interface IntegrationFlowState {
  step: IntegrationFlowStep;
  message: string;
  error: string | null;
}

// Combined integration state
export interface IntegrationState {
  activeFlow: IntegrationId | null;
  github: IntegrationFlowState;
  gitlab: IntegrationFlowState;
  figma: IntegrationFlowState;
  youtube: IntegrationFlowState;
  showPicker: boolean;
  connectionStatus: {
    github: boolean;
    gitlab: boolean;
    figma: boolean;
    youtube: boolean;
    loading: boolean;
  };
}

// Integration actions
export interface IntegrationActions {
  startFlow: (integration: IntegrationId) => void;
  cancelFlow: () => void;
  openPicker: () => void;
  closePicker: () => void;
}

// ChatCore render props state
export interface ChatCoreState {
  // Connection
  isConnected: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  currentTool: string | null;

  // File upload
  isUploading: boolean;
  cancelUpload: () => void;

  // Messages
  messages: ChatMessage[];
  sendMessage: (content: string, attachments?: File[]) => void;
  clearMessages: () => void;
  cancelProcessing: () => void;

  // Integrations
  integrationState: IntegrationState;
  integrationActions: IntegrationActions;

  // Onboarding
  onboarding: OnboardingState | null;

  // Orchestration
  pendingAction: PendingAction | null;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;

  // UI State
  quotaExceeded: QuotaExceededInfo | null;
  dismissQuotaExceeded: () => void;
  error: string | null;
  clearError: () => void;
}

// ChatCore props
export interface ChatCoreProps {
  conversationId: string;
  context?: ChatContext;
  enableOnboarding?: boolean;
  onProjectCreated?: (url: string, title: string) => void;
  onClose?: () => void;
  children: (state: ChatCoreState) => ReactNode;
}

// Message list props
export interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  currentTool: string | null;
  onCancelProcessing?: () => void;
  // Custom empty state
  customEmptyState?: ReactNode;
  // Greeting configuration (for EmberHomePage)
  greetingConfig?: {
    message: string;
    isTyping: boolean;
  };
  // Onboarding renderer
  onboarding?: OnboardingState | null;
  // For rendering generated images
  onCreateProjectFromImage?: (sessionId: number) => Promise<{ projectUrl: string; projectTitle: string }>;
  // Navigation handler for markdown links
  onNavigate?: (path: string) => void;
  // Auto-scroll behavior
  autoScroll?: boolean;
}

// Input area props
export interface ChatInputAreaProps {
  onSendMessage: (content: string, attachments?: File[]) => void;
  isLoading: boolean;
  isUploading?: boolean;
  onCancelUpload?: () => void;
  placeholder?: string;
  disabled?: boolean;
  // File attachments
  enableAttachments?: boolean;
  attachments?: File[];
  onAttachmentsChange?: (files: File[]) => void;
  // Custom prefix (for ChatPlusMenu)
  prefix?: ReactNode;
  // Callback to expose file select trigger function
  onFileSelectRef?: (triggerFn: () => void) => void;
  // Callback to expose file drop handler (for page-level drag-and-drop)
  onDropFilesRef?: (handler: (files: File[]) => void) => void;
}

// Loading message props
export interface LoadingMessageProps {
  currentTool: string | null;
  onCancel?: () => void;
  variant?: 'default' | 'neon'; // default for sidebar, neon for EmberHomePage
}

// User message props
export interface UserMessageProps {
  content: string;
  variant?: 'default' | 'neon';
}

// Assistant message props
export interface AssistantMessageProps {
  content: string;
  variant?: 'default' | 'neon';
  onNavigate?: (path: string) => void;
  // For showing GitHub connect button when AI asks user to connect
  showGitHubConnectButton?: boolean;
  onConnectGitHub?: () => void;
}

// Orchestration prompt props
export interface OrchestrationPromptProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'neon';
}

// Quota exceeded banner props
export interface QuotaExceededBannerProps {
  info: QuotaExceededInfo;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
  variant?: 'default' | 'neon';
}

// Game message props
export interface GameMessageProps {
  gameType: InlineGameType;
  gameConfig?: {
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  /** Topic-specific explanation text to display before the game */
  explanation?: string;
}

// Onboarding message props
export interface OnboardingMessageProps {
  onboarding: OnboardingState;
}
