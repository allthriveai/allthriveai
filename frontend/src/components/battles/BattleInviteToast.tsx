/**
 * BattleInviteToast Component
 *
 * Toast notification for incoming battle invitations.
 * Shows challenger info and accept/decline buttons.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { BoltIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';
import type { BattleInvitation } from '@/hooks/useBattleNotifications';

interface BattleInviteToastProps {
  invitation: BattleInvitation;
  onAccept: (invitationId: number) => void;
  onDecline: (invitationId: number) => void;
  onDismiss: (invitationId: number) => void;
}

export function BattleInviteToast({
  invitation,
  onAccept,
  onDecline,
  onDismiss,
}: BattleInviteToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="glass-strong rounded-xl p-4 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 max-w-sm w-full"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
          <BoltIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            Battle Challenge!
          </p>
          <p className="text-gray-600 dark:text-slate-400 text-xs">
            {invitation.challenger.username} wants to battle you
          </p>
        </div>
        <button
          onClick={() => onDismiss(invitation.invitationId)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </button>
      </div>

      {/* Challenge Preview */}
      {invitation.challengePreview && (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-slate-800/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
            "{invitation.challengePreview}..."
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onDecline(invitation.invitationId)}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <XMarkIcon className="w-4 h-4" />
          Decline
        </button>
        <button
          onClick={() => onAccept(invitation.invitationId)}
          className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
        >
          <CheckIcon className="w-4 h-4" />
          Accept
        </button>
      </div>
    </motion.div>
  );
}

interface BattleInviteToastContainerProps {
  invitations: BattleInvitation[];
  onAccept: (invitationId: number) => void;
  onDecline: (invitationId: number) => void;
  onDismiss: (invitationId: number) => void;
}

export function BattleInviteToastContainer({
  invitations,
  onAccept,
  onDecline,
  onDismiss,
}: BattleInviteToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {invitations.map((invitation) => (
          <BattleInviteToast
            key={invitation.invitationId}
            invitation={invitation}
            onAccept={onAccept}
            onDecline={onDecline}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default BattleInviteToast;
