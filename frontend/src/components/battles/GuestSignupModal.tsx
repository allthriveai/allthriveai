/**
 * GuestSignupModal
 *
 * Modal that prompts guest users to create a full account after a battle.
 * Allows them to claim their battle results and continue using the platform.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserPlusIcon,
  SparklesIcon,
  TrophyIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface GuestSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  battleResult?: 'win' | 'loss' | 'tie';
}

export function GuestSignupModal({
  isOpen,
  onClose,
  onSuccess,
  battleResult,
}: GuestSignupModalProps) {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/me/account/convert-guest/', {
        email,
        password,
        username: username || undefined,
      });

      setSuccess(true);

      // Refresh auth to get updated user data
      await refreshUser();

      // Delay slightly to show success state
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create account. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="glass-card p-6 md:p-8">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {success ? (
              // Success state
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
                <p className="text-slate-400">Welcome to AllThrive AI</p>
              </motion.div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="flex justify-center gap-2 mb-4">
                    {battleResult === 'win' ? (
                      <TrophyIcon className="w-8 h-8 text-amber-400" />
                    ) : (
                      <SparklesIcon className="w-8 h-8 text-cyan-400" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {battleResult === 'win'
                      ? 'Claim Your Victory!'
                      : 'Save Your Progress'}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Create an account to save your battle results, earn XP, and challenge more opponents!
                  </p>
                </div>

                {/* Benefits list */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-slate-300">
                      <SparklesIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span>Keep your XP and battle history</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <TrophyIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>Appear on the leaderboard</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <UserPlusIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Challenge friends via SMS</span>
                    </li>
                  </ul>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm text-slate-400 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600
                               text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none
                               focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="username" className="block text-sm text-slate-400 mb-1">
                      Username <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600
                               text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none
                               focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      placeholder="coolpromptmaster"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm text-slate-400 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600
                               text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none
                               focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      placeholder="At least 8 characters"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="w-5 h-5" />
                        Create Account
                      </>
                    )}
                  </button>
                </form>

                {/* Skip link */}
                <p className="text-center text-slate-500 text-sm mt-4">
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors underline"
                  >
                    Continue as guest
                  </button>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GuestSignupModal;
