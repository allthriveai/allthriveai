/**
 * ThriveCirclePage - Community circle page with Neon Glass aesthetic
 * Features the circle community: members, challenge, activity, and kudos
 * Includes real-time activity notifications
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import { useCircleActivityMock } from '@/hooks/useCircleWebSocket';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { CircleMembersGrid } from '@/components/thrive-circle/CircleMembersGrid';
import { CircleChallengeCard } from '@/components/thrive-circle/CircleChallengeCard';
import { CircleActivityFeed } from '@/components/thrive-circle/CircleActivityFeed';
import { CircleProjectsFeed } from '@/components/thrive-circle/CircleProjectsFeed';
import { KudosWall } from '@/components/thrive-circle/KudosWall';
import { GiveKudosModal } from '@/components/thrive-circle/GiveKudosModal';
import {
  CircleActivityToast,
  useCircleActivityToasts,
  type CircleActivityEvent,
} from '@/components/thrive-circle/CircleActivityToast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
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
    circleProjects,
    isLoadingCircleProjects,
    giveKudos,
    isGivingKudos,
  } = useThriveCircle();

  const [selectedMember, setSelectedMember] = useState<CircleMembership | null>(null);

  // Real-time activity toasts
  const { events: activityEvents, addEvent, dismissEvent } = useCircleActivityToasts();

  // Handle real-time activity events (using mock for demo, switch to useCircleWebSocket for production)
  const handleActivityEvent = useCallback((event: CircleActivityEvent) => {
    addEvent(event);
  }, [addEvent]);

  // Enable mock activity events for demo (shows a new activity every 8 seconds)
  // In production, replace this with: useCircleWebSocket({ circleId: myCircle?.id, onActivity: handleActivityEvent })
  useCircleActivityMock(handleActivityEvent, isAuthenticated && !!myCircle, 8000);

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
          <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
            <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10 h-full flex items-center justify-center px-4">
              <div className="glass-card text-center max-w-md p-8">
                <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 shadow-neon">
                  <FontAwesomeIcon icon={faUserGroup} className="text-4xl text-cyan-bright" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">
                  Join Your <span className="text-gradient-cyan">Circle</span>
                </h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
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
          <div className="min-h-screen bg-background relative overflow-hidden">
            <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4 shadow-neon">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-cyan-bright" />
                </div>
                <p className="text-slate-400">Loading your circle...</p>
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
        <div className="min-h-screen bg-background relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Hero Section with Circle Challenge */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Hero Banner - Matching Learn page style */}
                <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-8 h-64 bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950">
                  <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      {myCircle?.tier && (
                        <span className="text-4xl">
                          {TIER_CONFIG[myCircle.tier]?.emoji || '🌱'}
                        </span>
                      )}
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                        <FontAwesomeIcon icon={faCalendarWeek} />
                        <span>{formatWeekDates()}</span>
                      </div>
                      {myCircle && (
                        <div className="inline-flex items-center gap-4 ml-auto text-sm">
                          <span className="text-white/80">
                            <span className="font-semibold text-white">{myCircle.memberCount}</span> members
                          </span>
                          <span className="text-white/80">
                            <span className="font-semibold text-emerald-300">{myCircle.activeMemberCount}</span> active
                          </span>
                        </div>
                      )}
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">
                      {myCircle ? (
                        <>
                          {myCircle.tierDisplay || myCircle.tier?.charAt(0).toUpperCase() + myCircle.tier?.slice(1)} Circle
                        </>
                      ) : (
                        'Thrive Circle'
                      )}
                    </h1>
                    <p className="text-xl text-primary-100">
                      {myCircle?.tier
                        ? TIER_CONFIG[myCircle.tier]?.description
                        : 'A weekly community of ~25 learners at your level. Complete challenges together, give kudos to celebrate wins, and grow as a supportive community.'}
                    </p>
                  </div>
                </div>

                {/* Circle Challenge - Hero Style */}
                {myCircle?.activeChallenge ? (
                  <CircleChallengeCard challenge={myCircle.activeChallenge} variant="hero" />
                ) : (
                  <div className="glass-card neon-border p-8 text-center">
                    <FontAwesomeIcon icon={faCalendarWeek} className="text-4xl text-cyan-bright/50 mb-4" />
                    <p className="text-lg text-slate-400">
                      {myCircle
                        ? 'No challenge this week. Check back on Monday!'
                        : 'Circles are formed every Monday. Check back soon!'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              {/* Row 1: Circle Members (50%) + Activity Feed (50%) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Circle Members Grid */}
                <CircleMembersGrid
                  members={myCircle?.members || []}
                  currentUserId={user?.id}
                  onGiveKudos={setSelectedMember}
                  isLoading={isLoadingCircle}
                />

                {/* Activity Feed */}
                <CircleActivityFeed
                  kudos={circleActivity?.kudos || kudosReceived}
                  isLoading={isLoadingKudos}
                />
              </div>

              {/* Row 2: Kudos Wall (100% - only shows if kudos exist) */}
              <KudosWall
                kudos={kudosReceived || []}
                currentUserId={user?.id}
                isLoading={isLoadingKudos}
              />

              {/* Row 3: Circle Projects Feed (100%) */}
              <CircleProjectsFeed
                projects={circleProjects}
                isLoading={isLoadingCircleProjects}
              />

              {/* Quick Challenge Card (if exists) */}
              {myCircle?.activeChallenge && (
                <CircleChallengeCard challenge={myCircle.activeChallenge} variant="card" />
              )}
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

            {/* Real-time Activity Toasts */}
            <CircleActivityToast
              events={activityEvents}
              onDismiss={dismissEvent}
              maxVisible={3}
              autoHideDuration={5000}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
