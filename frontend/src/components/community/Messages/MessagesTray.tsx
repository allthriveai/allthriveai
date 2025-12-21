/**
 * Messages Tray Component
 *
 * A slide-in tray for direct messages that can be opened from any page.
 * Shows thread list on the left, active conversation on the right.
 */

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useMessagesTray } from '@/context/MessagesTrayContext';
import { useAuth } from '@/hooks/useAuth';
import { useDMThread } from '@/hooks/useDMThread';
import { getDMThreads } from '@/services/community';
import { DMThreadList } from './DMThreadList';
import { MessageBubble } from '../Room/MessageBubble';
import { MessageComposer } from '../Room/MessageComposer';
import type { DirectMessageThread } from '@/types/community';

export function MessagesTray() {
  const { isOpen, selectedThreadId, closeMessagesTray, selectThread } = useMessagesTray();
  const { user, isAuthenticated } = useAuth();

  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount for animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Load threads when tray opens
  useEffect(() => {
    async function loadThreads() {
      if (!isOpen || threadsLoaded || !isAuthenticated) return;

      setIsLoadingThreads(true);
      try {
        const data = await getDMThreads();
        setThreads(data);
        setThreadsLoaded(true);
      } catch (error) {
        console.error('Failed to load DM threads:', error);
      } finally {
        setIsLoadingThreads(false);
      }
    }

    loadThreads();
  }, [isOpen, threadsLoaded, isAuthenticated]);

  // Reset loaded state when tray closes
  useEffect(() => {
    if (!isOpen) {
      setThreadsLoaded(false);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMessagesTray}
        aria-hidden="true"
      />

      {/* Tray */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-white/10 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {selectedThreadId && (
                <button
                  onClick={() => selectThread('')}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-slate-400" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">
                  {selectedThreadId ? 'Conversation' : 'Messages'}
                </h2>
              </div>
            </div>
            <button
              onClick={closeMessagesTray}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {!isAuthenticated ? (
              <div className="flex items-center justify-center h-full p-4">
                <p className="text-slate-400 text-center">
                  Please sign in to view your messages.
                </p>
              </div>
            ) : selectedThreadId ? (
              <ThreadView
                threadId={selectedThreadId}
                currentUserId={user?.id?.toString()}
              />
            ) : (
              <ThreadListView
                threads={threads}
                isLoading={isLoadingThreads}
                onSelectThread={selectThread}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Thread List View
function ThreadListView({
  threads,
  isLoading,
  onSelectThread,
}: {
  threads: DirectMessageThread[];
  isLoading: boolean;
  onSelectThread: (threadId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <DMThreadList
        threads={threads}
        onThreadSelect={onSelectThread}
      />
    </div>
  );
}

// Thread View with real-time messaging
function ThreadView({
  threadId,
  currentUserId,
}: {
  threadId: string;
  currentUserId?: string;
}) {
  const {
    messages,
    typingUsers,
    connectionStatus,
    error,
    threadInfo,
    sendMessage,
    setTyping,
  } = useDMThread(threadId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Get display name for the thread
  const getDisplayName = () => {
    if (!threadInfo) return 'Loading...';
    if (threadInfo.isGroup && threadInfo.name) {
      return threadInfo.name;
    }
    const otherParticipant = threadInfo.participants.find(
      (p) => p.id !== currentUserId
    );
    return otherParticipant?.username || 'Unknown';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-white text-sm font-medium">
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-medium text-white text-sm">{getDisplayName()}</h3>
              <div className={`text-xs flex items-center gap-1 ${
                connectionStatus === 'connected' ? 'text-green-400' :
                connectionStatus === 'connecting' ? 'text-yellow-400' :
                connectionStatus === 'error' ? 'text-red-400' :
                'text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  connectionStatus === 'error' ? 'bg-red-500' :
                  'bg-slate-500'
                }`} />
                {connectionStatus}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-500/20 border-b border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <FontAwesomeIcon icon={faEnvelope} className="text-3xl mb-3 text-cyan-400/50" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.author?.id === currentUserId}
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-slate-400 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-white/10 p-3">
        <MessageComposer
          onSend={sendMessage}
          onTypingChange={setTyping}
          disabled={connectionStatus !== 'connected'}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
}

export default MessagesTray;
