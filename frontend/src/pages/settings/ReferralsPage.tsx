import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { ReferralCodeDisplay } from '@/components/referrals/ReferralCodeDisplay';
import { api } from '@/services/api';

interface ReferralCodeData {
  id: number;
  code: string;
  referralUrl: string;
  usesCount: number;
  maxUses: number | null;
  isValid: boolean;
  createdAt: string;
}

interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  rewardedReferrals: number;
  totalUses: number;
}

interface ReferralAPIResponse {
  id: number;
  referrer_username: string;
  referred_username: string | null;
  referral_code_value: string;
  created_at: string;
  status: string;
  status_display: string;
}

interface ReferralItem {
  id: number;
  referrerUsername: string;
  referredUsername: string | null;
  referralCodeValue: string;
  createdAt: string;
  status: string;
  statusDisplay: string;
}

export default function ReferralsPage() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCodeData | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch referral code and stats
  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setLoadingReferrals(true);
        setError('');
        const [codeResponse, statsResponse, referralsResponse] = await Promise.all([
          api.get('/me/referral-code/'),
          api.get('/me/referral-code/stats/'),
          api.get('/me/referrals/')
        ]);

        // Convert snake_case to camelCase
        const codeData = codeResponse.data;
        setReferralCode({
          id: codeData.id,
          code: codeData.code,
          referralUrl: codeData.referral_url,
          usesCount: codeData.uses_count,
          maxUses: codeData.max_uses,
          isValid: codeData.is_valid,
          createdAt: codeData.created_at,
        });

        const statsData = statsResponse.data;
        setReferralStats({
          totalReferrals: statsData.total_referrals,
          pendingReferrals: statsData.pending_referrals,
          completedReferrals: statsData.completed_referrals,
          rewardedReferrals: statsData.rewarded_referrals,
          totalUses: statsData.total_uses,
        });

        // Process referrals list - handle both array and paginated responses
        const data = referralsResponse.data;
        const items: ReferralAPIResponse[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];

        const referralsData = items.map((ref: ReferralAPIResponse) => ({
          id: ref.id,
          referrerUsername: ref.referrer_username,
          referredUsername: ref.referred_username,
          referralCodeValue: ref.referral_code_value,
          createdAt: ref.created_at,
          status: ref.status,
          statusDisplay: ref.status_display,
        }));
        setReferrals(referralsData);
      } catch (_error) {
        setError('Unable to load referral information. Please try again later.');
      } finally {
        setLoadingReferrals(false);
      }
    };

    if (user) {
      fetchReferralData();
    }
  }, [user]);

  const handleCodeUpdate = async (newCode: string) => {
    try {
      const response = await api.post('/me/referral-code/update_code/', {
        code: newCode,
      });

      const updatedCode = response.data;
      setReferralCode({
        id: updatedCode.id,
        code: updatedCode.code,
        referralUrl: updatedCode.referral_url,
        usesCount: updatedCode.uses_count,
        maxUses: updatedCode.max_uses,
        isValid: updatedCode.is_valid,
        createdAt: updatedCode.created_at,
      });
    } catch (error: any) {
      console.error('Failed to update code:', error);
      const errorMsg = error.response?.data?.error || 'Failed to update code';
      throw new Error(errorMsg);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rewarded':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-6xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Referrals
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Invite friends and earn rewards when they join All Thrive AI
              </p>
            </div>

            {loadingReferrals ? (
              <div className="glass-strong rounded p-8 border border-white/20">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              </div>
            ) : error ? (
              <div className="glass-strong rounded p-6 border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            ) : referralCode ? (
              <>
                {/* Info Box */}
                <div className="mb-6 glass-strong rounded p-4 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <span className="font-semibold">How it works:</span> Share your referral code or link with friends.
                    When they sign up using your code, you'll both be eligible for rewards.
                    We're currently designing our rewards program — stay tuned for updates!
                  </p>
                </div>

                {/* Referral Code Display */}
                <ReferralCodeDisplay
                  code={referralCode.code}
                  referralUrl={referralCode.referralUrl}
                  usesCount={referralCode.usesCount}
                  maxUses={referralCode.maxUses}
                  isValid={referralCode.isValid}
                  onCodeUpdate={handleCodeUpdate}
                />

                {/* Referral Stats */}
                {referralStats && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-strong rounded p-4 border border-white/20">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Referrals</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {referralStats.totalReferrals}
                      </p>
                    </div>
                    <div className="glass-strong rounded p-4 border border-white/20">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {referralStats.pendingReferrals}
                      </p>
                    </div>
                    <div className="glass-strong rounded p-4 border border-white/20">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Completed</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {referralStats.completedReferrals}
                      </p>
                    </div>
                    <div className="glass-strong rounded p-4 border border-white/20">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Rewarded</p>
                      <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {referralStats.rewardedReferrals}
                      </p>
                    </div>
                  </div>
                )}

                {/* Referrals List */}
                {referrals.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                      Your Referrals
                    </h2>
                    <div className="glass-strong rounded border border-white/20 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                User
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {referrals.map((referral) => (
                              <tr key={referral.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {referral.referredUsername || 'Pending Signup'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {new Date(referral.createdAt).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(referral.status)}`}>
                                    {referral.statusDisplay}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-strong rounded p-6 border border-white/20 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  Failed to load referral information. Please try refreshing the page.
                </p>
              </div>
            )}
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
