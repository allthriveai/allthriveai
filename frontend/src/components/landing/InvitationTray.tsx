/**
 * InvitationTray - Right sidebar tray for requesting an invitation to join AllThrive
 */

import { useState, useEffect, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import {
  XMarkIcon,
  SparklesIcon,
  CheckIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  BoltIcon,
  ShoppingBagIcon,
  AcademicCapIcon,
  PuzzlePieceIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { api } from '@/services/api';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

// Feature options for "What feature are you most excited about?"
const FEATURE_OPTIONS = [
  { key: 'portfolio', label: 'AI Portfolio', description: 'Auto-showcase your work', icon: BriefcaseIcon },
  { key: 'battles', label: 'Prompt Battles', description: 'Compete with AI prompts', icon: BoltIcon },
  { key: 'microlearning', label: 'Explore', description: 'See what others are building', icon: PuzzlePieceIcon },
  { key: 'learning', label: 'Learning Paths', description: 'Structured AI education', icon: AcademicCapIcon },
  { key: 'marketplace', label: 'Marketplace', description: 'Sell courses & projects', icon: ShoppingBagIcon },
  { key: 'challenges', label: 'Games & Challenges', description: 'Weekly games and challenges', icon: CalendarDaysIcon },
  { key: 'investing', label: 'Investing', description: 'Find AI projects', icon: CurrencyDollarIcon },
  { key: 'community', label: 'Community', description: 'Connect with creators', icon: UserGroupIcon },
];

// Integration options for portfolio import
const INTEGRATION_OPTIONS = [
  { key: 'github', label: 'GitHub' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'figma', label: 'Figma' },
  { key: 'url', label: 'Paste any URL' },
];

interface FormData {
  name: string;
  email: string;
  reason: string;
  excited_features: string[];
  desired_integrations: string[];
  desired_integrations_other: string;
}

interface InvitationTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvitationTray({ isOpen, onClose }: InvitationTrayProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    reason: '',
    excited_features: [],
    desired_integrations: [],
    desired_integrations_other: '',
  });

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount for animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Reset form when tray opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        email: '',
        reason: '',
        excited_features: [],
        desired_integrations: [],
        desired_integrations_other: '',
      });
      setFormState('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMessage('');

    try {
      // Get reCAPTCHA token if available
      let recaptchaToken = '';
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha('invitation_request');
        } catch (recaptchaError) {
          console.warn('reCAPTCHA failed, proceeding without token:', recaptchaError);
        }
      }

      await api.post('/invitations/request/', {
        ...formData,
        recaptcha_token: recaptchaToken,
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
  }, [executeRecaptcha, formData]);

  const toggleFeature = (key: string) => {
    const isSelected = formData.excited_features.includes(key);
    const newFeatures = isSelected
      ? formData.excited_features.filter((f) => f !== key)
      : [...formData.excited_features, key];

    // Clear integrations if portfolio is deselected
    const shouldClearIntegrations = key === 'portfolio' && isSelected;
    setFormData({
      ...formData,
      excited_features: newFeatures,
      ...(shouldClearIntegrations && {
        desired_integrations: [],
        desired_integrations_other: '',
      }),
    });
  };

  const toggleIntegration = (key: string) => {
    const isSelected = formData.desired_integrations.includes(key);
    const newIntegrations = isSelected
      ? formData.desired_integrations.filter((i) => i !== key)
      : [...formData.desired_integrations, key];
    setFormData({ ...formData, desired_integrations: newIntegrations });
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Right Sidebar Tray */}
      <aside
        className={`fixed right-0 top-0 h-full w-full sm:w-[28rem] lg:w-[32rem] border-l border-gray-700/50 shadow-2xl z-50 overflow-hidden flex flex-col bg-[#0a1628] transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700/50 bg-[#0a1628]/90 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-[#020617]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {formState === 'success' ? 'Request Received!' : 'Request an Invitation'}
                </h2>
                <p className="text-xs text-gray-400">
                  Join the AllThrive AI community
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {formState === 'success' ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
                <CheckIcon className="w-10 h-10 text-[#020617]" strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-3">
                Thanks for your interest!
              </h3>
              <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                We've sent a confirmation to your email. We'll review your request and
                get back to you soon!
              </p>
              <a
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
              >
                Explore Projects
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-gray-400 text-sm">
                Join our AI curious community! Fill out the form below and we'll
                review your request.
              </p>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {errorMessage}
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                  placeholder="Your name"
                  disabled={formState === 'submitting'}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                  placeholder="you@example.com"
                  disabled={formState === 'submitting'}
                />
              </div>

              {/* Feature interest question */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  What excites you most? <span className="text-gray-500">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURE_OPTIONS.map((feature) => {
                    const isSelected = formData.excited_features.includes(feature.key);
                    const Icon = feature.icon;
                    return (
                      <button
                        key={feature.key}
                        type="button"
                        onClick={() => toggleFeature(feature.key)}
                        disabled={formState === 'submitting'}
                        className={`relative p-3 rounded-xl text-left transition-all min-h-[72px] ${
                          isSelected
                            ? 'bg-gradient-to-br from-cyan-500/20 to-green-500/20 border-2 border-cyan-400'
                            : 'bg-white/5 border border-gray-700 hover:border-gray-500'
                        } disabled:opacity-50`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckIcon className="w-4 h-4 text-cyan-400" />
                          </div>
                        )}
                        <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-cyan-400' : 'text-gray-400'}`} />
                        <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {feature.label}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {feature.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional integrations question */}
              {formData.excited_features.includes('portfolio') && (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    I want to automate pulling in my projects from these integrations: <span className="text-gray-500">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {INTEGRATION_OPTIONS.map((integration) => {
                      const isSelected = formData.desired_integrations.includes(integration.key);
                      return (
                        <button
                          key={integration.key}
                          type="button"
                          onClick={() => toggleIntegration(integration.key)}
                          disabled={formState === 'submitting'}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-2 border-purple-400 text-white'
                              : 'bg-white/5 border border-gray-700 text-gray-300 hover:border-purple-400/50'
                          } disabled:opacity-50`}
                        >
                          {isSelected && <CheckIcon className="w-4 h-4 text-purple-400" />}
                          {integration.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={formData.desired_integrations_other}
                    onChange={(e) => setFormData({ ...formData, desired_integrations_other: e.target.value })}
                    placeholder="Other integration..."
                    disabled={formState === 'submitting'}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-colors text-sm"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">
                  Why do you want to join? <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
                  placeholder="Tell us about yourself and what you're building with AI..."
                  disabled={formState === 'submitting'}
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer - Fixed (only show for form, not success) */}
        {formState !== 'success' && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-700/50 bg-[#0a1628]/90 backdrop-blur-sm">
            <p className="text-xs text-gray-500 text-center mb-4">
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 border border-gray-700 transition-colors font-medium"
                disabled={formState === 'submitting'}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={formState === 'submitting'}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold inline-flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formState === 'submitting' ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Request Invitation
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default InvitationTray;
