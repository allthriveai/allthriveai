/**
 * ChallengeLeaderboard - Real-time leaderboard component for weekly challenges
 */

import { motion, AnimatePresence } from 'framer-motion';
import { TrophyIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { SignalIcon } from '@heroicons/react/24/outline';
import type { LeaderboardEntry } from '@/services/challenges';

interface ChallengeLeaderboardProps {
  entries: LeaderboardEntry[];
  userEntry?: LeaderboardEntry | null;
  totalParticipants: number;
}

// Animation variants
const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// Rank styling
const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        bgClass: 'bg-yellow-500/20 dark:bg-yellow-500/20',
        textClass: 'text-yellow-600 dark:text-yellow-400',
        iconClass: 'text-yellow-500',
        showTrophy: true,
      };
    case 2:
      return {
        bgClass: 'bg-gray-300/30 dark:bg-slate-400/20',
        textClass: 'text-gray-600 dark:text-slate-300',
        iconClass: 'text-gray-400',
        showTrophy: true,
      };
    case 3:
      return {
        bgClass: 'bg-amber-600/20 dark:bg-amber-600/20',
        textClass: 'text-amber-700 dark:text-amber-500',
        iconClass: 'text-amber-600',
        showTrophy: true,
      };
    default:
      return {
        bgClass: 'bg-gray-100 dark:bg-white/5',
        textClass: 'text-gray-500 dark:text-slate-400',
        iconClass: '',
        showTrophy: false,
      };
  }
};

function LeaderboardRow({
  entry,
  isHighlighted = false,
}: {
  entry: LeaderboardEntry;
  isHighlighted?: boolean;
}) {
  const rankStyle = getRankStyle(entry.rank);

  return (
    <motion.div
      variants={itemVariants}
      layout
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isHighlighted
          ? 'bg-cyan-500/10 dark:bg-cyan-500/10 border border-cyan-500/30'
          : entry.isCurrentUser
          ? 'bg-cyan-500/5 dark:bg-white/5'
          : ''
      }`}
    >
      {/* Rank */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${rankStyle.bgClass}`}
      >
        {rankStyle.showTrophy ? (
          <TrophyIcon className={`w-4 h-4 ${rankStyle.iconClass}`} />
        ) : (
          <span className={`text-sm font-medium ${rankStyle.textClass}`}>
            {entry.rank}
          </span>
        )}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {entry.avatarUrl ? (
            <img
              src={entry.avatarUrl}
              alt={entry.username}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center text-xs text-cyan-600 dark:text-cyan-400">
              {entry.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className={`text-sm truncate ${
              entry.isCurrentUser
                ? 'text-cyan-600 dark:text-cyan-400 font-medium'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            @{entry.username}
            {entry.isCurrentUser && (
              <span className="ml-1 text-xs text-cyan-500/70 dark:text-cyan-400/70">
                (You)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Votes */}
      <div className="text-right">
        <span
          className={`text-sm font-medium ${rankStyle.textClass || 'text-gray-900 dark:text-white'}`}
        >
          {entry.voteCount}
        </span>
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
          votes
        </span>
      </div>
    </motion.div>
  );
}

export function ChallengeLeaderboard({
  entries,
  userEntry,
  totalParticipants,
}: ChallengeLeaderboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-yellow-500" />
          Leaderboard
        </h3>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400"
        >
          <SignalIcon className="w-4 h-4 text-green-500" />
          Live
        </motion.div>
      </div>

      {/* Participant count */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-4 pb-4 border-b border-gray-200 dark:border-white/10">
        <UserGroupIcon className="w-4 h-4" />
        {totalParticipants} participants
      </div>

      {/* Leaderboard entries */}
      {entries.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-gray-400 dark:text-slate-500 py-4"
        >
          No entries yet. Be the first to submit!
        </motion.p>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* User's position if not in top list */}
      {userEntry && !entries.some((e) => e.userId === userEntry.userId) && (
        <>
          <div className="my-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
            <span className="text-xs text-gray-400 dark:text-slate-500">
              Your position
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <LeaderboardRow entry={userEntry} isHighlighted />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
