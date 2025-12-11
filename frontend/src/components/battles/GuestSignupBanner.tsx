/**
 * GuestSignupBanner
 *
 * Small, non-intrusive banner that prompts guest users to create an account
 * after a battle. Allows them to see the results while still encouraging signup.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserPlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';
import { GuestSignupModal } from './GuestSignupModal';

interface GuestSignupBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
  battleResult?: 'win' | 'loss' | 'tie';
}

export function GuestSignupBanner({
  isVisible,
  onDismiss,
  battleResult,
}: GuestSignupBannerProps) {
  const [showModal, setShowModal] = useState(false);

  if (!isVisible) return null;

  const getMessage = () => {
    switch (battleResult) {
      case 'win':
        return 'You won! Create an account to save your victory.';
      case 'tie':
        return 'Great battle! Create an account to track your progress.';
      default:
        return 'Good effort! Create an account to improve your skills.';
    }
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && !showModal && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
          >
            <div className="max-w-lg mx-auto">
              <div className="relative flex items-center gap-3 p-3 sm:p-4 rounded-xl
                            bg-gradient-to-r from-cyan-500/10 to-green-500/10
                            border border-cyan-500/30 backdrop-blur-md
                            shadow-lg shadow-black/20">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-slate-900" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate sm:whitespace-normal">
                    {getMessage()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg
                             bg-gradient-to-r from-cyan-500 to-green-500
                             text-white text-sm font-medium
                             hover:from-cyan-400 hover:to-green-400
                             transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Up</span>
                  </button>

                  {/* Dismiss button */}
                  <button
                    onClick={onDismiss}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full signup modal when user clicks Sign Up */}
      <GuestSignupModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          onDismiss();
        }}
        battleResult={battleResult}
      />
    </>
  );
}

export default GuestSignupBanner;
