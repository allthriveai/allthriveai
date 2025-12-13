import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { XMarkIcon, ArrowRightIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { api } from '@/services/api';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface ToolRequestTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolRequestTray({ isOpen, onClose }: ToolRequestTrayProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  // Form state
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    websiteUrl: '',
    description: '',
  });

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  // Track the visual open state (delayed to allow animation)
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      // First render the component (in closed position)
      setShouldRender(true);
      // Then after a frame, trigger the open animation
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      // Immediately start close animation
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Reset form when tray closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setFormData({ name: '', email: '', websiteUrl: '', description: '' });
        setFormState('idle');
        setErrorMessage('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMessage('');

    try {
      let recaptchaToken = '';
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha('tool_request');
        } catch (recaptchaError) {
          console.warn('reCAPTCHA failed, proceeding without token:', recaptchaError);
        }
      }

      await api.post('/invitations/request/', {
        name: formData.name,
        email: formData.email,
        reason: `[TOOL DIRECTORY REQUEST - Website: ${formData.websiteUrl}] ${formData.description}`,
        recaptcha_token: recaptchaToken,
        is_tool_request: true,
      });
      setFormState('success');
    } catch (error: unknown) {
      setFormState('error');
      const err = error as { response?: { data?: { error?: string }; status?: number } };
      if (err.response?.status === 409) {
        setErrorMessage('This email has already submitted a request. We\'ll review it soon!');
      } else if (err.response?.status === 429) {
        setErrorMessage('Too many requests. Please try again later.');
      } else if (err.response?.status === 400 && err.response?.data?.error?.includes('reCAPTCHA')) {
        setErrorMessage('Bot verification failed. Please try again.');
      } else {
        setErrorMessage(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    }
  }, [executeRecaptcha, formData]);

  if (!shouldRender) return null;

  const renderContent = () => {
    if (formState === 'success') {
      return (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden bg-gradient-to-r from-cyan-400 to-teal-400" style={{ borderRadius: 'var(--radius)' }}>
                  <svg
                    className="w-6 h-6 text-[#020617]"
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
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Request Received!</h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">We'll review your suggestion</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Success Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-[#020617]"
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
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                Thanks for your suggestion!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                We've received your request and will review it soon. We appreciate you helping us grow our directory!
              </p>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300"
              >
                Continue Exploring
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700" style={{ borderRadius: 'var(--radius)' }}>
                <PlusCircleIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Request a Tool</h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Suggest a new addition to our directory</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Know a tool or company that should be in our directory? Let us know!
            </p>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                {errorMessage}
              </div>
            )}

            <div>
              <label htmlFor="toolName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tool / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="toolName"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                placeholder="e.g., OpenAI, Midjourney"
                disabled={formState === 'submitting'}
              />
            </div>

            <div>
              <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Website URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                id="websiteUrl"
                required
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                placeholder="https://example.com"
                disabled={formState === 'submitting'}
              />
            </div>

            <div>
              <label htmlFor="requestEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Your Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="requestEmail"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                placeholder="you@example.com"
                disabled={formState === 'submitting'}
              />
            </div>

            <div>
              <label htmlFor="toolDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="toolDescription"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
                placeholder="Tell us what this tool does and why it should be in the directory..."
                disabled={formState === 'submitting'}
              />
            </div>

            <button
              type="submit"
              disabled={formState === 'submitting'}
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  Submit Request
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
              This site is protected by reCAPTCHA and the Google{' '}
              <a href="https://policies.google.com/privacy" className="text-cyan-600 dark:text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="https://policies.google.com/terms" className="text-cyan-600 dark:text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{' '}
              apply.
            </p>
          </form>
        </div>
      </>
    );
  };

  // Use portal to render tray at document body level
  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out ${
          visuallyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-96 lg:w-[32rem] border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${
          visuallyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {renderContent()}
      </aside>
    </>,
    document.body
  );
}
