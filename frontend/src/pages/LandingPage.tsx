import { useState, useCallback } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { Modal } from '@/components/ui/Modal';
import { SkipLink } from '@/components/ui/SkipLink';
import { HeroSection } from '@/components/landing/HeroSection';
import { ExplorePreview } from '@/components/landing/ExplorePreview';
import { AutomatedProfile } from '@/components/landing/AutomatedProfile';
import { SideQuestsPreview } from '@/components/landing/SideQuestsPreview';
import { Testimonials } from '@/components/landing/Testimonials';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';
import { api } from '@/services/api';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

interface InvitationFormProps {
  formState: FormState;
  setFormState: (state: FormState) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  formData: { name: string; email: string; reason: string };
  setFormData: (data: { name: string; email: string; reason: string }) => void;
}

function InvitationForm({
  formState,
  setFormState,
  errorMessage,
  setErrorMessage,
  formData,
  setFormData,
}: InvitationFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

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
  }, [executeRecaptcha, formData, setFormState, setErrorMessage]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-gray-400 mb-4">
        Join our community of AI creators! Fill out the form below and we'll
        review your request.
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
        <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-1">
          Why do you want to join? <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="reason"
          rows={3}
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
          placeholder="Tell us about yourself and what you're building with AI..."
          disabled={formState === 'submitting'}
        />
      </div>

      <button
        type="submit"
        disabled={formState === 'submitting'}
        className="w-full px-6 py-3 rounded bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold hover:shadow-neon transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {formState === 'submitting' ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Submitting...
          </>
        ) : (
          <>
            Request Invitation
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
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

function LandingPageContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reason: '',
  });

  const handleRequestInvite = () => {
    setIsModalOpen(true);
    setFormState('idle');
    setErrorMessage('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset form after closing
    setTimeout(() => {
      setFormData({ name: '', email: '', reason: '' });
      setFormState('idle');
      setErrorMessage('');
    }, 200);
  };

  return (
    <>
      <SEO {...SEOPresets.home} />
      <SkipLink />

      <main id="main-content" className="min-h-screen bg-[#020617] text-white overflow-x-hidden">
        {/* Section 1: Hero with CTA */}
        <HeroSection onRequestInvite={handleRequestInvite} />

        {/* Section 2: Automated Profile Creation */}
        <AutomatedProfile />

        {/* Section 3: Explore Feed Preview */}
        <ExplorePreview />

        {/* Section 4: Side Quests Preview */}
        <SideQuestsPreview />

        {/* Section 5: Testimonials */}
        <Testimonials />

        {/* Section 6: Final CTA */}
        <FinalCTA onRequestInvite={handleRequestInvite} />

        {/* Footer */}
        <Footer />
      </main>

      {/* Request Invitation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={formState === 'success' ? 'Request Received!' : 'Request an Invitation'}
      >
        {formState === 'success' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
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
              We've sent a confirmation to your email. We'll review your request and
              get back to you soon!
            </p>
            <a
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold hover:shadow-neon transition-all duration-300"
            >
              Explore Projects
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
          </div>
        ) : (
          <InvitationForm
            formState={formState}
            setFormState={setFormState}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            formData={formData}
            setFormData={setFormData}
          />
        )}
      </Modal>
    </>
  );
}

export default function LandingPage() {
  // Only wrap with reCAPTCHA provider if site key is configured
  if (RECAPTCHA_SITE_KEY) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
        <LandingPageContent />
      </GoogleReCaptchaProvider>
    );
  }

  // Fallback without reCAPTCHA for development
  return <LandingPageContent />;
}
