/**
 * Content Engine - Conversation-first layout with Echo Creator Coach
 * TASK-030: Refactored to remove tabs, uses EchoConversation + EchoContextPanel
 *
 * Layout:
 * - Desktop: EchoConversation (70%) + EchoContextPanel (30%)
 * - Mobile: EchoConversation full-width, EchoContextPanel as bottom drawer
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { EchoAgentProvider } from '@/context/EchoAgentContext';
import { EchoConversation } from '@/components/content-engine/agent/EchoConversation';
import { EchoContextPanel } from '@/components/content-engine/agent/EchoContextPanel';

// Old tab paths that should redirect to the base content-engine path
const OLD_TAB_PATHS = ['ideas', 'create', 'calendar', 'brand'];

export default function ContentEnginePage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();

  // Generate a unique session ID for this page visit (stable across renders)
  const sessionId = useMemo(() => {
    // Use a stable ID based on timestamp when component mounts
    return `echo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Redirect old tab URLs to the base content-engine path
  useEffect(() => {
    if (tab && OLD_TAB_PATHS.includes(tab)) {
      navigate('/create/content-engine', { replace: true });
    }
  }, [tab, navigate]);

  // Handle idea saved callback
  const handleIdeaSaved = useCallback((ideaId: number, title: string) => {
    // Could show a toast notification here in the future
    console.log(`Idea saved: ${title} (ID: ${ideaId})`);
  }, []);

  return (
    <DashboardLayout>
      <EchoAgentProvider initialMode="idle">
        <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
          {/* Main conversation area - 70% on desktop, full-width on mobile */}
          <main
            role="main"
            aria-label="Content creation conversation with Echo"
            className="flex-1 lg:w-[70%] min-h-0"
          >
            <EchoConversation
              sessionId={sessionId}
              onIdeaSaved={handleIdeaSaved}
              className="h-full"
            />
          </main>

          {/* Context panel - 30% on desktop, drawer on mobile */}
          <EchoContextPanel className="hidden lg:flex" />
        </div>
      </EchoAgentProvider>
    </DashboardLayout>
  );
}
