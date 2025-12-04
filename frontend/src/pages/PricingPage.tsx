import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SEO } from '@/components/common/SEO';
import { Footer } from '@/components/landing/Footer';
import { getSubscriptionTiers, getSubscriptionStatus } from '@/services/billing';
import type { SubscriptionTier } from '@/services/billing';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
  RocketLaunchIcon,
  BoltIcon,
  StarIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

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

  const handleSelectPlan = (tierSlug: string) => {
    if (tierSlug === 'free-explorer') {
      navigate('/auth');
      return;
    }
    navigate(`/checkout?tier=${tierSlug}`);
  };

  const currentTierSlug = subscriptionStatus?.tierSlug;

  // Feature mapping for display
  const getFeatureList = (tier: SubscriptionTier): string[] => {
    const featureList: string[] = [];

    if (tier.monthlyAiRequests === 0) {
      featureList.push('Unlimited AI chat & generation');
    } else {
      featureList.push(`${tier.monthlyAiRequests.toLocaleString()} AI chats/month`);
    }

    if (tier.features.aiMentor) featureList.push('Pip AI assistant');
    if (tier.features.quests) featureList.push('Gamified learning quests');
    if (tier.features.projects) featureList.push('Shareable project portfolio');
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

  // Get tier styling
  const getTierStyle = (tierType: string) => {
    switch (tierType) {
      case 'free':
        return {
          icon: RocketLaunchIcon,
          gradient: 'from-slate-500 to-slate-600',
          glow: '',
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        };
      case 'community_pro':
        return {
          icon: BoltIcon,
          gradient: 'from-blue-500 to-cyan-500',
          glow: 'shadow-neon',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        };
      case 'pro_learn':
        return {
          icon: AcademicCapIcon,
          gradient: 'from-purple-500 to-pink-500',
          glow: '',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        };
      case 'creator_mentor':
        return {
          icon: StarIcon,
          gradient: 'from-amber-500 to-orange-500',
          glow: '',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
      default:
        return {
          icon: RocketLaunchIcon,
          gradient: 'from-slate-500 to-slate-600',
          glow: '',
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        };
    }
  };

  if (tiersLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-green-400/50 rounded-full animate-spin animation-delay-150" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden">
      <SEO
        title="Pricing - All Thrive AI"
        description="Choose the perfect plan for your AI learning journey"
      />

      {/* Ambient Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/5 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-block">
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/explore"
                className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium"
              >
                Explore
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-sm hover:shadow-neon transition-all duration-300"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
              Choose Your{' '}
              <span className="text-gradient-cyan">Plan</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              Start free, upgrade as you grow. All plans include core AI features.
              Cancel anytime.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="inline-flex items-center gap-3 p-1.5 rounded-full glass-panel">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === 'annual'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Annual
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                  -15%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-4">
            {sortedTiers?.map((tier) => {
              const style = getTierStyle(tier.tierType);
              const TierIcon = style.icon;
              const features = getFeatureList(tier);
              const isCurrentPlan = currentTierSlug === tier.slug;
              const isPopular = tier.tierType === 'community_pro';

              const pricePerMonth = billingCycle === 'annual'
                ? (parseFloat(tier.priceAnnual) / 12).toFixed(2)
                : tier.priceMonthly;

              const totalPrice = billingCycle === 'annual'
                ? tier.priceAnnual
                : tier.priceMonthly;

              return (
                <div
                  key={tier.slug}
                  className={`relative flex flex-col glass-card p-6 ${
                    isPopular ? 'neon-border lg:scale-105 lg:-my-4' : ''
                  } ${style.glow}`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-0 right-0 mx-auto w-fit">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/30">
                        <SparklesIcon className="w-4 h-4" />
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Tier Icon & Name */}
                  <div className="mb-6">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} mb-4`}>
                      <TierIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${style.badge} mb-3`}>
                      {tier.name}
                    </div>
                    {tier.description && (
                      <p className="text-sm text-gray-400 min-h-[40px]">
                        {tier.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {parseFloat(totalPrice) === 0 ? (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-white">Free</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline">
                          <span className="text-4xl font-bold text-white">
                            ${pricePerMonth}
                          </span>
                          <span className="ml-1 text-lg text-gray-500">/mo</span>
                        </div>
                        {billingCycle === 'annual' && (
                          <p className="mt-1 text-sm text-gray-500">
                            ${totalPrice} billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(tier.slug)}
                    disabled={isCurrentPlan}
                    className={`w-full mb-6 ${
                      isCurrentPlan
                        ? 'px-6 py-3 rounded-xl bg-gray-800 text-gray-500 cursor-not-allowed'
                        : isPopular
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    {isCurrentPlan ? (
                      'Current Plan'
                    ) : tier.tierType === 'free' ? (
                      <span className="flex items-center justify-center gap-2">
                        Get Started <ArrowRightIcon className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Upgrade Now <ArrowRightIcon className="w-4 h-4" />
                      </span>
                    )}
                  </button>

                  {/* Features List */}
                  <ul className="space-y-3 flex-1">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center mt-0.5">
                          <CheckIcon className="w-3 h-3 text-cyan-400" />
                        </div>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* FAQ Section */}
          <div className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                Frequently Asked{' '}
                <span className="text-gradient-cyan">Questions</span>
              </h2>
              <p className="text-gray-400">Everything you need to know about our plans</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Can I change plans anytime?
                </h3>
                <p className="text-gray-400">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.
                </p>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  What happens to my AI request quota?
                </h3>
                <p className="text-gray-400">
                  Your monthly AI request quota resets on your billing cycle date. Unused requests don't roll over, but you can purchase token packages for additional capacity.
                </p>
                <p className="text-sm text-gray-500 mt-2 italic">
                  Token packages are available for purchase after signup and never expire.
                </p>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-400">
                  We offer a 14-day money-back guarantee on all paid plans. No questions asked.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Footer */}
          <div className="mt-24 text-center">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-xl" />
              <div className="relative glass-panel p-12 rounded-3xl border border-white/10">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Ready to start your AI journey?
                </h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  Join thousands of learners building their AI skills with All Thrive.
                </p>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold hover:shadow-neon transition-all duration-300"
                >
                  Get Started Free <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
