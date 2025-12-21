/**
 * Points Award Overlay Component
 *
 * Celebratory overlay shown when points are awarded to the user.
 * Features:
 * - Animated sparkle particles
 * - Spring animation on points badge
 * - Link to earn more points via side quests
 * - Neon glass design system styling
 *
 * Usage:
 * 1. Direct props: <PointsAwardOverlay isOpen={true} points={50} ... />
 * 2. Via context: <GlobalPointsAwardOverlay /> (auto-reads from PointsNotificationContext)
 */

import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { SparklesIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';
import { usePointsNotificationOptional } from '@/context/PointsNotificationContext';

interface PointsAwardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  points: number;
  title?: string;
  message?: string;
}

export function PointsAwardOverlay({
  isOpen,
  onClose,
  points,
  title = 'Welcome Bonus!',
  message = "You've earned your first points!",
}: PointsAwardOverlayProps) {
  // Memoize particle positions so they don't change on re-renders
  const particles = useMemo(
    () =>
      [...Array(6)].map(() => ({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
      })),
    []
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-sm transform overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 border border-cyan-500/30 p-6 text-center shadow-xl shadow-cyan-500/20 transition-all">
                {/* Sparkle particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {particles.map((particle, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-cyan-400 rounded-full"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        x: [0, particle.x],
                        y: [0, particle.y],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                      style={{
                        left: '50%',
                        top: '30%',
                      }}
                    />
                  ))}
                </div>

                {/* Points badge */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                  className="relative mx-auto mb-4 w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/50"
                >
                  <span className="text-3xl font-bold text-white">+{points}</span>
                </motion.div>

                <Dialog.Title className="text-2xl font-bold text-white mb-2">
                  {title}
                </Dialog.Title>

                <p className="text-slate-300 mb-6">{message}</p>

                {/* How to earn more */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
                  <div className="flex items-center justify-center gap-2 text-cyan-400 mb-2">
                    <TrophyIcon className="w-5 h-5" />
                    <span className="font-semibold">Earn More Points</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Complete side quests, create projects, and engage with the community!
                  </p>
                  <Link
                    to="/play/games#side-quests"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg font-medium hover:from-cyan-400 hover:to-teal-400 transition-all"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    View Side Quests
                  </Link>
                </div>

                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Continue
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/**
 * Global Points Award Overlay
 *
 * Rendered at app root level, reads from PointsNotificationContext.
 * Any component can trigger this by calling showPointsNotification().
 */
export function GlobalPointsAwardOverlay() {
  const context = usePointsNotificationOptional();

  if (!context || !context.currentNotification) {
    return null;
  }

  const { currentNotification, isOpen, closeNotification } = context;

  return (
    <PointsAwardOverlay
      isOpen={isOpen}
      onClose={closeNotification}
      points={currentNotification.points}
      title={currentNotification.title}
      message={currentNotification.message}
    />
  );
}
