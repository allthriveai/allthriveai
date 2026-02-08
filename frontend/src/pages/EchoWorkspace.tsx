/**
 * EchoWorkspace - Focused chat interface for Echo content coach
 *
 * Clean, distraction-free layout inspired by ChatGPT/Claude.
 * Just you and Echo - no sidebars, no footers, no distractions.
 */

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { FocusedLayout } from '@/components/layouts/FocusedLayout';
import { EchoChat } from '@/components/echo/EchoChat';
import { useAuth } from '@/hooks/useAuth';

export default function EchoWorkspace() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Generate a unique session ID for this page visit (stable across renders)
  const sessionId = useMemo(() => {
    return `echo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Auth loading state
  if (isAuthLoading) {
    return (
      <FocusedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </FocusedLayout>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <FocusedLayout>
      <EchoChat sessionId={sessionId} className="h-full" />
    </FocusedLayout>
  );
}
