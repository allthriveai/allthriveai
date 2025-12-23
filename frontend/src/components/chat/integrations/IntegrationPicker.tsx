/**
 * IntegrationPicker - Modal for selecting which integration to use
 *
 * Features:
 * - Shows all available integrations (GitHub, GitLab, Figma, YouTube)
 * - Displays connection status for each
 * - Loading states while checking connections
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { XMarkIcon, CheckCircleIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { IntegrationId } from '../core/types';

interface IntegrationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (integration: IntegrationId) => void;
  connectionStatus: {
    github: boolean;
    gitlab: boolean;
    figma: boolean;
    youtube: boolean;
    loading: boolean;
  };
}

const integrations = [
  {
    id: 'github' as IntegrationId,
    name: 'GitHub',
    description: 'Import a repository from GitHub',
    icon: faGithub,
    iconColor: 'text-white',
    bgColor: 'bg-gray-800',
    hoverBg: 'hover:bg-gray-700',
  },
  {
    id: 'gitlab' as IntegrationId,
    name: 'GitLab',
    description: 'Import a project from GitLab',
    icon: faGitlab,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-900/30',
    hoverBg: 'hover:bg-orange-900/50',
  },
  {
    id: 'figma' as IntegrationId,
    name: 'Figma',
    description: 'Import a design from Figma',
    icon: faFigma,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-900/30',
    hoverBg: 'hover:bg-purple-900/50',
  },
  {
    id: 'youtube' as IntegrationId,
    name: 'YouTube',
    description: 'Import a video from YouTube',
    icon: faYoutube,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-900/30',
    hoverBg: 'hover:bg-red-900/50',
  },
];

export function IntegrationPicker({
  isOpen,
  onClose,
  onSelect,
  connectionStatus,
}: IntegrationPickerProps) {
  if (!isOpen) return null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-white">Add from Integration</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/5 rounded transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-2">
        {integrations.map((integration) => {
          const isConnected = connectionStatus[integration.id];
          const isLoading = connectionStatus.loading;

          return (
            <button
              key={integration.id}
              onClick={() => onSelect(integration.id)}
              disabled={isLoading}
              className={`w-full p-3 rounded-lg text-left transition-colors ${integration.bgColor} ${integration.hoverBg} disabled:opacity-50`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${integration.bgColor}`}>
                  <FontAwesomeIcon
                    icon={integration.icon}
                    className={`w-5 h-5 ${integration.iconColor}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{integration.name}</span>
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                    ) : isConnected ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{integration.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Select an integration to import content
      </p>
    </div>
  );
}
