/**
 * ChallengeReadyScreen Component
 *
 * Shown to the challenger after creating an invitation battle.
 * Allows them to start writing their prompt before the opponent joins.
 *
 * Flow:
 * 1. Show challenge details and "Start Your Turn" button
 * 2. User clicks start -> 3 minute timer begins
 * 3. After submission -> Show "Waiting for your friend" state
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  PlayIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ShareIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { api } from '@/services/api';

interface ChallengeReadyScreenProps {
  challengeText: string;
  challengeType?: {
    key: string;
    name: string;
  };
  inviteUrl?: string;
  hasSubmitted: boolean;
  onStartTurn: () => void;
  isStarting?: boolean;
  onRefreshChallenge?: () => void;
  isRefreshingChallenge?: boolean;
  /** Hide share/copy link options (for guests who already have the link) */
  hideShareOptions?: boolean;
  /** Current friend's name (if already set) */
  friendName?: string;
  /** Callback when friend's name is updated */
  onFriendNameChange?: (name: string) => void;
  /** Battle ID for saving friend name */
  battleId?: number;
}

export function ChallengeReadyScreen({
  challengeText,
  challengeType,
  inviteUrl,
  hasSubmitted,
  onStartTurn,
  isStarting = false,
  onRefreshChallenge,
  isRefreshingChallenge = false,
  hideShareOptions = false,
  friendName: initialFriendName = '',
  onFriendNameChange,
  battleId,
}: ChallengeReadyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [localFriendName, setLocalFriendName] = useState(initialFriendName);
  const [isSavingFriendName, setIsSavingFriendName] = useState(false);

  // Save friend name to backend
  const saveFriendName = useCallback(async (name: string) => {
    if (!battleId || !name.trim()) return;

    setIsSavingFriendName(true);
    try {
      const response = await api.post(`/battles/${battleId}/set-friend-name/`, {
        friend_name: name.trim(),
      });

      if (response.data?.friend_name) {
        onFriendNameChange?.(name.trim());
      }
    } catch (error) {
      console.error('Failed to save friend name:', error);
    } finally {
      setIsSavingFriendName(false);
    }
  }, [battleId, onFriendNameChange]);

  // Update local and parent state when name changes (optimistic update)
  const handleFriendNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setLocalFriendName(name);
    // Update parent state immediately so it's available when transitioning to BattleArena
    onFriendNameChange?.(name);
  }, [onFriendNameChange]);

  // Save on blur - always save if there's a value
  const handleFriendNameBlur = useCallback(() => {
    if (localFriendName.trim()) {
      saveFriendName(localFriendName);
    }
  }, [localFriendName, saveFriendName]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [inviteUrl]);

  const handleShare = useCallback(async () => {
    if (!inviteUrl) return;

    const shareData = {
      title: 'Prompt Battle Challenge',
      text: `I challenge you to a Prompt Battle! ${challengeType?.name ? `Can you beat me at "${challengeType.name}"?` : ''}`,
      url: inviteUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed, fall back to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  }, [inviteUrl, challengeType?.name, handleCopyLink]);

  // After submission, show waiting state
  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-card p-8 md:p-12 text-center max-w-lg mx-4"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ClockIcon className="w-10 h-10 text-emerald-400" />
            </motion.div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Your Prompt is Submitted!
          </h2>

          <p className="text-slate-400 mb-6">
            Now share the challenge link with a friend. When they accept and submit their prompt, the battle will be judged!
          </p>

          {inviteUrl && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-medium hover:from-pink-500 hover:to-purple-500 transition-colors"
              >
                <ShareIcon className="w-5 h-5" />
                Share Challenge Link
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
              >
                {copied ? (
                  <>
                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="w-5 h-5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-6">
            You'll be notified when your friend accepts the challenge.
          </p>
        </motion.div>
      </div>
    );
  }

  // Before starting - show challenge and start button
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg mx-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center"
          >
            <BoltIcon className="w-10 h-10 text-pink-400" />
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Your Challenge is Ready!
          </h1>

          <p className="text-slate-400">
            Start writing your prompt while your friend joins
          </p>
        </div>

        {/* Challenge Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-6"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            {challengeType && (
              <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                {challengeType.name}
              </div>
            )}

            {/* Refresh Challenge Button */}
            {onRefreshChallenge && (
              <button
                type="button"
                onClick={onRefreshChallenge}
                disabled={isRefreshingChallenge}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-700/50 text-slate-400 text-xs font-medium hover:bg-slate-700 hover:text-slate-300 disabled:opacity-50 transition-colors"
                title="Get a different challenge"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshingChallenge ? 'animate-spin' : ''}`} />
                {isRefreshingChallenge ? 'Getting new...' : 'New Challenge'}
              </button>
            )}
          </div>

          <p className="text-white text-lg leading-relaxed">
            {challengeText}
          </p>
        </motion.div>

        {/* Friend Name Input (only for challengers, not guests) */}
        {!hideShareOptions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card p-4 mb-6"
          >
            <label htmlFor="friend-name" className="block text-sm font-medium text-slate-300 mb-2">
              Who are you challenging? <span className="text-slate-500">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="friend-name"
                type="text"
                name="friendName"
                data-testid="friend-name-input"
                value={localFriendName}
                onChange={handleFriendNameChange}
                onBlur={handleFriendNameBlur}
                placeholder="Enter your friend's name"
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-colors"
              />
              {isSavingFriendName && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <ArrowPathIcon className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Their name will appear in the battle while they join
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          {/* Primary: Start Turn */}
          <button
            type="button"
            onClick={onStartTurn}
            disabled={isStarting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-lg hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-pink-500/25"
          >
            <PlayIcon className="w-6 h-6" />
            {isStarting ? 'Starting...' : 'Start My Turn'}
          </button>

          <p className="text-center text-sm text-slate-500">
            You'll have 3 minutes to write your prompt
          </p>

          {/* Secondary: Share Link (hidden for guests who already have the link) */}
          {inviteUrl && !hideShareOptions && (
            <div className="pt-4 border-t border-slate-800">
              <p className="text-center text-sm text-slate-400 mb-3">
                Need the link again?
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  <ShareIcon className="w-5 h-5" />
                  Share
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-5 h-5" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Info */}
        {!hideShareOptions && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-xs text-slate-500 mt-6"
          >
            Your friend can join anytime within 24 hours
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default ChallengeReadyScreen;
