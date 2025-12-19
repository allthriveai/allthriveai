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
import { faDragon, faGamepad, faRocket, faCompass, faUserPen } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';
import type { AdventureId } from '@/hooks/useEmberOnboarding';

interface Adventure {
  id: AdventureId;
  title: string;
  shortTitle: string;
  icon: typeof faGamepad;
  gradient: string;
  path: string;
  bannerOnly?: boolean; // If true, only shows in banner, not in opening paths
}

// Core adventures shown in both modal and banner
const adventures: Adventure[] = [
  {
    id: 'battle_pip',
    title: 'Prompt Battle',
    shortTitle: 'Battle',
    icon: faGamepad,
    gradient: 'from-violet-500 to-purple-600',
    path: '/play/prompt-battles',
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
  {
    id: 'personalize',
    title: 'Personalize Profile',
    shortTitle: 'Profile',
    icon: faUserPen,
    gradient: 'from-pink-500 to-rose-500',
    path: '/account/settings',
    bannerOnly: true,
  },
];

interface EmberAdventureBannerProps {
  completedAdventures: AdventureId[];
  onAdventureClick: (adventureId: AdventureId) => void;
  onDismiss: () => void;
  onShowMoreRecommendations?: () => void;
}

export function EmberAdventureBanner({
  completedAdventures,
  onAdventureClick,
  onDismiss,
  onShowMoreRecommendations,
}: EmberAdventureBannerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isExpanded] = useState(true);

  const remainingAdventures = adventures.filter(
    (a) => !completedAdventures.includes(a.id)
  );

  const allComplete = remainingAdventures.length === 0;

  const handleAdventureClick = (adventure: Adventure) => {
    onAdventureClick(adventure.id);

    // Special handling for add_project - navigate to user's profile and open chat
    if (adventure.id === 'add_project') {
      localStorage.setItem('ember_open_chat', 'true');
      // Navigate to user's profile page (/:username)
      const profilePath = user?.username ? `/${user.username}` : '/dashboard';
      navigate(profilePath);
    } else if (adventure.id === 'personalize') {
      // Navigate to user's profile and open the AI profile generator tray
      localStorage.setItem('ember_open_profile_generator', 'true');
      const profilePath = user?.username ? `/${user.username}` : '/dashboard';
      // Dispatch event for when already on profile page
      window.dispatchEvent(new CustomEvent('ember-open-profile-generator'));
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
          <div className="max-w-[1920px] mx-auto px-4 sm:pl-8 sm:pr-6 py-2 sm:py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faDragon} className="text-xl sm:text-2xl text-orange-500 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                  <span className="text-orange-700 dark:text-orange-200 font-medium text-xs sm:text-sm truncate">
                    <span className="hidden sm:inline">Would you like to continue your adventure quest?</span>
                    <span className="sm:hidden">Continue quest?</span>
                  </span>
                  <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {onShowMoreRecommendations && (
                  <button
                    onClick={onShowMoreRecommendations}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 dark:border-orange-500/30 text-orange-700 dark:text-orange-300 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">More things to do</span>
                    <span className="sm:hidden">More</span>
                  </button>
                )}
                <button
                  onClick={onDismiss}
                  className="p-1 sm:p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white" />
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
          className="relative overflow-hidden border-b border-amber-700/30 dark:border-amber-800/40"
        >
          {/* Animated muted burnt orange gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-700/80 via-orange-700/70 to-amber-800/80 dark:from-amber-800/70 dark:via-orange-800/60 dark:to-amber-900/70 animate-gradient-shift bg-[length:200%_100%]" />
          {/* Subtle overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent dark:from-black/10" />
          <div className="relative max-w-[1920px] mx-auto px-4 sm:pl-8 sm:pr-6 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              {/* Ember avatar and message */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faDragon} className="text-xl sm:text-2xl text-orange-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                </div>
                <span className="text-orange-300 text-xs sm:text-sm">
                  <span className="text-orange-300 font-semibold">Ember:</span>{' '}
                  <a
                    href="/onboarding"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/onboarding');
                    }}
                    className="hover:text-orange-200 hover:underline transition-colors"
                  >
                    Continue onboarding
                  </a>
                </span>

                {/* Dismiss button - mobile only, at end of message row */}
                <button
                  onClick={onDismiss}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-auto sm:hidden"
                  aria-label="Dismiss banner"
                >
                  <XMarkIcon className="w-4 h-4 text-white/70 hover:text-white" />
                </button>
              </div>

              {/* Adventure buttons - horizontal scroll on mobile */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                {remainingAdventures.map((adventure) => (
                  <motion.button
                    key={adventure.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAdventureClick(adventure)}
                    className="
                      flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg
                      bg-white/10 hover:bg-orange-900/80
                      backdrop-blur-md border border-orange-400/60 hover:border-orange-600
                      text-orange-300 hover:text-orange-100 text-xs sm:text-sm font-medium
                      shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(194,65,12,0.4)]
                      transition-all duration-200
                      whitespace-nowrap flex-shrink-0
                    "
                  >
                    <FontAwesomeIcon icon={adventure.icon} className="text-xs" />
                    <span className="hidden sm:inline">{adventure.title}</span>
                    <span className="sm:hidden">{adventure.shortTitle}</span>
                  </motion.button>
                ))}

                {/* Completed indicators - hidden on mobile to save space */}
                {completedAdventures.map((id) => {
                  const adventure = adventures.find((a) => a.id === id);
                  if (!adventure) return null;
                  return (
                    <div
                      key={id}
                      className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white/60 text-sm flex-shrink-0"
                      title={`${adventure.title} - Complete!`}
                    >
                      <FontAwesomeIcon icon={adventure.icon} className="text-xs" />
                      <CheckCircleIcon className="w-4 h-4 text-white" />
                    </div>
                  );
                })}

                {/* Dismiss button - desktop only */}
                <button
                  onClick={onDismiss}
                  className="hidden sm:block p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1 flex-shrink-0"
                  aria-label="Dismiss banner"
                >
                  <XMarkIcon className="w-5 h-5 text-white/70 hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default EmberAdventureBanner;
