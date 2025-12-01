import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthChatStream } from '@/hooks/useAuthChatStream';
import { MessageList } from '@/components/auth/MessageList';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { MeshGradient } from '@paper-design/shaders-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const {
    state,
    submitEmail,
    acceptUsername,
    rejectUsername,
    submitUsername,
    submitName,
    submitPassword,
    submitInterests,
    agreeToValues,
    clearError,
    beginEmailEntry,
  } = useAuthChatStream();

  const [emailInput, setEmailInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  // Initialize mesh gradient
  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // The initial welcome message is typed locally in the chat hook, so we
  // don't need to start the backend chat until the user submits data.

  // Redirect if authenticated and flow complete
  useEffect(() => {
    if (isAuthenticated && state.step === 'complete' && user?.username) {
      // Redirect to explore page with welcome flag to trigger onboarding chat
      navigate('/explore?welcome=true');
    }
  }, [isAuthenticated, state.step, user?.username, navigate]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      submitEmail(emailInput.trim());
      setEmailInput('');
    }
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      submitUsername(usernameInput.trim());
      setUsernameInput('');
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstNameInput.trim() && lastNameInput.trim()) {
      submitName(firstNameInput.trim(), lastNameInput.trim());
      setFirstNameInput('');
      setLastNameInput('');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput) {
      submitPassword(passwordInput);
      setPasswordInput('');
    }
  };

  const handleInterestsSubmit = () => {
    if (selectedInterests.length > 0) {
      submitInterests(selectedInterests);
      setSelectedInterests([]);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const interests = [
    { id: 'explore', label: 'Explore' },
    { id: 'share_skills', label: 'Share my skills' },
    { id: 'invest', label: 'Invest in AI projects' },
    { id: 'mentor', label: 'Mentor others' },
  ];

  return (
    <div className="h-screen flex items-center justify-center bg-brand-dark p-4 relative overflow-hidden">
      {/* Animated MeshGradient Background */}
      <div className="fixed inset-0 w-screen h-screen z-0">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={[
                "#4991e5",  // brand blue
                "#39bdd6",  // brand cyan
                "#3bd4cb",  // brand teal
                "#00a4bd",  // primary 600
                "#00bda5",  // primary 500
                "#080b12",  // brand dark
              ]}
              distortion={0.7}
              swirl={0.5}
              grainMixer={0}
              grainOverlay={0}
              speed={0.3}
              offsetX={0.08}
            />
            <div className="absolute inset-0 pointer-events-none z-10 bg-black/30" />
          </>
        )}
      </div>

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-30">
        <ThemeToggle />
      </div>

      {/* Main Chat Container */}
      <div className="w-full max-w-3xl h-[calc(100vh-2rem)] mx-auto relative z-20">
        {/* Chat Card */}
        <div className="glass-strong rounded overflow-hidden h-full flex flex-col">
          {/* Header */}
          <div className="px-8 py-6 text-center border-b border-white/10 flex-shrink-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to All Thrive</h1>
            <p className="text-gray-600 dark:text-gray-300">Learn, play, and share everything you create with AI</p>
          </div>

          {/* Messages Area - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <MessageList messages={state.messages} isStreaming={state.isStreaming} />
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="px-6 py-3">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm flex justify-between items-center">
                <span>{state.error}</span>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300 font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-white/10 px-8 py-6 bg-white/5 dark:bg-black/5 flex-shrink-0">
          {/* Welcome - Show OAuth Buttons */}
          {state.step === 'welcome' && (
            <div className="flex flex-col items-center">
              <OAuthButtons onEmailClick={beginEmailEntry} />
            </div>
          )}

          {/* Email Input */}
          {state.step === 'email' && !state.isStreaming && (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                disabled={state.isStreaming}
              />
              <button
                type="submit"
                disabled={!emailInput.trim() || state.isStreaming}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </form>
          )}

          {/* Username Suggest - Yes/No Choice */}
          {state.step === 'username_suggest' && !state.isStreaming && (
            <div className="space-y-3">
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded p-4 mb-4">
                <p className="text-sm text-primary-700 dark:text-indigo-300">
                  Suggested username: <span className="font-bold">@{state.suggestedUsername}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={acceptUsername}
                  disabled={state.isStreaming}
                  className="btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Yes
                </button>
                <button
                  onClick={rejectUsername}
                  disabled={state.isStreaming}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Username Custom Input */}
          {state.step === 'username_custom' && !state.isStreaming && (
            <form onSubmit={handleUsernameSubmit} className="space-y-3">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                placeholder="your_username"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                disabled={state.isStreaming}
              />
              <button
                type="submit"
                disabled={!usernameInput.trim() || state.isStreaming}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </form>
          )}

          {/* Name Input */}
          {state.step === 'name' && !state.isStreaming && (
            <form onSubmit={handleNameSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={firstNameInput}
                  onChange={(e) => setFirstNameInput(e.target.value)}
                  placeholder="First name"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                <input
                  type="text"
                  value={lastNameInput}
                  onChange={(e) => setLastNameInput(e.target.value)}
                  placeholder="Last name"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={!firstNameInput.trim() || !lastNameInput.trim()}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50"
              >
                Continue
              </button>
            </form>
          )}

          {/* Password Input */}
          {state.step === 'password' && !state.isStreaming && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
                autoFocus
                minLength={8}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.mode === 'signup' ? 'At least 8 characters with letters and numbers' : ''}
              </p>
              <button
                type="submit"
                disabled={!passwordInput}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50"
              >
                {state.mode === 'login' ? 'Log In' : 'Continue'}
              </button>
            </form>
          )}

          {/* Interests Selection */}
          {state.step === 'interests' && !state.isStreaming && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {interests.map((interest) => (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={`px-4 py-3 rounded border-2 transition-all duration-200 font-medium text-sm ${
                      selectedInterests.includes(interest.id)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'
                    }`}
                  >
                    {interest.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleInterestsSubmit}
                disabled={selectedInterests.length === 0}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* Values Agreement */}
          {(state.step === 'values' || state.step === 'agreement') && !state.isStreaming && (
            <div className="space-y-3">
              <button
                onClick={agreeToValues}
                className="w-full btn-primary text-white py-3 px-4 rounded  transition-all duration-200 font-medium"
              >
                Yes, I Agree
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
