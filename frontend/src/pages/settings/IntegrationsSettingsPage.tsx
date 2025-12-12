import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma, faInstagram, faTiktok, faYoutube, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faChevronDown, faChevronUp, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { VideoPickerModal } from '@/components/integrations/VideoPickerModal';
import { YouTubeImportProgressModal } from '@/components/integrations/YouTubeImportProgressModal';
import { getUserFriendlyError, type UserFriendlyError, type ErrorResponse } from '@/utils/errorMessages';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Connect your LinkedIn profile to showcase your professional identity',
      icon: faLinkedin,
      isConnected: false,
      isAvailable: true,
    },
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
      description: 'Automatically sync your GitLab repositories as projects',
      icon: faGitlab,
      isConnected: false,
      isAvailable: true,
    },
    {
      id: 'figma',
      name: 'Figma',
      description: 'Embed your Figma designs and prototypes in your portfolio',
      icon: faFigma,
      isConnected: false,
      isAvailable: true,
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
  const [errorMessage, setErrorMessage] = useState<UserFriendlyError | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [videoPickerState, setVideoPickerState] = useState({
    isOpen: false,
    selectedVideoIds: new Set<string>(),
  });
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null);
  const [youtubeNeedsReconnect, setYoutubeNeedsReconnect] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importSourceId, setImportSourceId] = useState<number | null>(null);
  const [importVideoCount, setImportVideoCount] = useState(0);
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  // Fetch connection status on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchConnectionStatus() {
      try {
        // Check LinkedIn status (use 'li' alias to avoid ad-blocker blocking)
        const linkedinResponse = await api.get('/social/status/li/');
        const linkedinData = linkedinResponse.data.data || linkedinResponse.data;

        if (linkedinData.connected && isMounted) {
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'linkedin'
                ? {
                    ...integration,
                    isConnected: true,
                    username: linkedinData.providerUsername || 'LinkedIn User',
                    connectedAt: linkedinData.connectedAt,
                  }
                : integration
            )
          );
        }

        // Check GitHub status
        const githubResponse = await api.get('/social/status/github/');
        const githubData = githubResponse.data.data || githubResponse.data;

        if (githubData.connected && isMounted) {
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

        // Check GitLab status
        const gitlabResponse = await api.get('/social/status/gitlab/');
        const gitlabData = gitlabResponse.data.data || gitlabResponse.data;

        if (gitlabData.connected && isMounted) {
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'gitlab'
                ? {
                    ...integration,
                    isConnected: true,
                    username: gitlabData.providerUsername || 'GitLab User',
                    connectedAt: gitlabData.connectedAt,
                  }
                : integration
            )
          );
        }

        // Check Figma status
        const figmaResponse = await api.get('/social/status/figma/');
        const figmaData = figmaResponse.data.data || figmaResponse.data;

        if (figmaData.connected && isMounted) {
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'figma'
                ? {
                    ...integration,
                    isConnected: true,
                    username: figmaData.providerUsername || 'Figma User',
                    connectedAt: figmaData.connectedAt,
                  }
                : integration
            )
          );
        }

        // Check YouTube status (Google OAuth)
        const youtubeResponse = await api.get('/social/status/google/');
        const youtubeData = youtubeResponse.data.data || youtubeResponse.data;

        if (youtubeData.connected && isMounted) {
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
            const channelResponse = await api.get('/integrations/youtube/my-channel/', {
              headers: { 'X-Skip-Auth-Redirect': 'true' }
            });
            if (channelResponse.data?.success && channelResponse.data?.channel && isMounted) {
              const channelData = channelResponse.data.channel;
              setYoutubeChannelId(channelData.id);

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
          setLoading(false);
        }
      }
    }

    fetchConnectionStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConnect = async (integrationId: string) => {
    setErrorMessage(null);
    setSuccessMessage('');

    if (integrationId === 'linkedin') {
      try {
        console.log('[IntegrationsSettingsPage] Starting LinkedIn OAuth request...');
        // Use 'li' alias to avoid ad-blocker blocking "linkedin" URLs
        const response = await api.get('/social/connect/li/');
        console.log('[IntegrationsSettingsPage] LinkedIn OAuth response:', response);

        if (response.data.success && response.data.data?.authUrl) {
          const authUrl = response.data.data.authUrl;
          window.location.href = authUrl;
        } else {
          console.error('[IntegrationsSettingsPage] No authUrl in response');
          setErrorMessage({
            title: 'Connection Error',
            message: 'Failed to get LinkedIn OAuth URL. Please try again later.',
            variant: 'error',
          });
        }
      } catch (error: any) {
        console.error('[IntegrationsSettingsPage] Failed to initiate LinkedIn OAuth:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'linkedin');
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'github') {
      try {
        const response = await api.get('/auth/urls/');
        const githubUrl = response.data.github;
        if (githubUrl) {
          window.location.href = githubUrl;
        } else {
          setErrorMessage({
            title: 'Connection Error',
            message: 'GitHub login URL not available. Please try again later.',
            variant: 'error',
          });
        }
      } catch (error) {
        console.error('Failed to get GitHub OAuth URL:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'github');
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'youtube') {
      try {
        const response = await api.get('/social/connect/google/');

        if (response.data.success && response.data.data?.authUrl) {
          const authUrl = response.data.data.authUrl;
          window.location.href = authUrl;
        } else {
          console.error('[IntegrationsSettingsPage] No authUrl in response');
          setErrorMessage({
            title: 'Connection Error',
            message: 'Failed to get Google OAuth URL. Please try again later.',
            variant: 'error',
          });
        }
      } catch (error: any) {
        console.error('[IntegrationsSettingsPage] Failed to initiate Google OAuth:', error);
        console.error('[IntegrationsSettingsPage] Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'gitlab') {
      try {
        const response = await api.get('/social/connect/gitlab/');

        if (response.data.success && response.data.data?.authUrl) {
          const authUrl = response.data.data.authUrl;
          window.location.href = authUrl;
        } else {
          console.error('[IntegrationsSettingsPage] No authUrl in response');
          setErrorMessage({
            title: 'Connection Error',
            message: 'Failed to get GitLab OAuth URL. Please try again later.',
            variant: 'error',
          });
        }
      } catch (error: any) {
        console.error('[IntegrationsSettingsPage] Failed to initiate GitLab OAuth:', error);
        console.error('[IntegrationsSettingsPage] Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        const friendlyError = getUserFriendlyError(error as ErrorResponse);
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'figma') {
      // Redirect to Figma OAuth - backend handles the redirect
      window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/v1/social/connect/figma/`;
    } else {
      setErrorMessage({
        title: 'Coming Soon',
        message: `${integrationId} integration is coming soon! We're working hard to bring you more integrations.`,
        variant: 'info',
      });
    }
  };

  const handleDisconnect = async (integrationId: string, integrationName: string) => {
    setShowDisconnectModal(null);
    setErrorMessage(null);
    setSuccessMessage('');

    if (integrationId === 'linkedin') {
      try {
        // Use 'li' alias to avoid ad-blocker blocking "linkedin" URLs
        await api.post('/social/disconnect/li/');

        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'linkedin'
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
        console.error('Failed to disconnect LinkedIn:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'linkedin');
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'github') {
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
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'github');
        setErrorMessage(friendlyError);
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

        setYoutubeChannelId(null);
        setLastSyncedAt(null);
        setSuccessMessage(`${integrationName} disconnected successfully`);
      } catch (error) {
        console.error('Failed to disconnect YouTube:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'gitlab') {
      try {
        await api.post('/social/disconnect/gitlab/');

        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'gitlab'
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
        console.error('Failed to disconnect GitLab:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse);
        setErrorMessage(friendlyError);
      }
    } else if (integrationId === 'figma') {
      try {
        await api.post('/social/disconnect/figma/');

        setIntegrations(prev =>
          prev.map(integration =>
            integration.id === 'figma'
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
        console.error('Failed to disconnect Figma:', error);
        const friendlyError = getUserFriendlyError(error as ErrorResponse);
        setErrorMessage(friendlyError);
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
      const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
      setErrorMessage(friendlyError);
    }
  };

  const handleImportChannel = async () => {
    setErrorMessage(null);
    setSuccessMessage('');

    try {
      const response = await api.post('/integrations/youtube/import-channel/', {
        max_videos: 50
      });

      if (response.data.success) {
        // Show progress modal
        setImportSourceId(response.data.content_source_id);
        setImportVideoCount(50);
        setShowImportProgress(true);

        setSuccessMessage(
          'Your channel is being imported! This may take a few minutes. ' +
          'Auto-sync is now enabled for new uploads.'
        );

        // Refresh sync status after a delay
        setTimeout(() => fetchSyncStatus(), 5000);
      }
    } catch (error: any) {
      console.error('Failed to import channel:', error);
      const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
      setErrorMessage(friendlyError);
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

        // Update last synced time if available
        if (response.data.lastSyncedAt) {
          setLastSyncedAt(response.data.lastSyncedAt);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage('');

    try {
      const response = await api.post('/integrations/youtube/sync/');

      if (response.data.success) {
        setLastSyncedAt(new Date().toISOString());
        setSuccessMessage(response.data.message || `Found ${response.data.videosFound || 0} new videos. Syncing in progress...`);
      }
    } catch (error: any) {
      console.error('Failed to sync:', error);
      const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
      setErrorMessage(friendlyError);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSyncedTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString();
  };

  // Video picker modal handlers
  const handleOpenVideoPicker = () => {
    setVideoPickerState(prev => ({ ...prev, isOpen: true }));
  };

  const handleCloseVideoPicker = () => {
    setVideoPickerState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSelectionChange = (videoIds: Set<string>) => {
    setVideoPickerState(prev => ({ ...prev, selectedVideoIds: videoIds }));
  };

  const handleImportVideos = async (videoIds: string[]) => {
    setErrorMessage(null);
    setSuccessMessage('');

    try {
      // Import each video
      const importPromises = videoIds.map(videoId => {
        return api.post('/integrations/youtube/import/', {
          video_url: `https://youtube.com/watch?v=${videoId}`,
          is_showcase: true,
          is_private: false,
        });
      });

      await Promise.all(importPromises);

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
      const friendlyError = getUserFriendlyError(error as ErrorResponse, 'youtube');
      setErrorMessage(friendlyError);
      throw error; // Re-throw to keep modal open
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div>
            {/* Header */}
            <div className="mb-6">
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
                className={`mb-6 glass-strong rounded p-5 border ${
                  errorMessage.variant === 'error' ? 'border-red-500/20 bg-red-500/5' :
                  errorMessage.variant === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                  'border-blue-500/20 bg-blue-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    errorMessage.variant === 'error' ? 'bg-red-100 dark:bg-red-900/20' :
                    errorMessage.variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                    'bg-blue-100 dark:bg-blue-900/20'
                  }`}>
                    <span className="text-xl">
                      {errorMessage.variant === 'error' ? '⚠️' :
                       errorMessage.variant === 'warning' ? '⏸️' :
                       'ℹ️'}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-1 ${
                      errorMessage.variant === 'error' ? 'text-red-700 dark:text-red-400' :
                      errorMessage.variant === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                      'text-blue-700 dark:text-blue-400'
                    }`}>
                      {errorMessage.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {errorMessage.message}
                    </p>

                    {/* Action Button */}
                    {errorMessage.actionText && errorMessage.actionHref && (
                      <a
                        href={errorMessage.actionHref}
                        className="inline-block px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        {errorMessage.actionText}
                      </a>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {successMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mb-6 glass-strong rounded p-4 border border-green-500/20 bg-green-500/5"
              >
                <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              /* Integrations Accordion List */
              <div className="space-y-2">
              {integrations.map((integration) => {
                const isExpanded = expandedIntegration === integration.id;
                return (
                <div
                  key={integration.id}
                  className="glass-strong rounded-lg border border-white/20 overflow-hidden"
                >
                  {/* Accordion Header */}
                  <button
                    onClick={() => setExpandedIntegration(isExpanded ? null : integration.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={integration.icon} className="text-xl text-slate-700 dark:text-slate-300" />
                      </div>

                      {/* Name and status */}
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {integration.name}
                        </h3>
                        {integration.isConnected && integration.username && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            @{integration.username}
                          </p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2">
                        {integration.isConnected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                            <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                            Connected
                          </span>
                        )}
                        {!integration.isAvailable && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <FontAwesomeIcon
                      icon={isExpanded ? faChevronUp : faChevronDown}
                      className="text-slate-400 transition-transform"
                    />
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/10 bg-white/5">
                      {/* Description */}
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        {integration.description}
                      </p>

                      {/* Connected state details */}
                      {integration.isConnected && integration.connectedAt && (
                        <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                          Connected {new Date(integration.connectedAt).toLocaleDateString()}
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
                        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-white/5">
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
                          <span className="text-xs text-slate-700 dark:text-slate-300">
                            Automatic sync {integration.syncEnabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                      )}

                      {/* YouTube Sync Status */}
                      {integration.id === 'youtube' && integration.isConnected && (
                        <div className="mb-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                            Last synced: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLastSyncedTime(lastSyncedAt)}</span>
                          </p>
                          <button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="w-full px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSyncing ? (
                              <span className="flex items-center justify-center gap-2">
                                <FontAwesomeIcon icon={faSpinner} spin />
                                Syncing...
                              </span>
                            ) : (
                              '🔄 Sync Now'
                            )}
                          </button>
                        </div>
                      )}

                      {/* Action button */}
                      <div className="flex gap-2">
                        {integration.isConnected ? (
                          <button
                            onClick={() => setShowDisconnectModal(integration.id)}
                            className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium"
                          >
                            Disconnect
                          </button>
                        ) : integration.isAvailable ? (
                          <button
                            onClick={() => handleConnect(integration.id)}
                            className="flex-1 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors text-xs font-medium"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-500/10 text-slate-500 dark:text-slate-400 cursor-not-allowed text-xs font-medium"
                          >
                            Coming Soon
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              </div>
            )}
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

        {/* Import Progress Modal */}
        <YouTubeImportProgressModal
          isOpen={showImportProgress}
          onClose={() => setShowImportProgress(false)}
          sourceId={importSourceId}
          videoCount={importVideoCount}
        />

        {/* Disconnect Confirmation Modal */}
        {showDisconnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded shadow-lg max-w-md w-full mx-4 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Disconnect {showDisconnectModal === 'linkedin' ? 'LinkedIn' : showDisconnectModal === 'youtube' ? 'YouTube' : showDisconnectModal === 'github' ? 'GitHub' : showDisconnectModal === 'gitlab' ? 'GitLab' : showDisconnectModal === 'figma' ? 'Figma' : 'Integration'}?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {showDisconnectModal === 'youtube'
                      ? 'Auto-sync will stop, but your imported videos will remain on your profile. You can reconnect anytime.'
                      : 'This will stop syncing content from this platform. Existing projects will remain.'
                    }
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDisconnectModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const integrationName = showDisconnectModal === 'linkedin' ? 'LinkedIn' : showDisconnectModal === 'youtube' ? 'YouTube' : showDisconnectModal === 'github' ? 'GitHub' : showDisconnectModal === 'gitlab' ? 'GitLab' : showDisconnectModal === 'figma' ? 'Figma' : 'Integration';
                    handleDisconnect(showDisconnectModal, integrationName);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-sm"
                >
                  {showDisconnectModal === 'youtube' ? 'Keep Videos & Disconnect' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsLayout>
    </DashboardLayout>
  );
}
