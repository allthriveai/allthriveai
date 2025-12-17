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
  FireIcon,
  RocketLaunchIcon,
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

interface EngagementOverview {
  totalActions: number;
  uniqueActiveUsers: number;
  peakHour: number;
  d7RetentionRate: number;
}

interface EngagementHeatmap {
  heatmap: number[][];
  dailyActions: Array<{ date: string; count: number }>;
  peakHour: number;
  peakDay: string;
  totalActions: number;
}

interface EngagementFeature {
  name: string;
  activityType: string;
  uniqueUsers: number;
  totalActions: number;
  trend: number;
}

interface EngagementFeatures {
  features: EngagementFeature[];
  topFeature: string | null;
  totalUniqueUsers: number;
}

interface EngagementRetention {
  funnel: {
    signedUp: number;
    hadFirstAction: number;
    returnedDay7: number;
    returnedDay30: number;
  };
  funnelRates: {
    signupToAction: number;
    actionToDay7: number;
    day7ToDay30: number;
  };
  retentionCohorts: Array<{
    cohortWeek: string;
    size: number;
    [key: string]: number | string;
  }>;
}

interface OnboardingPath {
  count: number;
  percentage: number;
  label: string;
}

interface OnboardingRecent {
  username: string;
  path: string;
  pathLabel: string;
  completedAt: string;
}

interface OnboardingTimeseries {
  date: string;
  battle_pip: number;
  add_project: number;
  explore: number;
}

interface OnboardingStats {
  totalCompleted: number;
  paths: Record<string, OnboardingPath>;
  recent: OnboardingRecent[];
  timeseries: OnboardingTimeseries[];
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai' | 'content' | 'battles' | 'revenue' | 'engagement' | 'onboarding'>('overview');

  // Data states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserGrowthMetrics | null>(null);
  const [contentMetrics, setContentMetrics] = useState<ContentMetrics | null>(null);
  const [guestBattleMetrics, setGuestBattleMetrics] = useState<GuestBattleMetrics | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<TimeseriesDataPoint[]>([]);
  const [aiBreakdown, setAIBreakdown] = useState<AIBreakdown>({});

  // Engagement data states
  const [engagementOverview, setEngagementOverview] = useState<EngagementOverview | null>(null);
  const [engagementHeatmap, setEngagementHeatmap] = useState<EngagementHeatmap | null>(null);
  const [engagementFeatures, setEngagementFeatures] = useState<EngagementFeatures | null>(null);
  const [engagementRetention, setEngagementRetention] = useState<EngagementRetention | null>(null);

  // Onboarding data state
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);

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
      setTabError(null);
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
        } else if (activeTab === 'engagement') {
          const [overviewRes, heatmapRes, featuresRes, retentionRes] = await Promise.all([
            api.get(`/admin/analytics/engagement/overview/?days=${days}`),
            api.get(`/admin/analytics/engagement/heatmap/?days=${days}`),
            api.get(`/admin/analytics/engagement/features/?days=${days}`),
            api.get(`/admin/analytics/engagement/retention/?days=${days}`),
          ]);
          setEngagementOverview(overviewRes.data);
          setEngagementHeatmap(heatmapRes.data);
          setEngagementFeatures(featuresRes.data);
          setEngagementRetention(retentionRes.data);
        } else if (activeTab === 'onboarding') {
          const onboardingRes = await api.get(`/admin/analytics/onboarding/?days=${days}`);
          // Transform snake_case keys to camelCase for frontend
          const data = onboardingRes.data;
          setOnboardingStats({
            totalCompleted: data.total_completed,
            paths: data.paths,
            recent: data.recent.map((r: any) => ({
              username: r.username,
              path: r.path,
              pathLabel: r.path_label,
              completedAt: r.completed_at,
            })),
            timeseries: data.timeseries,
          });
        }
      } catch (err: any) {
        console.error('Failed to fetch tab data:', err);
        setTabError(err.response?.data?.error || `Failed to load ${activeTab} data`);
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
        <div className="mb-12">
          <div className="glass-subtle p-1.5 rounded-xl overflow-x-auto">
            <div className="flex flex-wrap justify-center gap-1 min-w-fit">
              {[
                { id: 'overview', label: 'Overview', icon: ChartBarIcon },
                { id: 'users', label: 'Users', icon: UsersIcon },
                { id: 'battles', label: 'Battles', icon: BoltIcon },
                { id: 'ai', label: 'AI Usage', icon: CpuChipIcon },
                { id: 'content', label: 'Content', icon: FolderIcon },
                { id: 'engagement', label: 'Engagement', icon: FireIcon },
                { id: 'onboarding', label: 'Onboarding', icon: RocketLaunchIcon },
                { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-bright shadow-neon border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {tabLoading ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-bright rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Loading data...</p>
            </div>
          ) : tabError ? (
            <div className="glass-card p-8 border border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-center">{tabError}</p>
              <button
                onClick={() => setTabError(null)}
                className="mt-4 mx-auto block text-sm text-slate-400 hover:text-white transition-colors"
              >
                Dismiss
              </button>
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

              {activeTab === 'engagement' && engagementOverview && engagementHeatmap && engagementFeatures && engagementRetention && (
                <EngagementDashboard
                  overview={engagementOverview}
                  heatmap={engagementHeatmap}
                  features={engagementFeatures}
                  retention={engagementRetention}
                />
              )}

              {activeTab === 'onboarding' && onboardingStats && (
                <OnboardingDashboard stats={onboardingStats} />
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

// Engagement Dashboard
interface EngagementDashboardProps {
  overview: EngagementOverview;
  heatmap: EngagementHeatmap;
  features: EngagementFeatures;
  retention: EngagementRetention;
}

function EngagementDashboard({ overview, heatmap, features, retention }: EngagementDashboardProps) {
  return (
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
        <h3 className="text-xl font-bold text-white mb-2">Activity Heatmap</h3>
        <p className="text-sm text-slate-400 mb-6">
          Hourly activity distribution across days of the week
        </p>
        <ActivityHeatmap data={heatmap.heatmap} />
      </div>

      {/* Daily Actions Trend */}
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">Daily Activity Trend</h3>
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
        <h3 className="text-xl font-bold text-white mb-6">Feature Adoption</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.features.slice(0, 9).map((feature) => (
            <div
              key={feature.activityType}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
            >
              <h4 className="text-white font-medium mb-1">{feature.name}</h4>
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
        <h3 className="text-xl font-bold text-white mb-2">User Journey Funnel</h3>
        <p className="text-sm text-slate-400 mb-6">
          Conversion rates from signup through retention
        </p>
        <UserJourneyFunnel funnel={retention.funnel} rates={retention.funnelRates} />
      </div>

      {/* Retention Cohorts */}
      {retention.retentionCohorts.length > 0 && (
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-6">Weekly Retention Cohorts</h3>
          <RetentionCohortTable cohorts={retention.retentionCohorts} />
        </div>
      )}
    </div>
  );
}

// Activity Heatmap Component
function ActivityHeatmap({ data }: { data: number[][] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxValue = Math.max(...data.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-12">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="w-4 text-xs text-slate-500 text-center">
              {i % 4 === 0 ? i : ''}
            </div>
          ))}
        </div>

        {/* Heatmap rows */}
        {data.map((row, dayIndex) => (
          <div key={dayIndex} className="flex items-center gap-1 mb-1">
            <div className="w-10 text-xs text-slate-400 text-right pr-2">
              {days[dayIndex]}
            </div>
            {row.map((value, hourIndex) => {
              const intensity = value / maxValue;
              return (
                <div
                  key={hourIndex}
                  className="w-4 h-4 rounded-sm cursor-pointer hover:ring-1 hover:ring-cyan-400"
                  style={{
                    backgroundColor: `rgba(34, 211, 238, ${Math.max(0.1, intensity)})`,
                  }}
                  title={`${days[dayIndex]} ${hourIndex}:00 - ${value} actions`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// User Journey Funnel Component
function UserJourneyFunnel({
  funnel,
  rates,
}: {
  funnel: EngagementRetention['funnel'];
  rates: EngagementRetention['funnelRates'];
}) {
  const steps = [
    { label: 'Signed Up', value: funnel.signedUp, rate: 100, color: 'cyan' },
    { label: 'First Action', value: funnel.hadFirstAction, rate: rates.signupToAction, color: 'purple' },
    { label: 'Returned Day 7', value: funnel.returnedDay7, rate: rates.actionToDay7, color: 'teal' },
    { label: 'Returned Day 30', value: funnel.returnedDay30, rate: rates.day7ToDay30, color: 'green' },
  ];

  const maxValue = funnel.signedUp || 1;

  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const widthPercent = (step.value / maxValue) * 100;
        return (
          <div key={step.label}>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-36 text-right">
                <p className="text-sm text-slate-400">{step.label}</p>
                <p className="text-xl font-bold text-white">{step.value.toLocaleString()}</p>
              </div>
              <div className="flex-1 relative h-8">
                <div
                  className={`h-full rounded-lg transition-all duration-500 ${
                    step.color === 'cyan' ? 'bg-cyan-500/20' :
                    step.color === 'purple' ? 'bg-purple-500/20' :
                    step.color === 'teal' ? 'bg-teal-500/20' :
                    'bg-green-500/20'
                  }`}
                  style={{ width: `${Math.max(widthPercent, 3)}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-medium ${
                      step.color === 'cyan' ? 'text-cyan-300' :
                      step.color === 'purple' ? 'text-purple-300' :
                      step.color === 'teal' ? 'text-teal-300' :
                      'text-green-300'
                    }`}>
                      {widthPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center gap-4 pl-36">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-slate-600" />
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {i === 0 ? rates.signupToAction : i === 1 ? rates.actionToDay7 : rates.day7ToDay30}% conversion
                  </span>
                  <div className="h-px flex-1 bg-slate-600" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Retention Cohort Table Component
function RetentionCohortTable({ cohorts }: { cohorts: EngagementRetention['retentionCohorts'] }) {
  const weeks = ['week0', 'week1', 'week4'].filter((w) =>
    cohorts.some((c) => w in c)
  );

  const weekLabels: { [key: string]: string } = {
    week0: 'W0',
    week1: 'W1 (D7)',
    week4: 'W4 (D30)',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 py-3 px-4">Cohort Week</th>
            <th className="text-center text-slate-400 py-3 px-4">Size</th>
            {weeks.map((w) => (
              <th key={w} className="text-center text-slate-400 py-3 px-4">
                {weekLabels[w] || w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortWeek} className="border-b border-slate-800/50">
              <td className="text-white py-3 px-4 font-medium">{cohort.cohortWeek}</td>
              <td className="text-center text-slate-300 py-3 px-4">{cohort.size}</td>
              {weeks.map((w) => {
                const value = cohort[w] as number | undefined;
                if (value === undefined) {
                  return <td key={w} className="text-center py-3 px-4 text-slate-600">-</td>;
                }
                const intensity = value / 100;
                return (
                  <td
                    key={w}
                    className="text-center py-3 px-4 font-medium"
                    style={{
                      backgroundColor: `rgba(34, 211, 238, ${intensity * 0.4})`,
                      color: intensity > 0.5 ? '#0f172a' : '#e2e8f0',
                    }}
                  >
                    {value}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Onboarding Dashboard
interface OnboardingDashboardProps {
  stats: OnboardingStats;
}

function OnboardingDashboard({ stats }: OnboardingDashboardProps) {
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

  return (
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
            <p className="text-3xl font-bold text-white">{data.count}</p>
            <p className="text-sm text-slate-500 mt-1">{data.percentage}% of users</p>
          </div>
        ))}
      </div>

      {/* Onboarding Path Distribution Chart */}
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-white mb-6">Onboarding Path Selection Over Time</h3>
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
          <h3 className="text-xl font-bold text-white mb-6">Recent Onboarding Completions</h3>
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
                    <p className="text-white font-medium">{item.username}</p>
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
  );
}
