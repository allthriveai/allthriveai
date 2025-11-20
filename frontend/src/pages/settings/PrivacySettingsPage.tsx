import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/services/auth';

export default function PrivacySettingsPage() {
  const { user, refreshUser } = useAuth();
  const [playgroundIsPublic, setPlaygroundIsPublic] = useState(user?.playgroundIsPublic ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPlaygroundIsPublic(user.playgroundIsPublic ?? true);
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
                    <strong>About Showcase & Playground:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Showcase</strong> is always public and displays your featured work, bio, and contact links</li>
                    <li><strong>Playground</strong> is public by default, but you can make it private if you prefer</li>
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
