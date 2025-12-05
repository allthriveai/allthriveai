/**
 * BattleInvitePage
 *
 * Handles SMS invitation links for prompt battles.
 * Shows invitation details and allows accepting the challenge.
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

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
      navigate(`/battles/${response.data.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to accept invitation');
      setIsAccepting(false);
    }
  };

  const timeUntilExpiry = invitation
    ? Math.max(0, new Date(invitation.expires_at).getTime() - Date.now())
    : 0;
  const hoursLeft = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));

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

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-md text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invitation Error</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <button onClick={() => navigate('/battles')} className="btn-primary">
              Go to Battles
            </button>
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
                  {hoursLeft}h {minutesLeft}m
                </span>
              </div>
            </div>

            {/* Actions */}
            {!isAuthenticated ? (
              <div className="space-y-4">
                <p className="text-center text-slate-400 text-sm">
                  Sign in or create an account to accept this challenge
                </p>
                <button
                  onClick={() => navigate(`/auth?redirect=/battle/invite/${token}`)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Sign In to Accept
                </button>
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
