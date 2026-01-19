/**
 * Schedule Card Component
 * US-007: Calendar Tab with month view
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faTrash } from '@fortawesome/free-solid-svg-icons';
import { PlatformBadge } from '../ideas/PlatformBadge';
import type { ScheduledPost } from '@/types/contentEngine';

interface ScheduleCardProps {
  post: ScheduledPost;
  onDelete?: (id: number) => void;
}

export function ScheduleCard({ post, onDelete }: ScheduleCardProps) {
  // Format time from ISO string
  const time = new Date(post.scheduledFor).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="glass-card p-3 rounded-lg flex items-center gap-3 group">
      {/* Time */}
      <div className="flex items-center gap-1.5 text-slate-400 min-w-[80px]">
        <FontAwesomeIcon icon={faClock} className="text-xs" />
        <span className="text-sm">{time}</span>
      </div>

      {/* Platform badge */}
      <PlatformBadge platform={post.platform} />

      {/* Clip title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {post.clip?.title || `Clip #${post.clipId}`}
        </p>
      </div>

      {/* Status indicator */}
      <div className={`
        w-2 h-2 rounded-full flex-shrink-0
        ${post.status === 'published' ? 'bg-green-400' : ''}
        ${post.status === 'scheduled' ? 'bg-cyan-400' : ''}
        ${post.status === 'failed' ? 'bg-red-400' : ''}
      `} />

      {/* Delete button */}
      {onDelete && post.status === 'scheduled' && (
        <button
          onClick={() => onDelete(post.id)}
          className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Delete scheduled post"
        >
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        </button>
      )}
    </div>
  );
}
