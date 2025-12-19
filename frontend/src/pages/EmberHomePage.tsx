/**
 * EmberHomePage - Unified chat experience for authenticated users
 *
 * A focused chat interface with Ember (the dragon guide).
 * Uses the consolidated ChatCore architecture with EmbeddedChatLayout.
 * Uses the Neon Glass design system.
 * Wrapped in DashboardLayout for header/footer.
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { EmbeddedChatLayout } from '@/components/chat/layouts';

function EmberHomeContent() {
  // Generate a unique conversation ID for this session
  const [conversationId] = useState(() => `ember-home-${Date.now()}`);

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
