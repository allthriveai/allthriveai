/**
 * ChatUserTeaserCard - User suggestion card for chat with follow functionality
 *
 * Features:
 * - Avatar with initials fallback
 * - Tagline display
 * - Follow button with loading state
 * - Top tools display
 * - Match reason explanation
 * - View Profile link
 * - Neon glass styling to match chat aesthetic
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faCheck, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { followService } from '@/services/followService';

export interface UserSuggestion {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  tagline: string | null;
  tier: string | null;
  level: number;
  matchReason: string;
  sharedInterests: string[];
  topTools: Array<{ id: number; name: string; slug: string }>;
  followersCount: number;
  isFollowing: boolean;
}

export interface ChatUserTeaserCardProps {
  user: UserSuggestion;
  onNavigate?: (path: string) => void;
  onFollowChange?: (userId: number, isFollowing: boolean) => void;
}

export function ChatUserTeaserCard({
  user,
  onNavigate,
  onFollowChange,
}: ChatUserTeaserCardProps) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollowUser(user.username);
        setIsFollowing(false);
        onFollowChange?.(user.userId, false);
      } else {
        await followService.followUser(user.username);
        setIsFollowing(true);
        onFollowChange?.(user.userId, true);
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(`/${user.username}`);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="group relative w-64 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800/50 border border-white/10 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/20">
      {/* Header with Avatar */}
      <div className="relative p-4 pb-0">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-violet-500/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-violet-500/50 transition-colors">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/20 to-cyan-600/20">
                  <span className="text-lg font-semibold text-white/80">
                    {getInitials(user.displayName)}
                  </span>
                </div>
              )}
            </div>

            {/* Level badge */}
            {user.level > 0 && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-violet-600 border border-background flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{user.level}</span>
              </div>
            )}
          </div>

          {/* Name and username */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
              {user.displayName}
            </h4>
            <p className="text-xs text-slate-400 truncate">@{user.username}</p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 pt-3">
        {/* Match reason */}
        <p className="text-xs text-cyan-400 mb-2">{user.matchReason}</p>

        {/* Tagline */}
        {user.tagline && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3">{user.tagline}</p>
        )}

        {/* Shared interests */}
        {user.sharedInterests.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {user.sharedInterests.map((interest) => (
              <span
                key={interest}
                className="px-1.5 py-0.5 text-[10px] bg-violet-500/20 text-violet-300 rounded"
              >
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Top tools */}
        {user.topTools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {user.topTools.map((tool) => (
              <span
                key={tool.id}
                className="px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-300 rounded"
              >
                {tool.name}
              </span>
            ))}
          </div>
        )}

        {/* Followers count */}
        <p className="text-[10px] text-slate-500 mb-3">
          {user.followersCount.toLocaleString()} follower{user.followersCount !== 1 ? 's' : ''}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2">
          {/* Follow button */}
          <button
            onClick={handleFollow}
            disabled={isLoading}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              isFollowing
                ? 'bg-white/10 text-slate-300 hover:bg-red-500/20 hover:text-red-400'
                : 'bg-violet-600 text-white hover:bg-violet-500'
            }`}
          >
            {isLoading ? (
              <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 animate-spin" />
            ) : isFollowing ? (
              <>
                <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                Following
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUserPlus} className="w-3 h-3" />
                Follow
              </>
            )}
          </button>

          {/* View Profile button */}
          <Link
            to={`/${user.username}`}
            onClick={handleViewProfile}
            className="py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white transition-all flex items-center gap-1.5"
          >
            Profile
            <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
