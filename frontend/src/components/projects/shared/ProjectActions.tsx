/**
 * ProjectActions - Unified action buttons for all project layouts
 *
 * Provides consistent like, share, comment, and external link buttons
 * across all project types.
 */

import {
  HeartIcon,
  ChatBubbleLeftRightIcon,
  ShareIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface ProjectActionsProps {
  /** Like state */
  isLiked: boolean;
  heartCount: number;
  isLiking: boolean;
  isAuthenticated: boolean;
  onLikeClick: () => void;
  likeRewardId: string;

  /** Comment handler */
  onCommentClick: () => void;

  /** Share handler */
  onShareClick: () => void;

  /** Optional external URL */
  externalUrl?: string;

  /** Visual variant */
  variant?: 'hero' | 'navbar' | 'compact';
}

export function ProjectActions({
  isLiked,
  heartCount,
  isLiking,
  isAuthenticated,
  onLikeClick,
  likeRewardId,
  onCommentClick,
  onShareClick,
  externalUrl,
  variant = 'hero',
}: ProjectActionsProps) {
  // Hero variant (for full-height hero sections)
  if (variant === 'hero') {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          id={likeRewardId}
          onClick={onLikeClick}
          disabled={!isAuthenticated || isLiking}
          className={`group flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-base transition-all transform active:scale-95 border border-white/10 ${
            isLiked
              ? 'bg-gradient-to-r from-pink-500/90 to-rose-500/90 backdrop-blur-xl text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]'
              : 'bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white shadow-lg hover:shadow-xl'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLiked ? (
            <HeartIconSolid className="w-5 h-5 animate-[bounce_0.5s_ease-in-out] drop-shadow-md" />
          ) : (
            <HeartIcon className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow-md" />
          )}
          <span className="drop-shadow-md">{heartCount}</span>
        </button>

        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View Live Project"
            className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-base bg-white/90 hover:bg-white text-gray-900 backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/50"
          >
            <LinkIcon className="w-5 h-5" />
          </a>
        )}

        <button
          onClick={onCommentClick}
          title="Share Your Thoughts"
          className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-base bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/20"
        >
          <ChatBubbleLeftRightIcon className="w-6 h-6" />
        </button>

        <button
          onClick={onShareClick}
          title="Share Project"
          className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-base bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/20"
        >
          <ShareIcon className="w-6 h-6" />
        </button>
      </div>
    );
  }

  // Navbar variant (for sticky navigation)
  if (variant === 'navbar') {
    return (
      <div className="flex items-center gap-3">
        <button
          id={likeRewardId}
          onClick={onLikeClick}
          disabled={!isAuthenticated || isLiking}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all backdrop-blur-md border ${
            isLiked
              ? 'bg-pink-500/90 border-pink-400/50 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLiked ? (
            <HeartIconSolid className="w-5 h-5" />
          ) : (
            <HeartIcon className="w-5 h-5" />
          )}
          <span>{heartCount}</span>
        </button>

        <button
          onClick={onCommentClick}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5" />
        </button>

        <button
          onClick={onShareClick}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
        >
          <ShareIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Compact variant (minimal buttons)
  return (
    <div className="flex items-center gap-2">
      <button
        id={likeRewardId}
        onClick={onLikeClick}
        disabled={!isAuthenticated || isLiking}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isLiked
            ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLiked ? (
          <HeartIconSolid className="w-4 h-4" />
        ) : (
          <HeartIcon className="w-4 h-4" />
        )}
        <span>{heartCount}</span>
      </button>

      <button
        onClick={onCommentClick}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <ChatBubbleLeftRightIcon className="w-4 h-4" />
      </button>

      <button
        onClick={onShareClick}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <ShareIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
