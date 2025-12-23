/**
 * PathSelectionMessage - Path selection for onboarding (Play/Learn/Personalize)
 *
 * Shows the three path options as interactive buttons in chat.
 * Uses orange Ember theme with larger fonts.
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGamepad,
  faGraduationCap,
  faPalette,
} from '@fortawesome/free-solid-svg-icons';
import type { PathOption } from '@/hooks/useIntelligentChat';

// Map icon names to actual icons
const iconMap: Record<string, typeof faGamepad> = {
  faGamepad,
  faGraduationCap,
  faPalette,
};

// Default path options
export const defaultPathOptions: PathOption[] = [
  {
    id: 'play',
    title: 'Play',
    description: 'Test your skills in prompt battles and challenges.',
    icon: 'faGamepad',
    gradient: 'from-violet-500 to-purple-600',
    path: '/play/prompt-battles',
  },
  {
    id: 'learn',
    title: 'Learn',
    description: 'Discover AI tools and level up your skills.',
    icon: 'faGraduationCap',
    gradient: 'from-cyan-500 to-teal-500',
    path: '/explore',
  },
  {
    id: 'personalize',
    title: 'Personalize',
    description: 'Set up your profile and showcase your projects.',
    icon: 'faPalette',
    gradient: 'from-amber-500 to-orange-500',
    path: '/dashboard',
  },
];

// Ember avatar component - positioned at bottom
function EmberAvatar() {
  return (
    <div className="relative flex-shrink-0 self-end">
      <img
        src="/ember-avatar.png"
        alt="Ember"
        className="w-12 h-12 rounded-full object-cover"
      />
    </div>
  );
}

interface PathSelectionMessageProps {
  paths?: PathOption[];
  selectedPath: string | null;
  onSelectPath: (path: PathOption) => void;
}

export function PathSelectionMessage({
  paths = defaultPathOptions,
  selectedPath,
  onSelectPath,
}: PathSelectionMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      {/* Layout with Ember avatar alongside */}
      <div className="flex items-end gap-4">
        <EmberAvatar />

        <div className="flex-1 max-w-2xl space-y-4">
          {/* Header message */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-subtle px-5 py-4 rounded bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
          >
            <p className="text-orange-100 text-lg leading-relaxed">
              Now, where would you like to start?
            </p>
          </motion.div>

          {/* Path selection label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-orange-200/60 text-base"
          >
            Choose your path:
          </motion.p>

          {/* Path options */}
          <div className="grid gap-3">
            {paths.map((path, index) => {
              const icon = iconMap[path.icon] || faGamepad;
              return (
                <motion.button
                  key={path.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectPath(path)}
                  disabled={selectedPath !== null}
                  className={`
                    relative w-full p-4 rounded-xl text-left transition-all
                    glass-subtle hover:bg-white/[0.08] border border-orange-500/20 hover:border-orange-500/40
                    group overflow-hidden
                    ${selectedPath === path.id ? 'ring-2 ring-orange-500 bg-orange-500/10' : ''}
                    ${selectedPath !== null && selectedPath !== path.id ? 'opacity-40' : ''}
                  `}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${path.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}
                  />

                  <div className="relative flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${path.gradient} flex items-center justify-center shadow-lg group-hover:shadow-neon transition-shadow`}
                    >
                      <FontAwesomeIcon icon={icon} className="text-lg text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-orange-100 group-hover:text-orange-50 transition-colors">
                        {path.title}
                      </h3>
                      <p className="text-base text-orange-200/70 group-hover:text-orange-200/90 transition-colors">
                        {path.description}
                      </p>
                    </div>

                    <div className="text-orange-400/50 group-hover:text-orange-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Helper text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-orange-200/50 text-base"
          >
            You can always explore the other paths later!
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

export default PathSelectionMessage;
