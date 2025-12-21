// Users Analytics Page - User growth and engagement metrics
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { MetricCard } from '@/components/admin/analytics';
import { useOverviewMetrics, useUserGrowthMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function UsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading } = useOverviewMetrics(days);
  const { data: userGrowth, timeseries, loading, error } = useUserGrowthMetrics(days);

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
        title="Users Analytics"
        subtitle="User growth, retention, and engagement insights."
        overview={overview}
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
      title="Users Analytics"
      subtitle="User growth, retention, and engagement insights."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      {userGrowth && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Growth Rate"
              value={`${(userGrowth.growthRate ?? 0).toFixed(1)}%`}
              trend={(userGrowth.growthRate ?? 0) > 0 ? 'up' : 'down'}
            />
            <MetricCard
              title="Stickiness"
              value={`${(userGrowth.stickiness ?? 0).toFixed(1)}%`}
              subtitle="DAU / MAU ratio"
            />
            <MetricCard
              title="Monthly Active"
              value={(userGrowth.avgMau ?? 0).toLocaleString()}
              subtitle="Average MAU"
            />
          </div>

          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-white mb-6">Daily Active Users Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#22D3EE" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </AnalyticsLayout>
  );
}
