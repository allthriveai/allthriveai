// Overview Analytics Page - High-level platform metrics and trends
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { useOverviewMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimeseriesDataPoint } from '@/types/analytics';
import { useState } from 'react';
import { api } from '@/services/api';

export default function OverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading, error } = useOverviewMetrics(days);
  const [timeseries, setTimeseries] = useState<TimeseriesDataPoint[]>([]);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch timeseries for overview
  useEffect(() => {
    const fetchTimeseries = async () => {
      try {
        const response = await api.get(`/admin/analytics/timeseries/?metric=users&days=${days}`);
        setTimeseries(response.data.data);
      } catch (err) {
        console.error('Failed to fetch timeseries:', err);
      }
    };
    fetchTimeseries();
  }, [days]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <AnalyticsLayout
      title="Platform Analytics"
      subtitle="Real-time insights into platform performance, user behavior, and AI usage."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={overviewLoading}
    >
      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Platform Overview</h2>
        <p className="text-slate-400 mb-8">High-level metrics and trends across the platform.</p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#0EA5E9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
