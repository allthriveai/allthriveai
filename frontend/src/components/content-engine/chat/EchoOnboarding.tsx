/**
 * EchoOnboarding - First-time onboarding flow for Echo Creator Coach
 * US-020: Echo first-time onboarding flow
 *
 * Displays welcome message with questions about:
 * - What platforms they create content for
 * - What topics they cover
 * - Who their audience is
 *
 * Stores preferences in localStorage and shows "Welcome back" on subsequent visits.
 */

import { useState, useCallback, useMemo } from 'react';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { EchoAvatar } from './EchoAvatar';
import type { Platform } from '@/types/contentEngine';

// localStorage key for Echo onboarding completion
const ECHO_ONBOARDING_KEY = 'echo_onboarding_complete';
const ECHO_PREFERENCES_KEY = 'echo_preferences';

export interface EchoPreferences {
  platforms: Platform[];
  topics: string[];
  audience: string;
  completedAt: string;
}

// Platform options
interface PlatformOption {
  id: Platform;
  label: string;
  description: string;
}

const platformOptions: PlatformOption[] = [
  { id: 'twitter', label: 'Twitter/X', description: 'Short-form posts and threads' },
  { id: 'linkedin', label: 'LinkedIn', description: 'Professional content and articles' },
  { id: 'youtube', label: 'YouTube', description: 'Video scripts and descriptions' },
];

// Topic suggestions
const topicSuggestions = [
  'AI & Tech',
  'Business & Startups',
  'Marketing',
  'Personal Development',
  'Design',
  'Productivity',
  'Leadership',
  'Career Advice',
];

// Audience presets
interface AudienceOption {
  id: string;
  label: string;
  description: string;
}

const audienceOptions: AudienceOption[] = [
  { id: 'professionals', label: 'Professionals', description: 'Working professionals in your industry' },
  { id: 'entrepreneurs', label: 'Entrepreneurs', description: 'Founders and business owners' },
  { id: 'creators', label: 'Creators', description: 'Fellow content creators' },
  { id: 'general', label: 'General Audience', description: 'Anyone interested in your topics' },
];

type OnboardingStep = 'welcome' | 'platforms' | 'topics' | 'audience' | 'complete';

interface EchoOnboardingProps {
  onComplete: (preferences: EchoPreferences) => void;
  onSkip: () => void;
}

// Helper to check if onboarding is complete
export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ECHO_ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

// Helper to get saved preferences
export function getEchoPreferences(): EchoPreferences | null {
  try {
    const data = localStorage.getItem(ECHO_PREFERENCES_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Helper to clear onboarding (for testing)
export function clearEchoOnboarding(): void {
  try {
    localStorage.removeItem(ECHO_ONBOARDING_KEY);
    localStorage.removeItem(ECHO_PREFERENCES_KEY);
  } catch {
    // Ignore errors
  }
}

export function EchoOnboarding({ onComplete, onSkip }: EchoOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle platform toggle
  const handlePlatformToggle = useCallback((platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }, []);

  // Handle topic toggle
  const handleTopicToggle = useCallback((topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  }, []);

  // Add custom topic
  const handleAddCustomTopic = useCallback(() => {
    const topic = customTopic.trim();
    if (topic && !selectedTopics.includes(topic)) {
      setSelectedTopics(prev => [...prev, topic]);
      setCustomTopic('');
    }
  }, [customTopic, selectedTopics]);

  // Save preferences and complete
  const handleComplete = useCallback(() => {
    setIsSubmitting(true);

    const preferences: EchoPreferences = {
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['twitter'],
      topics: selectedTopics,
      audience: selectedAudience || 'general',
      completedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(ECHO_ONBOARDING_KEY, 'true');
      localStorage.setItem(ECHO_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Continue even if localStorage fails - use in-memory state
    }

    setStep('complete');
    setTimeout(() => {
      setIsSubmitting(false);
      onComplete(preferences);
    }, 800);
  }, [selectedPlatforms, selectedTopics, selectedAudience, onComplete]);

  // Handle skip
  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(ECHO_ONBOARDING_KEY, 'true');
    } catch {
      // Continue even if localStorage fails
    }
    onSkip();
  }, [onSkip]);

  // Go to next step
  const goToNextStep = useCallback(() => {
    switch (step) {
      case 'welcome':
        setStep('platforms');
        break;
      case 'platforms':
        setStep('topics');
        break;
      case 'topics':
        setStep('audience');
        break;
      case 'audience':
        handleComplete();
        break;
    }
  }, [step, handleComplete]);

  // Check if can proceed
  const canProceed = useMemo(() => {
    switch (step) {
      case 'welcome':
        return true;
      case 'platforms':
        return selectedPlatforms.length > 0;
      case 'topics':
        return true; // Topics are optional
      case 'audience':
        return selectedAudience !== '';
      default:
        return false;
    }
  }, [step, selectedPlatforms, selectedAudience]);

  // Render welcome step
  const renderWelcome = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <EchoAvatar size="lg" className="flex-shrink-0 mt-1" />
        <div className="space-y-3">
          <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
            <p className="text-lg font-medium mb-2">Hey there! I'm Echo</p>
            <p className="text-sm text-slate-300">
              Your content brainstorming partner. I help you generate ideas, craft hooks, and plan content that resonates.
            </p>
          </div>
          <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
            <p className="text-sm">
              Before we dive in, let me learn a bit about your content goals. This will help me give you more relevant suggestions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render platforms step
  const renderPlatforms = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
        <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
          <p className="font-medium">Where do you share your content?</p>
          <p className="text-sm text-slate-400 mt-1">Select all platforms you use</p>
        </div>
      </div>

      <div className="grid gap-2 pl-9">
        {platformOptions.map(platform => (
          <button
            key={platform.id}
            type="button"
            onClick={() => handlePlatformToggle(platform.id)}
            aria-pressed={selectedPlatforms.includes(platform.id)}
            className={`
              w-full p-3 rounded-xl text-left transition-all
              ${selectedPlatforms.includes(platform.id)
                ? 'bg-cyan-500/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
                : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}
              border
            `}
          >
            <p className="font-medium text-white">{platform.label}</p>
            <p className="text-xs text-slate-400">{platform.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // Render topics step
  const renderTopics = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
        <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
          <p className="font-medium">What topics do you cover?</p>
          <p className="text-sm text-slate-400 mt-1">Select any that apply or add your own</p>
        </div>
      </div>

      <div className="pl-9">
        <div className="flex flex-wrap gap-2 mb-3">
          {topicSuggestions.map(topic => (
            <button
              key={topic}
              type="button"
              onClick={() => handleTopicToggle(topic)}
              aria-pressed={selectedTopics.includes(topic)}
              className={`
                px-3 py-1.5 rounded-full text-sm transition-all
                ${selectedTopics.includes(topic)
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'}
              `}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Custom topics display */}
        {selectedTopics.filter(t => !topicSuggestions.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedTopics.filter(t => !topicSuggestions.includes(t)).map(topic => (
              <span
                key={topic}
                className="px-3 py-1.5 rounded-full text-sm bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30 flex items-center gap-1"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => handleTopicToggle(topic)}
                  className="ml-1 hover:text-cyan-100"
                  aria-label={`Remove ${topic}`}
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Custom topic input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTopic();
              }
            }}
            placeholder="Add your own topic..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
          <button
            type="button"
            onClick={handleAddCustomTopic}
            disabled={!customTopic.trim()}
            className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );

  // Render audience step
  const renderAudience = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
        <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
          <p className="font-medium">Who's your audience?</p>
          <p className="text-sm text-slate-400 mt-1">This helps me suggest content that resonates</p>
        </div>
      </div>

      <div className="grid gap-2 pl-9">
        {audienceOptions.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedAudience(option.id)}
            aria-pressed={selectedAudience === option.id}
            className={`
              w-full p-3 rounded-xl text-left transition-all
              ${selectedAudience === option.id
                ? 'bg-cyan-500/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
                : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}
              border
            `}
          >
            <p className="font-medium text-white">{option.label}</p>
            <p className="text-xs text-slate-400">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // Render completion state
  const renderComplete = () => (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <EchoAvatar size="lg" className="mx-auto mb-4" />
        <p className="text-lg font-medium text-white mb-2">All set!</p>
        <p className="text-sm text-slate-400">Let's brainstorm some content...</p>
      </div>
    </div>
  );

  // Step indicator
  const stepNumber = useMemo(() => {
    const steps: OnboardingStep[] = ['welcome', 'platforms', 'topics', 'audience'];
    return steps.indexOf(step) + 1;
  }, [step]);

  return (
    <div className="h-full flex flex-col" aria-label="Echo onboarding">
      {/* Progress indicator */}
      {step !== 'complete' && step !== 'welcome' && (
        <div className="px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < stepNumber ? 'bg-cyan-500' :
                    i === stepNumber ? 'bg-cyan-400' :
                    'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">Step {stepNumber - 1} of 3</span>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === 'welcome' && renderWelcome()}
        {step === 'platforms' && renderPlatforms()}
        {step === 'topics' && renderTopics()}
        {step === 'audience' && renderAudience()}
        {step === 'complete' && renderComplete()}
      </div>

      {/* Action buttons */}
      {step !== 'complete' && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip for now
            </button>

            <button
              type="button"
              onClick={goToNextStep}
              disabled={!canProceed || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'audience' ? "Let's Go" : 'Continue'}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * WelcomeBackMessage - Shown to returning users
 */
export function WelcomeBackMessage() {
  const preferences = getEchoPreferences();

  return (
    <div className="flex items-start gap-3">
      <EchoAvatar size="sm" className="flex-shrink-0 mt-1" />
      <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-200">
        <p className="font-medium">Welcome back!</p>
        <p className="text-sm text-slate-400 mt-1">
          {preferences?.topics?.length
            ? `Ready to brainstorm more ${preferences.topics[0]} content?`
            : "Let's create something great together."}
        </p>
      </div>
    </div>
  );
}
