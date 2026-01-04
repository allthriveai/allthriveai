import { useState, useEffect, useCallback } from 'react';
import { getSmsOptInStatus, submitSmsOptIn, type SmsOptInStatus } from '@/services/notifications';
import { useAuth } from './useAuth';

interface UseSmsOptInReturn {
  showPrompt: boolean;
  status: SmsOptInStatus | null;
  isLoading: boolean;
  error: string | null;
  optIn: () => Promise<void>;
  dismiss: () => Promise<void>;
  remindLater: () => Promise<void>;
}

/**
 * Hook to manage SMS opt-in flow.
 *
 * Checks if user should see SMS opt-in prompt and provides
 * methods to handle opt-in, dismiss, or remind later actions.
 *
 * The prompt is shown when:
 * - User has been on platform for at least 3 minutes
 * - User has not already opted in (phone verified + SMS enabled)
 * - User has not dismissed the prompt
 * - Prompt was not shown in the last 24 hours
 */
export function useSmsOptIn(): UseSmsOptInReturn {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SmsOptInStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Fetch status when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setShowPrompt(false);
      setStatus(null);
      return;
    }

    let isMounted = true;

    async function fetchStatus() {
      if (!isMounted) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await getSmsOptInStatus();
        if (isMounted) {
          setStatus(data);
          setShowPrompt(data.showPrompt);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch SMS opt-in status:', err);
          setError(err?.message || 'Failed to check SMS opt-in status');
          setShowPrompt(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    // Check immediately - the API handles the 3-minute delay logic
    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user]);

  const optIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await submitSmsOptIn('opt_in');
      setShowPrompt(false);
      setStatus(prev => prev ? { ...prev, alreadyOptedIn: true, showPrompt: false } : null);
    } catch (err: any) {
      console.error('Failed to opt in to SMS:', err);
      setError(err?.message || 'Failed to opt in');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismiss = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await submitSmsOptIn('dismiss');
      setShowPrompt(false);
      setStatus(prev => prev ? { ...prev, showPrompt: false } : null);
    } catch (err: any) {
      console.error('Failed to dismiss SMS opt-in:', err);
      setError(err?.message || 'Failed to dismiss');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const remindLater = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await submitSmsOptIn('remind_later');
      setShowPrompt(false);
      setStatus(prev => prev ? { ...prev, showPrompt: false } : null);
    } catch (err: any) {
      console.error('Failed to set remind later:', err);
      setError(err?.message || 'Failed to set reminder');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    showPrompt,
    status,
    isLoading,
    error,
    optIn,
    dismiss,
    remindLater,
  };
}
