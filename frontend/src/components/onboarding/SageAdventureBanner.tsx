/**
 * EmberAdventureBanner Component
 *
 * Banner showing remaining adventure paths after user completes their first choice.
 * Guided by Ember the dragon. Can be dismissed by clicking X. Shows celebration when all done.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faGamepad, faRocket, faCompass } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';

type AdventureId = 'battle_pip' | 'add_project' | 'explore';

interface Adventure {
  id: AdventureId;
  title: string;
  shortTitle: string;
  icon: typeof faGamepad;
  gradient: string;
  path: string;
}

const adventures: Adventure[] = [
  {
    id: 'battle_pip',
    title: 'Battle Pip',
    shortTitle: 'Battle',
    icon: faGamepad,
    gradient: 'from-violet-500 to-purple-600',
    path: '/battles',
  },
  {
    id: 'add_project',
    title: 'Add Your First Project',
    shortTitle: 'Create',
    icon: faRocket,
    gradient: 'from-cyan-500 to-teal-500',
    path: '/dashboard', // Will be replaced with /:username dynamically
  },
  {
    id: 'explore',
    title: 'Explore',
    shortTitle: 'Explore',
    icon: faCompass,
    gradient: 'from-amber-500 to-orange-500',
    path: '/explore',
  },
];

interface SageAdventureBannerProps {
  completedAdventures: AdventureId[];
  onAdventureClick: (adventureId: AdventureId) => void;
  onDismiss: () => void;
  onShowMoreRecommendations?: () => void;
}

export function SageAdventureBanner({
  completedAdventures,
  onAdventureClick,
  onDismiss,
  onShowMoreRecommendations,
}: SageAdventureBannerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isExpanded] = useState(true);

  const remainingAdventures = adventures.filter(
    (a) => !completedAdventures.includes(a.id)
  );

  const allComplete = remainingAdventures.length === 0;
  const completedCount = completedAdventures.length;

  const handleAdventureClick = (adventure: Adventure) => {
    onAdventureClick(adventure.id);

    // Special handling for add_project - navigate to user's profile and open chat
    if (adventure.id === 'add_project') {
      localStorage.setItem('sage_open_chat', 'true');
      // Navigate to user's profile page (/:username)
      const profilePath = user?.username ? `/${user.username}` : '/dashboard';
      navigate(profilePath);
    } else {
      navigate(adventure.path);
    }
  };

  // All adventures complete - show celebration
  if (allComplete) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="bg-gradient-to-r from-orange-100 via-amber-100 to-orange-100 dark:from-orange-500/20 dark:via-amber-500/20 dark:to-red-500/20 border-b border-orange-300 dark:border-orange-500/30"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <FontAwesomeIcon icon={faDragon} className="text-2xl text-orange-500 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                  <span className="text-orange-700 dark:text-orange-200 font-medium">
                    Would you like to continue your adventure quest?
                  </span>
                  <SparklesIcon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {onShowMoreRecommendations && (
                  <button
                    onClick={onShowMoreRecommendations}
                    className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 dark:border-orange-500/30 text-orange-700 dark:text-orange-300 text-sm font-medium transition-colors"
                  >
                    More things to do
                  </button>
                )}
                <button
                  onClick={onDismiss}
                  className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-800/80 border-b border-slate-300 dark:border-slate-700/50 backdrop-blur-sm"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Ember avatar and message */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faDragon} className="text-2xl text-orange-500 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                </div>
                <span className="text-slate-700 dark:text-slate-300 text-sm hidden sm:block">
                  <span className="text-orange-600 dark:text-orange-400 font-medium">Ember:</span>{' '}
                  {completedCount === 0
                    ? 'Ready for an adventure?'
                    : completedCount === 1
                    ? 'Great start! Try another path:'
                    : 'One more to go!'}
                </span>

                {/* Progress dots (mobile) */}
                <div className="flex items-center gap-1 sm:hidden">
                  {adventures.map((a) => (
                    <div
                      key={a.id}
                      className={`w-2 h-2 rounded-full ${
                        completedAdventures.includes(a.id)
                          ? 'bg-orange-500 dark:bg-orange-400'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Adventure buttons */}
              <div className="flex items-center gap-2">
                {remainingAdventures.map((adventure) => (
                  <motion.button
                    key={adventure.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAdventureClick(adventure)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg
                      bg-gradient-to-r ${adventure.gradient}
                      text-white text-sm font-medium
                      shadow-lg hover:shadow-xl transition-shadow
                    `}
                  >
                    <FontAwesomeIcon icon={adventure.icon} className="text-xs" />
                    <span className="hidden sm:inline">{adventure.title}</span>
                    <span className="sm:hidden">{adventure.shortTitle}</span>
                  </motion.button>
                ))}

                {/* Completed indicators */}
                {completedAdventures.map((id) => {
                  const adventure = adventures.find((a) => a.id === id);
                  if (!adventure) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm"
                      title={`${adventure.title} - Complete!`}
                    >
                      <FontAwesomeIcon icon={adventure.icon} className="text-xs" />
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    </div>
                  );
                })}

                {/* Dismiss button */}
                <button
                  onClick={onDismiss}
                  className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors ml-1"
                  aria-label="Dismiss banner"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SageAdventureBanner;
