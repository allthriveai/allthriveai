/**
 * EmberHomePage - Unified chat experience for authenticated users
 *
 * A focused chat interface with Ember (the dragon guide).
 * Uses the consolidated ChatCore architecture with EmbeddedChatLayout.
 * Uses the Neon Glass design system.
 * Wrapped in DashboardLayout for header/footer.
 */

import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { EmbeddedChatLayout } from '@/components/chat/layouts';
import { useStableConversationId } from '@/hooks/useStableConversationId';

function EmberHomeContent() {
  // Use stable conversation ID for LangGraph checkpointing persistence
  // This ensures chat history is preserved across page refreshes
  const conversationId = useStableConversationId({ context: 'home' });

  // Ensure page starts at top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return <EmbeddedChatLayout conversationId={conversationId} />;
}

export default function EmberHomePage() {
  return (
    <DashboardLayout>
      <EmberHomeContent />
    </DashboardLayout>
  );
}
