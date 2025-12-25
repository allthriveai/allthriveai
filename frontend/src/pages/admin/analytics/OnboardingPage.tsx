// Onboarding Analytics Page - Onboarding path selection and completion metrics
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { MetricCard } from '@/components/admin/analytics';
import { useOverviewMetrics, useOnboardingMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading } = useOverviewMetrics(days);
  const { data: stats, loading, error } = useOnboardingMetrics(days);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const isLoading = overviewLoading || loading;

  const pathColors: Record<string, string> = {
    battle_pip: '#8B5CF6', // violet
    add_project: '#06B6D4', // cyan
    explore: '#F59E0B', // amber
  };

  const pathIcons: Record<string, string> = {
    battle_pip: '🎮',
    add_project: '🚀',
    explore: '🧭',
  };

  if (error) {
    return (
      <AnalyticsLayout
        title="Onboarding Analytics"
        subtitle="Onboarding path selection and user journey completion metrics."
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
      title="Onboarding Analytics"
      subtitle="Onboarding path selection and user journey completion metrics."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      {stats && (
        <div className="space-y-8">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Onboarding Completed"
              value={(stats.totalCompleted ?? 0).toLocaleString()}
              subtitle="Users who selected a path"
            />
            {Object.entries(stats.paths || {}).map(([pathId, data]) => (
              <div key={pathId} className="glass-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${pathColors[pathId]}20` }}
                  >
                    {pathIcons[pathId] || '📊'}
                  </div>
                  <h4 className="text-slate-400 text-sm font-medium">{data.label}</h4>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.count}</p>
                <p className="text-sm text-slate-500 mt-1">{data.percentage}% of users</p>
              </div>
            ))}
          </div>

          {/* Onboarding Path Distribution Chart */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Onboarding Path Selection Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.timeseries || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="battle_pip" name="Prompt Battle" fill="#8B5CF6" stackId="a" />
                  <Bar dataKey="add_project" name="Add Project" fill="#06B6D4" stackId="a" />
                  <Bar dataKey="explore" name="Explore" fill="#F59E0B" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Onboarding Completions */}
          {(stats.recent?.length ?? 0) > 0 && (
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Recent Onboarding Completions</h3>
              <div className="space-y-3">
                {stats.recent.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${pathColors[item.path]}20` }}
                      >
                        {pathIcons[item.path] || '📊'}
                      </div>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">{item.username}</p>
                        <p
                          className="text-xs font-medium"
                          style={{ color: pathColors[item.path] || '#94a3b8' }}
                        >
                          {item.pathLabel}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">
                      {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AnalyticsLayout>
  );
}
