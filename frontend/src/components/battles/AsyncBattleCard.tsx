/**
 * AsyncBattleCard Component
 *
 * Card display for an async battle in the My Battles tab.
 * Shows opponent info, deadline, status, and action buttons.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  ClockIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { BattleDeadlineCountdown } from './BattleDeadlineCountdown';
import { useAsyncBattles, type AsyncBattle } from '@/contexts/AsyncBattleContext';

interface AsyncBattleCardProps {
  battle: AsyncBattle;
}

export function AsyncBattleCard({ battle }: AsyncBattleCardProps) {
  const navigate = useNavigate();
  const { extendDeadline, sendReminder, startTurn } = useAsyncBattles();

  const [isExtending, setIsExtending] = useState(false);
  const [isReminding, setIsReminding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleExtendDeadline = useCallback(async () => {
    setIsExtending(true);
    await extendDeadline(battle.id);
    setIsExtending(false);
  }, [extendDeadline, battle.id]);

  const handleSendReminder = useCallback(async () => {
    setIsReminding(true);
    await sendReminder(battle.id);
    setIsReminding(false);
  }, [sendReminder, battle.id]);

  const handleStartTurn = useCallback(async () => {
    setIsStarting(true);
    const result = await startTurn(battle.id);
    if (result.success) {
      // Navigate to battle page to submit prompt
      navigate(`/battles/${battle.id}`);
      // Don't reset isStarting - component will unmount on navigation
      return;
    }
    setIsStarting(false);
  }, [startTurn, battle.id, navigate]);

  const handleViewBattle = useCallback(() => {
    navigate(`/battles/${battle.id}`);
  }, [navigate, battle.id]);

  const statusConfig: Record<string, { label: string; bgClass: string; textClass: string }> = {
    my_turn: {
      label: 'Your Turn',
      bgClass: 'bg-gradient-to-r from-pink-600 to-purple-600',
      textClass: 'text-white',
    },
    their_turn: {
      label: 'Their Turn',
      bgClass: 'bg-slate-700',
      textClass: 'text-slate-300',
    },
    judging: {
      label: 'Judging',
      bgClass: 'bg-gradient-to-r from-amber-600 to-orange-600',
      textClass: 'text-white',
    },
    completed: {
      label: 'Done',
      bgClass: 'bg-emerald-600',
      textClass: 'text-white',
    },
  };

  const status = statusConfig[battle.status] || statusConfig.their_turn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-xl border p-4',
        battle.isMyTurn
          ? 'border-pink-500/50 bg-gradient-to-br from-pink-950/30 to-purple-950/30'
          : 'border-slate-700/50 bg-slate-900/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Opponent Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
            {battle.opponent?.avatarUrl ? (
              <img
                src={battle.opponent.avatarUrl}
                alt={battle.opponent.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-slate-400">
                {battle.opponent?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              vs {battle.opponent?.username || 'Unknown'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {battle.challengeType?.name || battle.challengeText}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium shrink-0',
            status.bgClass,
            status.textClass
          )}
        >
          {status.label}
        </span>
      </div>

      {/* Deadline Info */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400">Deadline:</span>
          <BattleDeadlineCountdown
            targetDate={battle.deadline}
            variant="deadline"
            size="sm"
          />
        </div>

        {/* Turn Timer (if active) */}
        {battle.turnExpiresAt && (
          <div className="flex items-center gap-2">
            <BoltIcon className="w-4 h-4 text-pink-500" />
            <span className="text-xs text-slate-400">Turn:</span>
            <BattleDeadlineCountdown
              targetDate={battle.turnExpiresAt}
              variant="turn"
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Primary Action based on status */}
        {battle.isMyTurn && battle.status === 'my_turn' && (
          <button
            type="button"
            onClick={handleStartTurn}
            disabled={isStarting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-medium hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-colors"
          >
            <PlayIcon className="w-4 h-4" />
            {isStarting ? 'Starting...' : 'Start Turn'}
          </button>
        )}

        {battle.turnExpiresAt && battle.isMyTurn && (
          <button
            type="button"
            onClick={handleViewBattle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-colors"
          >
            <BoltIcon className="w-4 h-4" />
            Continue Battle
          </button>
        )}

        {/* Secondary Actions */}
        {!battle.isMyTurn && battle.canSendReminder && (
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={isReminding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            <BellAlertIcon className="w-4 h-4" />
            {isReminding ? 'Sending...' : 'Send Reminder'}
          </button>
        )}

        {battle.extensionsRemaining > 0 && (
          <button
            type="button"
            onClick={handleExtendDeadline}
            disabled={isExtending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            <CalendarDaysIcon className="w-4 h-4" />
            {isExtending
              ? 'Extending...'
              : `Extend (+1 day, ${battle.extensionsRemaining} left)`}
          </button>
        )}

        {/* Go to Battle (always show unless "Continue Battle" is primary action) */}
        {!(battle.turnExpiresAt && battle.isMyTurn) && (
          <button
            type="button"
            onClick={handleViewBattle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <BoltIcon className="w-4 h-4" />
            Go to Battle
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default AsyncBattleCard;
