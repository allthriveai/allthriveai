/**
 * CollectiveProfileSection - Profile layout for The AI Network Collective
 *
 * Based on profile-redesign.md spec and /styleguide design system.
 *
 * Sections:
 * 1. Asks + Offers side-by-side (the core marketplace)
 * 2. Things I'm Working On (projects, apps, agents)
 * 3. Things I Love (curated links)
 *
 * Design System:
 * - glass-panel, glass-card, glass-subtle for containers
 * - btn-primary, btn-secondary, btn-outline for buttons
 * - Heroicons (no emojis)
 * - Colors: cyan, slate, white
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  HeartIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { getUserAsks, getUserOffers, getListings } from '@/services/listings';
import { getMyPointActivities } from '@/services/thriveCircle';
import type { ListingCard as ListingCardType } from '@/types/listings';
import type { PointActivity } from '@/types/models';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface CollectiveProfileUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;
  tagline?: string;
}

interface CollectiveProfileSectionProps {
  user: CollectiveProfileUser;
  isOwnProfile?: boolean;
  className?: string;
}

// ============================================================================
// Section Header - Following styleguide pattern
// ============================================================================

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function SectionHeader({ icon, title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="text-sm text-slate-500">{count}</span>
        )}
      </div>
      {action && (
        <button onClick={action.onClick} className="btn-outline text-sm px-3 py-1.5">
          <PlusIcon className="w-4 h-4 mr-1.5 inline" />
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Ask Item - Compact list item for asks column
// ============================================================================

function AskItem({ listing }: { listing: ListingCardType }) {
  const isOpen = listing.status === 'open';

  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all"
    >
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
          {listing.title}
        </h4>
        {listing.listingTypeDisplay && (
          <p className="text-xs text-slate-500 mt-0.5">{listing.listingTypeDisplay}</p>
        )}
      </div>
      <span
        className={clsx(
          'flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded',
          isOpen
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
        )}
      >
        {isOpen ? 'Open' : 'Closed'}
      </span>
    </Link>
  );
}

// ============================================================================
// Offer Item - Compact list item for offers column
// ============================================================================

function OfferItem({ listing }: { listing: ListingCardType }) {
  const hasPrice = listing.isPaid && listing.price;

  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all"
    >
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
          {listing.title}
        </h4>
        {listing.listingTypeDisplay && (
          <p className="text-xs text-slate-500 mt-0.5">{listing.listingTypeDisplay}</p>
        )}
      </div>
      <span className="flex-shrink-0 text-sm font-medium text-emerald-400">
        {hasPrice ? (
          <>
            ${listing.price}
            {listing.pricingType === 'hourly' && '/hr'}
          </>
        ) : (
          'Free'
        )}
      </span>
    </Link>
  );
}

// ============================================================================
// Project Card - Rich card for "Things I'm Working On"
// ============================================================================

function ProjectCard({ listing }: { listing: ListingCardType }) {
  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group glass-card block overflow-hidden"
    >
      {/* Image */}
      {listing.featuredImageUrl && (
        <div className="aspect-video overflow-hidden">
          <img
            src={listing.featuredImageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="p-5">
        {/* Title */}
        <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors mb-2">
          {listing.title}
        </h4>

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-slate-400 line-clamp-2 mb-4">{listing.description}</p>
        )}

        {/* Tags */}
        {listing.topicsDisplay && listing.topicsDisplay.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {listing.topicsDisplay.slice(0, 3).map((topic, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-white/5 text-slate-400 border border-white/10"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          <CheckCircleIcon
            className={clsx(
              'w-4 h-4',
              listing.status === 'published' ? 'text-emerald-400' : 'text-slate-500'
            )}
          />
          <span className="text-xs text-slate-500">
            {listing.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Curated Link Item - For "Things I Love"
// ============================================================================

function CuratedLinkItem({ listing }: { listing: ListingCardType }) {
  return (
    <a
      href={listing.externalUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-rose-500/20 transition-all"
    >
      <HeartIcon className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white group-hover:text-rose-400 transition-colors">
          {listing.title}
        </h4>
        {listing.description && (
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{listing.description}</p>
        )}
      </div>
      <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-600 group-hover:text-rose-400 flex-shrink-0" />
    </a>
  );
}

// ============================================================================
// Activity Item - For "Recent Activity"
// ============================================================================

function ActivityItem({ activity }: { activity: PointActivity }) {
  const activityLabels: Record<string, string> = {
    quiz_complete: 'Completed a quiz',
    project_create: 'Created a project',
    project_update: 'Updated a project',
    comment: 'Posted a comment',
    reaction: 'Gave a reaction',
    daily_login: 'Daily login',
    streak_bonus: 'Streak bonus',
    weekly_goal: 'Completed weekly goal',
    side_quest: 'Completed a side quest',
    prompt_battle: 'Joined a Prompt Battle',
    prompt_battle_win: 'Won a Prompt Battle',
    lesson_complete: 'Completed a lesson',
    exercise_complete: 'Completed an exercise',
    learning_path_complete: 'Completed a learning path',
  };

  const label = activity.description || activityLabels[activity.activityType] || activity.activityType;
  const timeAgo = formatTimeAgo(activity.createdAt);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className="p-1.5 rounded bg-cyan-500/10">
        <ClockIcon className="w-4 h-4 text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{label}</p>
        <p className="text-xs text-slate-500">{timeAgo}</p>
      </div>
      {activity.amount > 0 && (
        <span className="text-xs font-medium text-emerald-400">+{activity.amount} pts</span>
      )}
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
  icon,
  message,
  action,
}: {
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">{icon}</div>
      <p className="text-sm text-slate-500 mb-4">{message}</p>
      {action && (
        <button onClick={action.onClick} className="btn-secondary text-sm">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CollectiveProfileSection({
  user,
  isOwnProfile = false,
  className,
}: CollectiveProfileSectionProps) {
  const navigate = useNavigate();

  const [asks, setAsks] = useState<ListingCardType[]>([]);
  const [offers, setOffers] = useState<ListingCardType[]>([]);
  const [projects, setProjects] = useState<ListingCardType[]>([]);
  const [curatedLinks, setCuratedLinks] = useState<ListingCardType[]>([]);
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load listings
  useEffect(() => {
    async function loadListings() {
      if (!user.username) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Load asks and offers separately to handle errors gracefully
        const [asksResult, offersResult, allListingsResult, activitiesResult] = await Promise.allSettled([
          getUserAsks(user.username),
          getUserOffers(user.username),
          getListings({ username: user.username }),
          isOwnProfile ? getMyPointActivities() : Promise.resolve([]),
        ]);

        // Set asks if successful
        if (asksResult.status === 'fulfilled') {
          setAsks(asksResult.value);
        } else {
          console.error('Failed to load asks:', asksResult.reason);
          setAsks([]);
        }

        // Set offers if successful
        if (offersResult.status === 'fulfilled') {
          setOffers(offersResult.value);
        } else {
          console.error('Failed to load offers:', offersResult.reason);
          setOffers([]);
        }

        // Process all listings if successful
        if (allListingsResult.status === 'fulfilled') {
          const allListings = allListingsResult.value;

          // Filter project-type listings
          const projectTypeSlugs = ['app', 'agent', 'listing-mcp-server', 'side-project'];
          setProjects(
            allListings.results.filter((l) => projectTypeSlugs.includes(l.listingTypeSlug || ''))
          );

          // Filter curated links
          setCuratedLinks(
            allListings.results.filter((l) => l.listingTypeSlug === 'curated-link')
          );
        } else {
          console.error('Failed to load all listings:', allListingsResult.reason);
          setProjects([]);
          setCuratedLinks([]);
        }

        // Set activities if successful (only for own profile)
        if (activitiesResult.status === 'fulfilled') {
          setActivities(activitiesResult.value);
        } else {
          console.error('Failed to load activities:', activitiesResult.reason);
          setActivities([]);
        }
      } catch (err) {
        console.error('Failed to load listings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadListings();
  }, [user.username, isOwnProfile]);

  // Navigation handlers
  const handleCreateAsk = () => navigate('/listings/new?intent=ask');
  const handleCreateOffer = () => navigate('/listings/new?intent=offer');
  const handleCreateProject = () => navigate('/listings/new?intent=offer&type=app');
  const handleCreateCuratedLink = () => navigate('/listings/new?intent=offer&type=curated-link');

  if (isLoading) {
    return <LoadingState />;
  }

  const hasAsksOrOffers = asks.length > 0 || offers.length > 0;
  const hasProjects = projects.length > 0;
  const hasCuratedLinks = curatedLinks.length > 0;
  const hasActivities = activities.length > 0;
  const hasAnyContent = hasAsksOrOffers || hasProjects || hasCuratedLinks || hasActivities;

  return (
    <div className={clsx('space-y-12', className)}>
      {/* ================================================================
          ASKS + OFFERS - Side by Side
          ================================================================ */}
      {(hasAsksOrOffers || isOwnProfile) && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Asks Column */}
            <div className="glass-panel p-6">
              <SectionHeader
                icon={<RocketLaunchIcon className="w-5 h-5 text-cyan-400" />}
                title="Asks"
                count={asks.length}
                action={isOwnProfile ? { label: 'Post Ask', onClick: handleCreateAsk } : undefined}
              />

              {asks.length > 0 ? (
                <div className="space-y-3">
                  {asks.slice(0, 5).map((ask) => (
                    <AskItem key={ask.id} listing={ask} />
                  ))}
                  {asks.length > 5 && (
                    <Link
                      to={`/@${user.username}/listings?filter=asks`}
                      className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-cyan-400 py-2 transition-colors"
                    >
                      View all {asks.length} asks
                      <ArrowRightIcon className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ) : isOwnProfile ? (
                <EmptyState
                  icon={<RocketLaunchIcon className="w-6 h-6 text-slate-500" />}
                  message="Share what you're looking for"
                  action={{ label: 'Post Ask', onClick: handleCreateAsk }}
                />
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">No asks yet</p>
              )}
            </div>

            {/* Offers Column */}
            <div className="glass-panel p-6">
              <SectionHeader
                icon={<SparklesIcon className="w-5 h-5 text-cyan-400" />}
                title="Offers"
                count={offers.length}
                action={isOwnProfile ? { label: 'Post Offer', onClick: handleCreateOffer } : undefined}
              />

              {offers.length > 0 ? (
                <div className="space-y-3">
                  {offers.slice(0, 5).map((offer) => (
                    <OfferItem key={offer.id} listing={offer} />
                  ))}
                  {offers.length > 5 && (
                    <Link
                      to={`/@${user.username}/listings?filter=offers`}
                      className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-cyan-400 py-2 transition-colors"
                    >
                      View all {offers.length} offers
                      <ArrowRightIcon className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ) : isOwnProfile ? (
                <EmptyState
                  icon={<SparklesIcon className="w-6 h-6 text-slate-500" />}
                  message="Share what you can offer"
                  action={{ label: 'Post Offer', onClick: handleCreateOffer }}
                />
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">No offers yet</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          THINGS I'M WORKING ON
          ================================================================ */}
      {(hasProjects || isOwnProfile) && (
        <section>
          <SectionHeader
            icon={<WrenchScrewdriverIcon className="w-5 h-5 text-cyan-400" />}
            title="Things I'm Working On"
            count={projects.length}
            action={isOwnProfile ? { label: 'Add Project', onClick: handleCreateProject } : undefined}
          />

          {projects.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.slice(0, 4).map((project) => (
                  <ProjectCard key={project.id} listing={project} />
                ))}
              </div>
              {projects.length > 4 && (
                <div className="mt-6 text-center">
                  <Link
                    to={`/@${user.username}/listings?filter=projects`}
                    className="text-sm text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
                  >
                    View all {projects.length} projects
                    <ArrowRightIcon className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </>
          ) : isOwnProfile ? (
            <div className="glass-panel p-8">
              <EmptyState
                icon={<WrenchScrewdriverIcon className="w-6 h-6 text-slate-500" />}
                message="Showcase your apps, agents, and projects"
                action={{ label: 'Add Project', onClick: handleCreateProject }}
              />
            </div>
          ) : null}
        </section>
      )}

      {/* ================================================================
          THINGS I LOVE
          ================================================================ */}
      {(hasCuratedLinks || isOwnProfile) && (
        <section>
          <SectionHeader
            icon={<HeartIcon className="w-5 h-5 text-rose-400" />}
            title="Things I Love"
            count={curatedLinks.length}
            action={isOwnProfile ? { label: 'Add Link', onClick: handleCreateCuratedLink } : undefined}
          />

          {curatedLinks.length > 0 ? (
            <div className="glass-panel p-6">
              <div className="space-y-3">
                {curatedLinks.slice(0, 5).map((link) => (
                  <CuratedLinkItem key={link.id} listing={link} />
                ))}
              </div>
            </div>
          ) : isOwnProfile ? (
            <div className="glass-panel p-8">
              <EmptyState
                icon={<HeartIcon className="w-6 h-6 text-slate-500" />}
                message="Share resources and links you recommend"
                action={{ label: 'Add Link', onClick: handleCreateCuratedLink }}
              />
            </div>
          ) : null}
        </section>
      )}

      {/* ================================================================
          RECENT ACTIVITY (only shown on own profile)
          ================================================================ */}
      {isOwnProfile && hasActivities && (
        <section>
          <SectionHeader
            icon={<ClockIcon className="w-5 h-5 text-cyan-400" />}
            title="Recent Activity"
            count={activities.length}
          />

          <div className="glass-panel p-6">
            <div className="space-y-2">
              {activities.slice(0, 8).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state for visitors when no content */}
      {!hasAnyContent && !isOwnProfile && (
        <div className="glass-panel p-12 text-center">
          <p className="text-slate-500">This profile doesn't have any content yet.</p>
        </div>
      )}
    </div>
  );
}

export default CollectiveProfileSection;
