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
import { createPortal } from 'react-dom';
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
  faWorm,
  faGamepad,
  faShield,
  faXmark,
  faCalendarCheck,
  faBullseye,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import {
  getActivityInsights,
  type ActivityInsights,
  type ToolEngagement,
  type TopicInterest,
  type PointsCategory,
  type PersonalizedInsight,
  type ActivityTrend,
  type GameStatsData,
} from '@/services/auth';
import { logError } from '@/utils/errorHandler';
import { AchievementBadge } from '@/components/achievements/AchievementBadge';
import type { AchievementProgressData, AchievementProgressItem } from '@/types/achievements';
import { getCategoryDisplay } from '@/services/achievements';

interface ActivityInsightsTabProps {
  username: string;
  isOwnProfile: boolean;
  achievements?: AchievementProgressData;
  isAchievementsLoading?: boolean;
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
  'worm': faWorm,
  'gamepad': faGamepad,
  'shield': faShield,
};

// Color classes for insight cards
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
};

export function ActivityInsightsTab({ username, isOwnProfile, achievements, isAchievementsLoading }: ActivityInsightsTabProps) {
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
        // Log to Sentry in production, console in development
        logError('Failed to load activity insights', err, {
          username,
          isOwnProfile,
          component: 'ActivityInsightsTab',
        });

        const errorMessage = err?.response?.data?.error ||
                            err?.response?.data?.detail ||
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
        <TopicInterestsSection topics={insights.topicInterests.filter(t => {
          // Filter out non-topic tags (status tags, battle types, generic terms)
          const excludedTags = [
            'winner', 'loser', 'featured', 'trending', 'new',
            'prompt battle', 'text prompt', 'image prompt', 'vs ai', 'vs pip',
            'image', 'text', 'battle', 'prompt', 'ai',
            'showcase', 'playground', 'clipped', 'product', 'reddit', 'other'
          ];
          return !excludedTags.includes(t.topic.toLowerCase());
        })} />
      </div>

      {/* Achievements Progress Showcase */}
      <AchievementsSection achievements={achievements} isLoading={isAchievementsLoading} />

      {/* Activity Trends */}
      <ActivityTrendsSection trends={insights.activityTrends} />

      {/* Games Activity */}
      {insights.gameStats && insights.gameStats.games.length > 0 && (
        <GamesActivitySection gameStats={insights.gameStats} onGameClick={(game) => navigate(`/games/${game}`)} />
      )}

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
              {segments.map((segment) => {
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

// Games Activity Section
function GamesActivitySection({
  gameStats,
  onGameClick,
}: {
  gameStats: GameStatsData;
  onGameClick: (game: string) => void;
}) {
  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faGamepad} className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Games</h3>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {gameStats.totalPlays} total plays
        </div>
      </div>

      <div className="space-y-4">
        {gameStats.games.map((game) => {
          const icon = iconMap[game.icon] || faGamepad;
          const formattedDate = game.highScoreDate
            ? new Date(game.highScoreDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : null;

          return (
            <button
              key={game.game}
              onClick={() => onGameClick(game.game.replace('_', '-'))}
              className="w-full p-4 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-cyan-400 dark:hover:border-cyan-600 transition-colors text-left"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <div className="flex items-center gap-4">
                {/* Game Icon */}
                <div className="p-3 bg-gradient-to-br from-cyan-400 to-teal-400 rounded-xl">
                  <FontAwesomeIcon icon={icon} className="w-6 h-6 text-white" />
                </div>

                {/* Game Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {game.displayName}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {game.playCount} {game.playCount === 1 ? 'play' : 'plays'}
                    </span>
                  </div>

                  {/* High Score */}
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      {game.highScore} tokens
                    </span>
                    {formattedDate && (
                      <span className="text-xs text-gray-400">
                        on {formattedDate}
                      </span>
                    )}
                  </div>

                  {/* Recent Scores Mini Chart */}
                  {game.recentScores.length > 1 && (
                    <div className="flex items-end gap-1 mt-2 h-6">
                      {game.recentScores.slice(0, 5).reverse().map((score, idx) => {
                        const maxScore = Math.max(...game.recentScores.map(s => s.score), 1);
                        const height = Math.max(15, (score.score / maxScore) * 100);
                        return (
                          <div
                            key={idx}
                            className="flex-1 bg-gradient-to-t from-cyan-500 to-teal-400 rounded-t"
                            style={{ height: `${height}%` }}
                            title={`${score.score} tokens`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Category colors for achievements
const categoryColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  projects: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-500 to-teal-500',
  },
  battles: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
    gradient: 'from-rose-500 to-red-500',
  },
  community: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-800',
    gradient: 'from-pink-500 to-rose-500',
  },
  engagement: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-500 to-indigo-500',
  },
  streaks: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-500 to-orange-500',
  },
};

// Achievements Section with Progress Showcase
function AchievementsSection({
  achievements,
  isLoading,
}: {
  achievements?: AchievementProgressData;
  isLoading?: boolean;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgressItem | null>(null);

  if (isLoading) {
    return (
      <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Achievements</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-teal-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!achievements || Object.keys(achievements).length === 0) {
    return (
      <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Achievements</h3>
        </div>
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faTrophy} className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Start earning achievements by completing activities!
          </p>
        </div>
      </div>
    );
  }

  // Get all categories and their stats
  const categories = Object.keys(achievements);
  const allAchievements = Object.values(achievements).flat();
  const totalEarned = allAchievements.filter(a => a.isEarned).length;
  const totalAchievements = allAchievements.length;
  const completionPercentage = totalAchievements > 0 ? Math.round((totalEarned / totalAchievements) * 100) : 0;

  // Filter achievements by selected category or show all
  const displayedAchievements = selectedCategory
    ? achievements[selectedCategory] || []
    : allAchievements;

  // Sort: earned first, then by progress percentage descending
  const sortedAchievements = [...displayedAchievements].sort((a, b) => {
    if (a.isEarned && !b.isEarned) return -1;
    if (!a.isEarned && b.isEarned) return 1;
    return b.progressPercentage - a.progressPercentage;
  });

  return (
    <div className="glass-subtle p-6 border border-gray-200 dark:border-gray-800" style={{ borderRadius: 'var(--radius)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30" style={{ borderRadius: 'var(--radius)' }}>
            <FontAwesomeIcon icon={faTrophy} className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Achievements</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {totalEarned}/{totalAchievements}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {completionPercentage}% Complete
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            selectedCategory === null
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All ({totalAchievements})
        </button>
        {categories.map((category) => {
          const categoryAchievements = achievements[category] || [];
          const earned = categoryAchievements.filter(a => a.isEarned).length;
          const colors = categoryColors[category] || categoryColors.projects;
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                selectedCategory === category
                  ? `${colors.bg} ${colors.text}`
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {getCategoryDisplay(category)} ({earned}/{categoryAchievements.length})
            </button>
          );
        })}
      </div>

      {/* Achievement Badges Grid */}
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        {sortedAchievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={{
              id: achievement.id,
              key: achievement.key,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              category: achievement.category as 'projects' | 'battles' | 'community' | 'engagement' | 'streaks',
              rarity: achievement.rarity as 'common' | 'rare' | 'epic' | 'legendary',
              points: achievement.points,
              isSecret: achievement.isSecret,
            }}
            userAchievement={achievement.isEarned ? {
              id: achievement.id,
              earnedAt: achievement.earnedAt || new Date().toISOString(),
              progress: achievement.currentValue,
              total: achievement.criteriaValue,
            } : {
              id: achievement.id,
              earnedAt: '',
              progress: achievement.currentValue,
              total: achievement.criteriaValue,
            }}
            size="small"
            onClick={() => setSelectedAchievement(achievement)}
          />
        ))}
      </div>

      {/* Empty state for filtered category */}
      {sortedAchievements.length === 0 && selectedCategory && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No achievements in this category yet.
          </p>
        </div>
      )}

      {/* Achievement Detail Slideout Tray */}
      {selectedAchievement && (
        <AchievementDetailTray
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </div>
  );
}

// Achievement Detail Slideout Tray
function AchievementDetailTray({
  achievement,
  onClose,
}: {
  achievement: AchievementProgressItem;
  onClose: () => void;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const [visuallyOpen, setVisuallyOpen] = useState(false);
  const colors = categoryColors[achievement.category] || categoryColors.projects;
  const isEarned = achievement.isEarned;

  // Animation: mount -> animate in
  useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setVisuallyOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setVisuallyOpen(false);
  };

  const handleTransitionEnd = () => {
    if (!visuallyOpen) {
      setShouldRender(false);
      onClose();
    }
  };

  // Format the earned date
  const earnedDate = achievement.earnedAt
    ? new Date(achievement.earnedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Get criteria description as a full sentence
  const getCriteriaDescription = () => {
    const type = achievement.criteriaType?.toLowerCase() || '';
    const value = achievement.criteriaValue;

    // Map criteria types to full sentence descriptions
    const criteriaMap: Record<string, string> = {
      // Projects
      project_count: `Create ${value} project${value !== 1 ? 's' : ''} to unlock this achievement.`,
      projects_created: `Create ${value} project${value !== 1 ? 's' : ''} to unlock this achievement.`,
      first_project: `Create your very first project to unlock this achievement.`,

      // Battles
      battle_count: `Participate in ${value} prompt battle${value !== 1 ? 's' : ''} to unlock this achievement.`,
      battles_participated: `Participate in ${value} prompt battle${value !== 1 ? 's' : ''} to unlock this achievement.`,
      battle_win_count: `Win ${value} prompt battle${value !== 1 ? 's' : ''} to unlock this achievement.`,
      battles_won: `Win ${value} prompt battle${value !== 1 ? 's' : ''} to unlock this achievement.`,
      first_battle: `Enter your first prompt battle to unlock this achievement.`,
      first_battle_win: `Win your first prompt battle to unlock this achievement.`,

      // Quizzes & Learning
      quiz_count: `Complete ${value} quiz${value !== 1 ? 'zes' : ''} to unlock this achievement.`,
      quizzes_completed: `Complete ${value} quiz${value !== 1 ? 'zes' : ''} to unlock this achievement.`,
      first_quiz: `Complete your first quiz to unlock this achievement.`,
      side_quest_count: `Complete ${value} side quest${value !== 1 ? 's' : ''} to unlock this achievement.`,
      side_quests_completed: `Complete ${value} side quest${value !== 1 ? 's' : ''} to unlock this achievement.`,
      learning_paths_completed: `Complete ${value} learning path${value !== 1 ? 's' : ''} to unlock this achievement.`,

      // Streaks & Activity
      streak_days: `Maintain a ${value}-day activity streak to unlock this achievement.`,
      current_streak: `Maintain a ${value}-day activity streak to unlock this achievement.`,
      longest_streak: `Achieve a ${value}-day activity streak to unlock this achievement.`,
      login_count: `Log in on ${value} different day${value !== 1 ? 's' : ''} to unlock this achievement.`,
      logins: `Log in on ${value} different day${value !== 1 ? 's' : ''} to unlock this achievement.`,
      first_login: `Log in to AllThrive for the first time.`,

      // Points
      total_points: `Earn ${value.toLocaleString()} total points to unlock this achievement.`,
      points_earned: `Earn ${value.toLocaleString()} total points to unlock this achievement.`,

      // Community
      follower_count: `Gain ${value} follower${value !== 1 ? 's' : ''} to unlock this achievement.`,
      followers: `Gain ${value} follower${value !== 1 ? 's' : ''} to unlock this achievement.`,
      comment_count: `Leave ${value} comment${value !== 1 ? 's' : ''} on projects to unlock this achievement.`,
      comments_made: `Leave ${value} comment${value !== 1 ? 's' : ''} on projects to unlock this achievement.`,
      like_count: `Receive ${value} like${value !== 1 ? 's' : ''} on your work to unlock this achievement.`,
      likes_received: `Receive ${value} like${value !== 1 ? 's' : ''} on your work to unlock this achievement.`,

      // Games
      game_play_count: `Play games ${value} time${value !== 1 ? 's' : ''} to unlock this achievement.`,
      games_played: `Play games ${value} time${value !== 1 ? 's' : ''} to unlock this achievement.`,
      game_high_score: `Score ${value.toLocaleString()}+ points in a game to unlock this achievement.`,

      // Tools
      tools_used: `Use ${value} different AI tool${value !== 1 ? 's' : ''} in your projects to unlock this achievement.`,

      // First time / one-time achievements
      first_time: value === 1
        ? `Complete this activity once to unlock this achievement.`
        : `Complete this activity ${value} time${value !== 1 ? 's' : ''} to unlock this achievement.`,
      count: value === 1
        ? `Complete this activity once to unlock this achievement.`
        : `Complete this activity ${value} time${value !== 1 ? 's' : ''} to unlock this achievement.`,
    };

    // Return mapped description or a generic fallback
    if (criteriaMap[type]) {
      return criteriaMap[type];
    }

    // Try to create a sensible sentence from criteriaTypeDisplay
    if (achievement.criteriaTypeDisplay) {
      const displayText = achievement.criteriaTypeDisplay.toLowerCase();
      if (value === 1) {
        return `Complete your first ${displayText.replace('first ', '').replace(' count', '')} to unlock this achievement.`;
      }
      return `Reach ${value} ${displayText.replace(' count', '').replace('total ', '')} to unlock this achievement.`;
    }

    // Final fallback
    return `Complete the required activity to unlock this achievement.`;
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          visuallyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Slideout Tray */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 transform transition-transform duration-300 ease-out ${
          visuallyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="h-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
          {/* Header with gradient background */}
          <div
            className={`relative p-6 pb-12 bg-gradient-to-br ${colors.gradient} text-white flex-shrink-0`}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              aria-label="Close"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
            </button>

            {/* Category badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium mb-3">
              <FontAwesomeIcon icon={faTrophy} className="w-3 h-3" />
              {getCategoryDisplay(achievement.category)}
            </div>

            {/* Achievement name */}
            <h3 className="text-2xl font-bold">
              {isEarned || !achievement.isSecret ? achievement.name : '???'}
            </h3>

            {/* Rarity */}
            <div className="flex items-center gap-2 mt-2">
              <FontAwesomeIcon icon={faStar} className="w-4 h-4" />
              <span className="text-sm font-medium capitalize">{achievement.rarity}</span>
              <span className="text-white/70">•</span>
              <span className="text-sm text-white/90">+{achievement.points} points</span>
            </div>
          </div>

          {/* Content - scrollable area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Description & Requirements */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`p-2 ${colors.bg} rounded-lg`}>
                <FontAwesomeIcon icon={faBullseye} className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {isEarned ? 'How you earned this' : 'How to earn'}
                </h4>
                {achievement.isSecret && !isEarned ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Complete this hidden achievement to reveal its description.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {getCriteriaDescription()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                      "{achievement.description}"
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Progress (for unearned) or Earned date (for earned) */}
            {isEarned ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FontAwesomeIcon icon={faCalendarCheck} className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
                    Achievement Unlocked!
                  </h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Earned on {earnedDate}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {achievement.currentValue} / {achievement.criteriaValue}
                  </span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(achievement.progressPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {Math.round(achievement.progressPercentage)}% complete
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
