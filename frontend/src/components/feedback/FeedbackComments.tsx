/**
 * FeedbackComments - Comments section for feedback items
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import {
  getFeedbackComments,
  addFeedbackComment,
  deleteFeedbackComment,
  type FeedbackComment,
} from '@/services/feedback';
import { formatRelativeTime } from './utils';

interface FeedbackCommentsProps {
  feedbackId: number;
}

export function FeedbackComments({ feedbackId }: FeedbackCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    // Guard: don't fetch with invalid ID
    if (!feedbackId || feedbackId <= 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getFeedbackComments(feedbackId);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [feedbackId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !feedbackId || feedbackId <= 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const comment = await addFeedbackComment(feedbackId, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!feedbackId || feedbackId <= 0) return;

    try {
      await deleteFeedbackComment(feedbackId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError('Failed to delete comment');
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
      <h3 className="font-medium text-slate-900 dark:text-white mb-4">
        Comments ({comments.length})
      </h3>

      {error && (
        <div className="mb-4 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
          {error}
        </div>
      )}

      {/* Comment List */}
      {isLoading ? (
        <div className="text-slate-500 text-sm animate-pulse">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm mb-4">
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {comment.user.avatarUrl ? (
                <img
                  src={comment.user.avatarUrl}
                  alt={comment.user.username}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex-shrink-0 bg-slate-200 dark:bg-slate-600" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {comment.user.username}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
                  {comment.user.username === user?.username && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete comment"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="text-slate-700 dark:text-slate-300 text-sm mt-1 prose prose-sm dark:prose-invert prose-p:my-1 prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline max-w-none">
                  <ReactMarkdown
                    components={{
                      // Use React Router Link for internal links
                      a: ({ href, children }) => {
                        if (href?.startsWith('/')) {
                          return (
                            <Link to={href} className="text-cyan-600 dark:text-cyan-400 hover:underline">
                              {children}
                            </Link>
                          );
                        }
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {comment.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="You" className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full flex-shrink-0 bg-slate-200 dark:bg-slate-600" />
        )}
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            maxLength={1000}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-slate-400">{newComment.length}/1000</span>
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSubmitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
