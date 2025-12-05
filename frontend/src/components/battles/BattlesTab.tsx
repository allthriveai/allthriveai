/**
 * BattlesTab component for displaying user's battle history on their profile
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrophy,
  faSpinner,
  faStar,
  faChevronDown,
  faChevronUp,
  faImage,
  faCrown,
  faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import { getUserBattles, type Battle, type BattleStats, type BattleSubmission } from '@/services/battles';

interface BattlesTabProps {
  username: string;
}

// Format relative time
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Battle Card Component
function BattleCard({ battle, profileUsername }: { battle: Battle; profileUsername: string }) {
  const [expanded, setExpanded] = useState(false);

  // Find profile user's submission and opponent's submission
  const profileSubmission = battle.submissions.find(s => s.user.username === profileUsername);
  const opponentSubmission = battle.submissions.find(s => s.user.username !== profileUsername);

  const isWinner = battle.isUserWinner;
  const isTie = !battle.winner;
  const opponent = battle.challenger.username === profileUsername ? battle.opponent : battle.challenger;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Battle Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isWinner ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold">
                <FontAwesomeIcon icon={faCrown} className="w-3 h-3" />
                Won
              </span>
            ) : isTie ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
                <FontAwesomeIcon icon={faHandshake} className="w-3 h-3" />
                Tie
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
                Lost
              </span>
            )}
            {battle.challengeType && (
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs">
                {battle.challengeType.name}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(battle.completedAt)}
          </span>
        </div>

        {/* Challenge */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">
          {battle.challengeText}
        </h3>

        {/* Opponent */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>vs</span>
          {opponent && (
            <>
              <img
                src={opponent.avatarUrl || `https://ui-avatars.com/api/?name=${opponent.username}&background=random`}
                alt={opponent.username}
                className="w-5 h-5 rounded-full"
              />
              <span className="font-medium">{opponent.username}</span>
            </>
          )}
        </div>
      </div>

      {/* Submissions Preview - Show images side by side */}
      <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800">
        {/* Profile User's Submission */}
        <div className="bg-white dark:bg-gray-900/50 p-2">
          <div className="text-xs text-gray-500 mb-1.5 font-medium">
            {profileUsername}
            {profileSubmission?.score && (
              <span className="ml-2 text-teal-600 dark:text-teal-400">
                {profileSubmission.score.toFixed(0)}
                <FontAwesomeIcon icon={faStar} className="w-2.5 h-2.5 ml-0.5" />
              </span>
            )}
          </div>
          {profileSubmission?.generatedOutputUrl ? (
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={profileSubmission.generatedOutputUrl}
                alt="Generated output"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FontAwesomeIcon icon={faImage} className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Opponent's Submission */}
        <div className="bg-white dark:bg-gray-900/50 p-2">
          <div className="text-xs text-gray-500 mb-1.5 font-medium">
            {opponent?.username || 'Opponent'}
            {opponentSubmission?.score && (
              <span className="ml-2 text-teal-600 dark:text-teal-400">
                {opponentSubmission.score.toFixed(0)}
                <FontAwesomeIcon icon={faStar} className="w-2.5 h-2.5 ml-0.5" />
              </span>
            )}
          </div>
          {opponentSubmission?.generatedOutputUrl ? (
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={opponentSubmission.generatedOutputUrl}
                alt="Opponent's output"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FontAwesomeIcon icon={faImage} className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-2 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span>{expanded ? 'Hide Prompts' : 'Show Prompts'}</span>
        <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} className="w-3 h-3" />
      </button>

      {/* Expanded Content - Prompts */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
              {/* Profile User's Prompt */}
              {profileSubmission && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {profileUsername}'s Prompt
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                    {profileSubmission.promptText}
                  </div>
                  {profileSubmission.evaluationFeedback && (
                    <div className="mt-2 text-xs text-gray-500 italic">
                      {profileSubmission.evaluationFeedback}
                    </div>
                  )}
                </div>
              )}

              {/* Opponent's Prompt */}
              {opponentSubmission && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {opponent?.username}'s Prompt
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                    {opponentSubmission.promptText}
                  </div>
                  {opponentSubmission.evaluationFeedback && (
                    <div className="mt-2 text-xs text-gray-500 italic">
                      {opponentSubmission.evaluationFeedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Stats Card Component
function StatsCard({ stats }: { stats: BattleStats }) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-teal-500/10 rounded-xl p-4 mb-6 border border-purple-200/50 dark:border-purple-800/50">
      <div className="flex items-center gap-2 mb-3">
        <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900 dark:text-white">Battle Stats</h3>
      </div>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBattles}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Battles</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.wins}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Wins</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.losses}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Losses</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.winRate}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Win Rate</div>
        </div>
      </div>
    </div>
  );
}

export function BattlesTab({ username }: BattlesTabProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBattles() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getUserBattles(username);
        setBattles(response.battles);
        setStats(response.stats);
      } catch (err) {
        console.error('Failed to fetch battles:', err);
        setError('Failed to load battle history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBattles();
  }, [username]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="text-center py-20">
        <FontAwesomeIcon icon={faTrophy} className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Battles Yet</h3>
        <p className="text-gray-500">This user hasn't participated in any prompt battles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && <StatsCard stats={stats} />}

      {/* Battle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {battles.map((battle) => (
            <BattleCard key={battle.id} battle={battle} profileUsername={username} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
