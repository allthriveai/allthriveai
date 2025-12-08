import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { SEO } from '@/components/common/SEO';
import { Footer } from '@/components/landing/Footer';
import { Modal } from '@/components/ui/Modal';
import { getSubscriptionTiers, getSubscriptionStatus, createCheckoutSession } from '@/services/billing';
import type { SubscriptionTier } from '@/services/billing';
import { api } from '@/services/api';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
  RocketLaunchIcon,
  BoltIcon,
  StarIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  SparklesIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { analytics } from '@/utils/analytics';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface CreatorFormProps {
  formState: FormState;
  setFormState: (state: FormState) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  formData: { name: string; email: string; reason: string; sellType: string };
  setFormData: (data: { name: string; email: string; reason: string; sellType: string }) => void;
}

function CreatorRequestForm({
  formState,
  setFormState,
  errorMessage,
  setErrorMessage,
  formData,
  setFormData,
}: CreatorFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMessage('');

    try {
      let recaptchaToken = '';
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha('creator_request');
        } catch (recaptchaError) {
          console.warn('reCAPTCHA failed, proceeding without token:', recaptchaError);
        }
      }

      await api.post('/invitations/request/', {
        name: formData.name,
        email: formData.email,
        reason: `[CREATOR REQUEST - Wants to sell: ${formData.sellType}] ${formData.reason}`,
        recaptcha_token: recaptchaToken,
        is_creator_request: true,
      });
      setFormState('success');
    } catch (error: unknown) {
      setFormState('error');
      const err = error as { response?: { data?: { error?: string }; status?: number } };
      if (err.response?.status === 409) {
        setErrorMessage('This email has already submitted a request. Check your inbox!');
      } else if (err.response?.status === 429) {
        setErrorMessage('Too many requests. Please try again later.');
      } else if (err.response?.status === 400 && err.response?.data?.error?.includes('reCAPTCHA')) {
        setErrorMessage('Bot verification failed. Please try again.');
      } else {
        setErrorMessage(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    }
  }, [executeRecaptcha, formData, setFormState, setErrorMessage]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-gray-400 mb-4">
        Join our creator community! Tell us what you'd like to sell on All Thrive.
      </p>

      {errorMessage && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          placeholder="Your name"
          disabled={formState === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          id="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          placeholder="you@example.com"
          disabled={formState === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="sellType" className="block text-sm font-medium text-gray-300 mb-1">
          What do you want to sell? <span className="text-red-400">*</span>
        </label>
        <select
          id="sellType"
          required
          value={formData.sellType}
          onChange={(e) => setFormData({ ...formData, sellType: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          disabled={formState === 'submitting'}
        >
          <option value="">Select an option...</option>
          <option value="Prompts & Templates">Prompts & Templates</option>
          <option value="Courses & Tutorials">Courses & Tutorials</option>
          <option value="AI Tools & Workflows">AI Tools & Workflows</option>
          <option value="Coaching & Mentoring">Coaching & Mentoring</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-1">
          Tell us more <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="reason"
          rows={3}
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
          placeholder="Describe what you'd like to create and sell..."
          disabled={formState === 'submitting'}
        />
      </div>

      <button
        type="submit"
        disabled={formState === 'submitting'}
        className="w-full px-6 py-3 rounded bg-gradient-to-r from-emerald-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {formState === 'submitting' ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Submitting...
          </>
        ) : (
          <>
            Request to Join
            <ArrowRightIcon className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        This site is protected by reCAPTCHA and the Google{' '}
        <a href="https://policies.google.com/privacy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{' '}
        and{' '}
        <a href="https://policies.google.com/terms" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{' '}
        apply.
      </p>
    </form>
  );
}

function PricingPageContent() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [creatorFormState, setCreatorFormState] = useState<FormState>('idle');
  const [creatorErrorMessage, setCreatorErrorMessage] = useState('');
  const [creatorFormData, setCreatorFormData] = useState({
    name: '',
    email: '',
    reason: '',
    sellType: '',
  });

  useEffect(() => {
    analytics.pricingPageViewed();
  }, []);

  const handleCreatorRequest = () => {
    setIsCreatorModalOpen(true);
    setCreatorFormState('idle');
    setCreatorErrorMessage('');
  };

  const handleCloseCreatorModal = () => {
    setIsCreatorModalOpen(false);
    setTimeout(() => {
      setCreatorFormData({ name: '', email: '', reason: '', sellType: '' });
      setCreatorFormState('idle');
      setCreatorErrorMessage('');
    }, 200);
  };

  const faqs: { question: string; answer: React.ReactNode }[] = [
    {
      question: 'Can I change plans anytime?',
      answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate the difference.',
    },
    {
      question: 'What happens to my AI request quota?',
      answer: 'Your monthly AI request quota resets on your billing cycle date. Unused requests don\'t roll over, but you can purchase token packages for additional capacity. Token packages are available for purchase after signup and never expire.',
    },
    {
      question: 'What happens when I cancel?',
      answer: 'When you cancel, you keep full access until the end of your current billing period. After that, your account will be downgraded to the free tier.',
    },
    {
      question: 'Can I buy more AI tokens if I run out?',
      answer: 'Yes! You can purchase token packs anytime from your account settings. Token packs are available in various sizes to fit your needs, never expire, and are used only after your monthly quota is depleted. This gives you flexibility to handle busy months without upgrading your plan.',
    },
    {
      question: 'Can I use my own API keys (BYOK)?',
      answer: 'Coming soon! We\'re building support for Bring Your Own Keys (BYOK), which will let you connect your own OpenAI, Anthropic, or other LLM API keys. This will give you unlimited AI usage with your own billing, perfect for power users and teams with existing API subscriptions.',
    },
    {
      question: 'I have an issue, how can I ask for help?',
      answer: (
        <>
          If you're logged in, use the support chat in the top menu for the fastest response. You can also report bugs or request features on our{' '}
          <a href="https://github.com/allthriveai/allthriveai/issues" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
            GitHub issues page
          </a>.
        </>
      ),
    },
    {
      question: 'How does the Creator plan work?',
      answer: 'The Creator plan is completely free to join. When you sell prompts, templates, or courses on our marketplace, we take a small 8% fee on each sale. You keep 92% of your earnings with no monthly costs or upfront fees.',
    },
  ];

  // Fallback tiers when API is unavailable
  const fallbackTiers: SubscriptionTier[] = [
    {
      slug: 'free-explorer',
      name: 'Free Explorer',
      description: 'Get started with All Thrive AI learning basics',
      tierType: 'free',
      priceMonthly: 0,
      priceAnnual: 0,
      trialPeriodDays: 0,
      monthlyAiRequests: 50,
      features: {
        aiMentor: true,
        quests: true,
        projects: true,
        circles: false,
        marketplace: false,
        go1Courses: false,
        analytics: false,
        creatorTools: false,
      },
    },
    {
      slug: 'community-pro',
      name: 'Community Pro',
      description: 'Connect and grow with the community',
      tierType: 'community_pro',
      priceMonthly: 9.99,
      priceAnnual: 101.90,
      trialPeriodDays: 14,
      monthlyAiRequests: 500,
      features: {
        aiMentor: true,
        quests: true,
        projects: true,
        circles: true,
        marketplace: true,
        go1Courses: false,
        analytics: false,
        creatorTools: false,
      },
    },
    {
      slug: 'pro-learn',
      name: 'Pro Learn',
      description: 'Learning paths & interactive courses',
      tierType: 'pro_learn',
      priceMonthly: 29.99,
      priceAnnual: 305.90,
      trialPeriodDays: 14,
      monthlyAiRequests: 2000,
      features: {
        aiMentor: true,
        quests: true,
        projects: true,
        circles: true,
        marketplace: true,
        go1Courses: true,
        analytics: true,
        creatorTools: false,
      },
    },
    {
      slug: 'creator-mentor',
      name: 'Creator',
      description: 'Sell courses, prompts & templates',
      tierType: 'creator_mentor',
      priceMonthly: 0,
      priceAnnual: 0,
      trialPeriodDays: 0,
      monthlyAiRequests: 0,
      features: {
        aiMentor: true,
        quests: true,
        projects: true,
        circles: true,
        marketplace: true,
        go1Courses: false,
        analytics: true,
        creatorTools: true,
      },
    },
  ];

  // Fetch available tiers
  const { data: tiers } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: getSubscriptionTiers,
  });

  // Fetch current subscription status
  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: getSubscriptionStatus,
  });

  const handleSelectPlan = async (tierSlug: string, tierType?: string) => {
    // Find the tier to get details for analytics
    const tier = (tiers || fallbackTiers).find(t => t.slug === tierSlug);
    const tierName = tier?.name || tierSlug;
    const priceAnnual = tier?.priceAnnual ?? 0;
    const priceMonthly = tier?.priceMonthly ?? 0;
    const price = billingCycle === 'annual'
      ? (typeof priceAnnual === 'number' ? priceAnnual : parseFloat(priceAnnual))
      : (typeof priceMonthly === 'number' ? priceMonthly : parseFloat(priceMonthly));

    // Track plan selection
    analytics.pricingPlanSelected(tierName, billingCycle, price);

    if (tierSlug === 'free-explorer') {
      navigate('/auth');
      return;
    }

    // Creator tier opens the request modal
    if (tierType === 'creator_mentor') {
      handleCreatorRequest();
      return;
    }

    try {
      // Track checkout start
      analytics.checkoutStarted(tierName, billingCycle, price);

      // Create checkout session and redirect to Stripe
      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/pricing`;

      const { url } = await createCheckoutSession(
        tierSlug,
        billingCycle === 'annual' ? 'annual' : 'monthly',
        successUrl,
        cancelUrl
      );

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      // Optionally show an error message to the user
      alert('Failed to start checkout. Please try again.');
    }
  };

  const currentTierSlug = subscriptionStatus?.tierSlug;

  // Feature mapping for display
  const getFeatureList = (tier: SubscriptionTier): string[] => {
    const featureList: string[] = [];

    // Free tier gets special simplified feature list
    if (tier.tierType === 'free') {
      featureList.push('Limited use of Community Pro Features');
      return featureList;
    }

    // Creator tier gets special feature list
    if (tier.tierType === 'creator_mentor') {
      featureList.push('Sell prompts, templates & courses');
      featureList.push('Only 8% fee on sales');
      featureList.push('Creator insights dashboard');
      featureList.push('Shareable project portfolio');
      featureList.push('Community groups');
      return featureList;
    }

    // Pro Learn tier gets simplified feature list
    if (tier.tierType === 'pro_learn') {
      featureList.push('Everything in Community Pro +');
      featureList.push('Structured learning paths');
      return featureList;
    }

    if (tier.monthlyAiRequests > 0) {
      featureList.push(`${tier.monthlyAiRequests.toLocaleString()} credits/month`);
    }

    if (tier.features.aiMentor) {
      featureList.push('Automated AI project creation');
    }
    featureList.push('Prompt Battles');
    if (tier.features.quests) featureList.push('Gamified learning quests');
    if (tier.features.projects) featureList.push('Shareable project portfolio');
    if (tier.tierType === 'community_pro') {
      featureList.push('Access to Explore Project Feed');
    }
    if (tier.features.circles) featureList.push('Community groups');
    if (tier.features.marketplace) featureList.push('Access to Creator marketplace');
    if (tier.features.go1Courses) featureList.push('Learning paths & interactive courses');
    if (tier.features.analytics) featureList.push('Portfolio insights');
    if (tier.features.creatorTools) featureList.push('Sell courses & coaching');

    return featureList;
  };

  // Tier order for display
  const tierOrder = ['free', 'community_pro', 'pro_learn', 'creator_mentor'];

  // Use API tiers or fallback to static tiers
  const displayTiers = tiers && tiers.length > 0 ? tiers : fallbackTiers;

  const sortedTiers = [...displayTiers].sort((a, b) => {
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
          gradient: 'from-emerald-500 to-teal-500',
          glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
            <Link to="/" className="inline-flex items-center gap-3">
              <img
                src="/all-thrvie-logo.png"
                alt="All Thrive"
                className="h-10 w-10"
              />
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-4 mt-16">
            {sortedTiers?.map((tier) => {
              const style = getTierStyle(tier.tierType);
              const TierIcon = style.icon;
              const features = getFeatureList(tier);
              const isCurrentPlan = currentTierSlug === tier.slug;
              const isPopular = tier.tierType === 'community_pro';

              const priceAnnual = typeof tier.priceAnnual === 'number' ? tier.priceAnnual : parseFloat(tier.priceAnnual);
              const priceMonthly = typeof tier.priceMonthly === 'number' ? tier.priceMonthly : parseFloat(tier.priceMonthly);
              const pricePerMonth = billingCycle === 'annual'
                ? (priceAnnual / 12).toFixed(2)
                : priceMonthly.toFixed(2);

              const totalPrice = billingCycle === 'annual'
                ? priceAnnual.toFixed(2)
                : priceMonthly.toFixed(2);

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
                  <div className="mb-6 text-center">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${style.gradient} mb-4 shadow-lg`}>
                      <TierIcon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {tier.name}
                    </h3>
                    {tier.description && (
                      <p className="text-sm text-gray-400 min-h-[40px]">
                        {tier.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {parseFloat(totalPrice) === 0 || tier.tierType === 'creator_mentor' ? (
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
                    onClick={() => handleSelectPlan(tier.slug, tier.tierType)}
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
                    ) : tier.tierType === 'creator_mentor' ? (
                      <span className="flex items-center justify-center gap-2">
                        Request to Join <ArrowRightIcon className="w-4 h-4" />
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

            <div className="max-w-5xl mx-auto space-y-2">
              {faqs.map((faq, index) => (
                <div key={index} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <h3 className="text-base font-medium text-white pr-4">
                      {faq.question}
                    </h3>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-cyan-400 flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openFaq === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="px-6 pb-4 text-gray-400 text-sm">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
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

      {/* Creator Request Modal */}
      <Modal
        isOpen={isCreatorModalOpen}
        onClose={handleCloseCreatorModal}
        title={creatorFormState === 'success' ? 'Request Received!' : 'Become a Creator'}
      >
        {creatorFormState === 'success' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#020617]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Thanks for your interest!
            </h3>
            <p className="text-gray-400 mb-6">
              We've received your creator application. We'll review it and get back to you soon!
            </p>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300"
            >
              Explore Projects
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <CreatorRequestForm
            formState={creatorFormState}
            setFormState={setCreatorFormState}
            errorMessage={creatorErrorMessage}
            setErrorMessage={setCreatorErrorMessage}
            formData={creatorFormData}
            setFormData={setCreatorFormData}
          />
        )}
      </Modal>
    </div>
  );
}

export default function PricingPage() {
  if (RECAPTCHA_SITE_KEY) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
        <PricingPageContent />
      </GoogleReCaptchaProvider>
    );
  }
  return <PricingPageContent />;
}
