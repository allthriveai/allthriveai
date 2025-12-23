/**
 * DM Thread List Component
 *
 * Displays list of direct message conversations.
 * Shows participant info, last message preview, and unread count.
 */

import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { DMEmptyState } from './DMEmptyState';
import type { DirectMessageThread } from '@/types/community';

interface DMThreadListProps {
  threads: DirectMessageThread[];
  selectedThreadId?: string;
  onThreadSelect: (threadId: string) => void;
}

export function DMThreadList({ threads, selectedThreadId, onThreadSelect }: DMThreadListProps) {
  const { user } = useAuth();

  if (threads.length === 0) {
    return <DMEmptyState onStartThread={onThreadSelect} />;
  }

  return (
    <div className="overflow-y-auto">
      {threads.map((thread) => (
        <DMThreadItem
          key={thread.id}
          thread={thread}
          isSelected={thread.id === selectedThreadId}
          currentUserId={user?.id?.toString()}
          onSelect={() => onThreadSelect(thread.id)}
        />
      ))}
    </div>
  );
}

interface DMThreadItemProps {
  thread: DirectMessageThread;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: () => void;
}

function DMThreadItem({ thread, isSelected, currentUserId, onSelect }: DMThreadItemProps) {
  // Get display name - for 1:1 DMs, show the other participant's name
  const getDisplayName = () => {
    if (thread.isGroup && thread.name) {
      return thread.name;
    }
    // For 1:1 DMs, show the other person's name
    const otherParticipant = thread.participants.find(
      (p) => p.id !== currentUserId
    );
    return otherParticipant?.username || 'Unknown';
  };

  // Get avatar initial
  const getAvatarInitial = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  // Get last activity time
  const lastActivity = thread.lastMessageAt
    ? formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })
    : 'No messages';

  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 text-left transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-l-2 border-cyan-400'
          : 'hover:bg-white/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-white font-medium">
          {getAvatarInitial()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name and time */}
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-medium truncate ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
              {getDisplayName()}
            </h3>
            <span className="text-xs text-slate-500 flex-shrink-0">{lastActivity}</span>
          </div>

          {/* Last message preview */}
          {thread.lastMessage && (
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {thread.lastMessage.author.id === currentUserId && (
                <span className="text-slate-500">You: </span>
              )}
              {thread.lastMessage.content}
            </p>
          )}

          {/* Unread indicator */}
          {thread.unreadCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">
                {thread.unreadCount} new
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default DMThreadList;
