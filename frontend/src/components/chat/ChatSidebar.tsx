/**
 * ChatSidebar - Unified sidebar chat component
 *
 * This replaces IntelligentChatPanel with the consolidated ChatCore architecture.
 * Used by DashboardLayout to show chat in a sliding panel.
 *
 * Props are compatible with IntelligentChatPanel for easy migration.
 */

import { SidebarChatLayout } from './layouts';
import type { ChatContext, ArchitectureRegenerateContext, LearningSetupContext } from './core';

export interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  context?: ChatContext;
  // Special contexts for DashboardLayout compatibility
  architectureRegenerateContext?: ArchitectureRegenerateContext | null;
  learningSetupContext?: LearningSetupContext | null;
  // Legacy prop for CreatorSettingsPage - translates to project context
  productCreationMode?: boolean;
}

export function ChatSidebar({
  isOpen,
  onClose,
  conversationId,
  context = 'default',
  architectureRegenerateContext = null,
  learningSetupContext = null,
  productCreationMode = false,
}: ChatSidebarProps) {
  // If productCreationMode is true, use 'project' context (for product creation flows)
  const effectiveContext = productCreationMode ? 'project' : context;
  // Generate a conversation ID if not provided
  const effectiveConversationId = conversationId || `ember-${effectiveContext}-${Date.now()}`;

  return (
    <SidebarChatLayout
      isOpen={isOpen}
      onClose={onClose}
      conversationId={effectiveConversationId}
      context={effectiveContext}
      architectureRegenerateContext={architectureRegenerateContext}
      learningSetupContext={learningSetupContext}
    />
  );
}
