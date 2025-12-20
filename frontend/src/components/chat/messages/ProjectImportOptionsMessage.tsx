/**
 * ProjectImportOptionsMessage - Card-based options for sharing/importing a project
 *
 * Displays 4 card-style options when user clicks "Share something I've been working on":
 * - Connect to an integration (GitHub, GitLab, Figma, YouTube)
 * - Paste in a URL
 * - Upload a project directly
 * - Install Chrome extension
 *
 * Styled with Neon Glass aesthetic, similar to GamePicker.
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlug,
  faLink,
  faCloudUpload,
  faPuzzlePiece,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ProjectImportOption } from '@/hooks/useIntelligentChat';

interface ImportOptionConfig {
  id: ProjectImportOption;
  title: string;
  description: string;
  icon: IconDefinition;
}

const IMPORT_OPTIONS: ImportOptionConfig[] = [
  {
    id: 'integration',
    title: 'Connect to an integration',
    description: 'Pull your project from GitHub, GitLab, Figma, or YouTube',
    icon: faPlug,
  },
  {
    id: 'url',
    title: 'Paste in a URL',
    description: 'Import from any website or repository URL',
    icon: faLink,
  },
  {
    id: 'upload',
    title: 'Upload a project',
    description: 'Upload images, files, or documents directly',
    icon: faCloudUpload,
  },
  {
    id: 'chrome-extension',
    title: 'Chrome extension',
    description: 'Install our extension to easily import from anywhere',
    icon: faPuzzlePiece,
  },
];

interface ProjectImportOptionsMessageProps {
  onOptionSelect: (option: ProjectImportOption) => void;
}

export function ProjectImportOptionsMessage({ onOptionSelect }: ProjectImportOptionsMessageProps) {
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
          How would you like to share your project?
        </span>
      </div>

      {/* Option cards - responsive grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {IMPORT_OPTIONS.map((option, index) => (
          <motion.button
            key={option.id}
            onClick={() => onOptionSelect(option.id)}
            className="group text-left"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="relative h-full p-4 overflow-hidden shadow-lg hover:shadow-neon cursor-pointer
                bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 dark:from-slate-800/50 dark:via-slate-900/50 dark:to-slate-800/50
                border border-orange-200 dark:border-orange-500/20 hover:border-orange-300 dark:hover:border-orange-400/40
                transition-all duration-300"
              style={{ borderRadius: 'var(--radius)' }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 mb-3 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20
                  border border-orange-200 dark:border-orange-500/30 flex items-center justify-center
                  group-hover:from-orange-200 group-hover:to-amber-200 dark:group-hover:from-orange-500/30 dark:group-hover:to-amber-500/30
                  transition-all duration-300"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <FontAwesomeIcon
                  icon={option.icon}
                  className="w-5 h-5 text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300 transition-colors"
                />
              </div>

              {/* Title */}
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1 line-clamp-2">
                {option.title}
              </h4>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 line-clamp-2 transition-colors">
                {option.description}
              </p>

              {/* Hover glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
