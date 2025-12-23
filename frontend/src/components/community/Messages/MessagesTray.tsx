/**
 * Messages Tray Component
 *
 * A slide-in tray for direct messages that can be opened from any page.
 * Shows thread list on the left, active conversation on the right.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, ArrowLeftIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useMessagesTray } from '@/context/MessagesTrayContext';
import { useAuth } from '@/hooks/useAuth';
import { useDMThread } from '@/hooks/useDMThread';
import { useDMSuggestions } from '@/hooks/useDMSuggestions';
import { getDMThreads, createDMThread } from '@/services/community';
import { globalSearch } from '@/services/globalSearch';
import { DMThreadList } from './DMThreadList';
import { MessageBubble } from '../Room/MessageBubble';
import { MessageComposer } from '../Room/MessageComposer';
import type { DirectMessageThread } from '@/types/community';
import type { UserSearchResult } from '@/types/search';

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
                  {selectedThreadId ? 'Conversation' : 'My Messages'}
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

// Thread List View with Search
function ThreadListView({
  threads,
  isLoading,
  onSelectThread,
}: {
  threads: DirectMessageThread[];
  isLoading: boolean;
  onSelectThread: (threadId: string) => void;
}) {
  const [isNewMessageMode, setIsNewMessageMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: suggestions, isLoading: isLoadingSuggestions } = useDMSuggestions(6);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await globalSearch({
          query: searchQuery,
          types: ['users'],
          limit: 5,
        });
        setSearchResults(response.results.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle clicking on a user to start a conversation
  const handleUserClick = useCallback(async (userId: number | string) => {
    if (isCreatingThread) return;

    setIsCreatingThread(true);
    try {
      const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const thread = await createDMThread({
        participantIds: [numericId],
      });
      setIsNewMessageMode(false);
      setSearchQuery('');
      onSelectThread(thread.id);
    } catch (error) {
      console.error('Failed to create DM thread:', error);
    } finally {
      setIsCreatingThread(false);
    }
  }, [isCreatingThread, onSelectThread]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // New message mode - show search and suggestions
  if (isNewMessageMode || threads.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with back button (only if has threads) */}
        {threads.length > 0 && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-white/10">
            <button
              onClick={() => {
                setIsNewMessageMode(false);
                setSearchQuery('');
              }}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to conversations
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="flex-shrink-0 p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for someone to message..."
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              autoFocus
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Search Results */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Search Results
              </h3>
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.id)}
                    disabled={isCreatingThread}
                    className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{user.fullName || user.username}</p>
                      <p className="text-sm text-slate-400">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Search Results */}
          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">No users found for "{searchQuery}"</p>
            </div>
          )}

          {/* Suggested Users (when not searching) */}
          {!searchQuery.trim() && (
            <>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Suggested
              </h3>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : suggestions && suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => handleUserClick(user.userId)}
                      disabled={isCreatingThread}
                      className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                          <span className="text-white font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="text-white font-medium">{user.displayName || user.username}</p>
                        <p className="text-sm text-slate-400">@{user.username}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full text-slate-400 bg-slate-500/10">
                        {user.matchReason}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Search for someone to start a conversation
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Normal thread list view
  return (
    <div className="h-full flex flex-col">
      {/* New Message Button */}
      <div className="flex-shrink-0 p-3 border-b border-white/10">
        <button
          onClick={() => setIsNewMessageMode(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-400 rounded-xl transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          New Message
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        <DMThreadList
          threads={threads}
          onThreadSelect={onSelectThread}
        />
      </div>
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
