import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma, faInstagram, faTiktok, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { VideoPickerModal } from '@/components/integrations/VideoPickerModal';

console.log('[IntegrationsSettingsPage] MODULE LOADED - File imported successfully');

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  isConnected: boolean;
  isAvailable: boolean;
  connectedAt?: string;
  username?: string;
  syncEnabled?: boolean;
}

export default function IntegrationsSettingsPage() {
  console.log('[IntegrationsSettingsPage] Component rendering...');

  const navigate = useNavigate();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'github',
      name: 'GitHub',
      description: 'Automatically sync your GitHub repositories as projects',
      icon: faGithub,
      isConnected: false,
      isAvailable: true,
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      description: 'Import your GitLab projects and showcase your work',
      icon: faGitlab,
      isConnected: false,
      isAvailable: false,
    },
    {
      id: 'figma',
      name: 'Figma',
      description: 'Embed your Figma designs and prototypes in your portfolio',
      icon: faFigma,
      isConnected: false,
      isAvailable: false,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Automatically sync your Instagram posts and videos to your project feed',
      icon: faInstagram,
      isConnected: false,
      isAvailable: false,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Import your TikTok videos as project showcases',
      icon: faTiktok,
      isConnected: false,
      isAvailable: false,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Automatically sync your YouTube videos as projects and enable auto-import of new uploads',
      icon: faYoutube,
      isConnected: false,
      isAvailable: true,
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [videoPickerState, setVideoPickerState] = useState({
    isOpen: false,
    selectedVideoIds: new Set<string>(),
  });
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null);
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null);
  const [youtubeNeedsReconnect, setYoutubeNeedsReconnect] = useState(false);

  // Fetch connection status on mount
  useEffect(() => {
    console.log('[IntegrationsSettingsPage] useEffect mounting...');
    let isMounted = true;

    async function fetchConnectionStatus() {
      console.log('[IntegrationsSettingsPage] fetchConnectionStatus started');
      try {
        // Check GitHub status
        console.log('[IntegrationsSettingsPage] Fetching GitHub status...');
        const githubResponse = await api.get('/social/status/github/');
        const githubData = githubResponse.data.data || githubResponse.data;
        console.log('[IntegrationsSettingsPage] GitHub data:', githubData);

        if (githubData.connected && isMounted) {
          console.log('[IntegrationsSettingsPage] GitHub is connected');
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'github'
                ? {
                    ...integration,
                    isConnected: true,
                    username: githubData.providerUsername || 'GitHub User',
                    connectedAt: githubData.connectedAt,
                  }
                : integration
            )
          );
        }

        // Check YouTube status (Google OAuth)
        console.log('[IntegrationsSettingsPage] Fetching YouTube status...');
        const youtubeResponse = await api.get('/social/status/google/');
        const youtubeData = youtubeResponse.data.data || youtubeResponse.data;
        console.log('[IntegrationsSettingsPage] YouTube data:', youtubeData);

        if (youtubeData.connected && isMounted) {
          console.log('[IntegrationsSettingsPage] YouTube is connected');
          // First set the integration as connected with email
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'youtube'
                ? {
                    ...integration,
                    isConnected: true,
                    username: youtubeData.providerEmail || 'Google Account',
                    connectedAt: youtubeData.connectedAt,
                  }
                : integration
            )
          );

          // Fetch sync status
          fetchSyncStatus();

          // Then try to fetch YouTube channel info to update the username
          try {
            console.log('[IntegrationsSettingsPage] Fetching YouTube channel info...');
            const channelResponse = await api.get('/integrations/youtube/my-channel/', {
              headers: { 'X-Skip-Auth-Redirect': 'true' }
            });
            console.log('[IntegrationsSettingsPage] YouTube channel response:', channelResponse.data);
            if (channelResponse.data?.success && channelResponse.data?.channel && isMounted) {
              const channelData = channelResponse.data.channel;
              console.log('[IntegrationsSettingsPage] YouTube channel data:', channelData);
              setYoutubeChannelId(channelData.id);
              setYoutubeChannelName(channelData.title);

              // Update with channel name
              setIntegrations(prev =>
                prev.map(integration =>
                  integration.id === 'youtube'
                    ? { ...integration, username: channelData.title }
                    : integration
                )
              );
            }
          } catch (error: any) {
            console.error('[IntegrationsSettingsPage] Could not fetch YouTube channel:', error);
            console.error('[IntegrationsSettingsPage] Error details:', {
              message: error.message,
              statusCode: error.statusCode
            });
            // If 401, YouTube needs reconnection for proper permissions
            if (error.statusCode === 401) {
              setYoutubeNeedsReconnect(true);
            }
            // Keep the email fallback already set above
          }
        }
      } catch (error: any) {
        console.error('[IntegrationsSettingsPage] Failed to fetch connection status:', error);
        console.error('[IntegrationsSettingsPage] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
      } finally {
        if (isMounted) {
          console.log('[IntegrationsSettingsPage] Setting loading to false');
          setLoading(false);
        }
      }
    }

    fetchConnectionStatus();

    return () => {
      console.log('[IntegrationsSettingsPage] useEffect cleanup - unmounting');
      isMounted = false;
    };
  }, []);

  const handleConnect = async (integrationId: string) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (integrationId === 'github') {
      try {
        const response = await api.get('/auth/urls/');
        const githubUrl = response.data.github;
        if (githubUrl) {
          window.location.href = githubUrl;
        } else {
          setErrorMessage('GitHub login URL not available');
        }
      } catch (error) {
        console.error('Failed to get GitHub OAuth URL:', error);
        setErrorMessage('Failed to connect to GitHub. Please try again.');
      }
    } else if (integrationId === 'youtube') {
      try {
        console.log('[IntegrationsSettingsPage] Initiating Google OAuth flow...');
        const response = await api.get('/social/connect/google/');
        console.log('[IntegrationsSettingsPage] OAuth response:', response.data);

        if (response.data.success && response.data.data?.authUrl) {
          const authUrl = response.data.data.authUrl;
          console.log('[IntegrationsSettingsPage] Redirecting to:', authUrl);
          window.location.href = authUrl;
        } else {
          console.error('[IntegrationsSettingsPage] No authUrl in response');
          setErrorMessage('Failed to get Google OAuth URL');
        }
      } catch (error: any) {
        console.error('[IntegrationsSettingsPage] Failed to initiate Google OAuth:', error);
        console.error('[IntegrationsSettingsPage] Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        setErrorMessage(`Failed to connect to YouTube: ${error.error || error.message || 'Unknown error'}`);
      }
    } else {
      setErrorMessage(`${integrationId} integration is coming soon!`);
    }
  };

  const handleDisconnect = async (integrationId: string, integrationName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${integrationName}?`)) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    if (integrationId === 'github') {
      try {
        await api.post('/social/disconnect/github/');

        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'github'
              ? {
                  ...integration,
                  isConnected: false,
                  username: undefined,
                  connectedAt: undefined,
                }
              : integration
          )
        );

        setSuccessMessage(`${integrationName} disconnected successfully`);
      } catch (error) {
        console.error('Failed to disconnect GitHub:', error);
        setErrorMessage('Failed to disconnect GitHub. Please try again.');
      }
    } else if (integrationId === 'youtube') {
      try {
        await api.post('/social/disconnect/google/');

        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'youtube'
              ? {
                  ...integration,
                  isConnected: false,
                  username: undefined,
                  connectedAt: undefined,
                  syncEnabled: undefined,
                }
              : integration
          )
        );

        setSuccessMessage(`${integrationName} disconnected successfully`);
      } catch (error) {
        console.error('Failed to disconnect YouTube:', error);
        setErrorMessage('Failed to disconnect YouTube. Please try again.');
      }
    } else {
      setSuccessMessage(`${integrationName} disconnected successfully`);
    }
  };

  const handleToggleSync = async (integrationId: string) => {
    if (integrationId !== 'youtube') {
      return;
    }

    const integration = integrations.find(i => i.id === 'youtube');
    if (!integration) return;

    const newSyncEnabled = !integration.syncEnabled;

    try {
      const response = await api.post('/integrations/youtube/toggle-sync/', {
        enabled: newSyncEnabled
      });

      if (response.data.success) {
        setIntegrations(prev =>
          prev.map(i =>
            i.id === integrationId
              ? { ...i, syncEnabled: newSyncEnabled }
              : i
          )
        );
        setSuccessMessage(response.data.message || `Auto-sync ${newSyncEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error: any) {
      console.error('Failed to toggle sync:', error);
      setErrorMessage(error.error || 'Failed to toggle auto-sync');
    }
  };

  const handleImportChannel = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.post('/integrations/youtube/import-channel/', {
        max_videos: 50
      });

      if (response.data.success) {
        setSuccessMessage(
          'Your channel is being imported! This may take a few minutes. ' +
          'Auto-sync is now enabled for new uploads.'
        );

        // Refresh sync status after a delay
        setTimeout(() => fetchSyncStatus(), 5000);
      }
    } catch (error: any) {
      console.error('Failed to import channel:', error);
      setErrorMessage(error.error || 'Failed to import channel');
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await api.get('/integrations/youtube/sync-status/');

      if (response.data.success) {
        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'youtube'
              ? {
                  ...integration,
                  syncEnabled: response.data.syncEnabled || false,
                }
              : integration
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  // Video picker modal handlers
  const handleOpenVideoPicker = () => {
    console.log('[IntegrationsSettingsPage] Opening video picker modal');
    setVideoPickerState(prev => ({ ...prev, isOpen: true }));
  };

  const handleCloseVideoPicker = () => {
    console.log('[IntegrationsSettingsPage] Closing video picker modal');
    setVideoPickerState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSelectionChange = (videoIds: Set<string>) => {
    console.log('[IntegrationsSettingsPage] Selection changed:', videoIds.size, 'videos selected');
    setVideoPickerState(prev => ({ ...prev, selectedVideoIds: videoIds }));
  };

  const handleImportVideos = async (videoIds: string[]) => {
    console.log('[IntegrationsSettingsPage] Starting import for', videoIds.length, 'videos');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Import each video
      const importPromises = videoIds.map(videoId => {
        console.log('[IntegrationsSettingsPage] Importing video:', videoId);
        return api.post('/integrations/youtube/import/', {
          video_url: `https://youtube.com/watch?v=${videoId}`,
          is_showcase: true,
          is_private: false,
        });
      });

      await Promise.all(importPromises);
      console.log('[IntegrationsSettingsPage] All videos imported successfully');

      setSuccessMessage(
        `Successfully imported ${videoIds.length} video${videoIds.length !== 1 ? 's' : ''}! ` +
        `Redirecting to your profile...`
      );

      // Clear selection
      setVideoPickerState({ isOpen: false, selectedVideoIds: new Set() });

      // Redirect to user's profile page after a short delay
      setTimeout(() => {
        if (user?.username) {
          navigate(`/${user.username}`);
        }
      }, 2000);
    } catch (error: any) {
      console.error('[IntegrationsSettingsPage] Failed to import videos:', error);
      console.error('[IntegrationsSettingsPage] Import error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setErrorMessage('Failed to import some videos. Please try again.');
      throw error; // Re-throw to keep modal open
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-3xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Integrations
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Connect platforms to automatically sync content to your project feed
              </p>
            </div>

            {/* Error/Success Messages */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 glass-strong rounded-xl p-4 border border-red-500/20 bg-red-500/5"
              >
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            )}
            {successMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mb-6 glass-strong rounded-xl p-4 border border-green-500/20 bg-green-500/5"
              >
                <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
              </div>
            )}

            {/* Info Banner */}
            <div className="mb-8 p-6 glass-strong rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex gap-3">
                <div className="text-2xl">ℹ️</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Automatic Project Updates
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    Connect your content platforms to automatically populate your project feed.
                    When you post on these platforms, your content can be synced to your AllThrive profile.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Your credentials are encrypted and stored securely. You can disconnect at any time.
                  </p>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              /* Integrations Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="glass-strong rounded-xl p-6 border border-white/20 flex flex-col"
                >
                  {/* Header with icon and badges */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={integration.icon} className="text-3xl text-slate-700 dark:text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {integration.name}
                        </h3>
                        {integration.isConnected && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                            Connected
                          </span>
                        )}
                        {!integration.isAvailable && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">
                    {integration.description}
                  </p>

                  {/* Connected state details */}
                  {integration.isConnected && integration.username && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-medium">Connected as:</span> @{integration.username}
                      </p>
                      {integration.connectedAt && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Connected {new Date(integration.connectedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* YouTube import info */}
                  {integration.id === 'youtube' && integration.isConnected && (
                    <div className="mb-4 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                        📥 YouTube Integration Active
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200 mb-3">
                        {youtubeChannelId
                          ? `Your YouTube channel is connected. Browse and import your videos below.`
                          : 'Please reconnect YouTube to grant video access permissions.'}
                      </p>
                      {youtubeChannelId ? (
                        <div className="space-y-2">
                          <button
                            onClick={handleOpenVideoPicker}
                            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm font-medium"
                          >
                            Browse & Import Videos
                          </button>
                          <button
                            onClick={handleImportChannel}
                            className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors text-sm font-medium"
                          >
                            📺 Import My Channel (Auto-Sync)
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            Importing your channel enables auto-sync for new uploads
                          </p>
                        </div>
                      ) : youtubeNeedsReconnect ? (
                        <button
                          onClick={() => handleConnect('youtube')}
                          className="w-full px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors text-sm font-medium"
                        >
                          🔄 Reconnect YouTube
                        </button>
                      ) : null}
                    </div>
                  )}

                  {/* Sync toggle for connected integrations */}
                  {integration.isConnected && integration.syncEnabled !== undefined && (
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5">
                      <button
                        onClick={() => handleToggleSync(integration.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          integration.syncEnabled
                            ? 'bg-primary-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        aria-label={`Toggle automatic sync for ${integration.name}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            integration.syncEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Automatic sync {integration.syncEnabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                  )}

                  {/* Action button */}
                  <div className="mt-auto">
                    {integration.isConnected ? (
                      <button
                        onClick={() => handleDisconnect(integration.id, integration.name)}
                        className="w-full px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                      >
                        Disconnect
                      </button>
                    ) : integration.isAvailable ? (
                      <button
                        onClick={() => handleConnect(integration.id)}
                        className="w-full px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors text-sm font-medium"
                      >
                        Connect
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full px-4 py-2 rounded-lg bg-slate-500/10 text-slate-500 dark:text-slate-400 cursor-not-allowed text-sm font-medium"
                      >
                        Coming Soon
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
            )}

            {/* Additional Info */}
            <div className="mt-8 p-6 glass-strong rounded-xl border border-white/20">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex gap-2">
                  <span className="text-primary-500">1.</span>
                  <span>Connect your account by authorizing AllThrive to access your public content</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500">2.</span>
                  <span>Choose whether to enable automatic syncing or manually import content</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500">3.</span>
                  <span>Your posts will appear in your project feed with proper attribution</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500">4.</span>
                  <span>Edit, organize, or remove synced content anytime from your dashboard</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Video Picker Modal */}
        <VideoPickerModal
          isOpen={videoPickerState.isOpen}
          onClose={handleCloseVideoPicker}
          onImport={handleImportVideos}
          selectedVideoIds={videoPickerState.selectedVideoIds}
          onSelectionChange={handleSelectionChange}
        />
      </SettingsLayout>
    </DashboardLayout>
  );
}
