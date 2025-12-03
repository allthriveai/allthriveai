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
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

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
      setClientSecret(data.clientSecret);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.error || 'Failed to initialize payment');
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

    // Auto-create subscription when page loads
    if (selectedTier && !clientSecret && !createSubscriptionMutation.isPending) {
      createSubscriptionMutation.mutate();
    }
  }, [tierSlug, tiers, selectedTier, subscriptionStatus, clientSecret]);

  const handlePaymentSuccess = async () => {
    // Poll for subscription activation
    const maxAttempts = 10;
    const pollInterval = 1000;

    console.log('[Checkout] Payment confirmed, polling for activation...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        const status = await getSubscriptionStatus();

        console.log(`[Checkout] Poll attempt ${attempt}/${maxAttempts}:`, status);

        if (status.hasActiveSubscription && status.subscriptionStatus === 'active') {
          console.log('[Checkout] Subscription activated!');
          navigate('/account/billing?success=true');
          return;
        }
      } catch (err) {
        console.error(`[Checkout] Poll attempt ${attempt} failed:`, err);
      }
    }

    // Timeout - show message but still redirect
    console.warn('[Checkout] Activation polling timeout');
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

            {/* Error Message */}
            {error && (
              <div className="mt-6 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
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
        </div>
      </div>
    </DashboardLayout>
  );
}
