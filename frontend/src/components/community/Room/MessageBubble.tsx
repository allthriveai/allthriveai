/**
 * Message Bubble Component
 *
 * Displays a single message with author, content, and reactions.
 * Uses Neon Glass design system styling.
 */

import { formatDistanceToNow } from 'date-fns';
import type { MessageProps } from '@/types/community';

export function MessageBubble({ message, isOwn, onReact }: MessageProps) {
  const formattedTime = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  // System messages have special styling
  if (message.messageType === 'system') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-slate-400 italic">{message.content}</span>
      </div>
    );
  }

  // Deleted messages
  if (message.messageType === 'deleted') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-slate-500 italic">[Message deleted]</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {message.author?.avatarUrl ? (
          <img
            src={message.author.avatarUrl}
            alt={message.author.username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {message.author?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
        {/* Author & Time */}
        <div className={`flex items-center gap-2 mb-1 text-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium text-slate-300">{message.author?.username || 'Unknown'}</span>
          <span className="text-slate-500">{formattedTime}</span>
          {message.isEdited && <span className="text-slate-500">(edited)</span>}
        </div>

        {/* Reply Preview */}
        {message.replyTo && (
          <div className={`mb-1 p-2 rounded text-xs border-l-2 border-cyan-500/50 bg-white/5 ${isOwn ? 'text-right' : ''}`}>
            <span className="text-slate-400">Replying to </span>
            <span className="text-slate-300">{message.replyTo.author?.username}</span>
            <p className="text-slate-400 truncate mt-0.5">{message.replyTo.content}</p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`inline-block p-3 rounded-2xl ${
            isOwn
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-tr-sm'
              : 'glass-subtle text-slate-200 rounded-tl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
              >
                <span>📎</span>
                <span>{attachment.name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactionCounts && Object.keys(message.reactionCounts).length > 0 && (
          <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
            {Object.entries(message.reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                className="px-2 py-0.5 rounded-full text-xs bg-white/10 hover:bg-white/20 transition-colors"
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
