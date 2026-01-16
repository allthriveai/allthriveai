/**
 * ListingComments - Comments section for listings
 *
 * Displays comments with replies and allows authenticated users to add comments.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getListingComments, addListingComment } from '@/services/listings';
import type { ListingComment } from '@/types/listings';
import clsx from 'clsx';

interface ListingCommentsProps {
  listingId: number;
  className?: string;
}

/**
 * Single comment with optional replies
 */
function CommentItem({
  comment,
  onReply,
  currentUserId,
  depth = 0,
}: {
  comment: ListingComment;
  onReply: (parentId: number) => void;
  currentUserId?: number;
  depth?: number;
}) {
  const timeAgo = formatTimeAgo(new Date(comment.createdAt));

  return (
    <div className={clsx('space-y-3', depth > 0 && 'ml-8 border-l border-gray-700 pl-4')}>
      <div className="bg-gray-800/50 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link to={`/@${comment.user.username}`} className="flex items-center gap-2 group">
            {comment.user.avatarUrl ? (
              <img
                src={comment.user.avatarUrl}
                alt={comment.user.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {comment.user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-gray-200 group-hover:text-cyan-400 transition-colors">
              @{comment.user.username}
            </span>
          </Link>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>

        {/* Body */}
        <p className="text-gray-300 text-sm whitespace-pre-wrap">{comment.body}</p>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              currentUserId={currentUserId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Comment input form
 */
function CommentForm({
  onSubmit,
  isSubmitting,
  placeholder = 'Add a comment...',
  replyingTo,
  onCancelReply,
}: {
  onSubmit: (body: string) => Promise<void>;
  isSubmitting: boolean;
  placeholder?: string;
  replyingTo?: number | null;
  onCancelReply?: () => void;
}) {
  const [body, setBody] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSubmitting) return;
    await onSubmit(body.trim());
    setBody('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {replyingTo && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Replying to comment</span>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Cancel
          </button>
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
        >
          {isSubmitting ? 'Posting...' : replyingTo ? 'Reply' : 'Comment'}
        </button>
      </div>
    </form>
  );
}

/**
 * Format time ago string
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ListingComments({ listingId, className }: ListingCommentsProps) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load comments
  useEffect(() => {
    async function loadComments() {
      setIsLoading(true);
      try {
        const data = await getListingComments(listingId);
        setComments(data);
      } catch (err) {
        console.error('Failed to load comments:', err);
        setError('Failed to load comments');
      } finally {
        setIsLoading(false);
      }
    }

    loadComments();
  }, [listingId]);

  // Submit comment
  const handleSubmit = async (body: string) => {
    setIsSubmitting(true);
    try {
      const newComment = await addListingComment(listingId, body, replyingTo || undefined);

      if (replyingTo) {
        // Add reply to parent comment
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyingTo
              ? { ...c, replies: [...(c.replies || []), newComment] }
              : c
          )
        );
      } else {
        // Add top-level comment
        setComments((prev) => [newComment, ...prev]);
      }

      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to post comment:', err);
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={clsx('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Comment form - only for authenticated users */}
      {isAuthenticated ? (
        <CommentForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      ) : (
        <div className="bg-gray-800/30 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">
            <a href="/auth" className="text-cyan-400 hover:text-cyan-300">
              Sign in
            </a>{' '}
            to leave a comment
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* Comments list */}
      {!isLoading && comments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No comments yet. Be the first to comment!</p>
        </div>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={setReplyingTo}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ListingComments;
