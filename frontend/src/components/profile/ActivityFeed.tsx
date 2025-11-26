import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserActivity } from '@/services/auth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import type { UserActivity, UserStatistics, QuizScore, PointsHistory } from '@/services/auth';
import {
  ClockIcon,
  ChartBarIcon,
  CalendarIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrophyIcon,
  AcademicCapIcon,
  SparklesIcon,
  PlusCircleIcon,
  FireIcon,
} from '@heroicons/react/24/outline';

export function ActivityFeed() {
  const navigate = useNavigate();
  const { tierStatus, allActivities: xpActivities, isLoadingActivities } = useThriveCircle();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [pointsFeed, setPointsFeed] = useState<PointsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivity() {
      try {
        const data = await getUserActivity();
        setActivities(data.activities);
        setStatistics(data.statistics);
        setPointsFeed(data.pointsFeed || []);
      } catch (err: any) {
        console.error('Failed to load activity:', err);
        setError(err?.message || 'Failed to load activity data');
      } finally {
        setIsLoading(false);
      }
    }

    loadActivity();
  }, []);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString.trim() === '') return '';
    const date = new Date(dateString);

    // Check for invalid date
    if (isNaN(date.getTime())) return '';

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

  const getActivityColor = (activityType: string): string => {
    const colors: Record<string, string> = {
      'quiz_complete': '#10b981', // green
      'project_create': '#3b82f6', // blue
      'project_update': '#6366f1', // indigo
      'comment': '#8b5cf6', // purple
      'reaction': '#ec4899', // pink
      'daily_login': '#f59e0b', // amber
      'streak_bonus': '#ef4444', // red
      'weekly_goal': '#14b8a6', // teal
      'side_quest': '#a855f7', // purple
      'special_event': '#f97316', // orange
      'referral': '#06b6d4', // cyan
    };
    return colors[activityType] || '#6b7280'; // default gray
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
                    {activity.timestamp && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(activity.timestamp)}
                      </span>
                    )}
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

      {/* Quiz Scores Section */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <AcademicCapIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quiz Scores</h3>
          </div>
          <button
            onClick={() => navigate('/quick-quizzes')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all quizzes →
          </button>
        </div>

        {statistics?.quizScores && statistics.quizScores.length > 0 ? (
          <div className="space-y-3">
            {statistics.quizScores.map((quiz: QuizScore) => (
              <div
                key={quiz.id}
                onClick={() => navigate(`/quick-quizzes/${quiz.quizSlug}`)}
                className="flex items-center justify-between p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {quiz.quizTitle}
                    </h4>
                    {quiz.percentageScore >= 80 && (
                      <TrophyIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="capitalize">{quiz.topic}</span>
                    <span>•</span>
                    <span className="capitalize">{quiz.difficulty}</span>
                    <span>•</span>
                    <span>
                      {quiz.completedAt
                        ? formatDate(quiz.completedAt)
                        : 'Recently'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      quiz.percentageScore >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : quiz.percentageScore >= 60
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {quiz.percentageScore}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {quiz.score}/{quiz.totalQuestions}
                    </div>
                  </div>
                  <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AcademicCapIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No quiz attempts yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Start taking quizzes to track your progress
            </p>
            <button
              onClick={() => navigate('/quick-quizzes')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Browse Quizzes
            </button>
          </div>
        )}
      </div>

      {/* Points Activity Feed */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-lg">
              <SparklesIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Points Activity</h3>
          </div>
          {tierStatus && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                {tierStatus.totalPoints}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Points</span>
            </div>
          )}
        </div>

        {!isLoadingActivities && xpActivities && xpActivities.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Donut Chart */}
            <div className="lg:col-span-1">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Points by Source</h4>
              {(() => {
                // Aggregate points by activity type
                const pointsByType: Record<string, { amount: number; display: string; color: string }> = {};

                xpActivities.forEach((activity) => {
                  if (!pointsByType[activity.activityType]) {
                    pointsByType[activity.activityType] = {
                      amount: 0,
                      display: activity.activityTypeDisplay,
                      color: getActivityColor(activity.activityType),
                    };
                  }
                  pointsByType[activity.activityType].amount += activity.amount;
                });

                const sortedTypes = Object.entries(pointsByType).sort((a, b) => b[1].amount - a[1].amount);
                const totalPoints = sortedTypes.reduce((sum, [_, data]) => sum + data.amount, 0);

                // Calculate angles for donut chart
                let currentAngle = -90;
                const segments = sortedTypes.map(([type, data]) => {
                  const percentage = (data.amount / totalPoints) * 100;
                  const angleSize = (percentage / 100) * 360;
                  const startAngle = currentAngle;
                  currentAngle += angleSize;
                  return { type, ...data, percentage, startAngle, angleSize };
                });

                return (
                  <>
                    {/* SVG Donut Chart */}
                    <div className="relative w-48 h-48 mx-auto mb-4">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {segments.map((segment, i) => {
                          const radius = 35;
                          const strokeWidth = 15;
                          const circumference = 2 * Math.PI * radius;
                          const offset = circumference - (segment.percentage / 100) * circumference;

                          return (
                            <circle
                              key={segment.type}
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${circumference} ${circumference}`}
                              strokeDashoffset={offset}
                              style={{
                                transformOrigin: '50% 50%',
                                transform: `rotate(${segments.slice(0, i).reduce((sum, s) => sum + (s.percentage / 100) * 360, 0)}deg)`,
                              }}
                              className="transition-all duration-300 hover:opacity-80"
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPoints}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2">
                      {segments.map((segment) => (
                        <div key={segment.type} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span className="text-gray-700 dark:text-gray-300 truncate">{segment.display}</span>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">{segment.amount}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Activity List */}
            <div className="lg:col-span-2 space-y-3">
              {xpActivities.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {activity.activityTypeDisplay}
                      </h4>
                      <span className="px-2 py-0.5 bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 text-teal-700 dark:text-teal-300 rounded text-xs font-medium">
                        {activity.tierAtTime}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {formatDate(activity.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      +{activity.amount}
                    </div>
                    <SparklesIcon className="w-6 h-6 text-teal-500 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isLoadingActivities ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-300 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No points earned yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Complete quizzes, create projects, and engage with the community to earn points and level up your tier!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
