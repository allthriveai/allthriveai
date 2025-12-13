/**
 * MyBattlesTab Component
 *
 * Tab content for profile page showing user's active async battles.
 * Displays pending battles with actions to manage them.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BoltIcon, ArrowPathIcon, TrophyIcon, LinkIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAsyncBattles } from '@/contexts/AsyncBattleContext';
import { AsyncBattleCard } from './AsyncBattleCard';

export function MyBattlesTab() {
  const navigate = useNavigate();
  const { pendingBattles, urgentBattles, pendingInvitations, isLoading, error, refreshBattles, cancelBattle } = useAsyncBattles();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  // Refresh battles when tab mounts to ensure we have latest data
  useEffect(() => {
    refreshBattles();

  }, []); // Only run once on mount

  const handleRefresh = useCallback(() => {
    refreshBattles();
  }, [refreshBattles]);

  const handleGoToBattles = useCallback(() => {
    navigate('/battles');
  }, [navigate]);

  const handleCopyInviteLink = useCallback(async (battleId: number, inviteUrl?: string) => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(battleId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleCancelInvite = useCallback(async (battleId: number) => {
    setCancelingId(battleId);
    await cancelBattle(battleId);
    setCancelingId(null);
  }, [cancelBattle]);

  const handleGoToBattle = useCallback((battleId: number) => {
    navigate(`/battles/${battleId}`);
  }, [navigate]);

  // Separate battles by status (exclude pending invitations from waiting)
  const waitingBattles = pendingBattles.filter((b) => !b.isMyTurn && b.status !== 'pending_invitation');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">My Battles</h2>
          <p className="text-sm text-slate-400">
            {pendingBattles.length === 0
              ? 'No active battles'
              : `${pendingBattles.length} active battle${pendingBattles.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            aria-label="Refresh battles"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleGoToBattles}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-medium hover:from-pink-500 hover:to-purple-500 transition-colors"
          >
            <BoltIcon className="w-4 h-4" />
            New Battle
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pendingBattles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <TrophyIcon className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Active Battles</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Challenge someone to a prompt battle and test your AI prompting skills!
          </p>
          <button
            type="button"
            onClick={handleGoToBattles}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-medium hover:from-pink-500 hover:to-purple-500 transition-colors"
          >
            <BoltIcon className="w-5 h-5" />
            Start a Battle
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && pendingBattles.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Your Turn Section */}
      {urgentBattles.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-pink-400 mb-3 flex items-center gap-2">
            <BoltIcon className="w-4 h-4" />
            Your Turn ({urgentBattles.length})
          </h3>
          <div className="space-y-3">
            {urgentBattles.map((battle) => (
              <AsyncBattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        </section>
      )}

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Pending Invitations ({pendingInvitations.length})
          </h3>
          <div className="space-y-3">
            {pendingInvitations.map((battle) => (
              <motion.div
                key={battle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-slate-800/50 border border-amber-500/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium mb-1">
                      {battle.challengeType?.name || 'Challenge'}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {battle.challengeText}
                    </p>
                    <p className="text-xs text-amber-400 mt-2">
                      Waiting for someone to accept your invitation
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-600/20 text-amber-400 shrink-0">
                    Pending
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => handleGoToBattle(battle.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-medium hover:from-pink-500 hover:to-purple-500 transition-colors"
                  >
                    <BoltIcon className="w-4 h-4" />
                    Go to Battle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyInviteLink(battle.id, battle.inviteUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-600 transition-colors"
                  >
                    {copiedId === battle.id ? (
                      <>
                        <ClipboardDocumentCheckIcon className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelInvite(battle.id)}
                    disabled={cancelingId === battle.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 text-xs font-medium hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    {cancelingId === battle.id ? 'Canceling...' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Their Turn Section */}
      {waitingBattles.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            Their Turn ({waitingBattles.length})
          </h3>
          <div className="space-y-3">
            {waitingBattles.map((battle) => (
              <AsyncBattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default MyBattlesTab;
