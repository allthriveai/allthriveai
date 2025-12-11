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
  BoltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

interface ConversionFunnel {
  invited: number;
  joinedBattle: number;
  converted: number;
  rates: {
    inviteToJoin: number;
    joinToConvert: number;
    overallConversion: number;
  };
}

interface GuestBattleMetrics {
  totalGuests: number;
  currentGuests: number;
  guestsConverted: number;
  conversionRate: number;
  allTimeConversionRate: number;
  battlesWithGuests: number;
  totalBattles: number;
  guestBattlePercentage: number;
  guestWins: number;
  guestLosses: number;
  guestTies: number;
  recentGuests: Array<{ id: number; username: string; dateJoined: string }>;
  conversionFunnel: ConversionFunnel;
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
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai' | 'content' | 'battles' | 'revenue'>('overview');

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserGrowthMetrics | null>(null);
  const [contentMetrics, setContentMetrics] = useState<ContentMetrics | null>(null);
  const [guestBattleMetrics, setGuestBattleMetrics] = useState<GuestBattleMetrics | null>(null);
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

      setTabLoading(true);
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
        } else if (activeTab === 'battles') {
          const battlesRes = await api.get(`/admin/analytics/guest-battles/?days=${days}`);
          setGuestBattleMetrics(battlesRes.data);
        }
      } catch (err: any) {
        console.error('Failed to fetch tab data:', err);
      } finally {
        setTabLoading(false);
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
              { id: 'battles', label: 'Battles', icon: BoltIcon },
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
          {tabLoading ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-bright rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Loading data...</p>
            </div>
          ) : (
            <>
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

              {activeTab === 'battles' && guestBattleMetrics && (
                <GuestBattlesDashboard metrics={guestBattleMetrics} />
              )}

              {activeTab === 'revenue' && (
                <RevenueDashboard />
              )}
            </>
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

function OverviewDashboard({ timeseriesData }: OverviewDashboardProps) {
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

// Guest Battles Dashboard
interface GuestBattlesDashboardProps {
  metrics: GuestBattleMetrics;
}

function GuestBattlesDashboard({ metrics }: GuestBattlesDashboardProps) {
  const funnel = metrics.conversionFunnel;

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-neon flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5" />
            </div>
            <h4 className="text-slate-400 text-sm font-medium">Current Guests</h4>
          </div>
          <p className="text-3xl font-bold text-white">{metrics.currentGuests}</p>
          <p className="text-sm text-slate-500 mt-1">{metrics.totalGuests} created this period</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-5 h-5" />
            </div>
            <h4 className="text-slate-400 text-sm font-medium">Conversion Rate</h4>
          </div>
          <p className="text-3xl font-bold text-white">{metrics.conversionRate}%</p>
          <p className="text-sm text-slate-500 mt-1">
            {metrics.guestsConverted} converted • {metrics.allTimeConversionRate}% all-time
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <BoltIcon className="w-5 h-5" />
            </div>
            <h4 className="text-slate-400 text-sm font-medium">Guest Battles</h4>
          </div>
          <p className="text-3xl font-bold text-white">{metrics.battlesWithGuests}</p>
          <p className="text-sm text-slate-500 mt-1">{metrics.guestBattlePercentage}% of all battles</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <h4 className="text-slate-400 text-sm font-medium">Total Battles</h4>
          </div>
          <p className="text-3xl font-bold text-white">{metrics.totalBattles}</p>
          <p className="text-sm text-slate-500 mt-1">This period</p>
        </div>
      </div>

      {/* Conversion Funnel */}
      {funnel && (
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-2">Guest Conversion Funnel</h3>
          <p className="text-sm text-slate-400 mb-6">All-time guest journey from invite to full user</p>

          <div className="space-y-4">
            {/* Funnel Steps */}
            <div className="relative">
              {/* Step 1: Invited */}
              <div className="flex items-center gap-4 mb-3">
                <div className="w-32 text-right">
                  <p className="text-sm text-slate-400">Invited</p>
                  <p className="text-2xl font-bold text-white">{funnel.invited}</p>
                </div>
                <div className="flex-1 relative">
                  <div className="h-10 bg-cyan-500/20 rounded-lg" style={{ width: '100%' }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-cyan-300">100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow with rate */}
              <div className="flex items-center gap-4 mb-3 pl-32">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-slate-600" />
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {funnel.rates.inviteToJoin}% played
                  </span>
                  <div className="h-px flex-1 bg-slate-600" />
                </div>
              </div>

              {/* Step 2: Joined Battle */}
              <div className="flex items-center gap-4 mb-3">
                <div className="w-32 text-right">
                  <p className="text-sm text-slate-400">Played Battle</p>
                  <p className="text-2xl font-bold text-white">{funnel.joinedBattle}</p>
                </div>
                <div className="flex-1 relative">
                  <div
                    className="h-10 bg-purple-500/20 rounded-lg transition-all duration-500"
                    style={{ width: `${Math.max((funnel.joinedBattle / funnel.invited) * 100, 5)}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-purple-300">
                        {funnel.rates.inviteToJoin}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow with rate */}
              <div className="flex items-center gap-4 mb-3 pl-32">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-slate-600" />
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {funnel.rates.joinToConvert}% converted
                  </span>
                  <div className="h-px flex-1 bg-slate-600" />
                </div>
              </div>

              {/* Step 3: Converted */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-right">
                  <p className="text-sm text-slate-400">Converted</p>
                  <p className="text-2xl font-bold text-green-400">{funnel.converted}</p>
                </div>
                <div className="flex-1 relative">
                  <div
                    className="h-10 bg-green-500/20 rounded-lg transition-all duration-500"
                    style={{ width: `${Math.max((funnel.converted / funnel.invited) * 100, 5)}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-green-300">
                        {funnel.rates.overallConversion}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t border-slate-700/50 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-cyan-400">{funnel.rates.inviteToJoin}%</p>
                <p className="text-xs text-slate-500">Invite → Battle</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{funnel.rates.joinToConvert}%</p>
                <p className="text-xs text-slate-500">Battle → Signup</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{funnel.rates.overallConversion}%</p>
                <p className="text-xs text-slate-500">Overall Conversion</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Win/Loss Stats */}
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">Guest Battle Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-3xl font-bold text-green-400">{metrics.guestWins}</p>
            <p className="text-sm text-slate-400 mt-1">Guest Wins</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-3xl font-bold text-red-400">{metrics.guestLosses}</p>
            <p className="text-sm text-slate-400 mt-1">Guest Losses</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-slate-500/10 border border-slate-500/20">
            <p className="text-3xl font-bold text-slate-400">{metrics.guestTies}</p>
            <p className="text-sm text-slate-400 mt-1">Ties</p>
          </div>
        </div>
        {metrics.guestWins + metrics.guestLosses + metrics.guestTies > 0 && (
          <p className="text-sm text-slate-500 mt-4 text-center">
            Guest win rate: {((metrics.guestWins / (metrics.guestWins + metrics.guestLosses + metrics.guestTies)) * 100).toFixed(1)}%
          </p>
        )}
      </div>

      {/* Recent Guests */}
      {metrics.recentGuests.length > 0 && (
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-6">Recent Guest Users</h3>
          <div className="space-y-3">
            {metrics.recentGuests.map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <UserGroupIcon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{guest.username}</p>
                    <p className="text-xs text-slate-500">ID: {guest.id}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  {new Date(guest.dateJoined).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
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
