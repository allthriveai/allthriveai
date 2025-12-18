import { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import type { TaskComment, TaskAdminUser } from '@/types/tasks';
import adminTasksService from '@/services/adminTasks';
import { formatDistanceToNow } from 'date-fns';

interface TaskCommentsProps {
  taskId: number;
  currentUser: TaskAdminUser | null;
}

export function TaskComments({ taskId, currentUser }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await adminTasksService.getComments(taskId);
        setComments(data);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComments();
  }, [taskId]);

  // Scroll to bottom when new comments added
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  // Submit new comment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await adminTasksService.createComment({
        task: taskId,
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update comment
  const handleUpdate = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      const updated = await adminTasksService.updateComment(commentId, {
        content: editContent.trim(),
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  // Delete comment
  const handleDelete = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await adminTasksService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  // Start editing
  const startEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // Check if current user is the author
  const isAuthor = (comment: TaskComment) => {
    return currentUser && comment.author === currentUser.id;
  };

  // Format timestamp
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  // Get author name
  const getAuthorName = (comment: TaskComment) => {
    if (comment.authorDetail) {
      if (comment.authorDetail.firstName) {
        return `${comment.authorDetail.firstName} ${comment.authorDetail.lastName || ''}`.trim();
      }
      return comment.authorDetail.email;
    }
    return 'Unknown';
  };

  // Get author initials
  const getAuthorInitials = (comment: TaskComment) => {
    if (comment.authorDetail?.firstName) {
      return `${comment.authorDetail.firstName[0]}${comment.authorDetail.lastName?.[0] || ''}`.toUpperCase();
    }
    if (comment.authorDetail?.email) {
      return comment.authorDetail.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Comments ({comments.length})
      </h3>

      {/* Comments List */}
      <div className="space-y-3 max-h-64 overflow-y-auto mb-4 pr-1">
        {isLoading ? (
          <div className="text-center py-4">
            <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
            No comments yet. Be the first to add one!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 group"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                {comment.authorDetail?.avatar ? (
                  <img
                    src={comment.authorDetail.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {getAuthorInitials(comment)}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {getAuthorName(comment)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTime(comment.createdAt)}
                  </span>
                  {comment.updatedAt !== comment.createdAt && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      (edited)
                    </span>
                  )}
                </div>

                {editingId === comment.id ? (
                  // Editing mode
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(comment.id)}
                        className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                    {isAuthor(comment) && (
                      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(comment)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* New Comment Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!newComment.trim() || isSubmitting}
          className="p-2 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
