/**
 * ChallengeSubmissionCard - Card component for displaying a challenge submission
 */

import { motion } from 'framer-motion';
import { HeartIcon, StarIcon, BoltIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import type { ChallengeSubmission } from '@/services/challenges';

interface ChallengeSubmissionCardProps {
  submission: ChallengeSubmission;
  onVote: () => void;
  canVote?: boolean;
}

// Animation variants
const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

export function ChallengeSubmissionCard({
  submission,
  onVote,
  canVote = false,
}: ChallengeSubmissionCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      whileTap="tap"
      className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden group shadow-sm hover:shadow-md dark:shadow-none transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-slate-800 overflow-hidden">
        {submission.imageUrl ? (
          <motion.img
            src={submission.imageUrl}
            alt={submission.title}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-pink-500/20">
            <span className="text-4xl">🎨</span>
          </div>
        )}

        {/* Featured badge */}
        {submission.isFeatured && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-2 left-2 px-2 py-1 rounded-md bg-yellow-500/90 text-yellow-900 text-xs font-medium flex items-center gap-1"
          >
            <StarIcon className="w-3 h-3" />
            Featured
          </motion.div>
        )}

        {/* Early bird badge */}
        {submission.isEarlyBird && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-2 right-2 px-2 py-1 rounded-md bg-cyan-500/90 text-white text-xs font-medium flex items-center gap-1"
          >
            <BoltIcon className="w-3 h-3" />
            Early Bird
          </motion.div>
        )}

        {/* Rank badge */}
        {submission.finalRank && submission.finalRank <= 3 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              submission.finalRank === 1
                ? 'bg-yellow-400 text-yellow-900'
                : submission.finalRank === 2
                ? 'bg-slate-300 text-slate-800'
                : 'bg-amber-600 text-white'
            }`}
          >
            #{submission.finalRank}
          </motion.div>
        )}

        {/* Vote overlay on hover */}
        {canVote && (
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
          >
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                onVote();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                submission.hasVoted
                  ? 'bg-pink-500 text-white'
                  : 'bg-white/20 text-white hover:bg-pink-500'
              }`}
            >
              {submission.hasVoted ? (
                <HeartIcon className="w-7 h-7" />
              ) : (
                <HeartOutlineIcon className="w-7 h-7" />
              )}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
          {submission.title}
        </h3>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {submission.user.avatarUrl ? (
              <img
                src={submission.user.avatarUrl}
                alt={submission.user.username}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-cyan-500/30 flex items-center justify-center text-xs text-cyan-600 dark:text-cyan-400">
                {submission.user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-gray-500 dark:text-slate-400">
              @{submission.user.username}
            </span>
          </div>

          <motion.button
            onClick={canVote ? onVote : undefined}
            disabled={!canVote}
            whileHover={canVote ? { scale: 1.05 } : {}}
            whileTap={canVote ? { scale: 0.95 } : {}}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              submission.hasVoted
                ? 'text-pink-500'
                : canVote
                ? 'text-gray-500 dark:text-slate-400 hover:text-pink-500'
                : 'text-gray-400 dark:text-slate-500'
            }`}
          >
            {submission.hasVoted ? (
              <HeartIcon className="w-4 h-4" />
            ) : (
              <HeartOutlineIcon className="w-4 h-4" />
            )}
            <span>{submission.voteCount}</span>
          </motion.button>
        </div>

        {/* AI tool used */}
        {submission.aiToolUsed && (
          <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
            Made with {submission.aiToolUsed}
          </div>
        )}
      </div>
    </motion.div>
  );
}
