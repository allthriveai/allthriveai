import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { FaStar } from 'react-icons/fa';
import { useReward } from 'react-rewards';
import type { Project } from '@/types/models';
import { getProjectComments, createProjectComment, voteOnComment, type Comment } from '@/services/comments';
import { parseApiError } from '@/utils/errorHandler';

interface CommentTrayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  isAuthenticated: boolean;
}

export function CommentTray({ isOpen, onClose, project, isAuthenticated }: CommentTrayProps) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // React Rewards for comment submission celebration
  const { reward: rewardComment } = useReward('commentRewardTray', 'confetti', {
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
    colors: ['#FFD700', '#FFA500', '#FFFF00'],
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Lazy load comments when tray is opened
  useEffect(() => {
    async function loadComments() {
      if (!project || !isOpen || commentsLoaded) return;

      setIsLoadingComments(true);
      try {
        const data = await getProjectComments(project.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch (error) {
        const errorInfo = parseApiError(error);
        console.error('Failed to load comments:', errorInfo.message);
        setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    }

    loadComments();
  }, [project, isOpen, commentsLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !isAuthenticated || !project) return;

    setIsSubmittingComment(true);
    try {
      const newComment = await createProjectComment(project.id, {
        content: commentText,
      });

      // Add new comment to list
      setComments([newComment, ...comments]);
      setCommentsLoaded(true);

      // Clear form
      setCommentText('');

      // Show success toast and trigger celebration
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);

      // Trigger star emoji celebration
      rewardComment();
    } catch (error) {
      const errorInfo = parseApiError(error);
      alert(errorInfo.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleVote = async (commentId: number, voteType: 'up' | 'down') => {
    if (!isAuthenticated || !project) {
      alert('Please sign in to vote on comments');
      return;
    }

    try {
      const result = await voteOnComment(project.id, commentId, voteType);

      // Update comment in list with new data from API
      setComments(comments.map(comment =>
        comment.id === commentId ? result.comment : comment
      ));
    } catch (error) {
      const errorInfo = parseApiError(error);
      alert(errorInfo.message);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Tray */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Your Thoughts</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{project.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* Info Section */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Leave feedback, endorsement, or comments about this project. Your input helps the creator improve!
                </p>

                {!isAuthenticated && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Please sign in to leave feedback and earn points.
                    </p>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              {isAuthenticated && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Your Feedback
                  </label>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={isSubmittingComment}
                      placeholder="What did you think about this project? Any suggestions or praise? Help others and get rewarded with +10 points!"
                      rows={6}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ✓ Auto-moderation enabled for community safety
                    </p>
                    <button
                      id="commentRewardTray"
                      type="submit"
                      disabled={!commentText.trim() || isSubmittingComment}
                      className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {isSubmittingComment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit Feedback</span>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Guidelines */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Feedback Guidelines</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>Be constructive and respectful</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>Provide specific examples when possible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>All comments are auto-moderated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>Help creators grow and improve</span>
                  </li>
                </ul>
              </div>

              {/* Comments List */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Comments ({comments.length})
                </h4>

                {isLoadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !Array.isArray(comments) || comments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No comments yet. Be the first to share your thoughts!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        {/* Comment Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm">
                              {comment.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {comment.username}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(comment.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Comment Content */}
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          {comment.content}
                        </p>

                        {/* Vote Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVote(comment.id, 'up')}
                            disabled={!isAuthenticated}
                            className={`p-1.5 rounded transition-all ${
                              comment.user_vote === 'up'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Upvote"
                          >
                            <ArrowUpIcon className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[2rem] text-center">
                            {comment.score}
                          </span>
                          <button
                            onClick={() => handleVote(comment.id, 'down')}
                            disabled={!isAuthenticated}
                            className={`p-1.5 rounded transition-all ${
                              comment.user_vote === 'down'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Downvote"
                          >
                            <ArrowDownIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-[60] animate-[slide-in-right_0.3s_ease-out]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px] max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                <FaStar className="text-white text-lg" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Your voice matters! +10 points earned
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Your feedback has been added to your activity feed.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
