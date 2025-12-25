// Engagement Analytics Page - User activity, retention, and feature adoption
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import {
  MetricCard,
  ActivityHeatmap,
  UserJourneyFunnel,
  RetentionCohortTable,
} from '@/components/admin/analytics';
import { useOverviewMetrics, useEngagementMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

export default function EngagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overviewData, loading: overviewLoading } = useOverviewMetrics(days);
  const { overview, heatmap, features, retention, loading, error } = useEngagementMetrics(days);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const isLoading = overviewLoading || loading;

  if (error) {
    return (
      <AnalyticsLayout
        title="Engagement Analytics"
        subtitle="User activity patterns, feature adoption, and retention insights."
        overview={overviewData}
        days={days}
        onDaysChange={setDays}
        loading={isLoading}
      >
        <div className="glass-card p-8 border border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      </AnalyticsLayout>
    );
  }

  return (
    <AnalyticsLayout
      title="Engagement Analytics"
      subtitle="User activity patterns, feature adoption, and retention insights."
      overview={overviewData}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      {overview && heatmap && features && retention && (
        <div className="space-y-8">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Total Actions"
              value={overview.totalActions.toLocaleString()}
              subtitle="In selected period"
            />
            <MetricCard
              title="Active Users"
              value={overview.uniqueActiveUsers.toLocaleString()}
              subtitle="Unique engaged users"
            />
            <MetricCard
              title="Peak Activity"
              value={`${heatmap.peakDay} ${heatmap.peakHour}:00`}
              subtitle="Most active time"
            />
            <MetricCard
              title="Day 7 Retention"
              value={`${overview.d7RetentionRate}%`}
              subtitle="Users returning after 7 days"
              trend={overview.d7RetentionRate > 30 ? 'up' : 'down'}
            />
          </div>

          {/* Activity Heatmap */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Activity Heatmap</h3>
            <p className="text-sm text-slate-400 mb-6">
              Hourly activity distribution across days of the week
            </p>
            <ActivityHeatmap data={heatmap.heatmap} />
          </div>

          {/* Daily Actions Trend */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Daily Activity Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmap.dailyActions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#22D3EE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Adoption */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Feature Adoption</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.features.slice(0, 9).map((feature) => (
                <div
                  key={feature.activityType}
                  className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                >
                  <h4 className="text-gray-900 dark:text-white font-medium mb-1">{feature.name}</h4>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-cyan-400">
                      {feature.uniqueUsers.toLocaleString()}
                    </p>
                    <span className="text-sm text-slate-500">users</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {feature.totalActions.toLocaleString()} total actions
                  </p>
                  <div
                    className={`text-sm mt-2 flex items-center gap-1 ${
                      feature.trend >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {feature.trend >= 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4" />
                    )}
                    {feature.trend >= 0 ? '+' : ''}
                    {feature.trend}% vs prev
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Journey Funnel */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">User Journey Funnel</h3>
            <p className="text-sm text-slate-400 mb-6">
              Conversion rates from signup through retention
            </p>
            <UserJourneyFunnel funnel={retention.funnel} rates={retention.funnelRates} />
          </div>

          {/* Retention Cohorts */}
          {retention.retentionCohorts.length > 0 && (
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Weekly Retention Cohorts</h3>
              <RetentionCohortTable cohorts={retention.retentionCohorts} />
            </div>
          )}
        </div>
      )}
    </AnalyticsLayout>
  );
}
