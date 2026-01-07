/**
 * MatchmakingScreen Component
 *
 * Pre-battle screen for finding opponents.
 * Two primary options: Battle Pip (AI) or Battle a Friend.
 * Human battle opens modal with SMS invite or random match options.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@heroicons/react/24/solid';

const PIP_AVATAR_VIDEO = '/pip-moving-avatar.mp4';
import { api } from '@/services/api';
import { clearStoredPendingBattle } from '@/utils/battleStorage';
import { useAuth } from '@/hooks/useAuth';
import { setGuestBattleId } from '@/routes/ProtectedRoute';

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
  initialOpenHumanModal?: boolean;
}

export function MatchmakingScreen({
  isSearching,
  queueStatus,
  isConnecting,
  onMatchWithPip,
  onFindRandomMatch: _onFindRandomMatch,
  onLeaveQueue,
  initialOpenHumanModal = false,
}: MatchmakingScreenProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [selectedMode, setSelectedMode] = useState<'ai' | 'random' | null>(null);
  const [isStartingGuestBattle, setIsStartingGuestBattle] = useState(false);
  const [showHumanModal, setShowHumanModal] = useState(initialOpenHumanModal);
  const [modalView, setModalView] = useState<'options' | 'sms' | 'link'>('options');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendName, setFriendName] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState<{ inviteUrl: string; battleId?: number } | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedBattleId, setGeneratedBattleId] = useState<number | null>(null);
  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
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

  const handleBattlePip = async () => {
    // If user is authenticated, use normal WebSocket matchmaking
    if (isAuthenticated) {
      setSelectedMode('ai');
      onMatchWithPip();
      return;
    }

    // Guest flow: create guest user and battle via REST API
    setIsStartingGuestBattle(true);
    setSelectedMode('ai');

    try {
      const response = await api.post('/battles/guest/start-pip/');
      const battleId = response.data.id;

      // Refresh auth context to pick up the new guest user from cookies
      await refreshUser();

      // Store battle ID so guest can return to it later
      if (battleId) {
        setGuestBattleId(battleId);
        navigate(`/play/prompt-battles/${battleId}`);
      }
    } catch (error) {
      console.error('Failed to start guest battle:', error);
      setSelectedMode(null);
      // TODO: Show error toast
    } finally {
      setIsStartingGuestBattle(false);
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

      const battleId = response.data.invitation?.battle_id || response.data.invitation?.battle?.id;
      setSmsSuccess({ inviteUrl: response.data.invite_url, battleId });
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
      const link = response.data.inviteUrl || response.data.invite_url;
      setGeneratedLink(link);
      // Get battle ID from the response (API returns invitation.battle as the ID)
      const battleId = response.data.invitation?.battle || response.data.invitation?.battleData?.id;
      if (battleId) {
        setGeneratedBattleId(battleId);
      }
      // Get challenge type from the response
      const battleData = response.data.invitation?.battleData;
      const challengeTypeName = battleData?.challengeTypeName || null;
      if (challengeTypeName) {
        setChallengeType(challengeTypeName);
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
    if (!generatedLink) {
      console.warn('[MatchmakingScreen] handleCopyMessage: No generated link');
      return;
    }

    const message = getShareMessage();
    let copied = false;

    // Try modern clipboard API first (localhost is considered secure context)
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        copied = true;
      } catch (err) {
        console.warn('[MatchmakingScreen] Clipboard API failed, using fallback:', err);
      }
    }

    // Fallback for older browsers or when clipboard API fails
    if (!copied) {
      const textArea = document.createElement('textarea');
      textArea.value = message;
      // Position off-screen to avoid visual flicker
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        copied = document.execCommand('copy');
      } catch (err) {
        console.error('[MatchmakingScreen] Failed to copy to clipboard:', err);
      }
      document.body.removeChild(textArea);
    }

    if (copied) {
      setMessageCopied(true);
      // For async battles, clear any stored pending battle and go to battle page
      // Sender can fill out their prompt while waiting for opponent to accept
      clearStoredPendingBattle();
      // Close modal after brief delay to show "Copied!" feedback
      setTimeout(() => {
        setShowHumanModal(false);
        setModalView('options');
        setGeneratedLink(null);
        setGeneratedBattleId(null);
        setChallengeType(null);
        setMessageCopied(false);
        // Navigate to battle page so sender can fill out their prompt
        if (generatedBattleId) {
          navigate(`/play/prompt-battles/${generatedBattleId}`);
        }
      }, 800);
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
    setGeneratedBattleId(null);
    setChallengeType(null);
    setLinkError(null);
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
          <p className="text-gray-600 dark:text-slate-400 text-lg max-w-md mx-auto">
            Go head-to-head writing prompts to generate AI images. An AI judge picks the winner based on creativity, clarity, and how well your image matches the prompt challenge!
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
                disabled={isConnecting || isStartingGuestBattle}
                className="glass-card p-8 text-center group cursor-pointer hover:border-violet-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 overflow-hidden mb-5 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-shadow mx-auto">
                  <video
                    src={PIP_AVATAR_VIDEO}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                  {isStartingGuestBattle ? 'Starting Battle...' : 'Battle Pip'}
                </h3>

                <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
                  Challenge our AI companion. Perfect for practice and honing your prompting skills!
                </p>

                <div className="flex items-center justify-center gap-2 text-violet-400 text-sm font-medium">
                  {isStartingGuestBattle ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full"
                    />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                  <span>{isStartingGuestBattle ? 'Setting up...' : 'Instant Match'}</span>
                </div>
              </motion.button>

              {/* Battle a Friend */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!isAuthenticated) {
                    // Redirect to sign up with return URL
                    navigate(`/auth?next=${encodeURIComponent('/play/prompt-battles?openHumanModal=true')}`);
                    return;
                  }
                  setShowHumanModal(true);
                }}
                disabled={isConnecting || isStartingGuestBattle}
                className="glass-card p-8 text-center group cursor-pointer hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-5 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-shadow mx-auto">
                  <UserGroupIcon className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  Battle a Friend
                </h3>

                <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
                  Challenge a friend or match with a random All Thrive member in real-time!
                </p>

                <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-medium">
                  <BoltIcon className="w-4 h-4" />
                  <span>{isAuthenticated ? 'Live PvP' : 'Sign in to play'}</span>
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
                      <h3 id="battle-human-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Battle a Friend</h3>
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
                      {/* Challenge a Friend via SMS - Coming Soon */}
                      <div
                        className="w-full p-5 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-left opacity-60 cursor-not-allowed"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <DevicePhoneMobileIcon className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                Send SMS Invite
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                                Coming Soon
                              </span>
                            </div>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              Send an SMS invite to battle anyone you know
                            </p>
                          </div>
                        </div>
                      </div>

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

                      {/* Find Random Opponent - Coming Soon */}
                      <div
                        className="w-full p-5 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-left opacity-60 cursor-not-allowed"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                            <GlobeAltIcon className="w-6 h-6 text-cyan-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                Find an Opponent
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                                Coming Soon
                              </span>
                            </div>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              Match with a random All Thrive member
                            </p>
                          </div>
                        </div>
                      </div>
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

                        {/* Shareable message box - Tappable to copy */}
                        <motion.button
                          onClick={handleCopyMessage}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left bg-gray-100 dark:bg-slate-800/50 border-2 rounded-xl p-4 mb-4 transition-all cursor-pointer group ${
                            messageCopied
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-gray-200 dark:border-slate-700 hover:border-pink-500/50 active:border-pink-500'
                          }`}
                        >
                          {/* Tap to copy hint */}
                          <div className={`flex items-center justify-center gap-1.5 mb-2 text-xs font-medium transition-colors ${
                            messageCopied
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500 dark:text-slate-500 group-hover:text-pink-500'
                          }`}>
                            {messageCopied ? (
                              <>
                                <CheckCircleIcon className="w-4 h-4" />
                                Prompt Battle Activated!
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="w-4 h-4" />
                                Click to copy message
                              </>
                            )}
                          </div>
                          <p className="text-gray-800 dark:text-slate-200 text-sm whitespace-pre-wrap break-all">
                            {getShareMessage()}
                          </p>
                        </motion.button>

                        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
                          You'll be notified when your friend accepts.
                          <br />
                          <span className="text-amber-500">This link expires in 24 hours.</span>
                        </p>

                        {/* View My Battles button */}
                        <button
                          type="button"
                          onClick={() => {
                            resetModal();
                            if (user?.username) {
                              navigate(`/${user.username}?tab=my-battles`);
                            }
                          }}
                          className="btn-secondary w-full"
                        >
                          View My Battles
                        </button>
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

                    {/* SMS Opt-in Compliance Notice */}
                    <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                        By clicking "Send Challenge", you confirm you have consent to send this person a one-time SMS battle invitation from All Thrive.
                        They will receive a single message with a link to accept.
                        Reply STOP to opt out. Message & data rates may apply.
                      </p>
                    </div>

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
