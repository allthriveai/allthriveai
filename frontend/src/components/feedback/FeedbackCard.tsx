/**
 * FeedbackCard - Card displaying a feedback item with vote button
 */

import { ChevronUpIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { ChevronUpIcon as ChevronUpIconSolid } from '@heroicons/react/24/solid';
import type { FeedbackItem, FeedbackCategory } from '@/services/feedback';
import { useFeedbackVote } from '@/hooks/useFeedbackVote';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime } from './utils';

interface FeedbackCardProps {
  item: FeedbackItem;
  onClick: () => void;
}

const categoryLabels: Record<FeedbackCategory, string> = {
  // Features
  explore: 'Explore',
  games: 'Games',
  prompt_battles: 'Prompt Battles',
  lounge: 'Lounge',
  learn: 'Learn',
  // Agents
  ava: 'Ava',
  sage: 'Sage',
  haven: 'Haven',
  guide: 'Guide',
  // General
  ui_ux: 'UI/UX',
  responsive: 'Responsive',
  accessibility: 'Accessibility',
  account: 'Account',
  other: 'Other',
};

const statusColors: Record<string, { bg: string; text: string; glow: string }> = {
  open: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  in_progress: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  completed: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  declined: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500 dark:text-gray-400',
    glow: '',
  },
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

export function FeedbackCard({ item, onClick }: FeedbackCardProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const isOwnSubmission = user?.username === item.user?.username;

  const { voted, voteCount, isVoting, toggleVote } = useFeedbackVote({
    itemId: item.id,
    initialVoted: item.hasVoted,
    initialCount: item.voteCount,
    isAuthenticated,
  });

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnSubmission) {
      toggleVote();
    }
  };

  const statusStyle = statusColors[item.status] || statusColors.open;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-5 hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex gap-4">
        {/* Vote button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleVoteClick}
            disabled={isVoting || isOwnSubmission}
            className={`
              flex flex-col items-center justify-center w-14 h-16 rounded border transition-all duration-200
              ${
                voted
                  ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400'
                  : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
              }
              ${isOwnSubmission ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
            `}
            title={isOwnSubmission ? "Can't vote on your own submission" : voted ? 'Remove vote' : 'Vote'}
          >
            {voted ? (
              <ChevronUpIconSolid className="w-5 h-5" />
            ) : (
              <ChevronUpIcon className="w-5 h-5" />
            )}
            <span className="text-sm font-semibold">{voteCount}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                {categoryLabels[item.category] || 'Other'}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyle.bg} ${statusStyle.text}`}
              >
                {statusLabels[item.status]}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-3">
            {item.description}
          </p>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-500">
            <div className="flex items-center gap-1.5">
              {item.user?.avatarUrl ? (
                <img
                  src={item.user.avatarUrl}
                  alt={item.user?.username || 'User'}
                  className="w-5 h-5 rounded-full ring-1 ring-white/20"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white">
                    {item.user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <span className="font-medium text-gray-700 dark:text-slate-300">{item.user?.username || 'Unknown'}</span>
            </div>
            <span className="text-gray-300 dark:text-slate-600">·</span>
            <span>{formatRelativeTime(item.createdAt)}</span>
            {item.commentCount > 0 && (
              <>
                <span className="text-gray-300 dark:text-slate-600">·</span>
                <div className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
                  <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                  <span>{item.commentCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
