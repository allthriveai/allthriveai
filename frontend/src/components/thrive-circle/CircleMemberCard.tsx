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
      className={`relative group w-20 flex flex-col items-center ${
        isCurrentUser ? '' : 'cursor-pointer'
      }`}
      onClick={() => !isCurrentUser && onGiveKudos(membership)}
    >
      {/* Current user badge - above avatar */}
      {isCurrentUser && (
        <div className="mb-1 bg-cyan-500/20 border border-cyan-500/50 text-cyan-bright text-[10px] px-2 py-0.5 rounded-full">
          You
        </div>
      )}

      {/* Avatar Container */}
      <div className="relative w-14 h-14 flex-shrink-0">
        {/* Avatar */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-base font-bold overflow-hidden transition-all duration-200 ${
            isCurrentUser
              ? 'ring-2 ring-cyan-bright ring-offset-2 ring-offset-background'
              : wasActive
              ? 'border-2 border-cyan-500/50 group-hover:border-cyan-bright'
              : 'border border-white/20 group-hover:border-white/40'
          }`}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${wasActive ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
              <span className={wasActive ? 'text-cyan-bright' : 'text-slate-400'}>
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Active indicator */}
        {wasActive && !isCurrentUser && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-background border border-cyan-500/50 flex items-center justify-center">
            <FontAwesomeIcon icon={faFire} className="text-cyan-bright text-[10px]" />
          </div>
        )}

        {/* Hover overlay for kudos */}
        {!isCurrentUser && (
          <div className="absolute inset-0 rounded-full bg-cyan-500/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <FontAwesomeIcon icon={faStar} className="text-white text-lg" />
          </div>
        )}
      </div>

      {/* Name and points */}
      <div className="mt-2 text-center w-full">
        <div
          className={`text-xs font-medium truncate ${
            isCurrentUser ? 'text-cyan-bright' : 'text-slate-300 group-hover:text-white'
          }`}
          title={user.username}
        >
          {isCurrentUser ? 'You' : user.username}
        </div>
        {pointsEarnedInCircle > 0 && (
          <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
            <FontAwesomeIcon icon={faBolt} className="text-cyan-bright/60" />
            <span className="text-cyan-bright/80">+{pointsEarnedInCircle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
