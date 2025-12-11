/**
 * MatchmakingScreen Component
 *
 * Pre-battle screen for finding opponents.
 * Two primary options: Battle Pip (AI) or Battle a Human.
 * Human battle opens modal with SMS invite or random match options.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoltIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/solid';

const PIP_AVATAR_URL = '/chatbot-chat.webp';
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
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [modalView, setModalView] = useState<'options' | 'sms' | 'link'>('options');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendName, setFriendName] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState<{ inviteUrl: string } | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  // Accessibility: refs and state for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showHumanModal) {
      resetModal();
    }
  }, [showHumanModal]);

  // Focus trap and keyboard handler for modal
  useEffect(() => {
    if (showHumanModal) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Add ESC key listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Restore focus when modal closes
        previousActiveElement.current?.focus();
      };
    }
  }, [showHumanModal, handleKeyDown]);

  const handleBattlePip = () => {
    setSelectedMode('ai');
    onMatchWithPip();
  };

  const handleFindOpponent = () => {
    setSelectedMode('random');
    setShowHumanModal(false);
    onFindRandomMatch();
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

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    setLinkError(null);

    try {
      const response = await api.post('/battles/invitations/generate-link/');
      setGeneratedLink(response.data.inviteUrl || response.data.invite_url);
      // Get challenge type from the response
      const battleData = response.data.invitation?.battle_data;
      if (battleData?.challenge_type_name) {
        setChallengeType(battleData.challenge_type_name);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setLinkError(err.response?.data?.error || 'Failed to generate link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Generate the shareable message
  const getShareMessage = () => {
    const challengeText = challengeType ? ` Can you beat me at "${challengeType}"?` : '';
    return `I challenge you to a Prompt Battle!${challengeText} Accept my challenge:\n${generatedLink}`;
  };

  const handleCopyMessage = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(getShareMessage());
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = getShareMessage();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const resetModal = () => {
    setShowHumanModal(false);
    setModalView('options');
    setPhoneNumber('');
    setFriendName('');
    setSmsSuccess(null);
    setSmsError(null);
    setGeneratedLink(null);
    setChallengeType(null);
    setLinkError(null);
    setLinkCopied(false);
    setMessageCopied(false);
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

      <div className="relative z-10 w-full max-w-xl">
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
            <div
              className="w-20 h-20 rounded-2xl p-0.5"
              style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
            >
              <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center">
                <BoltIcon
                  className="w-10 h-10"
                  style={{ color: '#a855f7' }}
                />
              </div>
            </div>
          </motion.div>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Prompt{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
            >
              Battles
            </span>
          </h1>
          <p className="text-gray-600 dark:text-slate-400 text-lg">
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
              role="status"
              aria-live="polite"
              aria-label={selectedMode === 'ai' ? 'Connecting to Pip' : 'Finding opponent'}
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

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {selectedMode === 'ai' ? 'Connecting to Pip...' : 'Finding Opponent...'}
              </h2>

              {queueStatus.position > 0 && (
                <p className="text-gray-600 dark:text-slate-400 mb-4">
                  Position in queue: <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{queueStatus.position}</span>
                </p>
              )}

              <p className="text-gray-500 dark:text-slate-500 text-sm mb-6">
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
            /* Mode selection - Two cards only */
            <motion.div
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Battle Pip */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBattlePip}
                disabled={isConnecting}
                className="glass-card p-8 text-center group cursor-pointer hover:border-violet-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 overflow-hidden mb-5 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-shadow mx-auto">
                  <img src={PIP_AVATAR_URL} alt="Pip" className="w-full h-full object-cover" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                  Battle Pip
                </h3>

                <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
                  Challenge our AI companion. Perfect for practice and honing your prompting skills!
                </p>

                <div className="flex items-center justify-center gap-2 text-violet-400 text-sm font-medium">
                  <SparklesIcon className="w-4 h-4" />
                  <span>Instant Match</span>
                </div>
              </motion.button>

              {/* Battle a Human */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowHumanModal(true)}
                disabled={isConnecting}
                className="glass-card p-8 text-center group cursor-pointer hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-5 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-shadow mx-auto">
                  <UserGroupIcon className="w-8 h-8 text-cyan-400" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  Battle a Human
                </h3>

                <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
                  Challenge a friend or match with a random AllThrive member in real-time!
                </p>

                <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-medium">
                  <BoltIcon className="w-4 h-4" />
                  <span>Live PvP</span>
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
            <h3 className="text-center text-gray-500 dark:text-slate-500 text-sm font-medium mb-6 tracking-wider uppercase">
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
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">{item.step}</span>
                  </div>
                  <h4 className="text-gray-900 dark:text-white font-medium text-sm">{item.title}</h4>
                  <p className="text-gray-500 dark:text-slate-500 text-xs">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Battle Human Modal */}
      <AnimatePresence>
        {showHumanModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && resetModal()}
            role="presentation"
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 w-full max-w-md"
              role="dialog"
              aria-modal="true"
              aria-labelledby="battle-human-modal-title"
              tabIndex={-1}
            >
              <AnimatePresence mode="wait">
                {smsSuccess ? (
                  /* SMS Success state */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Challenge Sent!</h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">
                      Your friend will receive an SMS with a link to accept the battle challenge.
                    </p>
                    <div className="bg-gray-100 dark:bg-slate-800/50 rounded-lg p-3 mb-6">
                      <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Share this link:</p>
                      <p className="text-sm text-cyan-600 dark:text-cyan-400 break-all">{smsSuccess.inviteUrl}</p>
                    </div>
                    <button onClick={resetModal} className="btn-primary w-full">
                      Done
                    </button>
                  </motion.div>
                ) : modalView === 'options' ? (
                  /* Options view - Choose SMS or Find Random */
                  <motion.div
                    key="options"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 id="battle-human-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Battle a Human</h3>
                      <button
                        onClick={resetModal}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        aria-label="Close modal"
                      >
                        <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" aria-hidden="true" />
                      </button>
                    </div>

                    <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
                      Choose how you want to find your opponent:
                    </p>

                    <div className="space-y-4">
                      {/* Challenge a Friend via SMS */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setModalView('sms')}
                        className="w-full p-5 bg-gray-100 dark:bg-slate-800/50 hover:bg-gray-200 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-shadow">
                            <DevicePhoneMobileIcon className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                              Send SMS Invite
                            </h4>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              Send an SMS invite to battle anyone you know
                            </p>
                          </div>
                        </div>
                      </motion.button>

                      {/* Share a Link */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setModalView('link');
                          handleGenerateLink();
                        }}
                        className="w-full p-5 bg-gray-100 dark:bg-slate-800/50 hover:bg-gray-200 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-pink-500/50 rounded-xl text-left transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_20px_rgba(236,72,153,0.2)] transition-shadow">
                            <LinkIcon className="w-6 h-6 text-pink-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-pink-600 dark:group-hover:text-pink-300 transition-colors">
                              Share a Link
                            </h4>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              Get a link to share via WhatsApp, iMessage, or anywhere
                            </p>
                          </div>
                        </div>
                      </motion.button>

                      {/* Find Random Opponent */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleFindOpponent}
                        className="w-full p-5 bg-gray-100 dark:bg-slate-800/50 hover:bg-gray-200 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-shadow">
                            <GlobeAltIcon className="w-6 h-6 text-cyan-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                              Find an Opponent
                            </h4>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              Match with a random AllThrive member
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                ) : modalView === 'link' ? (
                  /* Share Link view */
                  <motion.div
                    key="link-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setModalView('options');
                            setGeneratedLink(null);
                            setLinkError(null);
                          }}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          aria-label="Go back to options"
                        >
                          <svg className="w-5 h-5 text-gray-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Battle Link</h3>
                      </div>
                      <button
                        onClick={resetModal}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        aria-label="Close modal"
                      >
                        <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" aria-hidden="true" />
                      </button>
                    </div>

                    {isGeneratingLink ? (
                      <div className="text-center py-8">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-12 h-12 border-3 border-pink-500/30 border-t-pink-500 rounded-full mx-auto mb-4"
                        />
                        <p className="text-gray-600 dark:text-slate-400">Generating your battle link...</p>
                      </div>
                    ) : linkError ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                          <XMarkIcon className="w-8 h-8 text-red-400" />
                        </div>
                        <p className="text-red-400 mb-4">{linkError}</p>
                        <button
                          onClick={handleGenerateLink}
                          className="btn-secondary"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : generatedLink ? (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                          <BoltIcon className="w-8 h-8 text-pink-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Your Battle Challenge is Ready!
                        </h4>
                        <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
                          Copy the message below and send it to challenge a friend
                        </p>

                        {/* Shareable message box */}
                        <div className="bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4 text-left">
                          <p className="text-gray-800 dark:text-slate-200 text-sm whitespace-pre-wrap">
                            {getShareMessage()}
                          </p>
                        </div>

                        {/* Copy Message button - Primary */}
                        <button
                          onClick={handleCopyMessage}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-violet-500 text-white font-medium hover:from-pink-600 hover:to-violet-600 transition-all mb-3"
                        >
                          {messageCopied ? (
                            <>
                              <ClipboardDocumentCheckIcon className="w-5 h-5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <ClipboardDocumentIcon className="w-5 h-5" />
                              Copy Message to Share
                            </>
                          )}
                        </button>

                        {/* Copy just the link - Secondary */}
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          {linkCopied ? (
                            <>
                              <LinkIcon className="w-4 h-4" />
                              Link copied!
                            </>
                          ) : (
                            <>
                              <LinkIcon className="w-4 h-4" />
                              Copy link only
                            </>
                          )}
                        </button>

                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-4">
                          You'll be notified when your friend accepts the challenge.
                          <br />
                          <span className="text-amber-500">This link expires in 24 hours.</span>
                        </p>
                      </div>
                    ) : null}
                  </motion.div>
                ) : (
                  /* SMS Form view */
                  <motion.div
                    key="sms-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setModalView('options')}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          aria-label="Go back to options"
                        >
                          <svg className="w-5 h-5 text-gray-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h3 id="battle-human-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Send SMS Invite</h3>
                      </div>
                      <button
                        onClick={resetModal}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        aria-label="Close modal"
                      >
                        <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" aria-hidden="true" />
                      </button>
                    </div>

                    <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
                      Enter your friend's phone number to send them a battle invitation via SMS.
                    </p>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Friend's Name <span className="text-gray-500 dark:text-slate-500">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={friendName}
                          onChange={(e) => setFriendName(e.target.value)}
                          placeholder="John"
                          className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MatchmakingScreen;
