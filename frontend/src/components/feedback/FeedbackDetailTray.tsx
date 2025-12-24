/**
 * FeedbackDetailTray - Right sidebar tray for viewing full feedback details
 * Uses Neon Glass design system
 */

import { Fragment, useState } from 'react';
import { Transition } from '@headlessui/react';
import { XMarkIcon, ChevronUpIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { ChevronUpIcon as ChevronUpIconSolid } from '@heroicons/react/24/solid';
import type { FeedbackItem, FeedbackCategory } from '@/services/feedback';
import { adminUpdateFeedback } from '@/services/feedback';
import { useFeedbackVote } from '@/hooks/useFeedbackVote';
import { useAuth } from '@/hooks/useAuth';
import { FeedbackComments } from './FeedbackComments';
import { formatRelativeTime } from './utils';

const categoryLabels: Record<FeedbackCategory, string> = {
  // Features
  explore: 'Explore',
  games: 'Games',
  prompt_battles: 'Prompt Battles',
  lounge: 'Lounge',
  learn: 'Learn',
  // Agents
  ember: 'Ember',
  sage: 'Sage',
  haven: 'Haven',
  guide: 'Guide',
  // General
  ui_ux: 'UI/UX',
  responsive: 'Responsive Design',
  accessibility: 'Accessibility',
  account: 'Account & Settings',
  other: 'Other',
};

interface FeedbackDetailTrayProps {
  item: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedItem: FeedbackItem) => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  declined: { bg: 'bg-gray-500/10', text: 'text-gray-500 dark:text-gray-400' },
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

const typeColors: Record<string, { bg: string; text: string }> = {
  feature: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  bug: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
};

const typeLabels: Record<string, string> = {
  feature: 'Feature Request',
  bug: 'Bug Report',
};

export function FeedbackDetailTray({ item, isOpen, onClose, onUpdate }: FeedbackDetailTrayProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const isAdmin = user?.isStaff || false;
  const isOwnSubmission = user?.username === item?.user?.username;

  // Admin state
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const { voted, voteCount, isVoting, toggleVote } = useFeedbackVote({
    itemId: item?.id || 0,
    initialVoted: item?.hasVoted || false,
    initialCount: item?.voteCount || 0,
    isAuthenticated,
  });

  // Reset admin form when item changes
  const handleAdminUpdate = async () => {
    if (!item) return;
    setIsUpdating(true);
    try {
      const data: { status?: string; adminResponse?: string } = {};
      if (selectedStatus && selectedStatus !== item.status) {
        data.status = selectedStatus;
      }
      if (adminResponse.trim()) {
        data.adminResponse = adminResponse.trim();
      }
      if (Object.keys(data).length === 0) return;

      const updated = await adminUpdateFeedback(item.id, data);
      onUpdate?.(updated);
      setAdminResponse('');
      setSelectedStatus('');
    } catch (err) {
      console.error('Failed to update feedback:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!item) return null;

  const statusStyle = statusColors[item.status] || statusColors.open;
  const typeStyle = typeColors[item.feedbackType] || typeColors.feature;

  return (
    <>
      {/* Backdrop - click to close, doesn't block main page scroll */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/30"
          onClick={onClose}
        />
      </Transition>

      {/* Tray */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition-transform duration-300 ease-out"
        enterFrom="translate-x-full"
        enterTo="translate-x-0"
        leave="transition-transform duration-200 ease-in"
        leaveFrom="translate-x-0"
        leaveTo="translate-x-full"
      >
        <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusLabels[item.status]}
                </span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${typeStyle.bg} ${typeStyle.text}`}>
                  {typeLabels[item.feedbackType]}
                </span>
                <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                  {categoryLabels[item.category] || 'Other'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{item.title}</h2>

              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                {item.user?.avatarUrl ? (
                  <img
                    src={item.user.avatarUrl}
                    alt={item.user?.username || 'User'}
                    className="w-6 h-6 rounded-full ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {item.user?.username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <span className="font-medium text-gray-700 dark:text-slate-300">{item.user?.username || 'Unknown'}</span>
                <span className="text-gray-300 dark:text-slate-600">·</span>
                <span>{formatRelativeTime(item.createdAt)}</span>
              </div>

              <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                {item.description}
              </div>

              {/* Vote section */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => !isOwnSubmission && toggleVote()}
                  disabled={isVoting || isOwnSubmission}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200
                    ${
                      voted
                        ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400'
                        : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    }
                    ${isOwnSubmission ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  title={
                    isOwnSubmission
                      ? "Can't vote on your own submission"
                      : voted
                        ? 'Remove vote'
                        : 'Vote for this'
                  }
                >
                  {voted ? (
                    <ChevronUpIconSolid className="w-5 h-5" />
                  ) : (
                    <ChevronUpIcon className="w-5 h-5" />
                  )}
                  <span className="font-semibold">{voteCount}</span>
                </button>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  {voteCount === 1 ? '1 vote' : `${voteCount} votes`}
                </span>
              </div>

              {/* Admin response (if any) */}
              {item.adminResponse && (
                <div className="bg-emerald-500/10 rounded p-4 border border-emerald-500/20">
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Team Response
                  </h4>
                  <p className="text-gray-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                    {item.adminResponse}
                  </p>
                </div>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="bg-rose-500/5 rounded p-4 border border-rose-500/20">
                  <h4 className="font-medium text-rose-700 dark:text-rose-400 mb-4 flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5" />
                    Admin Controls
                  </h4>

                  {/* Status dropdown */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Update Status
                    </label>
                    <select
                      value={selectedStatus || item.status}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>

                  {/* Admin response textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {item.adminResponse ? 'Update Team Response' : 'Add Team Response'}
                    </label>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Add a response that will be visible to the user..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                    />
                  </div>

                  {/* Update button */}
                  <button
                    onClick={handleAdminUpdate}
                    disabled={isUpdating || (!selectedStatus && !adminResponse.trim())}
                    className="w-full px-4 py-2.5 text-sm font-medium rounded bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {isUpdating ? 'Updating...' : 'Update Feedback'}
                  </button>
                </div>
              )}

            {/* Comments Section */}
            <FeedbackComments feedbackId={item.id} />
          </div>
        </div>
      </Transition>
    </>
  );
}
