import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { Footer } from '@/components/landing/Footer';
import { getSubscriptionTiers, getSubscriptionStatus } from '@/services/billing';
import type { SubscriptionTier, SubscriptionStatus } from '@/services/billing';
import { CheckIcon } from '@heroicons/react/24/solid';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function PricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  // Fetch available tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: getSubscriptionTiers,
  });

  // Fetch current subscription status
  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
  });

  const handleSelectPlan = (tierSlug: string, tierName: string) => {
    if (tierSlug === 'free-explorer') {
      // Free tier - no action needed
      return;
    }

    // Navigate to checkout page with selected tier
    navigate(`/checkout?tier=${tierSlug}`);
  };

  const currentTierSlug = subscriptionStatus?.tierSlug;

  // Feature mapping for display
  const getFeatureList = (tier: SubscriptionTier): string[] => {
    const featureList: string[] = [];

    // AI Requests
    if (tier.monthlyAiRequests === 0) {
      featureList.push('Unlimited AI chat & generation');
    } else {
      featureList.push(`${tier.monthlyAiRequests.toLocaleString()} AI chats/month`);
    }

    // Core features
    if (tier.features.aiMentor) featureList.push('Pip AI assistant');
    if (tier.features.quests) featureList.push('Gamified learning quests');
    if (tier.features.projects) featureList.push('Shareable project portfolio');

    // Premium features
    if (tier.features.circles) featureList.push('Community groups');
    if (tier.features.marketplace) featureList.push('Prompt & template marketplace');
    if (tier.features.go1Courses) featureList.push('10,000+ professional courses');
    if (tier.features.analytics) featureList.push('Portfolio analytics');
    if (tier.features.creatorTools) featureList.push('Sell courses & coaching');

    return featureList;
  };

  // Tier order for display
  const tierOrder = ['free', 'community_pro', 'pro_learn', 'creator_mentor'];

  const sortedTiers = tiers?.sort((a, b) => {
    return tierOrder.indexOf(a.tierType) - tierOrder.indexOf(b.tierType);
  });

  // Get tier color scheme
  const getTierColor = (tierType: string) => {
    switch (tierType) {
      case 'free':
        return {
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
          button: 'bg-gray-600 hover:bg-gray-700 text-white',
          border: 'border-gray-200 dark:border-gray-700',
        };
      case 'community_pro':
        return {
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
          border: 'border-blue-200 dark:border-blue-700',
        };
      case 'pro_learn':
        return {
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          button: 'bg-purple-600 hover:bg-purple-700 text-white',
          border: 'border-purple-200 dark:border-purple-700',
        };
      case 'creator_mentor':
        return {
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
          button: 'bg-amber-600 hover:bg-amber-700 text-white',
          border: 'border-amber-200 dark:border-amber-700',
        };
      default:
        return {
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
          button: 'bg-gray-600 hover:bg-gray-700 text-white',
          border: 'border-gray-200 dark:border-gray-700',
        };
    }
  };

  if (tiersLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO
        title="Pricing - All Thrive AI"
        description="Choose the perfect plan for your AI learning journey"
      />

      <div className="min-h-screen bg-gray-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Start free, upgrade as you grow. Cancel anytime.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Annual
                <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                  Save 15%
                </span>
              </span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
            {sortedTiers?.map((tier) => {
              const colors = getTierColor(tier.tierType);
              const features = getFeatureList(tier);
              const isCurrentPlan = currentTierSlug === tier.slug;

              // Calculate pricing based on billing cycle
              const pricePerMonth = billingCycle === 'annual'
                ? (parseFloat(tier.priceAnnual) / 12).toFixed(2)
                : tier.priceMonthly;

              const totalPrice = billingCycle === 'annual'
                ? tier.priceAnnual
                : tier.priceMonthly;

              const isPopular = tier.tierType === 'pro_learn';

              return (
                <div
                  key={tier.slug}
                  className={`relative flex flex-col rounded-2xl border-2 ${colors.border} bg-white dark:bg-gray-800 p-8 shadow-xl ${isPopular ? 'ring-4 ring-purple-500 ring-opacity-50 scale-105' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-5 left-0 right-0 mx-auto w-fit">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-1 text-sm font-semibold text-white shadow-lg">
                        <SparklesIcon className="h-4 w-4" />
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Tier Name & Badge */}
                  <div className="mb-4">
                    <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colors.badge} mb-3`}>
                      {tier.name}
                    </div>
                    {tier.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 min-h-[40px]">
                        {tier.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {parseFloat(totalPrice) === 0 ? (
                      <div className="flex items-baseline">
                        <span className="text-5xl font-extrabold text-gray-900 dark:text-white">
                          Free
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline">
                          <span className="text-5xl font-extrabold text-gray-900 dark:text-white">
                            ${pricePerMonth}
                          </span>
                          <span className="ml-1 text-xl font-medium text-gray-500 dark:text-gray-400">
                            /mo
                          </span>
                        </div>
                        {billingCycle === 'annual' && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            ${totalPrice} billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(tier.slug, tier.name)}
                    disabled={isCurrentPlan}
                    className={`w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 mb-6 ${
                      isCurrentPlan
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        : colors.button
                    }`}
                  >
                    {isCurrentPlan ? 'Current Plan' : tier.tierType === 'free' ? 'Get Started' : 'Upgrade Now'}
                  </button>

                  {/* Features List */}
                  <ul className="space-y-3 flex-1">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-20 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <div className="max-w-3xl mx-auto space-y-6 text-left">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Can I change plans anytime?
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  What happens to my AI request quota?
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your monthly AI request quota resets on your billing cycle date. Unused requests don't roll over, but you can purchase token packages for additional capacity.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                  Token packages are available for purchase after signup and never expire.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We offer a 14-day money-back guarantee on all paid plans. No questions asked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </DashboardLayout>
  );
}
