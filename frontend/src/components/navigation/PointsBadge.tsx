/**
 * PointsBadge Component
 *
 * Displays the user's total points in the navigation bar.
 * Clicking links to the profile page points section.
 * Uses neon glass styling to match the nav aesthetic.
 */

import { Link } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';

export function PointsBadge() {
  const { user, isAuthenticated } = useAuth();

  // Don't show for unauthenticated users or if no points data
  if (!isAuthenticated || user?.totalPoints === undefined) {
    return null;
  }

  // Don't show for curation tier (AI agents)
  if (user?.tier === 'curation') {
    return null;
  }

  return (
    <Link
      to={`/@${user?.username}#points`}
      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-300 hover:scale-105 border border-cyan-500/30 hover:border-cyan-400/50"
      style={{
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(45, 212, 191, 0.15))',
      }}
      title="View your points"
    >
      <SparklesIcon className="w-4 h-4 text-cyan-400" />
      <span className="text-sm font-semibold text-white">
        {user.totalPoints.toLocaleString()}
      </span>
    </Link>
  );
}
