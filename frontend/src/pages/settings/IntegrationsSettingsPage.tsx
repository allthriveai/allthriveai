import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { api } from '@/services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma, faInstagram, faTiktok, faYoutube } from '@fortawesome/free-brands-svg-icons';

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
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'github',
      name: 'GitHub',
      description: 'Automatically sync your GitHub repositories as projects',
      icon: faGithub,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      description: 'Import your GitLab projects and showcase your work',
      icon: faGitlab,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
    {
      id: 'figma',
      name: 'Figma',
      description: 'Embed your Figma designs and prototypes in your portfolio',
      icon: faFigma,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Automatically sync your Instagram posts and videos to your project feed',
      icon: faInstagram,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Import your TikTok videos as project showcases',
      icon: faTiktok,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Embed your YouTube videos in your project portfolio',
      icon: faYoutube,
      isConnected: false,
      isAvailable: false, // Coming soon
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleConnect = async (integrationId: string) => {
    setErrorMessage('');
    setSuccessMessage('');

    // Placeholder for future integration
    setErrorMessage(`${integrationId} integration is coming soon!`);
  };

  const handleDisconnect = async (integrationId: string, integrationName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${integrationName}?`)) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    // Placeholder for future integration
    setSuccessMessage(`${integrationName} disconnected successfully`);
  };

  const handleToggleSync = async (integrationId: string) => {
    setIntegrations(prev =>
      prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, syncEnabled: !integration.syncEnabled }
          : integration
      )
    );
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

            {/* Integrations Grid */}
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
      </SettingsLayout>
    </DashboardLayout>
  );
}
