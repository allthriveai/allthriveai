// AI Usage Analytics Page - AI cost and usage metrics
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { useOverviewMetrics, useAIMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AIUsagePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading } = useOverviewMetrics(days);
  const { breakdown, timeseries, loading, error } = useAIMetrics(days);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const isLoading = overviewLoading || loading;

  const breakdownData = Object.entries(breakdown).map(([name, data]) => ({
    name,
    requests: data.requests,
    cost: data.cost,
  }));

  if (error) {
    return (
      <AnalyticsLayout
        title="AI Usage Analytics"
        subtitle="AI cost tracking, usage breakdown by feature, and trends."
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
      title="AI Usage Analytics"
      subtitle="AI cost tracking, usage breakdown by feature, and trends."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      <div className="space-y-8">
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-6">AI Cost Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="value" stroke="#FB37FF" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-6">Cost by Feature</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Bar dataKey="cost" fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
