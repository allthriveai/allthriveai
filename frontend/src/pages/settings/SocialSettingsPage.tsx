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
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profileLinks, setProfileLinks] = useState({
    websiteUrl: user?.websiteUrl || '',
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
        websiteUrl: user.websiteUrl || '',
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
      setErrorMessage(
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
      setErrorMessage('Failed to disconnect. Please try again.');
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
    }
  };

  const handleSaveProfileLinks = async () => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');
      await updateProfile(profileLinks);
      await refreshUser();
      setSuccessMessage('Social media links updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update profile links:', error);
      setErrorMessage('Failed to update social media links. Please try again.');
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
        setSuccessMessage(
          `GitHub sync complete! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`
        );
        setTimeout(() => setSuccessMessage(''), 5000);
        await loadGithubSyncStatus();
      }
    } catch (error: any) {
      console.error('Failed to sync GitHub:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to sync repositories. Please try again.');
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

            {/* Error/Success Messages */}
            {errorMessage && (
              <div role="alert" aria-live="assertive" className="mb-6 glass-strong rounded-xl p-4 border border-red-500/20 bg-red-500/5">
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            )}
            {successMessage && (
              <div role="status" aria-live="polite" className="mb-6 glass-strong rounded-xl p-4 border border-green-500/20 bg-green-500/5">
                <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
              </div>
            )}

            {/* Public Profile Links */}
            <section className="mb-8" aria-labelledby="profile-links-heading">
              <h2 id="profile-links-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Public Profile Links
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                These links will appear on your public Showcase profile
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={profileLinks.websiteUrl}
                    onChange={(e) => setProfileLinks({ ...profileLinks, websiteUrl: e.target.value })}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
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
                  aria-busy={saving}
                  aria-label={saving ? 'Saving social media links' : 'Save social media links'}
                  className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Links'}
                </button>
              </div>
            </section>

            {/* Account Connections */}
            <section className="mb-4" aria-labelledby="connections-heading">
              <h2 id="connections-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Account Connections
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Connect your accounts to enhance your All Thrive experience
              </p>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <div className="space-y-4" role="list" aria-label="Social account connections">
                {providers.map((provider) => (
                  <div
                    key={provider.key}
                    role="listitem"
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
                              aria-busy={syncingGithub}
                              aria-label={syncingGithub ? 'Syncing GitHub repositories' : 'Sync GitHub repositories'}
                              className="px-4 py-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {syncingGithub ? 'Syncing...' : 'Sync Repos'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDisconnect(provider.key, provider.label)}
                            aria-label={`Disconnect ${provider.label}`}
                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : provider.isAvailable ? (
                        <button
                          onClick={() => handleConnect(provider.key)}
                          disabled={connectingProvider === provider.key}
                          aria-busy={connectingProvider === provider.key}
                          aria-label={connectingProvider === provider.key ? `Connecting to ${provider.label}` : `Connect ${provider.label}`}
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
            </section>

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
                <strong>Note:</strong> Connecting these accounts allows All Thrive to integrate with your
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
