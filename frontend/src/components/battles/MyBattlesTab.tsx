/**
 * MyBattlesTab Component
 *
 * Tab content for profile page showing user's battles.
 * Supports viewing active battles and full history with bulk actions.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  ArrowPathIcon,
  TrophyIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  TrashIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAsyncBattles, type BattleHistoryItem } from '@/contexts/AsyncBattleContext';
import { AsyncBattleCard } from './AsyncBattleCard';

type ViewMode = 'active' | 'history';
type HistoryFilter = 'all' | 'completed' | 'cancelled' | 'expired';

export function MyBattlesTab() {
  const navigate = useNavigate();
  const {
    pendingBattles,
    urgentBattles,
    pendingInvitations,
    isLoading,
    error,
    refreshBattles,
    cancelBattle,
    bulkDeleteBattles,
    fetchBattleHistory,
  } = useAsyncBattles();

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  // View mode and history state
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyBattles, setHistoryBattles] = useState<BattleHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Refresh battles when tab mounts
  useEffect(() => {
    refreshBattles();
  }, []);

  // Load history when switching to history view or changing filter
  useEffect(() => {
    if (viewMode === 'history') {
      loadHistory();
    }
  }, [viewMode, historyFilter, historyPage]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const result = await fetchBattleHistory({
      status: historyFilter,
      page: historyPage,
      pageSize: 20,
    });
    setHistoryBattles(result.battles);
    setHistoryTotalPages(result.totalPages);
    setHistoryLoading(false);
  };

  const handleRefresh = useCallback(() => {
    if (viewMode === 'active') {
      refreshBattles();
    } else {
      loadHistory();
    }
  }, [refreshBattles, viewMode]);

  const handleGoToBattles = useCallback(() => {
    navigate('/play/prompt-battles');
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

  const handleCancelInvite = useCallback(
    async (battleId: number) => {
      setCancelingId(battleId);
      await cancelBattle(battleId);
      setCancelingId(null);
    },
    [cancelBattle]
  );

  const handleGoToBattle = useCallback(
    (battleId: number) => {
      navigate(`/play/prompt-battles/${battleId}`);
    },
    [navigate]
  );

  // Selection handlers
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (viewMode === 'active') {
      setSelectedIds(new Set(pendingBattles.map((b) => b.id)));
    } else {
      setSelectedIds(new Set(historyBattles.map((b) => b.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleting(true);
    const result = await bulkDeleteBattles(Array.from(selectedIds));
    setBulkDeleting(false);

    if (result.deleted > 0) {
      // Clear selection and refresh
      setSelectedIds(new Set());
      setSelectionMode(false);
      if (viewMode === 'history') {
        loadHistory();
      }
    }

    if (result.failed.length > 0) {
      console.warn('Some battles could not be deleted:', result.failed);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Get battles list based on view mode
  const waitingBattles = pendingBattles.filter((b) => !b.isMyTurn && b.status !== 'pending_invitation');
  const currentLoading = viewMode === 'active' ? isLoading : historyLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">My Battles</h2>
          <p className="text-sm text-slate-400">
            {viewMode === 'active'
              ? pendingBattles.length === 0
                ? 'No active battles'
                : `${pendingBattles.length} active battle${pendingBattles.length !== 1 ? 's' : ''}`
              : `Battle history`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-slate-400">{selectedIds.size} selected</span>
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-900/50 text-red-400 hover:bg-red-900/70 disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={exitSelectionMode}
                className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                Select
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={currentLoading}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                aria-label="Refresh battles"
              >
                <ArrowPathIcon className={`w-5 h-5 ${currentLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleGoToBattles}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-medium hover:from-pink-500 hover:to-purple-500 transition-colors"
              >
                <BoltIcon className="w-4 h-4" />
                New Battle
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setViewMode('active')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'active'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'history'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>

        {/* History Filter */}
        {viewMode === 'history' && (
          <select
            value={historyFilter}
            onChange={(e) => {
              setHistoryFilter(e.target.value as HistoryFilter);
              setHistoryPage(1);
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Active View */}
      {viewMode === 'active' && (
        <>
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
                <div key={i} className="h-32 rounded-xl bg-slate-800/50 animate-pulse" />
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
                  <SelectableBattleCard
                    key={battle.id}
                    id={battle.id}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(battle.id)}
                    onToggle={toggleSelection}
                  >
                    <AsyncBattleCard battle={battle} />
                  </SelectableBattleCard>
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
                  <SelectableBattleCard
                    key={battle.id}
                    id={battle.id}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(battle.id)}
                    onToggle={toggleSelection}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-slate-800/50 border border-amber-500/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium mb-1">
                            {battle.challengeType?.name || 'Challenge'}
                          </p>
                          <p className="text-xs text-slate-400 line-clamp-2">{battle.challengeText}</p>
                          <p className="text-xs text-amber-400 mt-2">
                            Waiting for someone to accept your invitation
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-600/20 text-amber-400 shrink-0">
                          Pending
                        </span>
                      </div>
                      {!selectionMode && (
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
                      )}
                    </motion.div>
                  </SelectableBattleCard>
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
                  <SelectableBattleCard
                    key={battle.id}
                    id={battle.id}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(battle.id)}
                    onToggle={toggleSelection}
                  >
                    <AsyncBattleCard battle={battle} />
                  </SelectableBattleCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* History View */}
      {viewMode === 'history' && (
        <>
          {historyLoading && historyBattles.length === 0 && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}

          {!historyLoading && historyBattles.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <TrophyIcon className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Battle History</h3>
              <p className="text-sm text-slate-400">Your completed battles will appear here.</p>
            </div>
          )}

          {historyBattles.length > 0 && (
            <div className="space-y-3">
              {historyBattles.map((battle) => (
                <SelectableBattleCard
                  key={battle.id}
                  id={battle.id}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(battle.id)}
                  onToggle={toggleSelection}
                >
                  <HistoryBattleCard
                    battle={battle}
                    onClick={() => handleGoToBattle(battle.id)}
                  />
                </SelectableBattleCard>
              ))}
            </div>
          )}

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-400">
                Page {historyPage} of {historyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage === historyTotalPages}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Wrapper component for selectable battle cards
interface SelectableBattleCardProps {
  id: number;
  selectionMode: boolean;
  isSelected: boolean;
  onToggle: (id: number) => void;
  children: React.ReactNode;
}

function SelectableBattleCard({
  id,
  selectionMode,
  isSelected,
  onToggle,
  children,
}: SelectableBattleCardProps) {
  if (!selectionMode) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative cursor-pointer ${isSelected ? 'ring-2 ring-cyan-500 rounded-xl' : ''}`}
      onClick={() => onToggle(id)}
    >
      <div className="absolute top-3 left-3 z-10">
        <div
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-cyan-500 border-cyan-500'
              : 'bg-slate-800/80 border-slate-600 hover:border-slate-500'
          }`}
        >
          {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
        </div>
      </div>
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

// History battle card component
interface HistoryBattleCardProps {
  battle: BattleHistoryItem;
  onClick: () => void;
}

function HistoryBattleCard({ battle, onClick }: HistoryBattleCardProps) {
  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-600/20 text-emerald-400',
    cancelled: 'bg-red-600/20 text-red-400',
    expired: 'bg-amber-600/20 text-amber-400',
    pending: 'bg-slate-600/20 text-slate-400',
    active: 'bg-cyan-600/20 text-cyan-400',
  };

  const statusColor = statusColors[battle.status] || statusColors.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm text-white font-medium">
              vs {battle.opponentDisplayName || battle.opponent?.username || 'Unknown'}
            </p>
            {battle.winner && (
              <span className="text-xs text-emerald-400">
                {battle.winner.username === battle.challenger.username
                  ? battle.challenger.username === battle.opponent?.username
                    ? 'Tie'
                    : 'Won'
                  : 'Lost'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 line-clamp-1">{battle.challengeText}</p>
          <p className="text-xs text-slate-500 mt-1">
            {new Date(battle.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>
          {battle.status}
        </span>
      </div>
    </motion.div>
  );
}

export default MyBattlesTab;
