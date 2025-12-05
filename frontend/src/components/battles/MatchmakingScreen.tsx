/**
 * MatchmakingScreen Component
 *
 * Pre-battle screen for finding opponents.
 * Offers quick match with Pip (AI), random matchmaking, or SMS challenge.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoltIcon,
  UserGroupIcon,
  CpuChipIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import { api } from '@/services/api';

interface QueueStatus {
  inQueue: boolean;
  position: number;
  expiresAt: string | null;
}

interface MatchmakingScreenProps {
  isSearching: boolean;
  queueStatus: QueueStatus;
  isConnecting: boolean;
  onMatchWithPip: () => void;
  onFindRandomMatch: () => void;
  onLeaveQueue: () => void;
}

export function MatchmakingScreen({
  isSearching,
  queueStatus,
  isConnecting,
  onMatchWithPip,
  onFindRandomMatch,
  onLeaveQueue,
}: MatchmakingScreenProps) {
  const [selectedMode, setSelectedMode] = useState<'ai' | 'random' | null>(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendName, setFriendName] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState<{ inviteUrl: string } | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);

  const handleModeSelect = (mode: 'ai' | 'random') => {
    setSelectedMode(mode);
    if (mode === 'ai') {
      onMatchWithPip();
    } else {
      onFindRandomMatch();
    }
  };

  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      setSmsError('Please enter a phone number');
      return;
    }

    setIsSendingSms(true);
    setSmsError(null);

    try {
      const response = await api.post('/battles/invitations/send_sms/', {
        phone_number: phoneNumber,
        recipient_name: friendName,
      });

      setSmsSuccess({ inviteUrl: response.data.invite_url });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setSmsError(err.response?.data?.error || 'Failed to send SMS invitation');
    } finally {
      setIsSendingSms(false);
    }
  };

  const resetSmsModal = () => {
    setShowSmsModal(false);
    setPhoneNumber('');
    setFriendName('');
    setSmsSuccess(null);
    setSmsError(null);
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4 pb-16">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0) 70%)',
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 p-0.5">
              <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
                <BoltIcon className="w-10 h-10 text-cyan-400" />
              </div>
            </div>
          </motion.div>

          <h1 className="text-4xl font-bold text-white mb-2">
            Prompt <span className="text-gradient-cyan">Battles</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Challenge others to an AI image generation duel!
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {isSearching ? (
            /* Searching state */
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-8 text-center"
            >
              {/* Animated radar */}
              <div className="relative w-32 h-32 mx-auto mb-6">
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  >
                    <MagnifyingGlassIcon className="w-12 h-12 text-cyan-400" />
                  </motion.div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {selectedMode === 'ai' ? 'Connecting to Pip...' : 'Finding Opponent...'}
              </h2>

              {queueStatus.position > 0 && (
                <p className="text-slate-400 mb-4">
                  Position in queue: <span className="text-cyan-400 font-semibold">{queueStatus.position}</span>
                </p>
              )}

              <p className="text-slate-500 text-sm mb-6">
                {selectedMode === 'ai'
                  ? 'Pip is warming up for battle!'
                  : 'Looking for a worthy challenger...'}
              </p>

              <button
                onClick={onLeaveQueue}
                className="btn-secondary flex items-center gap-2 mx-auto"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </motion.div>
          ) : (
            /* Mode selection */
            <motion.div
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid md:grid-cols-3 gap-6"
            >
              {/* Battle Pip */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleModeSelect('ai')}
                disabled={isConnecting}
                className="glass-card p-6 text-left group cursor-pointer hover:border-violet-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-shadow">
                  <CpuChipIcon className="w-7 h-7 text-violet-400" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
                  Battle Pip
                </h3>

                <p className="text-slate-400 text-sm mb-4">
                  Challenge our AI companion. Perfect for practice!
                </p>

                <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                  <SparklesIcon className="w-4 h-4" />
                  <span>Instant Match</span>
                </div>
              </motion.button>

              {/* Random Match */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleModeSelect('random')}
                disabled={isConnecting}
                className="glass-card p-6 text-left group cursor-pointer hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-shadow">
                  <UserGroupIcon className="w-7 h-7 text-cyan-400" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  Random Match
                </h3>

                <p className="text-slate-400 text-sm mb-4">
                  Face off against another player in real-time!
                </p>

                <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                  <BoltIcon className="w-4 h-4" />
                  <span>Live PvP</span>
                </div>
              </motion.button>

              {/* Challenge a Friend */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSmsModal(true)}
                disabled={isConnecting}
                className="glass-card p-6 text-left group cursor-pointer hover:border-emerald-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-shadow">
                  <DevicePhoneMobileIcon className="w-7 h-7 text-emerald-400" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  Challenge a Friend
                </h3>

                <p className="text-slate-400 text-sm mb-4">
                  Send an SMS invite to battle anyone!
                </p>

                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <PaperAirplaneIcon className="w-4 h-4" />
                  <span>Text Invite</span>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works */}
        {!isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <h3 className="text-center text-slate-500 text-sm font-medium mb-6 tracking-wider uppercase">
              How It Works
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Match', desc: 'Find an opponent' },
                { step: '2', title: 'Create', desc: 'Write your prompt' },
                { step: '3', title: 'Battle', desc: 'AI judges the winner' },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-cyan-400 font-bold">{item.step}</span>
                  </div>
                  <h4 className="text-white font-medium text-sm">{item.title}</h4>
                  <p className="text-slate-500 text-xs">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* SMS Invitation Modal */}
      <AnimatePresence>
        {showSmsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && resetSmsModal()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 w-full max-w-md"
            >
              {smsSuccess ? (
                /* Success state */
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Challenge Sent!</h3>
                  <p className="text-slate-400 mb-6">
                    Your friend will receive an SMS with a link to accept the battle challenge.
                  </p>
                  <div className="bg-slate-800/50 rounded-lg p-3 mb-6">
                    <p className="text-xs text-slate-500 mb-1">Share this link:</p>
                    <p className="text-sm text-cyan-400 break-all">{smsSuccess.inviteUrl}</p>
                  </div>
                  <button onClick={resetSmsModal} className="btn-primary w-full">
                    Done
                  </button>
                </div>
              ) : (
                /* Form state */
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Challenge a Friend</h3>
                    <button
                      onClick={resetSmsModal}
                      className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <p className="text-slate-400 text-sm mb-6">
                    Enter your friend's phone number to send them a battle invitation via SMS.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Friend's Name <span className="text-slate-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={friendName}
                        onChange={(e) => setFriendName(e.target.value)}
                        placeholder="John"
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {smsError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{smsError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleSendSms}
                    disabled={isSendingSms || !phoneNumber.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingSms ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="w-5 h-5" />
                        Send Challenge
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MatchmakingScreen;
