import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Project } from '@/types/models';

interface CommentTrayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  isAuthenticated: boolean;
}

export function CommentTray({ isOpen, onClose, project, isAuthenticated }: CommentTrayProps) {
  const [comment, setComment] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement comment submission
    console.log('Submit comment:', comment);
    setComment('');
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Comments</h2>
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

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Placeholder for empty state */}
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No comments yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Be the first to share your thoughts!
                </p>
              </div>

              {/* Comments would be mapped here */}
              {/* {comments.map(comment => <CommentItem key={comment.id} comment={comment} />)} */}
            </div>
          </div>

          {/* Comment Input */}
          {isAuthenticated ? (
            <div className="border-t border-gray-200 dark:border-gray-800 p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  Post Comment
                </button>
              </form>
            </div>
          ) : (
            <div className="border-t border-gray-200 dark:border-gray-800 p-4 text-center">
              <p className="text-gray-600 dark:text-gray-400">Please log in to comment.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
