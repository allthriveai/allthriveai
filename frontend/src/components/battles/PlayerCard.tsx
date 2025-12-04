/**
 * PlayerCard Component
 *
 * Displays a player in the battle arena with their avatar,
 * username, status indicators, and submission state.
 */

import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  CheckCircleIcon,
  PencilIcon,
  SparklesIcon,
  WifiIcon,
} from '@heroicons/react/24/solid';
import { CpuChipIcon } from '@heroicons/react/24/outline';

export type PlayerStatus = 'connected' | 'disconnected' | 'typing' | 'submitted' | 'idle';

interface PlayerCardProps {
  username: string;
  avatarUrl?: string;
  isAi?: boolean;
  isCurrentUser?: boolean;
  status: PlayerStatus;
  isWinner?: boolean;
  score?: number;
  side: 'left' | 'right';
}

export function PlayerCard({
  username,
  avatarUrl,
  isAi = false,
  isCurrentUser = false,
  status,
  isWinner,
  score,
  side,
}: PlayerCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'typing':
        return <PencilIcon className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'submitted':
        return <CheckCircleIcon className="w-4 h-4 text-emerald-400" />;
      case 'disconnected':
        return <WifiIcon className="w-4 h-4 text-rose-400 opacity-50" />;
      default:
        return <WifiIcon className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'typing':
        return 'Writing...';
      case 'submitted':
        return 'Submitted!';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Ready';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`
        relative flex flex-col items-center p-6 rounded-2xl
        ${isWinner ? 'glass-card neon-border' : 'glass-card'}
        ${side === 'left' ? 'items-start' : 'items-end'}
      `}
    >
      {/* Winner crown */}
      {isWinner && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="absolute -top-4 left-1/2 -translate-x-1/2"
        >
          <span className="text-3xl">👑</span>
        </motion.div>
      )}

      {/* Avatar */}
      <div className="relative mb-4">
        <div
          className={`
            w-20 h-20 rounded-2xl overflow-hidden
            ${isWinner ? 'ring-2 ring-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)]' : ''}
            ${isCurrentUser ? 'ring-2 ring-cyan-400/50' : ''}
            bg-gradient-to-br from-slate-700/50 to-slate-800/50
          `}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isAi ? (
                <CpuChipIcon className="w-10 h-10 text-cyan-400" />
              ) : (
                <UserCircleIcon className="w-16 h-16 text-slate-500" />
              )}
            </div>
          )}
        </div>

        {/* AI badge */}
        {isAi && (
          <div
            className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full
                       bg-gradient-to-r from-violet-500 to-purple-500
                       text-[10px] font-bold text-white shadow-lg"
          >
            AI
          </div>
        )}

        {/* You badge */}
        {isCurrentUser && (
          <div
            className="absolute -bottom-1 -left-1 px-2 py-0.5 rounded-full
                       bg-gradient-to-r from-cyan-500 to-teal-500
                       text-[10px] font-bold text-slate-900 shadow-lg"
          >
            YOU
          </div>
        )}
      </div>

      {/* Username */}
      <h3
        className={`
          text-lg font-bold mb-2
          ${isWinner ? 'text-amber-300' : 'text-white'}
          ${isCurrentUser ? 'text-cyan-300' : ''}
        `}
      >
        {username}
      </h3>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className="text-slate-400">{getStatusText()}</span>
      </div>

      {/* Score (shown after judging) */}
      {score !== undefined && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="mt-4 flex items-center gap-2"
        >
          <SparklesIcon className="w-5 h-5 text-amber-400" />
          <span className="text-2xl font-bold text-white">{score.toFixed(1)}</span>
          <span className="text-slate-400 text-sm">pts</span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default PlayerCard;
