/**
 * ThriveCirclePage - Community circle page with Neon Glass aesthetic
 * Features the circle community: members, challenge, activity, and kudos
 * Includes real-time activity notifications
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { CircleMembersGrid } from '@/components/thrive-circle/CircleMembersGrid';
import { CircleChallengeCard } from '@/components/thrive-circle/CircleChallengeCard';
import { CircleActivityFeed } from '@/components/thrive-circle/CircleActivityFeed';
import { CircleProjectsFeed } from '@/components/thrive-circle/CircleProjectsFeed';
import { KudosWall } from '@/components/thrive-circle/KudosWall';
import { GiveKudosModal } from '@/components/thrive-circle/GiveKudosModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarWeek,
  faSpinner,
  faUserGroup,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { CircleMembership, KudosType, TierName } from '@/types/models';

// Tier descriptions and colors
const TIER_CONFIG: Record<TierName, { emoji: string; description: string; color: string }> = {
  seedling: {
    emoji: '🌱',
    description: 'Just getting started! Focus on exploring and building your first projects.',
    color: 'text-emerald-400',
  },
  sprout: {
    emoji: '🌿',
    description: 'Growing strong! You\'re building consistency and helping others along the way.',
    color: 'text-green-400',
  },
  blossom: {
    emoji: '🌸',
    description: 'Blooming beautifully! Your creativity and contributions are making an impact.',
    color: 'text-pink-400',
  },
  bloom: {
    emoji: '🌺',
    description: 'In full bloom! You\'re a valued community member inspiring others.',
    color: 'text-rose-400',
  },
  evergreen: {
    emoji: '🌲',
    description: 'A pillar of the community! Your consistent excellence guides others.',
    color: 'text-teal-400',
  },
  curation: {
    emoji: '✨',
    description: 'Community curator! You help shape and elevate the entire community.',
    color: 'text-yellow-400',
  },
};

export default function ThriveCirclePage() {
  const { isAuthenticated, user } = useAuth();
  const {
    myCircle,
    kudosReceived,
    circleActivity,
    isLoading,
    isLoadingCircle,
    isLoadingKudos,
    isLoadingCircleActivity,
    circleProjects,
    isLoadingCircleProjects,
    giveKudos,
    isGivingKudos,
  } = useThriveCircle();

  const [selectedMember, setSelectedMember] = useState<CircleMembership | null>(null);

  const handleGiveKudos = (kudosType: KudosType, message: string) => {
    if (!selectedMember) return;
    giveKudos({
      toUserId: selectedMember.user.id,
      kudosType,
      message,
    });
    setSelectedMember(null);
  };

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        {() => (
          <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
            <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10 h-full flex items-center justify-center px-4">
              <div className="glass-card text-center max-w-md p-8">
                <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 shadow-neon">
                  <FontAwesomeIcon icon={faUserGroup} className="text-4xl text-cyan-bright" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Join Your <span className="text-gradient-cyan">Circle</span>
                </h1>
                <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Every week, you'll be matched with ~25 fellow learners at your level.
                  Complete challenges together, give kudos, and grow as a community.
                </p>
                <a
                  href="/auth"
                  className="btn-primary inline-flex items-center gap-2 shadow-neon-strong"
                >
                  <FontAwesomeIcon icon={faBolt} />
                  Sign In to Join
                </a>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Loading state
  if (isLoading || isLoadingCircle) {
    return (
      <DashboardLayout>
        {() => (
          <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
            <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 min-h-[60vh] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4 shadow-neon">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-cyan-bright" />
                </div>
                <p className="text-gray-600 dark:text-slate-400">Loading your circle...</p>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Format week dates
  const formatWeekDates = () => {
    if (!myCircle) return 'This Week';
    const start = new Date(myCircle.weekStart);
    const end = new Date(myCircle.weekEnd);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Hero Banner - Neon Glass Style */}
            <header className="relative min-h-64 py-6 sm:py-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden" aria-label="Thrive Circle page header">
              {/* Ambient Glow Background */}
              <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 dark:bg-cyan-500/20 blur-[120px] pointer-events-none" aria-hidden="true" />
              <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-pink-500/10 dark:bg-pink-500/10 blur-[100px] pointer-events-none" aria-hidden="true" />

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
                {/* Member stats - shown at top on mobile */}
                {myCircle && (
                  <dl className="flex items-center gap-4 text-sm mb-3 sm:hidden">
                    <div className="text-gray-600 dark:text-white/80">
                      <dt className="sr-only">Total members</dt>
                      <dd><span className="font-semibold text-gray-900 dark:text-white">{myCircle.memberCount}</span> members</dd>
                    </div>
                    <div className="text-gray-600 dark:text-white/80">
                      <dt className="sr-only">Active members</dt>
                      <dd><span className="font-semibold text-emerald-600 dark:text-emerald-300">{myCircle.activeMemberCount}</span> active</dd>
                    </div>
                  </dl>
                )}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  {myCircle?.tier && (
                    <span className="text-4xl" role="img" aria-label={`${myCircle.tierDisplay || myCircle.tier} tier`}>
                      {TIER_CONFIG[myCircle.tier]?.emoji || '🌱'}
                    </span>
                  )}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-white/10 text-gray-700 dark:text-white/80 text-xs font-medium border border-gray-200 dark:border-white/20">
                    <FontAwesomeIcon icon={faCalendarWeek} aria-hidden="true" />
                    <span>{formatWeekDates()}</span>
                  </div>
                  {/* Member stats - inline on desktop */}
                  {myCircle && (
                    <dl className="hidden sm:inline-flex items-center gap-4 ml-auto text-sm">
                      <div className="text-gray-600 dark:text-white/80">
                        <dt className="sr-only">Total members</dt>
                        <dd><span className="font-semibold text-gray-900 dark:text-white">{myCircle.memberCount}</span> members</dd>
                      </div>
                      <div className="text-gray-600 dark:text-white/80">
                        <dt className="sr-only">Active members</dt>
                        <dd><span className="font-semibold text-emerald-600 dark:text-emerald-300">{myCircle.activeMemberCount}</span> active</dd>
                      </div>
                    </dl>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-pink-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-pink-400 bg-clip-text text-transparent">
                    {myCircle ? (
                      <>
                        {myCircle.tierDisplay || myCircle.tier?.charAt(0).toUpperCase() + myCircle.tier?.slice(1)} Circle
                      </>
                    ) : (
                      'Thrive Circle'
                    )}
                  </span>
                </h1>
                <div className="max-w-6xl space-y-2">
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                    Thrive Circles are small groups of creators matched weekly based on where you are in your journey.
                  </p>
                  {myCircle && (
                    <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                      {myCircle.matchReason || `You and ${myCircle.memberCount - 1} other creators are all at the ${myCircle.tierDisplay || myCircle.tier} level. We put you together so you can learn from each other, share wins, and grow at a similar pace.`}
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Hero Section with Circle Challenge */}
            <div className="relative">
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Circle Challenge - Hero Style */}
                {myCircle?.activeChallenge ? (
                  <CircleChallengeCard challenge={myCircle.activeChallenge} variant="hero" />
                ) : (
                  <div className="glass-card neon-border p-8 text-center">
                    <FontAwesomeIcon icon={faCalendarWeek} className="text-4xl text-cyan-600 dark:text-cyan-bright/50 mb-4" />
                    <p className="text-lg text-gray-600 dark:text-slate-400">
                      {myCircle
                        ? 'No challenge this week. Check back on Monday!'
                        : 'Circles are formed every Monday. Check back soon!'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 space-y-6">
              {/* Row 1: Circle Members (50%) + Activity Feed (50%) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Circle Members Grid */}
                <CircleMembersGrid
                  members={myCircle?.members || []}
                  currentUserId={user?.id?.toString()}
                  onGiveKudos={setSelectedMember}
                  isLoading={isLoadingCircle}
                />

                {/* Activity Feed */}
                <CircleActivityFeed
                  activityFeed={circleActivity}
                  isLoading={isLoadingCircleActivity}
                />
              </div>

              {/* Row 2: Kudos Wall (100% - only shows if kudos exist) */}
              <KudosWall
                kudos={kudosReceived || []}
                currentUserId={user?.id?.toString()}
                isLoading={isLoadingKudos}
              />

              {/* Row 3: Circle Projects Feed (100%) */}
              <CircleProjectsFeed
                projects={circleProjects}
                isLoading={isLoadingCircleProjects}
              />
            </div>

            {/* Give Kudos Modal */}
            {selectedMember && (
              <GiveKudosModal
                member={selectedMember}
                onClose={() => setSelectedMember(null)}
                onSubmit={handleGiveKudos}
                isSubmitting={isGivingKudos}
              />
            )}

          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
