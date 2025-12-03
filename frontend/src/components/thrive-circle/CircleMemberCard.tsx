/**
 * CircleMemberCard - Individual circle member with Neon Glass aesthetic
 * Features avatar, name, streak, and kudos interaction
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faStar,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { CircleMembership } from '@/types/models';

interface CircleMemberCardProps {
  membership: CircleMembership;
  onGiveKudos: (membership: CircleMembership) => void;
  isCurrentUser?: boolean;
}

export function CircleMemberCard({ membership, onGiveKudos, isCurrentUser }: CircleMemberCardProps) {
  const { user, pointsEarnedInCircle, wasActive } = membership;

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-300 ${
        isCurrentUser ? '' : 'hover:scale-105'
      }`}
      onClick={() => !isCurrentUser && onGiveKudos(membership)}
    >
      {/* Avatar Container */}
      <div className="relative">
        {/* Neon ring for active users */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold transition-all duration-300 ${
            isCurrentUser
              ? 'ring-2 ring-cyan-bright ring-offset-2 ring-offset-background shadow-neon'
              : wasActive
              ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/30 border border-cyan-500/50 group-hover:shadow-neon group-hover:border-cyan-bright'
              : 'bg-white/5 border border-white/10 group-hover:border-white/30'
          }`}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className={wasActive ? 'text-cyan-bright' : 'text-slate-400'}>
              {user.username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Active indicator - lightning bolt */}
        {wasActive && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shadow-neon">
            <FontAwesomeIcon icon={faFire} className="text-cyan-bright text-xs" />
          </div>
        )}

        {/* Hover overlay for kudos */}
        {!isCurrentUser && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/50 to-pink-accent/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
            <FontAwesomeIcon icon={faStar} className="text-white text-xl drop-shadow-lg" />
          </div>
        )}

        {/* Current user badge */}
        {isCurrentUser && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-bright text-xs px-2 py-0.5 rounded-full shadow-neon whitespace-nowrap">
            You
          </div>
        )}
      </div>

      {/* Name and points */}
      <div className="mt-3 text-center">
        <div
          className={`text-xs font-medium truncate max-w-[80px] ${
            isCurrentUser ? 'text-cyan-bright' : 'text-slate-300 group-hover:text-white'
          }`}
          title={user.username}
        >
          {isCurrentUser ? 'You' : user.username}
        </div>
        <div className="flex items-center justify-center gap-1 text-xs mt-0.5">
          <FontAwesomeIcon icon={faBolt} className="text-cyan-bright/60 text-[10px]" />
          <span className="text-cyan-bright/80">+{pointsEarnedInCircle}</span>
        </div>
      </div>
    </div>
  );
}
