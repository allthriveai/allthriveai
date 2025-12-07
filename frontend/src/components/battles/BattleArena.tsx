/**
 * BattleArena Component
 *
 * Main battle interface showing VS layout with both players,
 * challenge prompt, and submission area.
 */

import { motion } from 'framer-motion';
import { BoltIcon } from '@heroicons/react/24/solid';
import { PlayerCard } from './PlayerCard';
import type { PlayerStatus } from './PlayerCard';
import { ChallengeDisplay } from './ChallengeDisplay';
import { PromptEditor } from './PromptEditor';

interface Player {
  id: number;
  username: string;
  avatarUrl?: string;
  isAi?: boolean;
}

interface BattleArenaProps {
  challengeText: string;
  challengeType?: { key: string; name: string } | null;
  currentUser: Player;
  opponent: Player;
  currentUserStatus: PlayerStatus;
  opponentStatus: PlayerStatus;
  timeRemaining: number | null;
  hasSubmitted: boolean;
  onSubmit: (prompt: string) => void;
  onTyping: (isTyping: boolean) => void;
  /** Callback to refresh the challenge (only for Pip battles) */
  onRefreshChallenge?: () => Promise<void>;
  /** Whether challenge refresh is in progress */
  isRefreshingChallenge?: boolean;
  /** Whether the opponent is AI (Pip) */
  isAiOpponent?: boolean;
}

export function BattleArena({
  challengeText,
  challengeType,
  currentUser,
  opponent,
  currentUserStatus,
  opponentStatus,
  timeRemaining,
  hasSubmitted,
  onSubmit,
  onTyping,
  onRefreshChallenge,
  isRefreshingChallenge = false,
  isAiOpponent = false,
}: BattleArenaProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Left glow */}
        <div
          className="absolute -left-1/4 top-1/4 w-1/2 h-1/2 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)',
          }}
        />
        {/* Right glow */}
        <div
          className="absolute -right-1/4 top-1/4 w-1/2 h-1/2 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(251, 55, 255, 0.3) 0%, transparent 70%)',
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4 md:mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-rose-500/20 border border-rose-500/30 mb-2 md:mb-4">
            <BoltIcon className="w-3 h-3 md:w-4 md:h-4 text-rose-400" />
            <span className="text-xs md:text-sm font-semibold text-rose-300 tracking-wider uppercase">
              Battle in Progress
            </span>
          </div>
        </motion.div>

        {/* VS Layout - Horizontal on desktop, compact row on mobile */}
        <div className="flex items-center justify-center gap-3 md:gap-8 mb-6 md:mb-12">
          {/* Current user */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 max-w-[140px] md:max-w-xs"
          >
            <PlayerCard
              username={currentUser.username}
              avatarUrl={currentUser.avatarUrl}
              isCurrentUser={true}
              status={currentUserStatus}
              side="left"
            />
          </motion.div>

          {/* VS badge - smaller on mobile */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center"
          >
            <div
              className="relative w-12 h-12 md:w-20 md:h-20 rounded-full flex items-center justify-center
                         bg-gradient-to-br from-slate-800 to-slate-900
                         border-2 border-cyan-500/50
                         shadow-[0_0_20px_rgba(34,211,238,0.3)] md:shadow-[0_0_30px_rgba(34,211,238,0.3)]"
            >
              {/* Animated ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-lg md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
                VS
              </span>
            </div>

            {/* Connection line - hidden on mobile */}
            <div className="hidden md:block w-px h-32 bg-gradient-to-b from-cyan-500/50 via-transparent to-pink-500/50 mt-4" />
          </motion.div>

          {/* Opponent */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 max-w-[140px] md:max-w-xs"
          >
            <PlayerCard
              username={opponent.username}
              avatarUrl={opponent.avatarUrl}
              isAi={opponent.isAi}
              status={opponentStatus}
              side="right"
            />
          </motion.div>
        </div>

        {/* Challenge display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 md:mb-12"
        >
          <ChallengeDisplay
            challengeText={challengeText}
            challengeType={challengeType}
            onRefresh={onRefreshChallenge}
            isRefreshing={isRefreshingChallenge}
            canRefresh={isAiOpponent && !hasSubmitted}
          />
        </motion.div>

        {/* Prompt editor */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          {hasSubmitted ? (
            <div className="text-center p-8 rounded-2xl glass-card">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h3 className="text-xl font-bold text-white mb-2">Prompt Submitted!</h3>
              <p className="text-slate-400">
                {opponentStatus === 'submitted'
                  ? 'Both players have submitted. Generating images...'
                  : 'Waiting for your opponent to submit...'}
              </p>

              {/* Loading dots */}
              <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-cyan-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <PromptEditor
              onSubmit={onSubmit}
              onTyping={onTyping}
              timeRemaining={timeRemaining}
              minLength={10}
              maxLength={2000}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default BattleArena;
