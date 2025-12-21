/**
 * Hook for generating stable conversation IDs that persist across page refreshes.
 *
 * This is critical for LangGraph checkpointing - the conversation ID becomes the
 * thread_id in PostgreSQL, which is how conversation history is loaded.
 *
 * Without stable IDs, every page refresh creates a new conversation and the AI
 * loses all context from previous messages.
 *
 * ID Format:
 * - Main Ember chat: `ember-chat-{userId}` (stable per user)
 * - Context-specific: `ember-{context}-{userId}` (stable per user+context)
 * - Project chat: `project-{projectId}` (stable per project)
 * - Anonymous: Falls back to timestamp-based (no persistence)
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';

export type ChatContext = 'default' | 'learn' | 'explore' | 'project' | 'home';

interface UseStableConversationIdOptions {
  /**
   * Context for the chat. Different contexts get separate conversation threads.
   * - 'home' and 'default' share the same main Ember chat thread
   * - 'learn', 'explore', 'project' each get their own thread
   */
  context?: ChatContext;

  /**
   * Project ID for project-specific chats.
   * When provided, uses `project-{projectId}` format.
   */
  projectId?: number | string;

  /**
   * Optional sub-context for project chats (e.g., 'architecture').
   * Results in `project-{projectId}-{subContext}` format.
   */
  subContext?: string;
}

/**
 * Generate a stable conversation ID for the Ember chat.
 *
 * @example
 * // Main Ember chat (home page)
 * const conversationId = useStableConversationId({ context: 'home' });
 * // Returns: 'ember-chat-123' for user ID 123
 *
 * @example
 * // Project-specific chat
 * const conversationId = useStableConversationId({ projectId: 456 });
 * // Returns: 'project-456'
 *
 * @example
 * // Project architecture chat
 * const conversationId = useStableConversationId({ projectId: 456, subContext: 'architecture' });
 * // Returns: 'project-456-architecture'
 */
export function useStableConversationId(options: UseStableConversationIdOptions = {}): string {
  const { user } = useAuth();
  const { context = 'default', projectId, subContext } = options;

  return useMemo(() => {
    // Project-specific chat takes precedence
    if (projectId) {
      const base = `project-${projectId}`;
      return subContext ? `${base}-${subContext}` : base;
    }

    // For authenticated users, use stable user-based ID
    if (user?.id) {
      // 'home' and 'default' share the same main conversation thread
      // This ensures chat history persists whether accessed from sidebar or home page
      if (context === 'home' || context === 'default') {
        return `ember-chat-${user.id}`;
      }
      // Other contexts get separate threads
      return `ember-${context}-${user.id}`;
    }

    // Anonymous users get a timestamp-based ID (no persistence, but prevents errors)
    // This will be regenerated on page refresh, which is expected for non-authenticated users
    return `ember-anon-${Date.now()}`;
  }, [user?.id, context, projectId, subContext]);
}

/**
 * Generate a stable conversation ID without the hook (for non-component contexts).
 * Prefer useStableConversationId() when possible.
 */
export function getStableConversationId(
  userId: number | string | undefined,
  options: Omit<UseStableConversationIdOptions, 'context'> & { context?: ChatContext } = {}
): string {
  const { context = 'default', projectId, subContext } = options;

  if (projectId) {
    const base = `project-${projectId}`;
    return subContext ? `${base}-${subContext}` : base;
  }

  if (userId) {
    if (context === 'home' || context === 'default') {
      return `ember-chat-${userId}`;
    }
    return `ember-${context}-${userId}`;
  }

  return `ember-anon-${Date.now()}`;
}
