/**
 * Activity Insights Tab
 *
 * A comprehensive activity dashboard showing:
 * - Personalized insights cards
 * - Side quests completed
 * - Topic interests
 * - Activity trends
 * - Points breakdown by category
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faFire,
  faBookOpen,
  faWrench,
  faChartLine,
  faTrophy,
  faLightbulb,
  faArrowTrendUp,
  faGraduationCap,
  faCompass,
} from '@fortawesome/free-solid-svg-icons';
import {
  getActivityInsights,
  type ActivityInsights,
  type ToolEngagement,
  type TopicInterest,
  type PointsCategory,
  type PersonalizedInsight,
  type ActivityTrend,
} from '@/services/auth';

interface ActivityInsightsTabProps {
  username: string;
  isOwnProfile: boolean;
}

// Map icon names from backend to FontAwesome icons
const iconMap: Record<string, any> = {
  'wrench': faWrench,
  'book-open': faBookOpen,
  'fire': faFire,
  'academic-cap': faGraduationCap,
  'chart-bar': faChartLine,
  'arrow-trending-up': faArrowTrendUp,
  'trophy': faTrophy,
  'lightbulb': faLightbulb,
};

// Color classes for insight cards
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
};

export function ActivityInsightsTab({ username, isOwnProfile }: ActivityInsightsTabProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<ActivityInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      if (!isOwnProfile) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getActivityInsights();
        setInsights(data);
      } catch (err: any) {
        console.error('Failed to load activity insights:', err);
        const errorMessage = err?.response?.data?.detail ||
                            err?.response?.data?.error ||
                            err?.message ||
                            'Failed to load activity insights';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInsights();
  }, [isOwnProfile]);

  if (!isOwnProfile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">
          Activity insights are private to each user.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Personalized Insights Cards */}
      {insights.insights.length > 0 && (
        <InsightsCardsSection insights={insights.insights} />
      )}

      {/* Stats Summary */}
      <StatsSummarySection stats={insights.statsSummary} />

      {/* Tool Engagement & Topic Interests - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ToolEngagementSection tools={insights.toolEngagement} onToolClick={(slug) => navigate(`/tools/${slug}`)} />
        <TopicInterestsSection topics={insights.topicInterests} />
      </div>

      {/* Activity Trends */}
      <ActivityTrendsSection trends={insights.activityTrends} />

      {/* Points by Category */}
      <PointsCategorySection categories={insights.pointsByCategory} />
    </div>
  );
}

// Personalized Insights Cards
function InsightsCardsSection({ insights }: { insights: PersonalizedInsight[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.map((insight, index) => {
        const colors = colorClasses[insight.color] || colorClasses.gray;
        const icon = iconMap[insight.icon] || faLightbulb;

        return (
          <div
            key={index}
            className={`p-4 border ${colors.border} ${colors.bg} transition-transform hover:scale-[1.02]`}
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 ${colors.bg}`} style={{ borderRadius: 'var(--radius)' }}>
                <FontAwesomeIcon icon={icon} className={`w-5 h-5 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {insight.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Stats Summary
function StatsSummarySection({ stats }: { stats: ActivityInsights['statsSummary'] }) {
  const statItems = [
    { label: 'Prompt Battles', value: stats.battlesCount ?? 0, icon: faTrophy, color: 'text-yellow-500' },
    { label: 'Projects', value: stats.projectsCount, icon: faChartLine, color: 'text-blue-500' },
    { label: 'Quizzes Completed', value: stats.quizzesCompleted, icon: faGraduationCap, color: 'text-purple-500' },
    { label: 'Side Quests Completed', value: stats.sideQuestsCompleted, icon: faCompass, color: 'text-teal-500' },
    { label: 'Current Streak', value: `${stats.currentStreak} days`, icon: faFire, color: 'text-orange-500' },
    { label: 'Best Streak', value: `${stats.longestStreak} days`, icon: faArrowTrendUp, color: 'text-green-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statItems.map((stat) => (
        <div
          key={stat.label}
          className="glass-subtle p-4 border border-gray-200 dark:border-gray-800 text-center"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <FontAwesomeIcon icon={stat.icon} className={`w-6 h-6 ${stat.color} mb-2`} />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stat.value}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tool Engagement Section
function ToolEngagementSection({ tools, onToolClick }: { tools: ToolEngagement[]; onToolClick: (slug: string) => void }) {
  if (tools.length === 0) {
    return (
      <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faWrench} className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tools You Use</h3>
        </div>
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faWrench} className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Add tools to your projects to see your usage here!
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...tools.map(t => t.usageCount));

  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-teal-100 dark:bg-teal-900/30" style={{ borderRadius: 'var(--radius)' }}>
          <FontAwesomeIcon icon={faWrench} className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tools You Use</h3>
      </div>

      <div className="space-y-3">
        {tools.map((tool) => {
          const percentage = (tool.usageCount / maxCount) * 100;
          return (
            <button
              key={tool.id}
              onClick={() => onToolClick(tool.slug)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              {tool.logoUrl ? (
                <img src={tool.logoUrl} alt={tool.name} className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <FontAwesomeIcon icon={faWrench} className="w-4 h-4 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {tool.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {tool.usageCount} project{tool.usageCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Topic Interests Section
function TopicInterestsSection({ topics }: { topics: TopicInterest[] }) {
  if (topics.length === 0) {
    return (
      <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faBookOpen} className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your Interests</h3>
        </div>
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faBookOpen} className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Complete quizzes and create projects to discover your interests!
          </p>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(...topics.map(t => t.engagementScore));

  // Color palette for topics
  const topicColors = [
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-indigo-500 to-blue-500',
    'from-lime-500 to-green-500',
    'from-fuchsia-500 to-pink-500',
  ];

  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30" style={{ borderRadius: 'var(--radius)' }}>
          <FontAwesomeIcon icon={faBookOpen} className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your Interests</h3>
      </div>

      <div className="space-y-3">
        {topics.map((topic, index) => {
          const percentage = (topic.engagementScore / maxScore) * 100;
          const colorClass = topicColors[index % topicColors.length];
          return (
            <div key={topic.topic} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {topic.topicDisplay}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {topic.quizCount > 0 && (
                      <span>{topic.quizCount} quiz{topic.quizCount !== 1 ? 'zes' : ''}</span>
                    )}
                    {topic.projectCount > 0 && (
                      <span>{topic.projectCount} project{topic.projectCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Activity Trends Section
function ActivityTrendsSection({ trends }: { trends: ActivityTrend[] }) {
  if (!trends.length) return null;

  const maxPoints = Math.max(...trends.map(t => t.points), 1);
  const totalPoints = trends.reduce((sum, t) => sum + t.points, 0);
  const totalActivities = trends.reduce((sum, t) => sum + t.activityCount, 0);
  const activeDays = trends.filter(t => t.activityCount > 0).length;

  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faChartLine} className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Last 30 Days</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <div className="font-bold text-gray-900 dark:text-white">{totalPoints}</div>
            <div className="text-xs text-gray-500">Points</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-gray-900 dark:text-white">{totalActivities}</div>
            <div className="text-xs text-gray-500">Activities</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-gray-900 dark:text-white">{activeDays}</div>
            <div className="text-xs text-gray-500">Active Days</div>
          </div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="flex items-end gap-1 h-24">
        {trends.map((day, index) => {
          const height = day.points > 0 ? Math.max(10, (day.points / maxPoints) * 100) : 4;
          const opacity = day.points > 0 ? 1 : 0.3;
          const date = new Date(day.date);
          const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
          const isToday = index === trends.length - 1;

          return (
            <div
              key={day.date}
              className="flex-1 group relative"
            >
              <div
                className={`w-full rounded-t transition-all ${
                  day.points > 0
                    ? 'bg-gradient-to-t from-green-500 to-emerald-400'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
                style={{ height: `${height}%`, opacity }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-medium">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div>{day.points} pts, {day.activityCount} activities</div>
              </div>
              {/* Day indicator for weekends and today */}
              {(isToday || index % 7 === 0) && (
                <div className="text-[10px] text-gray-400 text-center mt-1">
                  {isToday ? 'Today' : dayLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Points by Category Section (Donut Chart)
function PointsCategorySection({ categories }: { categories: PointsCategory[] }) {
  if (categories.length === 0) {
    return null;
  }

  const totalPoints = categories.reduce((sum, c) => sum + c.totalPoints, 0);

  // Calculate segments for donut chart
  let cumulativePercentage = 0;
  const segments = categories.map(category => {
    const percentage = (category.totalPoints / totalPoints) * 100;
    const segment = {
      ...category,
      percentage,
      offset: cumulativePercentage,
    };
    cumulativePercentage += percentage;
    return segment;
  });

  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30" style={{ borderRadius: 'var(--radius)' }}>
          <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Points Breakdown</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="lg:col-span-1 flex items-center justify-center">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {segments.map((segment, i) => {
                const radius = 35;
                const strokeWidth = 15;
                const circumference = 2 * Math.PI * radius;
                const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((segment.offset / 100) * circumference);

                return (
                  <circle
                    key={segment.activityType}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalPoints.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Points</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {segments.map((segment) => (
            <div
              key={segment.activityType}
              className="flex items-center gap-3 p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {segment.displayName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {segment.totalPoints.toLocaleString()} pts ({segment.percentage.toFixed(1)}%)
                </div>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {segment.count}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
