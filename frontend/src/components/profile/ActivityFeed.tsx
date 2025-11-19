import { useState, useEffect } from 'react';
import { getUserActivity } from '@/services/auth';
import type { UserActivity, UserStatistics } from '@/services/auth';
import {
  ClockIcon,
  ChartBarIcon,
  CalendarIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export function ActivityFeed() {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivity() {
      try {
        const data = await getUserActivity();
        setActivities(data.activities);
        setStatistics(data.statistics);
      } catch (err: any) {
        console.error('Failed to load activity:', err);
        setError(err?.message || 'Failed to load activity data');
      } finally {
        setIsLoading(false);
      }
    }

    loadActivity();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (actionType: string, success: boolean) => {
    if (!success) {
      return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
    return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-subtle rounded-xl p-6">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="glass-subtle rounded-xl p-6">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-300 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-subtle rounded-xl p-8 text-center">
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Last Login */}
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <ClockIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Last Login</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatDate(statistics?.lastLogin || null)}
          </p>
          {statistics?.lastLoginDetails?.ipAddress && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <GlobeAltIcon className="w-4 h-4" />
              {statistics.lastLoginDetails.ipAddress}
            </p>
          )}
        </div>

        {/* Total Logins */}
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg">
              <ChartBarIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Total Logins</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {statistics?.totalLogins || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Since {statistics?.accountCreated ? new Date(statistics.accountCreated).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : ''}
          </p>
        </div>

        {/* Account Age */}
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Member Since</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {statistics?.accountCreated ? new Date(statistics.accountCreated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {statistics?.projectCount || 0} project{statistics?.projectCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>

        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(activity.actionType, activity.success)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {activity.action}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(activity.timestamp)}
                    </span>
                  </div>
                  {activity.ipAddress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <GlobeAltIcon className="w-3 h-3" />
                      {activity.ipAddress}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Future Analytics Sections - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quiz Scores Placeholder */}
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 opacity-60">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Quiz Scores</h3>
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Coming soon</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Track your quiz performance and progress
            </p>
          </div>
        </div>

        {/* Analytics Placeholder */}
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800 opacity-60">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Analytics</h3>
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Coming soon</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              View detailed insights and trends
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
