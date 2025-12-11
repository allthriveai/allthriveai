/**
 * CircleActivityFeed - Recent activity from circle members with Neon Glass aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faRocket,
  faStar,
  faComment,
  faTrophy,
  faUserPlus,
  faBolt,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import type { CircleActivityFeed as CircleActivityFeedType, CircleActivityItem, CircleActivityType } from '@/types/models';

interface CircleActivityFeedProps {
  activityFeed?: CircleActivityFeedType | null;
  isLoading?: boolean;
}

const ACTIVITY_CONFIG: Record<CircleActivityType, { icon: typeof faRocket; color: string; bgColor: string }> = {
  project: { icon: faRocket, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  streak: { icon: faFire, color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
  kudos: { icon: faStar, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' },
  comment: { icon: faComment, color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  quiz: { icon: faTrophy, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
  joined: { icon: faUserPlus, color: 'text-pink-400', bgColor: 'bg-pink-500/20 border-pink-500/30' },
  level_up: { icon: faBolt, color: 'text-cyan-bright', bgColor: 'bg-cyan-500/20 border-cyan-500/30' },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function CircleActivityFeed({ activityFeed, isLoading }: CircleActivityFeedProps) {
  // Get activities from the feed
  const allActivities: CircleActivityItem[] = activityFeed?.activities || [];

  if (isLoading) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faClock} className="text-cyan-bright" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Activity Feed</h3>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (allActivities.length === 0) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <FontAwesomeIcon icon={faClock} className="text-cyan-bright" />
          </div>
          <h3 className="text-lg font-bold text-white">Activity Feed</h3>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faClock} className="text-2xl text-slate-500" />
          </div>
          <p className="text-slate-400 mb-2">
            No activity yet this week.
          </p>
          <p className="text-slate-500 text-sm">
            Be the first to do something!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shadow-neon">
          <FontAwesomeIcon icon={faClock} className="text-cyan-bright" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Activity Feed</h3>
          <p className="text-xs text-slate-500">Recent circle activity</p>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {allActivities.slice(0, 15).map((activity) => {
          const config = ACTIVITY_CONFIG[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg ${config.bgColor} border flex items-center justify-center flex-shrink-0`}>
                <FontAwesomeIcon icon={config.icon} className={`text-sm ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-white group-hover:text-cyan-bright transition-colors">
                    {activity.username}
                  </span>{' '}
                  <span className="text-slate-400">{activity.message}</span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Circuit connector decoration */}
      <div className="circuit-connector mt-6 opacity-20" />
    </div>
  );
}
