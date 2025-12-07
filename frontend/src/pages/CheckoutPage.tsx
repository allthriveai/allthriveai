/**
 * Checkout Page
 *
 * Dedicated page for completing subscription payments.
 * Accessed from pricing page when user clicks "Upgrade Now"
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { StripePaymentForm } from '@/components/billing/StripePaymentForm';
import { getSubscriptionTiers, getSubscriptionStatus, createSubscription } from '@/services/billing';
import { ArrowLeftIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tierSlug = searchParams.get('tier');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch tiers to get tier details
  const { data: tiers } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: getSubscriptionTiers,
  });

  // Fetch current subscription status
  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: () => {
      if (!tierSlug) throw new Error('No tier selected');
      return createSubscription(tierSlug, billingInterval);
    },
    onSuccess: (data) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setError(null);
      } else {
        console.error('[Checkout] No clientSecret in response:', data);
        setError('Payment initialization failed: No client secret received. The subscription may already exist.');
      }
    },
    onError: (err: any) => {
      console.error('[Checkout] Subscription creation failed:', err);
      // Extract error message from various response formats
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.error ||
        err?.message ||
        'Failed to initialize payment. Please try again.';
      setError(errorMessage);
    },
  });

  // Get selected tier details
  const selectedTier = tiers?.find(t => t.slug === tierSlug);

  // Redirect if no tier selected or tier not found
  useEffect(() => {
    if (!tierSlug) {
      navigate('/pricing');
      return;
    }

    if (tiers && !selectedTier) {
      navigate('/pricing');
      return;
    }

    // Check if user already has this subscription
    if (subscriptionStatus?.tierSlug === tierSlug && subscriptionStatus?.hasActiveSubscription) {
      setError('You already have an active subscription to this plan.');
      return;
    }

    // Auto-create subscription when page loads (wait for subscriptionStatus to load first)
    if (selectedTier && !clientSecret && !createSubscriptionMutation.isPending && !error && subscriptionStatus !== undefined) {
      createSubscriptionMutation.mutate();
    }
  }, [tierSlug, tiers, selectedTier, subscriptionStatus, clientSecret, error]);

  const handlePaymentSuccess = async () => {
    // Poll for subscription activation
    const maxAttempts = 10;
    const pollInterval = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        const status = await getSubscriptionStatus();

        if (status.hasActiveSubscription && status.subscriptionStatus === 'active') {
          navigate('/account/billing?success=true');
          return;
        }
      } catch (_err) {
        // Continue polling on error
      }
    }

    // Timeout - show message but still redirect
    navigate('/account/billing?success=pending');
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (!tierSlug || !selectedTier) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-[var(--text-secondary)] mb-4">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO
        title={`Checkout - ${selectedTier.name} - AllThrive AI`}
        description={`Complete your subscription to ${selectedTier.name}`}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-2 mb-6 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to pricing
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] bg-clip-text text-transparent mb-2">
              Complete Your Subscription
            </h1>
            <p className="text-[var(--text-secondary)]">
              Subscribe to <span className="font-semibold text-[var(--text-primary)]">{selectedTier.name}</span>
            </p>
          </div>

          {/* Main Content Card */}
          <div
            className="rounded-lg p-8 mb-6"
            style={{
              background: 'var(--glass-fill)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-neon)',
            }}
          >
            {/* Plan Summary */}
            <div className="mb-8 pb-8 border-b border-[var(--glass-border)]">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Your Plan
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                    {selectedTier.name}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {selectedTier.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[var(--text-primary)]">
                    ${billingInterval === 'annual'
                      ? (selectedTier.priceAnnual / 12).toFixed(2)
                      : selectedTier.priceMonthly}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    per month
                  </div>
                  {billingInterval === 'annual' && (
                    <div className="text-xs text-[var(--neon-green)] mt-1">
                      Billed ${selectedTier.priceAnnual}/year
                    </div>
                  )}
                </div>
              </div>

              {/* Billing Interval Toggle */}
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-4 py-2 rounded-md transition-all ${
                    billingInterval === 'monthly'
                      ? 'bg-[var(--neon-cyan)] text-white'
                      : 'bg-[var(--glass-fill-subtle)] text-[var(--text-secondary)] hover:bg-[var(--glass-fill)]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('annual')}
                  className={`px-4 py-2 rounded-md transition-all ${
                    billingInterval === 'annual'
                      ? 'bg-[var(--neon-cyan)] text-white'
                      : 'bg-[var(--glass-fill-subtle)] text-[var(--text-secondary)] hover:bg-[var(--glass-fill)]'
                  }`}
                >
                  Annual <span className="text-xs">(Save 15%)</span>
                </button>
              </div>
            </div>

            {/* Payment Form */}
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                Payment Details
              </h2>

              {clientSecret ? (
                <StripePaymentForm
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              ) : createSubscriptionMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--neon-cyan)] border-t-transparent mb-4"></div>
                  <p className="text-[var(--text-secondary)]">Initializing payment...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <button
                    onClick={() => createSubscriptionMutation.mutate()}
                    className="px-6 py-3 rounded-lg font-semibold transition-all"
                    style={{
                      background: 'var(--gradient-primary)',
                      boxShadow: 'var(--shadow-neon)',
                    }}
                  >
                    Continue to Payment
                  </button>
                </div>
              )}
            </div>

            {/* Error State UI */}
            {error && (
              <div className="mt-6 rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
                {/* Error scenarios with friendly UI */}
                {/* Detect various "already subscribed" messages - check if they already have THIS tier */}
                {((error.toLowerCase().includes('already') &&
                  (error.toLowerCase().includes('subscription') || error.toLowerCase().includes('subscribed'))) ||
                 error.toLowerCase().includes('active subscription') ||
                 (error.toLowerCase().includes('cancel') && error.toLowerCase().includes('subscription')) ||
                 (subscriptionStatus?.hasActiveSubscription && subscriptionStatus?.tierSlug === tierSlug)) ? (
                  // Already subscribed - show success-like state
                  <div className="p-6 text-center bg-gradient-to-br from-green-500/10 to-emerald-500/10">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-4 text-[var(--neon-green)]" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      You're Already Subscribed!
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                      Great news - you already have an active {selectedTier.name} subscription.
                      You can manage your subscription from your billing settings.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => navigate('/account/billing')}
                        className="px-5 py-2.5 rounded-lg font-medium text-white transition-all"
                        style={{ background: 'var(--gradient-primary)' }}
                      >
                        View Billing Settings
                      </button>
                      <button
                        onClick={() => navigate('/pricing')}
                        className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                        style={{ background: 'var(--glass-fill-subtle)' }}
                      >
                        See Other Plans
                      </button>
                    </div>
                  </div>
                ) : error.includes('client secret') || error.includes('initialization failed') ? (
                  // Payment initialization failed - offer retry
                  <div className="p-6 text-center bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                    <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Payment Setup Issue
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                      We couldn't set up the payment form. This might be a temporary issue.
                      Please try again or contact support if the problem persists.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          setError(null);
                          setClientSecret(null);
                          createSubscriptionMutation.reset();
                          createSubscriptionMutation.mutate();
                        }}
                        disabled={createSubscriptionMutation.isPending}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--gradient-primary)' }}
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${createSubscriptionMutation.isPending ? 'animate-spin' : ''}`} />
                        {createSubscriptionMutation.isPending ? 'Retrying...' : 'Try Again'}
                      </button>
                      <button
                        onClick={() => navigate('/account/billing')}
                        className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                        style={{ background: 'var(--glass-fill-subtle)' }}
                      >
                        Check Billing
                      </button>
                    </div>
                  </div>
                ) : (
                  // Generic error - show message with retry
                  <div className="p-6 text-center bg-gradient-to-br from-red-500/10 to-rose-500/10">
                    <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4 text-red-400" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      Something Went Wrong
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-2 max-w-sm mx-auto">
                      {error}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mb-6">
                      If this continues, please contact support.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          setError(null);
                          setClientSecret(null);
                          createSubscriptionMutation.reset();
                          createSubscriptionMutation.mutate();
                        }}
                        disabled={createSubscriptionMutation.isPending}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--gradient-primary)' }}
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${createSubscriptionMutation.isPending ? 'animate-spin' : ''}`} />
                        {createSubscriptionMutation.isPending ? 'Retrying...' : 'Try Again'}
                      </button>
                      <button
                        onClick={() => navigate('/pricing')}
                        className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                        style={{ background: 'var(--glass-fill-subtle)' }}
                      >
                        Back to Pricing
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Secured by Stripe • SSL Encrypted</span>
          </div>

          {/* Debug Panel - Development Only */}
          {import.meta.env.DEV && (
            <details className="mt-8 rounded-lg p-4 bg-slate-800/50 border border-slate-700">
              <summary className="cursor-pointer text-sm font-mono text-slate-400 hover:text-slate-300">
                Debug Info (Dev Only)
              </summary>
              <div className="mt-4 space-y-2 text-xs font-mono text-slate-500">
                <p><span className="text-slate-400">Tier Slug:</span> {tierSlug || 'null'}</p>
                <p><span className="text-slate-400">Selected Tier:</span> {selectedTier?.name || 'null'}</p>
                <p><span className="text-slate-400">Billing Interval:</span> {billingInterval}</p>
                <p><span className="text-slate-400">Has Client Secret:</span> {clientSecret ? 'Yes' : 'No'}</p>
                <p><span className="text-slate-400">Mutation Pending:</span> {createSubscriptionMutation.isPending ? 'Yes' : 'No'}</p>
                <p><span className="text-slate-400">Mutation Status:</span> {createSubscriptionMutation.status}</p>
                <p><span className="text-slate-400">Current Subscription:</span> {subscriptionStatus?.tierSlug || 'none'}</p>
                <p><span className="text-slate-400">Has Active Sub:</span> {subscriptionStatus?.hasActiveSubscription ? 'Yes' : 'No'}</p>
                <p><span className="text-slate-400">Error:</span> {error || 'none'}</p>
                {createSubscriptionMutation.error && (
                  <p className="text-red-400">
                    <span className="text-slate-400">Mutation Error:</span>{' '}
                    {JSON.stringify(createSubscriptionMutation.error, null, 2)}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
