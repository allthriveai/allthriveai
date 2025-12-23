/**
 * DM Thread View Component
 *
 * Real-time direct message chat with message list and composer.
 * Uses Neon Glass design system.
 */

import { useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useDMThread } from '@/hooks/useDMThread';
import { useAuth } from '@/hooks/useAuth';
import { MessageBubble } from '../Room/MessageBubble';
import { MessageComposer } from '../Room/MessageComposer';

interface DMThreadViewProps {
  threadId: string;
  onBack?: () => void;
}

export function DMThreadView({ threadId, onBack }: DMThreadViewProps) {
  const { user } = useAuth();
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

  // Auto-scroll to bottom on new messages (within container only)
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Get the other participant in 1:1 DMs
  const getOtherParticipant = () => {
    if (!threadInfo) return null;
    return threadInfo.participants.find(
      (p) => String(p.id) !== String(user?.id)
    ) || null;
  };

  // Get display name for the thread
  const getDisplayName = () => {
    if (!threadInfo) return 'Loading...';
    if (threadInfo.isGroup && threadInfo.name) {
      return threadInfo.name;
    }
    // For 1:1 DMs, show the other person's name
    const otherParticipant = getOtherParticipant();
    return otherParticipant?.username || 'Unknown';
  };

  // Get avatar URL for the other participant
  const getAvatarUrl = () => {
    const otherParticipant = getOtherParticipant();
    return otherParticipant?.avatarUrl || null;
  };

  // Get avatar initial
  const getAvatarInitial = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleTypingChange = (isTyping: boolean) => {
    setTyping(isTyping);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <header className="flex-shrink-0 p-4 border-b border-white/10 glass-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button for mobile */}
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="text-slate-400" />
              </button>
            )}

            {/* Avatar */}
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 overflow-hidden">
              {getAvatarUrl() ? (
                <img
                  src={getAvatarUrl()!}
                  alt={getDisplayName()}
                  className="w-full h-full object-cover"
                />
              ) : (
                getAvatarInitial()
              )}
            </div>

            <div>
              <h2 className="font-semibold text-white">{getDisplayName()}</h2>
              {threadInfo?.isGroup && (
                <p className="text-sm text-slate-400">
                  {threadInfo.participants.length} participants
                </p>
              )}
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
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
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Message List */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <FontAwesomeIcon icon={faEnvelope} className="text-4xl mb-4 text-cyan-400" />
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={String(message.author?.id) === String(user?.id)}
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
        placeholder="Type a message..."
      />
    </div>
  );
}

export default DMThreadView;
