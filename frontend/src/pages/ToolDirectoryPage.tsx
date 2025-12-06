import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { getTools, getToolCategories, getToolCompanies, prefetchTool } from '@/services/tools';
import { ToolSearchBar, type ToolFilters } from '@/components/tools/ToolSearchBar';
import type { Tool } from '@/types/models';
import { api } from '@/services/api';
import { SparklesIcon, PlusCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface ToolRequestFormProps {
  formState: FormState;
  setFormState: (state: FormState) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  formData: { name: string; email: string; websiteUrl: string; description: string };
  setFormData: (data: { name: string; email: string; websiteUrl: string; description: string }) => void;
}

function ToolRequestForm({
  formState,
  setFormState,
  errorMessage,
  setErrorMessage,
  formData,
  setFormData,
}: ToolRequestFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

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
  }, [executeRecaptcha, formData, setFormState, setErrorMessage]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-gray-400 mb-4">
        Know a tool or company that should be in our directory? Let us know!
      </p>

      {errorMessage && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      <div>
        <label htmlFor="toolName" className="block text-sm font-medium text-gray-300 mb-1">
          Tool / Company Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="toolName"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          placeholder="e.g., OpenAI, Midjourney"
          disabled={formState === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-300 mb-1">
          Website URL <span className="text-red-400">*</span>
        </label>
        <input
          type="url"
          id="websiteUrl"
          required
          value={formData.websiteUrl}
          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          placeholder="https://example.com"
          disabled={formState === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="requestEmail" className="block text-sm font-medium text-gray-300 mb-1">
          Your Email <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          id="requestEmail"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          placeholder="you@example.com"
          disabled={formState === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="toolDescription" className="block text-sm font-medium text-gray-300 mb-1">
          Description <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="toolDescription"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 rounded bg-[#0f172a] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-none"
          placeholder="Tell us what this tool does and why it should be in the directory..."
          disabled={formState === 'submitting'}
        />
      </div>

      <button
        type="submit"
        disabled={formState === 'submitting'}
        className="w-full px-6 py-3 rounded bg-gradient-to-r from-cyan-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

function ToolDirectoryPageContent() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ToolFilters>({});
  const [categories, setCategories] = useState<Array<{ value: string; label: string; count: number }>>([]);
  const [companies, setCompanies] = useState<Array<{ id: number; name: string; slug: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tool request modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestFormState, setRequestFormState] = useState<FormState>('idle');
  const [requestErrorMessage, setRequestErrorMessage] = useState('');
  const [requestFormData, setRequestFormData] = useState({
    name: '',
    email: '',
    websiteUrl: '',
    description: '',
  });

  const handleOpenRequestModal = () => {
    setIsRequestModalOpen(true);
    setRequestFormState('idle');
    setRequestErrorMessage('');
  };

  const handleCloseRequestModal = () => {
    setIsRequestModalOpen(false);
    setTimeout(() => {
      setRequestFormData({ name: '', email: '', websiteUrl: '', description: '' });
      setRequestFormState('idle');
      setRequestErrorMessage('');
    }, 300);
  };

  // Check if a tool tray is currently open (via nested route)
  // When path is /tools/:slug, a tray is open
  const location = useLocation();
  const isToolTrayOpen = location.pathname !== '/tools' && location.pathname.startsWith('/tools/');

  // Load categories and companies on mount
  useEffect(() => {
    async function loadFilters() {
      try {
        const [categoriesData, companiesData] = await Promise.all([
          getToolCategories(),
          getToolCompanies(),
        ]);
        setCategories(categoriesData);
        setCompanies(companiesData);
      } catch (err) {
        console.error('Failed to load filter options:', err);
        // Filters are non-critical - tools will still load without them
      }
    }
    loadFilters();
  }, []);

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load tools when filters or debounced search change
  useEffect(() => {
    async function loadTools() {
      try {
        setIsLoading(true);
        setError(null);
        const params: any = { ...filters };
        if (debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }

        // Fetch all tools at once (no pagination limit) for directory view
        // This ensures users see all companies, tools, and technologies by default
        const response = await getTools({ ...params, page_size: 1000 });
        const toolsList = response.results;
        // Sort alphabetically
        toolsList.sort((a, b) => a.name.localeCompare(b.name));
        setTools(toolsList);
      } catch (err: any) {
        console.error('Failed to load tools:', err);
        setError(err?.error || 'Failed to load tool directory');
      } finally {
        setIsLoading(false);
      }
    }
    loadTools();
  }, [filters, debouncedSearch]);

  // Group tools by first letter for dictionary-style layout (memoized for performance)
  const groupedTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};
    tools.forEach((tool) => {
      const firstLetter = tool.name[0].toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(tool);
    });
    return groups;
  }, [tools]);

  const letters = useMemo(() => Object.keys(groupedTools).sort(), [groupedTools]);

  return (
    <DashboardLayout>
      {() => (
        <div className="flex-1 overflow-y-auto h-full">
          {/* Hero Banner - Neon Glass Style */}
          <header className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden" aria-label="Tool Directory page header">
            {/* Ambient Glow Background */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 dark:bg-cyan-500/20 blur-[120px] pointer-events-none" aria-hidden="true" />
            <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-yellow-500/10 dark:bg-yellow-500/10 blur-[100px] pointer-events-none" aria-hidden="true" />

            <div className="relative max-w-6xl mx-auto px-8 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-yellow-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-yellow-400 bg-clip-text text-transparent">Tool Directory</span>
              </h1>
              <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mb-6">
                Explore AI tools and technologies to enhance your workflow
              </p>
              <button
                onClick={handleOpenRequestModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 dark:bg-white/5 border border-gray-300 dark:border-gray-700 hover:border-cyan-400 dark:hover:border-cyan-500 text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] w-fit"
              >
                <PlusCircleIcon className="w-5 h-5" />
                Request to Add a Tool
              </button>
            </div>
          </header>

          <div className="max-w-6xl mx-auto p-8 pb-24">

            {/* Search Bar with Filters */}
            <div className="mb-6">
              <ToolSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                companies={companies}
              />
            </div>

            {/* Results count */}
            {!isLoading && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6" role="status" aria-live="polite">
                {tools.length} tool{tools.length !== 1 ? 's' : ''} found
              </p>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-8 animate-pulse" role="status" aria-live="polite">
                <span className="sr-only">Loading tools...</span>
                {[1, 2, 3].map((i) => (
                  <div key={i} aria-hidden="true">
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-4" />
                    <div className="space-y-4">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-24 bg-gray-300 dark:bg-gray-700 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="glass-subtle rounded-xl p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20" role="alert">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Tool Directory - Dictionary Style */}
            {!isLoading && !error && (
              <>
                {letters.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      {searchQuery || Object.keys(filters).length > 0
                        ? 'No tools found matching your criteria'
                        : 'No tools available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {letters.map((letter) => (
                      <div key={letter} id={letter}>
                        {/* Letter Header */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-bold text-2xl shadow-sm">
                            {letter}
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-300 dark:from-gray-700 to-transparent" />
                        </div>

                        {/* Tools in this letter */}
                        <div className="grid grid-cols-1 gap-4">
                          {groupedTools[letter].map((tool) => (
                            <Link
                              key={tool.id}
                              to={`/tools/${tool.slug}`}
                              replace={isToolTrayOpen}
                              className="block text-left glass-subtle p-6 border border-gray-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all hover:shadow-neon"
                              style={{ borderRadius: 'var(--radius)' }}
                              onMouseEnter={() => prefetchTool(tool.slug)}
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center overflow-hidden bg-white border border-gray-200 dark:border-gray-700" style={{ borderRadius: 'var(--radius)' }}>
                                  {tool.logoUrl ? (
                                    <img src={tool.logoUrl} alt={`${tool.name} logo`} className="w-10 h-10 object-contain" />
                                  ) : (
                                    <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="mb-2">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                      {tool.name}
                                    </h3>
                                    {tool.companyName && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        by {tool.companyName}
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                    {tool.tagline}
                                  </p>
                                  <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Alphabet Navigation (if more than 3 letters and no active search/filters) */}
                {letters.length > 3 && !searchQuery && Object.keys(filters).length === 0 && (
                  <div className="fixed bottom-8 right-8 glass-strong rounded-xl p-3 shadow-2xl border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col gap-1">
                      {letters.map((letter) => (
                        <a
                          key={letter}
                          href={`#${letter}`}
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Nested route outlet for tool detail drawer */}
          <Outlet />

          {/* Tool Request Modal */}
          <Modal
            isOpen={isRequestModalOpen}
            onClose={handleCloseRequestModal}
            title={requestFormState === 'success' ? 'Request Received!' : 'Request to Add a Tool'}
          >
            {requestFormState === 'success' ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 flex items-center justify-center">
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
                  Thanks for your suggestion!
                </h3>
                <p className="text-gray-400 mb-6">
                  We've received your request and will review it soon. We appreciate you helping us grow our directory!
                </p>
                <button
                  onClick={handleCloseRequestModal}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-[#020617] font-semibold hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300"
                >
                  Continue Exploring
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ToolRequestForm
                formState={requestFormState}
                setFormState={setRequestFormState}
                errorMessage={requestErrorMessage}
                setErrorMessage={setRequestErrorMessage}
                formData={requestFormData}
                setFormData={setRequestFormData}
              />
            )}
          </Modal>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function ToolDirectoryPage() {
  if (RECAPTCHA_SITE_KEY) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
        <ToolDirectoryPageContent />
      </GoogleReCaptchaProvider>
    );
  }
  return <ToolDirectoryPageContent />;
}
