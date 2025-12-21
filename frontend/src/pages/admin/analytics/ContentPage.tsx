// Content Analytics Page - Projects, views, and content engagement metrics
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { MetricCard } from '@/components/admin/analytics';
import { useOverviewMetrics, useContentMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ContentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading } = useOverviewMetrics(days);
  const { data: contentMetrics, timeseries, loading, error } = useContentMetrics(days);

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
        title="Content Analytics"
        subtitle="Project creation, views, and content engagement metrics."
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
      title="Content Analytics"
      subtitle="Project creation, views, and content engagement metrics."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      {contentMetrics && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard title="Total Views" value={(contentMetrics.totalViews ?? 0).toLocaleString()} />
            <MetricCard title="Total Clicks" value={(contentMetrics.totalClicks ?? 0).toLocaleString()} />
            <MetricCard title="Engagement Rate" value={`${(contentMetrics.engagementRate ?? 0).toFixed(1)}%`} trend="up" />
          </div>

          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-white mb-6">Projects Created</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#22D3EE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </AnalyticsLayout>
  );
}
