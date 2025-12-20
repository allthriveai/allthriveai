/**
 * IntegrationCardsMessage - Inline integration picker with connection status
 *
 * Displays all 4 integrations (GitHub, GitLab, Figma, YouTube) as cards
 * with live connection status indicators. Shown when user clicks
 * "Connect to an integration" in the project import options.
 *
 * Styled with Neon Glass aesthetic, similar to GamePicker.
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGithub,
  faGitlab,
  faFigma,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import { faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { IntegrationId } from '../core/types';

interface IntegrationConfig {
  id: IntegrationId;
  name: string;
  description: string;
  icon: IconDefinition;
  color: string;
  hoverColor: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Import repositories',
    icon: faGithub,
    color: 'from-slate-700/50 to-slate-800/50',
    hoverColor: 'from-slate-600/50 to-slate-700/50',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Import projects',
    icon: faGitlab,
    color: 'from-orange-900/30 to-orange-950/30',
    hoverColor: 'from-orange-800/30 to-orange-900/30',
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Import designs',
    icon: faFigma,
    color: 'from-purple-900/30 to-purple-950/30',
    hoverColor: 'from-purple-800/30 to-purple-900/30',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Import videos',
    icon: faYoutube,
    color: 'from-red-900/30 to-red-950/30',
    hoverColor: 'from-red-800/30 to-red-900/30',
  },
];

interface ConnectionStatus {
  github: boolean;
  gitlab: boolean;
  figma: boolean;
  youtube: boolean;
  loading: boolean;
}

interface IntegrationCardsMessageProps {
  onIntegrationSelect: (integration: IntegrationId) => void;
  connectionStatus: ConnectionStatus;
}

export function IntegrationCardsMessage({
  onIntegrationSelect,
  connectionStatus,
}: IntegrationCardsMessageProps) {
  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Header text */}
      <div className="mb-4 px-1">
        <span className="text-base text-slate-600 dark:text-slate-300">
          Which platform would you like to import from?
        </span>
      </div>

      {/* Integration cards - responsive grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {INTEGRATIONS.map((integration, index) => {
          const isConnected = connectionStatus[integration.id];
          const isLoading = connectionStatus.loading;

          return (
            <motion.button
              key={integration.id}
              onClick={() => onIntegrationSelect(integration.id)}
              className="group text-left"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="relative h-full p-4 overflow-hidden shadow-lg hover:shadow-neon cursor-pointer
                  bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50
                  border border-slate-200 dark:border-slate-600/30 hover:border-orange-300 dark:hover:border-orange-400/40
                  transition-all duration-300"
                style={{ borderRadius: 'var(--radius)' }}
              >
                {/* Connection status badge */}
                <div className="absolute top-2 right-2">
                  {isLoading ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700/50 rounded-full">
                      <FontAwesomeIcon
                        icon={faSpinner}
                        className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 animate-spin"
                      />
                    </div>
                  ) : isConnected ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 rounded-full">
                      <FontAwesomeIcon
                        icon={faCheck}
                        className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400"
                      />
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/30 rounded-full">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Connect</span>
                    </div>
                  )}
                </div>

                {/* Icon */}
                <div
                  className="w-12 h-12 mb-3 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5
                    border border-slate-300 dark:border-white/10 flex items-center justify-center
                    group-hover:from-slate-300 group-hover:to-slate-200 dark:group-hover:from-white/15 dark:group-hover:to-white/10
                    transition-all duration-300"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <FontAwesomeIcon
                    icon={integration.icon}
                    className="w-6 h-6 text-slate-700 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-200 transition-colors"
                  />
                </div>

                {/* Name */}
                <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-0.5">
                  {integration.name}
                </h4>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                  {integration.description}
                </p>

                {/* Hover glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
