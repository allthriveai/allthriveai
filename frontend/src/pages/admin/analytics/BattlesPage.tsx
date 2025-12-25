// Battles Analytics Page - Guest battles and conversion metrics
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsLayout } from '@/components/admin/analytics/AnalyticsLayout';
import { useOverviewMetrics, useGuestBattlesMetrics, useAnalyticsTimePeriod } from '@/hooks/useAnalytics';
import {
  UserGroupIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function BattlesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { days, setDays } = useAnalyticsTimePeriod();
  const { data: overview, loading: overviewLoading } = useOverviewMetrics(days);
  const { data: metrics, loading, error } = useGuestBattlesMetrics(days);

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
        title="Battles Analytics"
        subtitle="Guest battles, conversions, and performance metrics."
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
      title="Battles Analytics"
      subtitle="Guest battles, conversions, and performance metrics."
      overview={overview}
      days={days}
      onDaysChange={setDays}
      loading={isLoading}
    >
      {metrics && (
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.currentGuests}</p>
              <p className="text-sm text-slate-500 mt-1">{metrics.totalGuests} created this period</p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                  <ArrowTrendingUpIcon className="w-5 h-5" />
                </div>
                <h4 className="text-slate-400 text-sm font-medium">Conversion Rate</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.conversionRate}%</p>
              <p className="text-sm text-slate-500 mt-1">
                {metrics.guestsConverted} converted &bull; {metrics.allTimeConversionRate}% all-time
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <h4 className="text-slate-400 text-sm font-medium">Guest Battles</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.battlesWithGuests}</p>
              <p className="text-sm text-slate-500 mt-1">{metrics.guestBattlePercentage}% of all battles</p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5" />
                </div>
                <h4 className="text-slate-400 text-sm font-medium">Total Battles</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalBattles}</p>
              <p className="text-sm text-slate-500 mt-1">This period</p>
            </div>
          </div>

          {/* Conversion Funnel */}
          {metrics.conversionFunnel && (
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Guest Conversion Funnel</h3>
              <p className="text-sm text-slate-400 mb-6">All-time guest journey from invite to full user</p>

              <div className="space-y-4">
                {/* Step 1: Invited */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-32 text-right">
                    <p className="text-sm text-slate-400">Invited</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.conversionFunnel.invited}</p>
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
                      {metrics.conversionFunnel.rates.inviteToJoin}% played
                    </span>
                    <div className="h-px flex-1 bg-slate-600" />
                  </div>
                </div>

                {/* Step 2: Joined Battle */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-32 text-right">
                    <p className="text-sm text-slate-400">Played Battle</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.conversionFunnel.joinedBattle}</p>
                  </div>
                  <div className="flex-1 relative">
                    <div
                      className="h-10 bg-purple-500/20 rounded-lg transition-all duration-500"
                      style={{ width: `${Math.max((metrics.conversionFunnel.joinedBattle / metrics.conversionFunnel.invited) * 100, 5)}%` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-300">
                          {metrics.conversionFunnel.rates.inviteToJoin}%
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
                      {metrics.conversionFunnel.rates.joinToConvert}% converted
                    </span>
                    <div className="h-px flex-1 bg-slate-600" />
                  </div>
                </div>

                {/* Step 3: Converted */}
                <div className="flex items-center gap-4">
                  <div className="w-32 text-right">
                    <p className="text-sm text-slate-400">Converted</p>
                    <p className="text-2xl font-bold text-green-400">{metrics.conversionFunnel.converted}</p>
                  </div>
                  <div className="flex-1 relative">
                    <div
                      className="h-10 bg-green-500/20 rounded-lg transition-all duration-500"
                      style={{ width: `${Math.max((metrics.conversionFunnel.converted / metrics.conversionFunnel.invited) * 100, 5)}%` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-medium text-green-300">
                          {metrics.conversionFunnel.rates.overallConversion}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 pt-6 border-t border-slate-700/50 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-cyan-400">{metrics.conversionFunnel.rates.inviteToJoin}%</p>
                    <p className="text-xs text-slate-500">Invite &rarr; Battle</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">{metrics.conversionFunnel.rates.joinToConvert}%</p>
                    <p className="text-xs text-slate-500">Battle &rarr; Signup</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{metrics.conversionFunnel.rates.overallConversion}%</p>
                    <p className="text-xs text-slate-500">Overall Conversion</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guest Win/Loss Stats */}
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Guest Battle Performance</h3>
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Recent Guest Users</h3>
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
                        <p className="text-gray-900 dark:text-white font-medium">{guest.username}</p>
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
      )}
    </AnalyticsLayout>
  );
}
