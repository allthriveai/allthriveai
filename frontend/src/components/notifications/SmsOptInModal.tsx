import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMobileAlt, faBell, faTrophy, faFire, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

interface SmsOptInModalProps {
  isOpen: boolean;
  onOptIn: () => Promise<void>;
  onDismiss: () => Promise<void>;
  onRemindLater: () => Promise<void>;
}

/**
 * Modal that prompts users to opt-in to SMS notifications.
 *
 * Features:
 * - Clean, focused UI with clear value proposition
 * - Three actions: Enable, Remind Later, No Thanks
 * - Links to settings for phone number management
 * - TCPA-compliant disclosure about message rates
 */
export function SmsOptInModal({
  isOpen,
  onOptIn,
  onDismiss,
  onRemindLater,
}: SmsOptInModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'optIn' | 'dismiss' | 'remind' | null>(null);

  const handleOptIn = async () => {
    try {
      setIsLoading(true);
      setLoadingAction('optIn');
      await onOptIn();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleDismiss = async () => {
    try {
      setIsLoading(true);
      setLoadingAction('dismiss');
      await onDismiss();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleRemindLater = async () => {
    try {
      setIsLoading(true);
      setLoadingAction('remind');
      await onRemindLater();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleRemindLater} title="">
      <div className="text-center pb-2">
        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faMobileAlt} className="text-white text-2xl" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-3">
          Never Miss a Battle
        </h2>

        {/* Description */}
        <p className="text-slate-400 mb-6">
          Get text notifications for battle invitations, results, and streak alerts so you never miss the action.
        </p>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 glass-subtle rounded-lg">
            <FontAwesomeIcon icon={faTrophy} className="text-amber-400 mb-2" />
            <p className="text-xs text-slate-400">Battle Invites</p>
          </div>
          <div className="p-3 glass-subtle rounded-lg">
            <FontAwesomeIcon icon={faBell} className="text-cyan-400 mb-2" />
            <p className="text-xs text-slate-400">Results</p>
          </div>
          <div className="p-3 glass-subtle rounded-lg">
            <FontAwesomeIcon icon={faFire} className="text-orange-400 mb-2" />
            <p className="text-xs text-slate-400">Streak Alerts</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleOptIn}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25"
          >
            {loadingAction === 'optIn' ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                Enabling...
              </>
            ) : (
              'Enable SMS Notifications'
            )}
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleRemindLater}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAction === 'remind' ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                'Remind Me Later'
              )}
            </button>
            <button
              onClick={handleDismiss}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-slate-500 hover:text-slate-400 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAction === 'dismiss' ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                'No Thanks'
              )}
            </button>
          </div>
        </div>

        {/* Settings link and disclosure */}
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-2">
            You can manage your phone number and preferences in{' '}
            <Link
              to="/account/settings/notifications"
              className="text-primary-400 hover:text-primary-300"
              onClick={handleRemindLater}
            >
              notification settings
            </Link>
            .
          </p>
          <p className="text-xs text-slate-600">
            Message & data rates may apply. Reply STOP to unsubscribe.
          </p>
        </div>
      </div>
    </Modal>
  );
}
