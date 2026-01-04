/**
 * Stripe Connect Button
 *
 * Button component for creator Stripe Connect onboarding.
 * Shows current status and handles onboarding flow.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import {
  startStripeOnboarding,
  getStripeConnectStatus,
  getStripeDashboardLink,
  type StripeConnectStatus,
} from '@/services/marketplace';

/** Platform fee percentage (AllThrive takes 8%, creator receives 92%) */
export const PLATFORM_FEE_PERCENT = 8;
export const CREATOR_PAYOUT_PERCENT = 100 - PLATFORM_FEE_PERCENT;

interface StripeConnectButtonProps {
  onStatusChange?: (status: StripeConnectStatus) => void;
}

export function StripeConnectButton({ onStatusChange }: StripeConnectButtonProps) {
  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: getStripeConnectStatus,
    refetchOnWindowFocus: true, // Refetch when user returns from Stripe
  });

  // Notify parent when status changes (React Query v5 compatible)
  useEffect(() => {
    if (status) {
      onStatusChange?.(status);
    }
  }, [status, onStatusChange]);

  // Start onboarding mutation
  const onboardMutation = useMutation({
    mutationFn: () => startStripeOnboarding(),
    onSuccess: (data) => {
      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to start onboarding');
    },
  });

  // Get dashboard link mutation
  const dashboardMutation = useMutation({
    mutationFn: getStripeDashboardLink,
    onSuccess: (url) => {
      // Open dashboard in new tab
      window.open(url, '_blank');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to open dashboard');
    },
  });

  const handleStartOnboarding = () => {
    setError(null);
    onboardMutation.mutate();
  };

  const handleOpenDashboard = () => {
    setError(null);
    dashboardMutation.mutate();
  };

  const handleRefreshStatus = () => {
    setError(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--neon-cyan)] border-t-transparent"></div>
        <span>Checking payment setup...</span>
      </div>
    );
  }

  // Fully onboarded
  if (status?.isOnboarded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircleIcon className="w-6 h-6" />
          <span className="font-medium">Payment setup complete</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          You can accept payments and receive payouts. Stripe will deposit your earnings to your linked bank account.
        </p>
        <button
          onClick={handleOpenDashboard}
          disabled={dashboardMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--glass-fill-subtle)]"
          style={{
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          {dashboardMutation.isPending ? 'Opening...' : 'View Stripe Dashboard'}
        </button>
      </div>
    );
  }

  // Pending - details submitted but not yet verified
  if (status?.detailsSubmitted && !status?.isOnboarded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-yellow-400">
          <ExclamationCircleIcon className="w-6 h-6" />
          <span className="font-medium">Verification pending</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Your information is being verified by Stripe. This usually takes a few minutes but can take up to 24 hours.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshStatus}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--glass-fill-subtle)]"
            style={{
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            Check Status
          </button>
          <button
            onClick={handleStartOnboarding}
            disabled={onboardMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--glass-fill-subtle)]"
            style={{
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            Complete Missing Info
          </button>
        </div>
      </div>
    );
  }

  // Not started
  return (
    <div className="space-y-4">
      <p className="text-[var(--text-secondary)]">
        To sell products on All Thrive, you need to set up payment processing through Stripe.
        This allows you to receive {CREATOR_PAYOUT_PERCENT}% of each sale directly to your bank account.
      </p>
      <div className="p-4 rounded-lg bg-[var(--glass-fill-subtle)]">
        <h4 className="font-medium text-[var(--text-primary)] mb-2">What you'll need:</h4>
        <ul className="text-sm text-[var(--text-secondary)] space-y-1">
          <li>- Valid ID (passport or driver's license)</li>
          <li>- Bank account for payouts</li>
          <li>- Tax information (SSN for US residents)</li>
        </ul>
      </div>
      <button
        onClick={handleStartOnboarding}
        disabled={onboardMutation.isPending}
        className="w-full py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-50"
        style={{
          background: 'var(--gradient-primary)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-neon)',
        }}
      >
        {onboardMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            Setting up...
          </span>
        ) : (
          'Set Up Payments with Stripe'
        )}
      </button>
      {error && (
        <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
