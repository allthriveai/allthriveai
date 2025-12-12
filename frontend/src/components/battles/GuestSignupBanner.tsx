/**
 * GuestSignupBanner
 *
 * Small, non-intrusive banner that prompts guest users to create an account
 * after a battle. Clicking anywhere on the banner opens the signup modal.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

interface GuestSignupBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
  onSignupClick: () => void;
  battleResult?: 'win' | 'loss' | 'tie';
}

export function GuestSignupBanner({
  isVisible,
  onDismiss,
  onSignupClick,
}: GuestSignupBannerProps) {
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        >
          <div className="max-w-lg mx-auto">
            <button
              onClick={onSignupClick}
              className="relative w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl
                        bg-gradient-to-r from-cyan-500/10 to-green-500/10
                        border border-cyan-500/30 backdrop-blur-md
                        shadow-lg shadow-black/20
                        hover:from-cyan-500/20 hover:to-green-500/20
                        hover:border-cyan-500/50 transition-all cursor-pointer
                        text-left"
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-slate-900" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate sm:whitespace-normal">
                  Create an account to keep playing
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="flex-shrink-0">
                <ArrowRightIcon className="w-5 h-5 text-cyan-400" />
              </div>
            </button>

            {/* Dismiss button - positioned absolutely so it doesn't trigger navigation */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuestSignupBanner;
