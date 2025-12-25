// Revenue Analytics Page - Revenue and subscription metrics (placeholder)
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { useOverviewMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';

export default function RevenuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading } = useOverviewMetrics(days);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <AnalyticsLayout
      title="Revenue Analytics"
      subtitle="Subscription and revenue tracking metrics."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={loading}
    >
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Revenue Metrics</h3>
        <p className="text-slate-400">Coming soon - subscription and revenue tracking.</p>
      </div>
    </AnalyticsLayout>
  );
}
