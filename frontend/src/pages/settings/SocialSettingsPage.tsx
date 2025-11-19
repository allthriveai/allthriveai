import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/services/auth';
import {
  getAvailableProviders,
  connectProvider,
  disconnectProvider,
  openOAuthPopup,
  getProviderIcon,
  getProviderColor,
  type SocialProvider,
} from '@/services/socialApi';

export default function SocialSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubSyncStatus, setGithubSyncStatus] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [profileLinks, setProfileLinks] = useState({
    linkedinUrl: user?.linkedinUrl || '',
    twitterUrl: user?.twitterUrl || '',
    githubUrl: user?.githubUrl || '',
    youtubeUrl: user?.youtubeUrl || '',
    instagramUrl: user?.instagramUrl || '',
  });

  useEffect(() => {
    loadProviders();
    loadGithubSyncStatus();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileLinks({
        linkedinUrl: user.linkedinUrl || '',
        twitterUrl: user.twitterUrl || '',
        githubUrl: user.githubUrl || '',
        youtubeUrl: user.youtubeUrl || '',
        instagramUrl: user.instagramUrl || '',
      });
    }
  }, [user]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await getAvailableProviders();
      setProviders(data);
    } catch (error) {
      console.error('Failed to load providers:', error);
      // Silently fail - UI will show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerKey: string) => {
    try {
      setConnectingProvider(providerKey);
      const authUrl = await connectProvider(providerKey);

      // Open OAuth popup
      await openOAuthPopup(authUrl, providerKey);

      // Reload providers to update connection status
      await loadProviders();
    } catch (error) {
      console.error('Failed to connect provider:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to connect. Please try again.'
      );
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (providerKey: string, providerLabel: string) => {
    if (!confirm(`Are you sure you want to disconnect ${providerLabel}?`)) {
      return;
    }

    try {
      await disconnectProvider(providerKey);
      await loadProviders();
      if (providerKey === 'github') {
        setGithubSyncStatus(null);
      }
    } catch (error) {
      console.error('Failed to disconnect provider:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  const loadGithubSyncStatus = async () => {
    try {
      const response = await api.get('/github/sync/status/');
      if (response.data.success && response.data.data.connected) {
        setGithubSyncStatus(response.data.data);
      }
    } catch (error) {
      // Silently fail - user might not have GitHub connected
      console.log('GitHub not connected');
    }
  };

  const handleSaveProfileLinks = async () => {
    try {
      setSaving(true);
      await updateProfile(profileLinks);
      await refreshUser();
      alert('Social media links updated successfully!');
    } catch (error) {
      console.error('Failed to update profile links:', error);
      alert('Failed to update social media links. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGithubSync = async () => {
    if (!confirm('Sync all your GitHub repositories as projects? This may take a moment.')) {
      return;
    }

    try {
      setSyncingGithub(true);
      const response = await api.post('/github/sync/trigger/', {
        auto_publish: false,
        add_to_showcase: false,
        include_private: false,
        include_forks: false,
        min_stars: 0,
      });

      if (response.data.success) {
        const { created, updated, skipped } = response.data.data;
        alert(
          `GitHub sync complete!\n` +
          `Created: ${created} projects\n` +
          `Updated: ${updated} projects\n` +
          `Skipped: ${skipped} repositories`
        );
        await loadGithubSyncStatus();
      }
    } catch (error: any) {
      console.error('Failed to sync GitHub:', error);
      alert(error.response?.data?.error || 'Failed to sync repositories. Please try again.');
    } finally {
      setSyncingGithub(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Social Profiles
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage your public social media links and account connections
              </p>
            </div>

            {/* Public Profile Links */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Public Profile Links
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                These links will appear on your public Showcase profile
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={profileLinks.linkedinUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Twitter / X
                  </label>
                  <input
                    type="url"
                    value={profileLinks.twitterUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, twitterUrl: e.target.value })}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    GitHub
                  </label>
                  <input
                    type="url"
                    value={profileLinks.githubUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, githubUrl: e.target.value })}
                    placeholder="https://github.com/username"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    YouTube
                  </label>
                  <input
                    type="url"
                    value={profileLinks.youtubeUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/@username"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={profileLinks.instagramUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/username"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSaveProfileLinks}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Links'}
                </button>
              </div>
            </div>

            {/* Account Connections */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Account Connections
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Connect your accounts to enhance your AllThrive experience
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {providers.map((provider) => (
                  <div
                    key={provider.key}
                    className="glass-strong rounded-xl p-6 border border-white/20 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl">
                        {getProviderIcon(provider.key)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {provider.label}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {provider.isConnected ? (
                            <span className="text-green-600 dark:text-green-400">✓ Connected</span>
                          ) : provider.isAvailable ? (
                            'Not connected'
                          ) : (
                            'Not available'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {provider.isConnected ? (
                        <>
                          {provider.key === 'github' && (
                            <button
                              onClick={handleGithubSync}
                              disabled={syncingGithub}
                              className="px-4 py-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {syncingGithub ? 'Syncing...' : 'Sync Repos'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDisconnect(provider.key, provider.label)}
                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : provider.isAvailable ? (
                        <button
                          onClick={() => handleConnect(provider.key)}
                          disabled={connectingProvider === provider.key}
                          className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
                            connectingProvider === provider.key
                              ? 'bg-gray-400 cursor-not-allowed'
                              : getProviderColor(provider.key)
                          }`}
                        >
                          {connectingProvider === provider.key ? 'Connecting...' : 'Connect'}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-4 py-2 rounded-lg bg-gray-500/10 text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm font-medium"
                        >
                          Coming Soon
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {githubSyncStatus && githubSyncStatus.connected && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🐙</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                      GitHub Connected
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                      @{githubSyncStatus.github_username} • {githubSyncStatus.synced_projects} repositories synced
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Click "Sync Repos" above to import your latest GitHub repositories as projects.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Connecting these accounts allows AllThrive to integrate with your
                workflows and provide enhanced AI capabilities. Your credentials are encrypted and stored
                securely.
              </p>
            </div>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
