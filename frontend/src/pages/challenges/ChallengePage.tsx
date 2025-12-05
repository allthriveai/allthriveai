/**
 * ChallengePage - Weekly Challenge landing page with Neon Glass aesthetic
 * Features the current challenge, submissions gallery, leaderboard, and submission form
 * Supports light/dark mode with framer-motion animations
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
  TrophyIcon,
  ClockIcon,
  UserGroupIcon,
  HeartIcon,
  ArrowRightIcon,
  StarIcon,
  BoltIcon,
  PhotoIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import {
  getChallengeBySlug,
  getCurrentChallenge,
  getChallengeSubmissions,
  getChallengeLeaderboard,
  voteForSubmission,
  unvoteSubmission,
  type WeeklyChallenge,
  type ChallengeSubmission,
  type LeaderboardEntry,
} from '@/services/challenges';
import { ChallengeSubmitModal } from '@/components/challenges/ChallengeSubmitModal';
import { ChallengeLeaderboard } from '@/components/challenges/ChallengeLeaderboard';
import { ChallengeSubmissionCard } from '@/components/challenges/ChallengeSubmissionCard';
import { ToolTray } from '@/components/tools/ToolTray';

// Animation variants
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Prize tier colors
const PRIZE_COLORS: Record<string, string> = {
  '1st': 'text-yellow-400',
  '2nd': 'text-slate-300 dark:text-slate-400',
  '3rd': 'text-amber-600',
};

export default function ChallengePage() {
  const { slug } = useParams<{ slug?: string }>();
  const { isAuthenticated, user } = useAuth();

  // State
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'recent' | 'featured'>('votes');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Tool tray state
  const [toolTrayOpen, setToolTrayOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);

  const openToolTray = (toolName: string) => {
    const toolSlug = toolName.toLowerCase().replace(/\s+/g, '-');
    setSelectedToolSlug(toolSlug);
    setToolTrayOpen(true);
  };

  const closeToolTray = () => {
    setToolTrayOpen(false);
    setSelectedToolSlug(null);
  };

  // Fetch challenge data
  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = slug
        ? await getChallengeBySlug(slug)
        : await getCurrentChallenge();
      setChallenge(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load challenge';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    if (!challenge?.slug) return;

    setIsLoadingSubmissions(true);
    try {
      const data = await getChallengeSubmissions(challenge.slug, {
        sort: sortBy,
        page,
        pageSize: 12,
      });
      setSubmissions(data.results);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [challenge?.slug, sortBy, page]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!challenge?.slug) return;

    try {
      const data = await getChallengeLeaderboard(challenge.slug, 10);
      setLeaderboard(data.entries);
      setTotalParticipants(data.totalParticipants);
      setUserEntry(data.userEntry || null);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }, [challenge?.slug]);

  // Load data
  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  useEffect(() => {
    if (challenge) {
      fetchSubmissions();
      fetchLeaderboard();
    }
  }, [challenge, fetchSubmissions, fetchLeaderboard]);

  // Handle vote
  const handleVote = async (submission: ChallengeSubmission) => {
    if (!isAuthenticated || !challenge) return;

    try {
      if (submission.hasVoted) {
        const result = await unvoteSubmission(challenge.slug, submission.id);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submission.id
              ? { ...s, hasVoted: false, voteCount: result.newVoteCount }
              : s
          )
        );
      } else {
        const result = await voteForSubmission(challenge.slug, submission.id);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submission.id
              ? { ...s, hasVoted: true, voteCount: result.newVoteCount }
              : s
          )
        );
      }
      // Refresh leaderboard
      fetchLeaderboard();
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  // Handle submission success
  const handleSubmissionSuccess = () => {
    setShowSubmitModal(false);
    fetchChallenge();
    fetchSubmissions();
    fetchLeaderboard();
  };

  // Render prize display
  const renderPrizes = () => {
    if (!challenge?.prizes) return null;

    return (
      <motion.div
        variants={fadeIn}
        className="glass-card p-6 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-yellow-500" />
          Prizes
        </h3>
        <div className="space-y-3">
          {Object.entries(challenge.prizes).map(([place, prize]) => (
            <motion.div
              key={place}
              whileHover={{ x: 4 }}
              className="flex items-center justify-between"
            >
              <span className={`font-medium ${PRIZE_COLORS[place] || 'text-gray-600 dark:text-slate-400'}`}>
                {place}
              </span>
              <span className="text-gray-900 dark:text-white">
                {prize.type === 'cash' ? `$${prize.amount}` : `${prize.amount.toLocaleString()} tokens`}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        {() => (
          <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-600 dark:text-slate-400">Loading challenge...</p>
            </motion.div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !challenge) {
    return (
      <DashboardLayout>
        {() => (
          <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
            <div className="fixed inset-0 bg-grid-pattern opacity-10 dark:opacity-20 pointer-events-none" />
            <div className="relative z-10 flex items-center justify-center min-h-[60vh] px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card text-center max-w-md p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <div className="w-20 h-20 rounded-2xl bg-pink-100 dark:bg-pink-accent/20 flex items-center justify-center mx-auto mb-6">
                  <TrophyIcon className="w-10 h-10 text-pink-500 dark:text-pink-accent" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {error || 'No Active Challenge'}
                </h1>
                <p className="text-gray-600 dark:text-slate-400 mb-6">
                  Check back soon for our next weekly challenge!
                </p>
                <Link
                  to="/challenges"
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  View All Challenges
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="fixed inset-0 bg-grid-pattern opacity-10 dark:opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-500/3 dark:bg-pink-accent/5 blur-[120px] pointer-events-none" />

          {/* Hero Banner - Neon Glass Style */}
          <header className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden" aria-label="Weekly Challenge page header">
            {/* Ambient Glow Background */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-yellow-500/20 dark:bg-yellow-500/20 blur-[120px] pointer-events-none" aria-hidden="true" />
            <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-pink-500/10 dark:bg-pink-500/10 blur-[100px] pointer-events-none" aria-hidden="true" />

            <div className="relative max-w-7xl mx-auto px-4 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                <span className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 dark:from-yellow-400 dark:via-amber-400 dark:to-orange-400 bg-clip-text text-transparent">Weekly Challenge</span>
              </h1>
              <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mb-6">
                Complete this week's challenge and share your work. The submission with the most community votes wins.
              </p>

              {/* How It Works - inline */}
              <div className="flex items-center gap-6 text-sm">
                {[
                  { step: '1', label: 'Complete the challenge' },
                  { step: '2', label: 'Submit your work' },
                  { step: '3', label: 'Get votes to win' },
                ].map((item, i) => (
                  <div key={item.step} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 dark:bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                      <span className="text-yellow-600 dark:text-yellow-400 font-bold text-xs">{item.step}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">

            {/* Challenge Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-8 mb-8 relative overflow-hidden bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10"
            >
              {/* Top right: Stats and Sponsor */}
              <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                {/* Challenge stats row */}
                <div className="flex items-center gap-3 text-sm">
                  {challenge.timeRemainingDisplay && (
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                      <ClockIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-bright" />
                      <span>{challenge.timeRemainingDisplay}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                    <PhotoIcon className="w-4 h-4 text-pink-500 dark:text-pink-accent" />
                    <span>{challenge.submissionCount} submissions</span>
                  </div>
                </div>

                {/* User stats row */}
                {isAuthenticated && challenge.userStatus && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                      <BoltIcon className="w-4 h-4 text-yellow-500" />
                      <span>{challenge.userStatus.submissionCount}/{challenge.maxSubmissionsPerUser} submissions</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                      <HeartIcon className="w-4 h-4 text-pink-500 dark:text-pink-accent" />
                      <span>{challenge.userStatus.votesRemainingToday} votes remaining</span>
                    </div>
                  </div>
                )}

                {/* Sponsor badge */}
                {challenge.sponsor && (
                  <motion.a
                    href={challenge.sponsor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    <span className="text-xs text-gray-500 dark:text-slate-400">Sponsored by</span>
                    {challenge.sponsor.logoUrl ? (
                      <img
                        src={challenge.sponsor.logoUrl}
                        alt={challenge.sponsor.name}
                        className="h-5"
                      />
                    ) : (
                      <span className="text-sm text-gray-900 dark:text-white font-medium">
                        {challenge.sponsor.name}
                      </span>
                    )}
                  </motion.a>
                )}
              </div>

              {/* Challenge title and status */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    challenge.status === 'active'
                      ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 ring-1 ring-green-500/30'
                      : challenge.status === 'voting'
                      ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-500/30'
                      : challenge.status === 'upcoming'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/30'
                      : 'bg-gray-100 dark:bg-slate-500/20 text-gray-700 dark:text-slate-400 ring-1 ring-gray-500/30'
                  }`}
                >
                  {challenge.status === 'active' && (
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                  )}
                  {challenge.statusDisplay}
                </motion.span>
                <span className="text-gray-400 dark:text-slate-500">•</span>
                <span className="text-gray-500 dark:text-slate-400 text-sm">
                  Week {challenge.weekNumber}, {challenge.year}
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {challenge.title}
              </h2>

              <p className="text-gray-600 dark:text-slate-300 text-lg mb-6 max-w-3xl">
                {challenge.description}
              </p>

              {/* Suggested Tools */}
              {challenge.suggestedTools && challenge.suggestedTools.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <WrenchScrewdriverIcon className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Try it with
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {challenge.suggestedTools.map((tool, index) => (
                      <motion.button
                        key={tool.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => openToolTray(tool.name)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all group"
                      >
                        {tool.icon ? (
                          <img src={tool.icon} alt={tool.name} className="w-5 h-5 rounded" />
                        ) : (
                          <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
                            {tool.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-gray-600 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {tool.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}


              {/* User rank display */}
              {isAuthenticated && challenge.userStatus?.rank && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 mb-6"
                >
                  <TrophyIcon className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    You're ranked #{challenge.userStatus.rank} with {challenge.userStatus.totalVotes} votes
                  </span>
                </motion.div>
              )}

              {/* CTA */}
              {challenge.canSubmit && isAuthenticated && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSubmitModal(true)}
                  className="btn-primary inline-flex items-center gap-2 shadow-lg dark:shadow-neon-strong"
                  disabled={!challenge.userStatus?.canSubmitMore}
                >
                  <BoltIcon className="w-5 h-5" />
                  Submit Your Entry
                </motion.button>
              )}

              {!isAuthenticated && (
                <Link
                  to="/auth"
                  className="btn-primary inline-flex items-center gap-2 shadow-lg dark:shadow-neon-strong"
                >
                  <BoltIcon className="w-5 h-5" />
                  Sign In to Participate
                </Link>
              )}
            </motion.div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Submissions gallery */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Submissions</h2>
                  <div className="flex gap-2">
                    {(['votes', 'recent', 'featured'] as const).map((sort) => (
                      <motion.button
                        key={sort}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setSortBy(sort);
                          setPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          sortBy === sort
                            ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-bright'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {sort.charAt(0).toUpperCase() + sort.slice(1)}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {isLoadingSubmissions ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center py-12"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"
                      />
                    </motion.div>
                  ) : submissions.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-8 text-center bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10"
                    >
                      <PhotoIcon className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-slate-400">No submissions yet. Be the first!</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="submissions"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {submissions.map((submission, index) => (
                          <motion.div
                            key={submission.id}
                            variants={fadeIn}
                            transition={{ delay: index * 0.05 }}
                          >
                            <ChallengeSubmissionCard
                              submission={submission}
                              onVote={() => handleVote(submission)}
                              canVote={isAuthenticated && challenge.canVote}
                            />
                          </motion.div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <motion.button
                              key={p}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setPage(p)}
                              className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                                page === p
                                  ? 'bg-cyan-500 text-white'
                                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                              }`}
                            >
                              {p}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sidebar */}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-6"
              >
                {/* Prizes */}
                {renderPrizes()}

                {/* Leaderboard */}
                <motion.div variants={fadeIn}>
                  <ChallengeLeaderboard
                    entries={leaderboard}
                    userEntry={userEntry}
                    totalParticipants={totalParticipants}
                  />
                </motion.div>

                {/* Points info */}
                {challenge.pointsConfig && (
                  <motion.div
                    variants={fadeIn}
                    className="glass-card p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <StarIcon className="w-5 h-5 text-yellow-500" />
                      Earn Points
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Submit entry</span>
                        <span className="text-cyan-600 dark:text-cyan-bright">+{challenge.pointsConfig.submit || 50}</span>
                      </div>
                      {challenge.pointsConfig.early_bird && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Early bird bonus</span>
                          <span className="text-cyan-600 dark:text-cyan-bright">+{challenge.pointsConfig.early_bird}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Vote on others</span>
                        <span className="text-cyan-600 dark:text-cyan-bright">+{challenge.pointsConfig.vote_cast || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Receive vote</span>
                        <span className="text-cyan-600 dark:text-cyan-bright">+{challenge.pointsConfig.vote_received || 2}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Submit Modal */}
          <AnimatePresence>
            {showSubmitModal && challenge && (
              <ChallengeSubmitModal
                challenge={challenge}
                onClose={() => setShowSubmitModal(false)}
                onSuccess={handleSubmissionSuccess}
              />
            )}
          </AnimatePresence>

          {/* Tool Tray */}
          {selectedToolSlug && (
            <ToolTray
              isOpen={toolTrayOpen}
              onClose={closeToolTray}
              toolSlug={selectedToolSlug}
            />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
