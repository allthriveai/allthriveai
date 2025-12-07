/**
 * Subscribe Modal Component
 *
 * A beautiful neon glass modal for selecting and subscribing to a tier.
 * Uses the neon-glass design system with glassmorphism effects.
 *
 * Features:
 * - Tier comparison cards
 * - Stripe Elements integration for payment
 * - Multi-step flow (select tier → enter payment)
 * - Loading states
 * - Error handling
 * - Responsive design
 */

import { useState, useEffect } from 'react';
import { CheckIcon, XMarkIcon, SparklesIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscriptionTiers, createSubscription, getSubscriptionStatus } from '@/services/billing';
import { StripePaymentForm } from './StripePaymentForm';
import type { SubscriptionTier } from '@/services/billing';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: Pre-select a specific tier */
  selectedTierSlug?: string;
  /** Optional: Feature that triggered the paywall */
  blockedFeature?: string;
  /** Optional: Custom message */
  message?: string;
}

export function SubscribeModal({
  isOpen,
  onClose,
  selectedTierSlug,
  blockedFeature,
  message,
}: SubscribeModalProps) {
  const queryClient = useQueryClient();
  // If tier is pre-selected (from pricing page), start on payment step, otherwise tier selection
  const [step, setStep] = useState<'select' | 'payment'>(selectedTierSlug ? 'payment' : 'select');
  const [selectedTier, setSelectedTier] = useState<string | null>(selectedTierSlug || null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: getSubscriptionTiers,
    enabled: isOpen, // Only fetch when modal is open
  });

  // Create subscription mutation (gets client secret)
  const createSubscriptionMutation = useMutation({
    mutationFn: (tierSlug: string) => createSubscription(tierSlug, billingInterval),
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setStep('payment');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to initialize payment');
    },
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setClientSecret(null);
      setError(null);
    }
  }, [isOpen]);

  // Auto-proceed to payment if tier is pre-selected (from pricing page)
  useEffect(() => {
    if (isOpen && selectedTierSlug && !clientSecret && step === 'payment') {
      // Automatically create subscription for pre-selected tier
      createSubscriptionMutation.mutate(selectedTierSlug);
    }
  }, [isOpen, selectedTierSlug, clientSecret, step]);

  if (!isOpen) return null;

  const handleContinueToPayment = () => {
    if (!selectedTier) return;
    createSubscriptionMutation.mutate(selectedTier);
  };

  const handlePaymentSuccess = async () => {
    // Poll backend for subscription activation (webhooks are asynchronous)
    const maxAttempts = 10;
    const pollInterval = 1000; // 1 second

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Wait before checking status
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Fetch latest subscription status
        const status = await getSubscriptionStatus();

        // Check if subscription is now active
        if (status.hasActiveSubscription && status.subscriptionStatus === 'active') {
          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
          queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
          onClose();
          return;
        }
      } catch (err) {
        console.error(`[SubscribeModal] Poll attempt ${attempt} failed:`, err);
      }
    }

    // Timeout reached - webhook might be delayed
    console.warn('[SubscribeModal] Subscription activation polling timeout');
    setError(
      'Your payment was successful, but subscription activation is taking longer than expected. ' +
      'Please refresh the page in a few seconds. If the issue persists, contact support.'
    );

    // Still invalidate queries in case status updated
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleBackToTiers = () => {
    setStep('select');
    setClientSecret(null);
    setError(null);
  };

  // Tier order for display
  const tierOrder = ['free', 'community_pro', 'pro_learn', 'creator_mentor'];

  const sortedTiers = tiers
    ? [...tiers] // Create a new array to avoid mutating the original
        .filter(t => t.tierType !== 'free') // Don't show free tier in modal
        .sort((a, b) => {
          const indexA = tierOrder.indexOf(a.tierType);
          const indexB = tierOrder.indexOf(b.tierType);
          return indexA - indexB;
        })
    : [];


  // Get feature list for a tier
  const getFeatureList = (tier: SubscriptionTier): string[] => {
    const featureList: string[] = [];

    // AI Requests
    if (tier.monthlyAiRequests === 0) {
      featureList.push('Unlimited AI requests');
    } else {
      featureList.push(`${tier.monthlyAiRequests.toLocaleString()} AI requests/month`);
    }

    // Core features
    if (tier.features.aiMentor) featureList.push('AI Mentor');
    if (tier.features.quests) featureList.push('Side Quests');
    if (tier.features.projects) featureList.push('Project Portfolio');

    // Premium features
    if (tier.features.circles) featureList.push('Thrive Circles');
    if (tier.features.marketplace) featureList.push('Marketplace Access');
    if (tier.features.go1Courses) featureList.push('Go1 Course Library');
    if (tier.features.analytics) featureList.push('Advanced Analytics');
    if (tier.features.creatorTools) featureList.push('Creator Tools');

    return featureList;
  };

  // Get neon color for tier
  const getTierNeonColor = (tierType: string) => {
    switch (tierType) {
      case 'community_pro':
        return 'neon-cyan'; // Cyan neon
      case 'pro_learn':
        return 'neon-teal'; // Teal neon
      case 'creator_mentor':
        return 'neon-pink'; // Pink neon
      default:
        return 'neon-cyan';
    }
  };

  // Get price display
  const getPriceDisplay = (tier: SubscriptionTier) => {
    // For now, show monthly pricing (backend handles monthly/annual)
    const price = parseFloat(tier.priceMonthly);

    if (price === 0) return 'Free';

    return (
      <>
        <span className="text-4xl font-bold">${price.toFixed(0)}</span>
        <span className="text-lg text-[var(--text-secondary)]">/month</span>
      </>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto rounded-lg"
        style={{
          background: 'var(--glass-fill)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-neon)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-fill-strong)] transition-all"
          aria-label="Close modal"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[var(--glass-border)]">
          {/* Back Button (in payment step) */}
          {step === 'payment' && (
            <button
              onClick={handleBackToTiers}
              className="flex items-center gap-2 mb-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to plans
            </button>
          )}

          {blockedFeature && step === 'select' && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-md bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
              <SparklesIcon className="w-5 h-5 text-[var(--neon-cyan)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                {message || `Unlock ${blockedFeature} with a premium plan`}
              </p>
            </div>
          )}

          <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] bg-clip-text text-transparent">
            {step === 'select' ? 'Choose Your Plan' : 'Complete Payment'}
          </h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            {step === 'select'
              ? 'Unlock powerful features and accelerate your growth'
              : 'Enter your payment details to activate your subscription'}
          </p>
        </div>

        {/* Loading State */}
        {tiersLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--neon-cyan)] border-t-transparent"></div>
          </div>
        )}

        {/* Step 1: Tier Selection */}
        {!tiersLoading && sortedTiers && step === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
            {sortedTiers.map((tier) => {
              const isSelected = selectedTier === tier.tierType;
              const isPopular = tier.tierType === 'pro_learn';
              const neonColor = getTierNeonColor(tier.tierType);

              return (
                <div
                  key={tier.slug}
                  className={`relative rounded-lg p-6 cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-[var(--neon-cyan)]'
                      : 'hover:ring-1 hover:ring-[var(--glass-border-subtle)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--glass-fill-strong)' : 'var(--glass-fill-subtle)',
                    border: `1px solid ${isSelected ? 'var(--neon-cyan)' : 'var(--glass-border)'}`,
                    boxShadow: isSelected ? 'var(--shadow-neon)' : 'none',
                  }}
                  onClick={() => setSelectedTier(tier.tierType)}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span
                        className="px-3 py-1 text-xs font-semibold rounded-full text-white"
                        style={{
                          background: 'var(--gradient-primary)',
                          boxShadow: 'var(--shadow-neon)',
                        }}
                      >
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {/* Tier Name */}
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                    {tier.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-6 text-[var(--text-primary)]">
                    {getPriceDisplay(tier)}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {getFeatureList(tier).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 text-[var(--${neonColor})]`} />
                        <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Select Indicator */}
                  {isSelected && (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--neon-cyan)]">
                      <CheckIcon className="w-5 h-5" />
                      Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 2: Payment Form */}
        {step === 'payment' && (
          <div className="p-8 max-w-2xl mx-auto">
            {clientSecret ? (
              <StripePaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            ) : (
              /* Loading state while creating subscription */
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--neon-cyan)] border-t-transparent mb-4"></div>
                <p className="text-[var(--text-secondary)]">Initializing payment...</p>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-8 mb-4 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        {/* Footer - Only show in tier selection step */}
        {step === 'select' && (
          <div className="px-8 py-6 border-t border-[var(--glass-border)] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-fill-subtle)] transition-all"
            >
              Cancel
            </button>

            <button
              onClick={handleContinueToPayment}
              disabled={!selectedTier || createSubscriptionMutation.isPending}
              className="px-8 py-3 rounded-md font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: selectedTier && !createSubscriptionMutation.isPending ? 'var(--gradient-primary)' : 'var(--glass-fill)',
                boxShadow: selectedTier && !createSubscriptionMutation.isPending ? 'var(--shadow-neon)' : 'none',
              }}
            >
              {createSubscriptionMutation.isPending ? 'Initializing...' : 'Continue to Payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
