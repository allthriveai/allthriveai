// Admin Analytics Dashboard - Platform-wide metrics and insights
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  ChartBarIcon,
  UsersIcon,
  CpuChipIcon,
  FolderIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface OverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  totalAiCost: number;
  totalProjects: number;
}

interface UserGrowthMetrics {
  totalUsers: number;
  newUsers: number;
  avgDau: number;
  avgMau: number;
  growthRate: number;
  stickiness: number;
}

interface ContentMetrics {
  totalProjects: number;
  totalViews: number;
  totalClicks: number;
  totalComments: number;
  engagementRate: number;
}

interface TimeseriesDataPoint {
  date: string;
  value: number;
}

interface AIBreakdown {
  [key: string]: {
    requests: number;
    cost: number;
  };
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai' | 'content' | 'revenue'>('overview');

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserGrowthMetrics | null>(null);
  const [contentMetrics, setContentMetrics] = useState<ContentMetrics | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<TimeseriesDataPoint[]>([]);
  const [aiBreakdown, setAIBreakdown] = useState<AIBreakdown>({});

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch overview metrics
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/analytics/overview/?days=${days}`);
        setOverview(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch overview metrics');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchOverview();
    }
  }, [user, days]);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchTabData = async () => {
      if (!user || user.role !== 'admin') return;

      try {
        if (activeTab === 'users') {
          const [growthRes, timeseriesRes] = await Promise.all([
            api.get(`/admin/analytics/user-growth/?days=${days}`),
            api.get(`/admin/analytics/timeseries/?metric=users&days=${days}`),
          ]);
          setUserGrowth(growthRes.data);
          setTimeseriesData(timeseriesRes.data.data);
        } else if (activeTab === 'ai') {
          const [breakdownRes, timeseriesRes] = await Promise.all([
            api.get(`/admin/analytics/ai-breakdown/?type=feature&days=${days}`),
            api.get(`/admin/analytics/timeseries/?metric=ai_cost&days=${days}`),
          ]);
          setAIBreakdown(breakdownRes.data.breakdown);
          setTimeseriesData(timeseriesRes.data.data);
        } else if (activeTab === 'content') {
          const [contentRes, timeseriesRes] = await Promise.all([
            api.get(`/admin/analytics/content/?days=${days}`),
            api.get(`/admin/analytics/timeseries/?metric=projects&days=${days}`),
          ]);
          setContentMetrics(contentRes.data);
          setTimeseriesData(timeseriesRes.data.data);
        }
      } catch (err: any) {
        console.error('Failed to fetch tab data:', err);
      }
    };

    fetchTabData();
  }, [user, activeTab, days]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-neon mx-auto"></div>
          <p className="text-slate-400 mt-4 text-center">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      </div>
    );
  }

  // Show loading state until overview data is loaded
  if (!overview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-bright">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-bright rounded-full animate-spin" />
          <span className="text-lg">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Platform <span className="text-gradient-cyan">Analytics</span>
            </h1>

            <p className="text-slate-400">
              Real-time insights into platform performance, user behavior, and AI usage.
            </p>
          </header>

        {/* Time Period Selector */}
        <div className="mb-8 flex justify-end">
          <div className="glass-subtle p-1 inline-flex rounded-xl">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  days === d
                    ? 'bg-cyan-500/20 text-cyan-bright shadow-neon border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <KPICard
            icon={UsersIcon}
            title="Total Users"
            value={(overview?.totalUsers ?? 0).toLocaleString()}
            subtitle={`${(overview?.activeUsers ?? 0).toLocaleString()} active`}
            color="cyan"
          />
          <KPICard
            icon={CpuChipIcon}
            title="AI Cost"
            value={`$${(overview?.totalAiCost ?? 0).toFixed(2)}`}
            subtitle={`Last ${days} days`}
            color="pink"
          />
          <KPICard
            icon={FolderIcon}
            title="Projects"
            value={(overview?.totalProjects ?? 0).toLocaleString()}
            subtitle="Total created"
            color="teal"
          />
          <KPICard
            icon={SparklesIcon}
            title="Active Now"
            value={(overview?.activeUsers ?? 0).toLocaleString()}
            subtitle="Online users"
            color="purple"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-12">
          <div className="glass-subtle p-1 inline-flex rounded-xl">
            {[
              { id: 'overview', label: 'Overview', icon: ChartBarIcon },
              { id: 'users', label: 'Users', icon: UsersIcon },
              { id: 'ai', label: 'AI Usage', icon: CpuChipIcon },
              { id: 'content', label: 'Content', icon: FolderIcon },
              { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-bright shadow-neon border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && overview && (
            <OverviewDashboard overview={overview} timeseriesData={timeseriesData} />
          )}

          {activeTab === 'users' && userGrowth && (
            <UsersDashboard userGrowth={userGrowth} timeseriesData={timeseriesData} />
          )}

          {activeTab === 'ai' && (
            <AIDashboard aiBreakdown={aiBreakdown} timeseriesData={timeseriesData} />
          )}

          {activeTab === 'content' && contentMetrics && (
            <ContentDashboard contentMetrics={contentMetrics} timeseriesData={timeseriesData} />
          )}

          {activeTab === 'revenue' && (
            <RevenueDashboard />
          )}
        </div>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}

// KPI Card Component
interface KPICardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
  color: 'cyan' | 'pink' | 'teal' | 'purple';
}

function KPICard({ icon: Icon, title, value, subtitle, color }: KPICardProps) {
  const colorClasses = {
    cyan: 'text-cyan-neon border-cyan-500/30 bg-cyan-500/10',
    pink: 'text-pink-accent border-pink-500/30 bg-pink-500/10',
    teal: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  };

  return (
    <div className="glass-card p-6 hover:shadow-neon transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

// Overview Dashboard
interface OverviewDashboardProps {
  overview: OverviewMetrics;
  timeseriesData: TimeseriesDataPoint[];
}

function OverviewDashboard({ overview, timeseriesData }: OverviewDashboardProps) {
  return (
    <div className="glass-card p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Platform Overview</h2>
      <p className="text-slate-400 mb-8">High-level metrics and trends across the platform.</p>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeseriesData}>
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
  );
}

// Users Dashboard
interface UsersDashboardProps {
  userGrowth: UserGrowthMetrics;
  timeseriesData: TimeseriesDataPoint[];
}

function UsersDashboard({ userGrowth, timeseriesData }: UsersDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Growth Rate"
          value={`${(userGrowth?.growthRate ?? 0).toFixed(1)}%`}
          trend={(userGrowth?.growthRate ?? 0) > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Stickiness"
          value={`${(userGrowth?.stickiness ?? 0).toFixed(1)}%`}
          subtitle="DAU / MAU ratio"
        />
        <MetricCard
          title="Monthly Active"
          value={(userGrowth?.avgMau ?? 0).toLocaleString()}
          subtitle="Average MAU"
        />
      </div>

      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">Daily Active Users Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseriesData}>
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
  );
}

// AI Dashboard
interface AIDashboardProps {
  aiBreakdown: AIBreakdown;
  timeseriesData: TimeseriesDataPoint[];
}

function AIDashboard({ aiBreakdown, timeseriesData }: AIDashboardProps) {
  const breakdownData = Object.entries(aiBreakdown).map(([name, data]) => ({
    name,
    requests: data.requests,
    cost: data.cost,
  }));

  const COLORS = ['#0EA5E9', '#22D3EE', '#FB37FF', '#A855F7', '#F59E0B'];

  return (
    <div className="space-y-8">
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">AI Cost Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseriesData}>
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
  );
}

// Content Dashboard
interface ContentDashboardProps {
  contentMetrics: ContentMetrics;
  timeseriesData: TimeseriesDataPoint[];
}

function ContentDashboard({ contentMetrics, timeseriesData }: ContentDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Views" value={(contentMetrics?.totalViews ?? 0).toLocaleString()} />
        <MetricCard title="Total Clicks" value={(contentMetrics?.totalClicks ?? 0).toLocaleString()} />
        <MetricCard title="Engagement Rate" value={`${(contentMetrics?.engagementRate ?? 0).toFixed(1)}%`} trend="up" />
      </div>

      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">Projects Created</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeseriesData}>
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
  );
}

// Revenue Dashboard (placeholder)
function RevenueDashboard() {
  return (
    <div className="glass-card p-8">
      <h3 className="text-xl font-bold text-white mb-4">Revenue Metrics</h3>
      <p className="text-slate-400">Coming soon - subscription and revenue tracking.</p>
    </div>
  );
}

// Metric Card
interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}

function MetricCard({ title, value, subtitle, trend }: MetricCardProps) {
  return (
    <div className="glass-card p-6">
      <h4 className="text-slate-400 text-sm font-medium mb-2">{title}</h4>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          trend === 'up' ? (
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />
          ) : (
            <ArrowTrendingDownIcon className="w-5 h-5 text-red-400" />
          )
        )}
      </div>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
