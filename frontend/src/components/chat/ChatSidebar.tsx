/**
 * ChatSidebar - Unified sidebar chat component
 *
 * This replaces IntelligentChatPanel with the consolidated ChatCore architecture.
 * Used by DashboardLayout to show chat in a sliding panel.
 *
 * Props are compatible with IntelligentChatPanel for easy migration.
 */

import { SidebarChatLayout } from './layouts';
import { useStableConversationId, type ChatContext as StableChatContext } from '@/hooks/useStableConversationId';
import type { ChatContext, ArchitectureRegenerateContext, ProfileGenerateContext, LearningSetupContext } from './core';

export interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  context?: ChatContext;
  // Special contexts for DashboardLayout compatibility
  architectureRegenerateContext?: ArchitectureRegenerateContext | null;
  profileGenerateContext?: ProfileGenerateContext | null;
  learningSetupContext?: LearningSetupContext | null;
  // Legacy prop for CreatorSettingsPage - translates to project context
  productCreationMode?: boolean;
  // Expand mode for learning sessions
  defaultExpanded?: boolean;
}

export function ChatSidebar({
  isOpen,
  onClose,
  conversationId,
  context = 'default',
  architectureRegenerateContext = null,
  profileGenerateContext = null,
  learningSetupContext = null,
  productCreationMode = false,
  defaultExpanded = false,
}: ChatSidebarProps) {
  // If productCreationMode is true, use 'project' context (for product creation flows)
  const effectiveContext = productCreationMode ? 'project' : context;

  // Generate stable conversation ID if not provided
  // This ensures chat history persists across page refreshes via LangGraph checkpointing
  const stableConversationId = useStableConversationId({
    context: effectiveContext as StableChatContext,
  });

  // Use provided conversationId if available, otherwise use stable fallback
  const effectiveConversationId = conversationId || stableConversationId;

  return (
    <SidebarChatLayout
      isOpen={isOpen}
      onClose={onClose}
      conversationId={effectiveConversationId}
      context={effectiveContext}
      architectureRegenerateContext={architectureRegenerateContext}
      profileGenerateContext={profileGenerateContext}
      learningSetupContext={learningSetupContext}
      defaultExpanded={defaultExpanded}
    />
  );
}
