/**
 * BattleInvitePage
 *
 * Handles SMS invitation links for prompt battles.
 * Shows invitation details and allows accepting the challenge.
 * Supports both authenticated users and guest users who can play without signing up.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserPlusIcon,
} from '@heroicons/react/24/solid';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

interface InvitationData {
  invitation_id: number;
  sender: {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  battle: {
    id: number;
    topic: string;
    challenge_type: string | null;
  };
  expires_at: string;
}

export function BattleInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAcceptingAsGuest, setIsAcceptingAsGuest] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) return;

      try {
        const response = await api.get(`/battles/invite/${token}/`);
        setInvitation(response.data);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Invitation not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token || !isAuthenticated) return;

    setIsAccepting(true);
    try {
      const response = await api.post(`/battles/invite/${token}/accept/`);
      // Navigate to the battle
      const battleId = response.data?.id;
      if (battleId) {
        navigate(`/battles/${battleId}`);
      } else {
        console.error('No battle ID in response:', response.data);
        setError('Failed to join battle - please try again');
        setIsAccepting(false);
      }
    } catch (err: unknown) {
      console.error('Accept invitation error:', err);
      const error = err as { response?: { data?: { error?: string; detail?: string }; status?: number } };
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || 'Failed to accept invitation';
      setError(errorMessage);
      setIsAccepting(false);
    }
  };

  const handleAcceptAsGuest = async () => {
    if (!token) return;

    setIsAcceptingAsGuest(true);
    try {
      // Accept as guest - backend creates guest user and sets auth cookies
      const response = await api.post(`/battles/invite/${token}/accept/`);

      // Refresh auth context to pick up the new guest user from cookies
      await refreshUser();

      // Navigate to the battle - the response contains the serialized battle
      const battleId = response.data?.id;
      if (battleId) {
        navigate(`/battles/${battleId}`);
      } else {
        console.error('No battle ID in response:', response.data);
        setError('Failed to join battle - please try again');
        setIsAcceptingAsGuest(false);
      }
    } catch (err: unknown) {
      console.error('Accept invitation error:', err);
      const error = err as { response?: { data?: { error?: string; detail?: string }; status?: number } };
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || 'Failed to accept invitation';
      setError(errorMessage);
      setIsAcceptingAsGuest(false);
    }
  };

  // Calculate time until expiry with guards for invalid dates
  const getTimeUntilExpiry = () => {
    if (!invitation?.expires_at) return 0;
    const expiryTime = new Date(invitation.expires_at).getTime();
    if (isNaN(expiryTime)) return 0;
    return Math.max(0, expiryTime - Date.now());
  };
  const timeUntilExpiry = getTimeUntilExpiry();
  const hoursLeft = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
  const hasValidExpiry = invitation?.expires_at && !isNaN(new Date(invitation.expires_at).getTime());

  if (isLoading || authLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full"
          />
        </div>
      </DashboardLayout>
    );
  }

  // Check error type for specific messaging
  const isExpiredError = error?.toLowerCase().includes('expired');
  const isCancelledError = error?.toLowerCase().includes('cancelled');

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-md text-center"
          >
            {isExpiredError ? (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <ClockIcon className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Challenge Expired</h2>
                <p className="text-slate-400 mb-4">
                  This battle invitation has expired. Battle links are only valid for 24 hours.
                </p>
                <p className="text-slate-500 text-sm mb-6">
                  Ask your friend to send you a new challenge link, or start your own battle and invite them!
                </p>
                <div className="space-y-3">
                  <button onClick={() => navigate('/battles')} className="btn-primary w-full">
                    Start a New Battle
                  </button>
                  <button
                    onClick={() => navigate('/explore')}
                    className="w-full px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Explore All Thrive
                  </button>
                </div>
              </>
            ) : isCancelledError ? (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-500/20 flex items-center justify-center mx-auto mb-4">
                  <XCircleIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Challenge Cancelled</h2>
                <p className="text-slate-400 mb-4">
                  The challenger has cancelled this battle invitation.
                </p>
                <p className="text-slate-500 text-sm mb-6">
                  They may have started a different battle or changed their mind. You can challenge them back or find another opponent!
                </p>
                <div className="space-y-3">
                  <button onClick={() => navigate('/battles')} className="btn-primary w-full">
                    Start Your Own Battle
                  </button>
                  <button
                    onClick={() => navigate('/explore')}
                    className="w-full px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Explore All Thrive
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <XCircleIcon className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Invitation Error</h2>
                <p className="text-slate-400 mb-6">{error}</p>
                <button onClick={() => navigate('/battles')} className="btn-primary">
                  Go to Battles
                </button>
              </>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invitation) return null;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
        {/* Background effect */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 70%)',
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="glass-card p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block mb-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-0.5">
                  <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
                    <BoltIcon className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>
              </motion.div>

              <h1 className="text-2xl font-bold text-white mb-2">Battle Challenge!</h1>
              <p className="text-slate-400">You've been challenged to a prompt battle</p>
            </div>

            {/* Challenger info */}
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-4">
                {invitation.sender.avatar_url ? (
                  <img
                    src={invitation.sender.avatar_url}
                    alt={invitation.sender.username}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <UserCircleIcon className="w-14 h-14 text-slate-600" />
                )}
                <div>
                  <p className="text-white font-semibold">
                    {invitation.sender.display_name || invitation.sender.username}
                  </p>
                  <p className="text-slate-400 text-sm">@{invitation.sender.username}</p>
                </div>
              </div>
            </div>

            {/* Battle details */}
            <div className="space-y-3 mb-6">
              {invitation.battle.challenge_type && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Challenge Type</span>
                  <span className="text-white font-medium">{invitation.battle.challenge_type}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Expires In</span>
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {hasValidExpiry ? `${hoursLeft}h ${minutesLeft}m` : '< 24h'}
                </span>
              </div>
            </div>

            {/* Actions */}
            {!isAuthenticated ? (
              <div className="space-y-4">
                {/* Question prompt */}
                <p className="text-center text-slate-300 font-medium">
                  Do you have an account?
                </p>

                {/* Sign in option - Primary for existing users */}
                <button
                  onClick={() => navigate(`/auth?redirect=/battle/invite/${token}`)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Sign In
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-slate-800 px-2 text-slate-500">or</span>
                  </div>
                </div>

                {/* Play as Guest option */}
                <button
                  onClick={handleAcceptAsGuest}
                  disabled={isAcceptingAsGuest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                >
                  {isAcceptingAsGuest ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-slate-400/30 border-t-slate-400 rounded-full"
                      />
                      Joining Battle...
                    </>
                  ) : (
                    <>
                      <BoltIcon className="w-5 h-5" />
                      Continue as Guest
                    </>
                  )}
                </button>

                <p className="text-center text-slate-500 text-xs">
                  You can create an account after the battle to save your progress
                </p>
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAccepting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Accept Challenge
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

export default BattleInvitePage;
