/**
 * CircleMembersGrid - Avatar grid of circle members with Neon Glass aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faUserPlus, faBolt } from '@fortawesome/free-solid-svg-icons';
import { CircleMemberCard } from './CircleMemberCard';
import type { CircleMembership } from '@/types/models';

interface CircleMembersGridProps {
  members: CircleMembership[];
  currentUserId?: string;
  onGiveKudos: (membership: CircleMembership) => void;
  isLoading?: boolean;
}

export function CircleMembersGrid({
  members,
  currentUserId,
  onGiveKudos,
  isLoading,
}: CircleMembersGridProps) {
  if (isLoading) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faUsers} className="text-cyan-bright" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Circle Members</h3>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10" />
              <div className="mt-3 h-3 bg-white/5 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faUsers} className="text-cyan-bright" />
          </div>
          <h3 className="text-lg font-bold text-white">Circle Members</h3>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faUserPlus} className="text-2xl text-slate-500" />
          </div>
          <p className="text-slate-400 mb-2">
            Circles are formed weekly on Mondays.
          </p>
          <p className="text-slate-500 text-sm">
            Check back soon to meet your circle!
          </p>
        </div>
      </div>
    );
  }

  // Sort members: current user first, then by points earned
  const sortedMembers = [...members].sort((a, b) => {
    if (a.user.id === currentUserId) return -1;
    if (b.user.id === currentUserId) return 1;
    return b.pointsEarnedInCircle - a.pointsEarnedInCircle;
  });

  const activeCount = members.filter((m) => m.wasActive).length;

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shadow-neon">
            <FontAwesomeIcon icon={faUsers} className="text-cyan-bright" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Circle Members</h3>
            <p className="text-xs text-slate-500">
              <span className="text-cyan-bright">{members.length}</span> members
              {activeCount > 0 && (
                <>
                  <span className="text-slate-600 mx-1">•</span>
                  <span className="text-emerald-400">{activeCount}</span> active
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick tip */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <FontAwesomeIcon icon={faBolt} className="text-cyan-bright/60 text-xs" />
          <span className="text-xs text-slate-400">Click to give kudos</span>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-4 sm:gap-6 justify-items-center">
        {sortedMembers.map((membership) => (
          <CircleMemberCard
            key={membership.id}
            membership={membership}
            onGiveKudos={onGiveKudos}
            isCurrentUser={membership.user.id === currentUserId}
          />
        ))}
      </div>

      {/* Circuit connector decoration */}
      <div className="circuit-connector mt-6 opacity-30" />
    </div>
  );
}
