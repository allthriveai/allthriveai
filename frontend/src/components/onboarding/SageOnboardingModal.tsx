/**
 * EmberOnboardingModal Component
 *
 * Playful "Choose Your Adventure" onboarding modal guided by Ember the dragon.
 * Shows on first login with 3 paths: Battle Pip, Add Project, Explore.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faGamepad, faRocket, faCompass } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';

interface Adventure {
  id: 'battle_pip' | 'add_project' | 'explore';
  title: string;
  description: string;
  icon: typeof faGamepad;
  color: string;
  gradient: string;
  path: string;
  action?: () => void;
}

interface SageOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAdventure: (adventureId: Adventure['id']) => void;
  username?: string;
}

const adventures: Adventure[] = [
  {
    id: 'battle_pip',
    title: 'Battle Pip',
    description: 'Jump into a prompt battle and test your AI skills against our resident bot!',
    icon: faGamepad,
    color: 'text-violet-400',
    gradient: 'from-violet-500 to-purple-600',
    path: '/battles',
  },
  {
    id: 'add_project',
    title: 'Add Your First Project',
    description: 'Create something amazing with AI assistance. Ember will help you get started!',
    icon: faRocket,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500 to-teal-500',
    path: '/dashboard', // Will be replaced with /:username dynamically
  },
  {
    id: 'explore',
    title: 'Explore',
    description: 'Discover AI tools, projects, and creators in the AllThrive community.',
    icon: faCompass,
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    path: '/explore',
  },
];

export function SageOnboardingModal({
  isOpen,
  onClose,
  onSelectAdventure,
  username = 'Adventurer',
}: SageOnboardingModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure['id'] | null>(null);

  const handleSelectAdventure = (adventure: Adventure) => {
    setSelectedAdventure(adventure.id);
    onSelectAdventure(adventure.id);

    // Small delay for animation before navigating
    setTimeout(() => {
      onClose();

      // Special handling for add_project - navigate to user's profile and open chat
      if (adventure.id === 'add_project') {
        localStorage.setItem('sage_open_chat', 'true');
        // Navigate to user's profile page (/:username)
        const profilePath = user?.username ? `/${user.username}` : '/dashboard';
        navigate(profilePath);
      } else {
        navigate(adventure.path);
      }
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl"
          >
            {/* Skip button */}
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              Skip for now
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* Main card */}
            <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden">
              {/* Header with Ember */}
              <div className="relative bg-gradient-to-br from-orange-500/20 via-red-500/10 to-amber-500/20 p-6 pb-4 border-b border-white/10">
                {/* Decorative sparkles */}
                <motion.div
                  className="absolute top-4 right-8"
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <SparklesIcon className="w-6 h-6 text-amber-400/60" />
                </motion.div>
                <motion.div
                  className="absolute top-12 right-16"
                  animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                >
                  <SparklesIcon className="w-4 h-4 text-red-400/60" />
                </motion.div>

                <div className="flex items-start gap-4">
                  {/* Ember avatar */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-16 h-16 flex items-center justify-center"
                  >
                    <FontAwesomeIcon icon={faDragon} className="text-5xl text-orange-500 drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]" />
                  </motion.div>

                  <div className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h2 className="text-xl font-bold text-white mb-1">
                        Welcome, {username}! ✨
                      </h2>
                      <p className="text-orange-200/80 text-sm">
                        I'm <span className="font-semibold text-orange-300">Ember</span>, your guide to AllThrive!
                      </p>
                    </motion.div>
                  </div>
                </div>

                {/* Welcome badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30"
                >
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-200 text-sm font-medium">+50 Welcome Points!</span>
                </motion.div>
              </div>

              {/* Adventure selection */}
              <div className="p-6">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center text-slate-300 mb-6"
                >
                  🎮 <span className="font-medium text-white">Choose your adventure!</span> Where would you like to start?
                </motion.p>

                <div className="grid gap-4">
                  {adventures.map((adventure, index) => (
                    <motion.button
                      key={adventure.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectAdventure(adventure)}
                      disabled={selectedAdventure !== null}
                      className={`
                        relative w-full p-4 rounded-xl text-left transition-all
                        bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600
                        group overflow-hidden
                        ${selectedAdventure === adventure.id ? 'ring-2 ring-orange-500 bg-orange-500/10' : ''}
                        ${selectedAdventure !== null && selectedAdventure !== adventure.id ? 'opacity-50' : ''}
                      `}
                    >
                      {/* Hover gradient */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${adventure.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />

                      <div className="relative flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${adventure.gradient} flex items-center justify-center shadow-lg`}>
                          <FontAwesomeIcon icon={adventure.icon} className="text-xl text-white" />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-white group-hover:text-orange-300 transition-colors">
                            {adventure.title}
                          </h3>
                          <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                            {adventure.description}
                          </p>
                        </div>

                        <div className="text-slate-500 group-hover:text-orange-400 transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Footer hint */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-center text-slate-500 text-xs mt-6"
                >
                  Don't worry - you can always come back and try the other paths!
                </motion.p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SageOnboardingModal;
