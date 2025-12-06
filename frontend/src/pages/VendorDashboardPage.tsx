import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
  ChartBarIcon,
  EyeIcon,
  BookmarkIcon,
  StarIcon,
  FolderIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface VendorTool {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  access: {
    can_view_basic: boolean;
    can_view_competitive: boolean;
    can_view_segments: boolean;
    can_view_queries: boolean;
    can_export: boolean;
  };
}

interface ToolAnalytics {
  tool?: {
    id: number;
    name: string;
    slug: string;
    logo_url: string;
    category: string;
    tagline: string;
    is_featured: boolean;
    is_verified: boolean;
  };
  period?: {
    days: number;
    start_date: string;
    end_date: string;
  };
  metrics?: {
    total_views: number;
    popularity_score: number;
    total_bookmarks: number;
    recent_bookmarks: number;
    total_reviews: number;
    recent_reviews: number;
    avg_rating: number | null;
    projects_using_tool: number;
    category_rank: number | null;
    category_total: number;
  };
  similar_tools?: Array<{
    id: number;
    name: string;
    slug: string;
    logo_url: string;
    view_count: number;
    popularity_score: number;
  }>;
  recent_reviews?: Array<{
    rating: number;
    title: string;
    content: string;
    user__username: string;
    created_at: string;
  }>;
}

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tools, setTools] = useState<VendorTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<VendorTool | null>(null);
  const [analytics, setAnalytics] = useState<ToolAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Redirect if not vendor or admin
  useEffect(() => {
    if (user && user.role !== 'vendor' && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch vendor tools
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await api.get('/vendor/tools/');
        setTools(response.data.tools);
        if (response.data.tools.length > 0) {
          setSelectedTool(response.data.tools[0]);
        }
      } catch (err) {
        setError('Failed to load vendor tools');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  // Fetch analytics when tool or days change
  useEffect(() => {
    if (!selectedTool) return;

    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const response = await api.get(`/vendor/tools/${selectedTool.id}/analytics/?days=${days}`);
        setAnalytics(response.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedTool, days]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary-500/30 dark:border-cyan-500/30 border-t-primary-500 dark:border-t-cyan-bright animate-spin" />
            <span className="text-slate-500 dark:text-slate-400 text-sm">Loading dashboard...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="glass-card p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="w-8 h-8 text-rose-500 dark:text-rose-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Unable to Load Dashboard</h2>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (tools.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="glass-card p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-cyan-500/20 flex items-center justify-center mx-auto mb-6">
              <ChartBarIcon className="w-10 h-10 text-primary-600 dark:text-cyan-bright" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Welcome to Vendor Analytics</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              You don't have access to any tools yet. Contact our team to get analytics access for your tools listed on AllThrive AI.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const metrics = analytics?.metrics;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 dark:bg-cyan-500/10 border border-primary-500/20 dark:border-cyan-500/20 text-primary-600 dark:text-cyan-neon text-xs font-medium mb-3 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-cyan-bright animate-pulse" />
                Vendor Analytics
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {selectedTool?.name || 'Dashboard'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Performance insights for your tools on AllThrive AI
              </p>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg py-2 px-4 pr-10 text-sm min-w-[140px] focus:ring-2 focus:ring-primary-500 dark:focus:ring-cyan-500 focus:border-transparent"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tool Selector */}
        {tools.length > 1 && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                    selectedTool?.id === tool.id
                      ? 'bg-primary-500/20 dark:bg-cyan-500/20 text-primary-600 dark:text-cyan-bright border-primary-500/40 dark:border-cyan-500/40 shadow-sm dark:shadow-neon'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  {tool.logo_url && (
                    <img src={tool.logo_url} alt={tool.name} className="w-5 h-5 rounded" />
                  )}
                  {tool.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-primary-500/30 dark:border-cyan-500/30 border-t-primary-500 dark:border-t-cyan-bright animate-spin" />
              <span className="text-slate-500 dark:text-slate-400 text-sm">Loading analytics...</span>
            </div>
          </div>
        ) : analytics ? (
          <div className="space-y-8">
            {/* Tool Status Card */}
            {analytics.tool && (
              <div className="glass-card">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {analytics.tool.logo_url ? (
                      <img src={analytics.tool.logo_url} alt={analytics.tool.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <SparklesIcon className="w-8 h-8 text-primary-600 dark:text-cyan-bright" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{analytics.tool.name}</h2>
                      {analytics.tool.is_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <CheckBadgeIcon className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                      {analytics.tool.is_featured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium">
                          <StarIconSolid className="w-3.5 h-3.5" />
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mb-3">{analytics.tool.tagline}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">Category: <span className="text-slate-700 dark:text-slate-300 capitalize">{analytics.tool.category}</span></span>
                      {metrics?.category_rank && (
                        <span className="text-slate-500">
                          Rank: <span className="text-primary-600 dark:text-cyan-bright font-medium">#{metrics.category_rank}</span>
                          <span className="text-slate-500"> of {metrics.category_total}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Views"
                value={metrics?.total_views}
                icon={<EyeIcon className="w-5 h-5" />}
                description="All-time page views"
                color="cyan"
              />
              <MetricCard
                title="Bookmarks"
                value={metrics?.total_bookmarks}
                icon={<BookmarkIcon className="w-5 h-5" />}
                description={metrics?.recent_bookmarks ? `+${metrics.recent_bookmarks} in period` : 'Users who saved this tool'}
                color="purple"
              />
              <MetricCard
                title="Reviews"
                value={metrics?.total_reviews}
                icon={<StarIcon className="w-5 h-5" />}
                description={metrics?.avg_rating ? `${metrics.avg_rating} avg rating` : 'User reviews'}
                color="amber"
              />
              <MetricCard
                title="Projects"
                value={metrics?.projects_using_tool}
                icon={<FolderIcon className="w-5 h-5" />}
                description="Projects using this tool"
                color="emerald"
              />
            </div>

            {/* Category Performance */}
            {metrics?.category_rank && (
              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Category Performance</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      How your tool ranks in the {analytics.tool?.category} category
                    </p>
                  </div>
                  <TrophyIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary-600 dark:text-cyan-bright mb-1">#{metrics.category_rank}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Category Rank</div>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 dark:from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, 100 - ((metrics.category_rank - 1) / metrics.category_total) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>#1</span>
                      <span>#{metrics.category_total}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">{metrics.popularity_score}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Popularity Score</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Reviews */}
            {analytics.recent_reviews && analytics.recent_reviews.length > 0 && (
              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Reviews</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      What users are saying about {analytics.tool?.name}
                    </p>
                  </div>
                  <StarIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                </div>
                <div className="space-y-4">
                  {analytics.recent_reviews.map((review, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <UserCircleIcon className="w-6 h-6 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{review.user__username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <StarIconSolid
                              key={i}
                              className={`w-4 h-4 ${i < review.rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.title && (
                        <div className="font-medium text-slate-900 dark:text-white mb-1">{review.title}</div>
                      )}
                      {review.content && (
                        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Tools (Competitors) */}
            {analytics.similar_tools && analytics.similar_tools.length > 0 && (
              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Similar Tools in Category</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Other tools in the {analytics.tool?.category} category
                    </p>
                  </div>
                  <ArrowTrendingUpIcon className="w-5 h-5 text-primary-600 dark:text-cyan-bright" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                        <th className="pb-3 font-medium">Tool</th>
                        <th className="pb-3 font-medium text-right">Views</th>
                        <th className="pb-3 font-medium text-right">Popularity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {analytics.similar_tools.map((tool) => (
                        <tr key={tool.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                                {tool.logo_url ? (
                                  <img src={tool.logo_url} alt={tool.name} className="w-6 h-6 object-contain" />
                                ) : (
                                  <SparklesIcon className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <span className="text-slate-700 dark:text-slate-200">{tool.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-slate-600 dark:text-slate-300">{tool.view_count.toLocaleString()}</td>
                          <td className="py-3 text-right text-slate-600 dark:text-slate-300">{tool.popularity_score.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty States */}
            {(!metrics?.total_views && !metrics?.total_bookmarks && !metrics?.total_reviews) && (
              <div className="glass-card text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Activity Yet</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  This tool hasn't received any views, bookmarks, or reviews yet.
                  Activity will appear here as users discover and engage with your tool.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

// === Helper Components ===

function MetricCard({
  title,
  value,
  icon,
  description,
  color = 'cyan',
}: {
  title: string;
  value: number | undefined | null;
  icon: React.ReactNode;
  description: string;
  color?: 'cyan' | 'purple' | 'amber' | 'emerald';
}) {
  const colorClasses = {
    cyan: 'bg-primary-100 dark:bg-cyan-500/20 text-primary-600 dark:text-cyan-bright border-primary-200 dark:border-cyan-500/30',
    purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  };

  const iconColorClasses = {
    cyan: 'text-primary-600 dark:text-cyan-bright',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="glass-card group hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]} border`}>
          <span className={iconColorClasses[color]}>{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
        {(value ?? 0).toLocaleString()}
      </div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{title}</div>
      <div className="text-xs text-slate-500">{description}</div>
    </div>
  );
}
