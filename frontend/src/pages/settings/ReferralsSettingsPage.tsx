import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { GiftIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';

export default function ReferralsSettingsPage() {
  const [copied, setCopied] = useState(false);

  // Placeholder referral code - would come from user data
  const referralCode = 'ALLTHRIVE2024';
  const referralLink = `https://allthrive.ai/auth?beta=THRIVE&ref=${referralCode}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                My Referral Codes
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Invite friends and earn rewards when they join All Thrive
              </p>
            </div>

            {/* Referral Overview */}
            <div className="glass-strong rounded p-8 border border-white/20 mb-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-primary-500/10 rounded-lg">
                  <GiftIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Share All Thrive with Friends
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Give your friends access and get rewarded when they sign up using your referral code
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Invites Sent</div>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">0</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Successful Signups</div>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">0</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Rewards Earned</div>
                </div>
              </div>

              {/* Referral Code */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Your Referral Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      readOnly
                      className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 font-mono text-lg font-semibold"
                    />
                    <button
                      onClick={() => handleCopy(referralCode)}
                      className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-5 h-5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Your Referral Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
                    />
                    <button
                      onClick={() => handleCopy(referralLink)}
                      className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-5 h-5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="glass-strong rounded p-6 border border-white/20 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                How It Works
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      Share your code
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Send your referral code or link to friends and colleagues
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      They sign up
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Your friend creates an account using your referral code
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      You both get rewards
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Earn bonus credits, features, or other rewards (coming soon)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral History */}
            <div className="glass-strong rounded p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Referral History
              </h3>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GiftIcon className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  No referrals yet
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Start sharing your referral code to see your invites here
                </p>
              </div>
            </div>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
