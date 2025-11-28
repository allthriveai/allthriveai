import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/services/auth';

export default function PrivacySettingsPage() {
  const { user, refreshUser } = useAuth();
  const [playgroundIsPublic, setPlaygroundIsPublic] = useState(user?.playgroundIsPublic ?? true);
  const [isProfilePublic, setIsProfilePublic] = useState(user?.isProfilePublic ?? true);
  const [allowLlmTraining, setAllowLlmTraining] = useState(user?.allowLlmTraining ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPlaygroundIsPublic(user.playgroundIsPublic ?? true);
      setIsProfilePublic(user.isProfilePublic ?? true);
      setAllowLlmTraining(user.allowLlmTraining ?? false);
    }
  }, [user]);

  const handleTogglePlayground = async (value: boolean) => {
    try {
      setSaving(true);
      setPlaygroundIsPublic(value);
      await updateProfile({ playgroundIsPublic: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update privacy setting:', error);
      // Revert on error
      setPlaygroundIsPublic(!value);
      alert('Failed to update privacy setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProfilePublic = async (value: boolean) => {
    try {
      setSaving(true);
      setIsProfilePublic(value);
      await updateProfile({ isProfilePublic: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update profile visibility:', error);
      // Revert on error
      setIsProfilePublic(!value);
      alert('Failed to update profile visibility. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLlmTraining = async (value: boolean) => {
    try {
      setSaving(true);
      setAllowLlmTraining(value);
      await updateProfile({ allowLlmTraining: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update LLM training setting:', error);
      // Revert on error
      setAllowLlmTraining(!value);
      alert('Failed to update LLM training setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Privacy & Security
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Control who can see your content and activities
              </p>
            </div>

            {/* Profile Visibility Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Profile Visibility
              </h2>

              <div className="space-y-4">
                {/* Profile Public Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                        Public Profile
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Allow your profile to appear in search engines and sitemaps. Disable for complete privacy.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isProfilePublic}
                        onChange={(e) => handleToggleProfilePublic(e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                {/* Playground Public Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                        Public Playground
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Allow others to view your Playground projects. Disable to make it private.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={playgroundIsPublic}
                        onChange={(e) => handleTogglePlayground(e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* AI & LLM Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                AI & Machine Learning
              </h2>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      Allow AI Model Training
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      Allow AI models like ChatGPT and Claude to use your public profile and projects for training.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      When disabled, AI crawlers (GPTBot, ClaudeBot, etc.) will be blocked from indexing your content. Traditional search engines (Google, Bing) are unaffected.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowLlmTraining}
                      onChange={(e) => handleToggleLlmTraining(e.target.checked)}
                      disabled={saving}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex gap-3">
                <div className="text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Privacy Settings Guide:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Public Profile:</strong> Controls visibility to search engines. Disable for complete privacy.</li>
                    <li><strong>Public Playground:</strong> Controls who can view your Playground projects.</li>
                    <li><strong>AI Model Training:</strong> Opt-out by default. Enable to help improve AI models like ChatGPT and Claude.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
