/**
 * Room View Component
 *
 * Real-time chat room with message list and composer.
 * Uses Neon Glass design system.
 */

import { useRef, useEffect } from 'react';
import { useCommunityRoom } from '@/hooks/useCommunityRoom';
import { useAuth } from '@/hooks/useAuth';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import type { RoomViewProps } from '@/types/community';

export function RoomView({ roomId }: RoomViewProps) {
  const { user } = useAuth();
  const {
    messages,
    onlineUsers,
    typingUsers,
    connectionStatus,
    error,
    sendMessage,
    setTyping,
    loadMoreMessages,
    hasMoreMessages,
    roomInfo,
  } = useCommunityRoom(roomId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle scroll for loading more messages
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
  };

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleTypingChange = (isTyping: boolean) => {
    setTyping(isTyping);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Room Header */}
      <header className="flex-shrink-0 p-4 border-b border-white/10 glass-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{roomInfo?.emoji || '💬'}</span>
            <div>
              <h2 className="font-semibold text-white">{roomInfo?.name || 'Loading...'}</h2>
              <p className="text-sm text-slate-400">{roomInfo?.description}</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            {/* Online Users */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {onlineUsers.length} online
            </div>

            {/* Connection Indicator */}
            <div className={`flex items-center gap-2 text-sm ${
              connectionStatus === 'connected' ? 'text-green-400' :
              connectionStatus === 'connecting' ? 'text-yellow-400' :
              connectionStatus === 'error' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' :
                'bg-slate-500'
              }`}></span>
              {connectionStatus}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 p-3 bg-red-500/20 border-b border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load More */}
        {hasMoreMessages && (
          <button
            onClick={loadMoreMessages}
            className="w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Load older messages
          </button>
        )}

        {/* Message List */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <span className="text-4xl mb-4">🎉</span>
            <p>No messages yet. Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.author?.id === user?.id?.toString()}
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="text-sm text-slate-400 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        onTypingChange={handleTypingChange}
        disabled={connectionStatus !== 'connected'}
      />
    </div>
  );
}

export default RoomView;
