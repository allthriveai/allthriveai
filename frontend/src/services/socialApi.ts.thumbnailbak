/**
 * API service for social OAuth connections
 */
import { api } from './api';

export interface SocialProvider {
  key: string;
  label: string;
  isConfigured: boolean;
  isConnected: boolean;
  isAvailable: boolean;
}

export interface SocialConnection {
  id: number;
  provider: string;
  providerDisplay: string;
  providerUsername: string;
  providerEmail: string;
  profileUrl: string;
  avatarUrl: string;
  isExpired: boolean;
  connectedAt: string;
  scopes: string[];
}

export interface ConnectionStatus {
  connected: boolean;
  provider: string;
  providerDisplay?: string;
  providerUsername?: string;
  profileUrl?: string;
  avatarUrl?: string;
  isExpired?: boolean;
  connectedAt?: string;
}

/**
 * Get list of available OAuth providers
 */
export async function getAvailableProviders(): Promise<SocialProvider[]> {
  const response = await api.get<{ data: SocialProvider[] }>('/social/providers/');
  return response.data.data;
}

/**
 * Get list of user's connected social accounts
 */
export async function getConnections(): Promise<SocialConnection[]> {
  const response = await api.get<{ data: SocialConnection[] }>('/social/connections/');
  return response.data.data;
}

/**
 * Get connection status for a specific provider
 */
export async function getConnectionStatus(provider: string): Promise<ConnectionStatus> {
  const response = await api.get<{ data: ConnectionStatus }>(`/social/status/${provider}/`);
  return response.data.data;
}

/**
 * Initiate OAuth flow to connect a provider
 * Returns the authorization URL to redirect the user to
 */
export async function connectProvider(provider: string): Promise<string> {
  const response = await api.get<{ data: { authUrl: string; provider: string } }>(
    `/social/connect/${provider}/`
  );
  return response.data.data.authUrl;
}

/**
 * Disconnect a social provider
 */
export async function disconnectProvider(provider: string): Promise<void> {
  await api.post<{ message: string }>(`/social/disconnect/${provider}/`);
}

/**
 * Open OAuth popup window and handle the flow
 */
export function openOAuthPopup(authUrl: string, provider: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      `oauth_${provider}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup) {
      reject(new Error('Failed to open popup. Please allow popups for this site.'));
      return;
    }

    // Poll to check if popup is closed
    const pollInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollInterval);
        // Give a short delay for the backend to process
        setTimeout(() => {
          resolve(true);
        }, 500);
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
        clearInterval(pollInterval);
        reject(new Error('OAuth flow timed out'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Helper function to get provider icon/emoji
 */
export function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    github: '🐙',
    gitlab: '🦊',
    linkedin: '💼',
    figma: '🎨',
    huggingface: '🤗',
    midjourney: '🎭',
  };
  return icons[provider] || '🔗';
}

/**
 * Helper function to get provider color
 */
export function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    github: 'bg-gray-900 hover:bg-gray-800',
    gitlab: 'bg-orange-600 hover:bg-orange-700',
    linkedin: 'bg-blue-600 hover:bg-blue-700',
    figma: 'bg-purple-600 hover:bg-purple-700',
    huggingface: 'bg-yellow-500 hover:bg-yellow-600',
    midjourney: 'bg-indigo-600 hover:bg-indigo-700',
  };
  return colors[provider] || 'bg-gray-600 hover:bg-gray-700';
}
