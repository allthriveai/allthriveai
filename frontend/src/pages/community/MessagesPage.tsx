/**
 * Messages Page - Direct Messages
 *
 * Displays list of DM conversations with real-time chat view.
 * Uses Neon Glass design system.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faComments } from '@fortawesome/free-solid-svg-icons';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getDMThreads } from '@/services/community';
import { DMThreadList } from '@/components/community/Messages/DMThreadList';
import { DMThreadView } from '@/components/community/Messages/DMThreadView';
import type { DirectMessageThread } from '@/types/community';

export function MessagesPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load DM threads on mount
  useEffect(() => {
    async function loadThreads() {
      try {
        setLoading(true);
        const threadList = await getDMThreads();
        setThreads(threadList);
      } catch (_err) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    }

    loadThreads();
  }, []);

  const handleThreadSelect = (id: string) => {
    navigate(`/messages/${id}`);
  };

  const handleBack = () => {
    navigate('/messages');
  };

  if (loading) {
    return (
      <DashboardLayout>
        {() => (
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <div className="glass-panel p-8">
              <div className="animate-pulse flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/30"></div>
                <span className="text-slate-400">Loading Messages...</span>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        {() => (
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <div className="glass-panel p-8 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {() => (
        <div className="h-[calc(100vh-8rem)] flex overflow-hidden -mt-4">
          {/* Sidebar - Thread List */}
          <aside className={`w-72 flex-shrink-0 border-r border-white/10 glass-panel rounded-none ${
            threadId ? 'hidden md:block' : ''
          }`}>
            <div className="p-4 border-b border-white/10">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="text-cyan-400" />
                Messages
              </h1>
              <p className="text-sm text-slate-400 mt-1">Direct conversations</p>
            </div>
            <DMThreadList
              threads={threads}
              selectedThreadId={threadId}
              onThreadSelect={handleThreadSelect}
            />
          </aside>

          {/* Main Content - Thread View */}
          <main className={`flex-1 flex flex-col ${
            !threadId ? 'hidden md:flex' : ''
          }`}>
            {threadId ? (
              <DMThreadView threadId={threadId} onBack={handleBack} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <FontAwesomeIcon icon={faComments} className="text-4xl mb-4 text-cyan-400" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </DashboardLayout>
  );
}

export default MessagesPage;
