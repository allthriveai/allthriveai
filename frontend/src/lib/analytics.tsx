/**
 * PostHog Analytics Provider
 *
 * Features:
 * - Lazy loading (only loads after page is interactive)
 * - Automatic user identification
 * - Privacy-friendly (respects Do Not Track)
 * - Performance optimized (won't block rendering)
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

interface AnalyticsContextValue {
  isReady: boolean;
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  identifyUser: (userId: string, traits?: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  isReady: false,
  trackEvent: () => {},
  identifyUser: () => {},
});

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Skip if no API key configured
    if (!POSTHOG_KEY) {
      console.info('PostHog analytics disabled (no API key)');
      return;
    }

    // Respect Do Not Track
    if (navigator.doNotTrack === '1') {
      console.info('PostHog analytics disabled (Do Not Track enabled)');
      return;
    }

    // Initialize PostHog after page is interactive (lazy load)
    // This ensures analytics never blocks critical rendering
    const initializePostHog = () => {
      try {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          // Privacy settings
          opt_out_capturing_by_default: false,
          respect_dnt: true,

          // Performance settings
          loaded: () => {
            setIsReady(true);
            console.info('PostHog analytics initialized');
          },

          // Auto-capture settings
          autocapture: {
            // Capture clicks on buttons, links, and form submissions
            dom_event_allowlist: ['click', 'submit'],
            // Don't capture sensitive data
            capture_copied_text: false,
          },

          // Session recording (disabled by default, can enable in PostHog dashboard)
          disable_session_recording: false,

          // Feature flags
          bootstrap: {
            featureFlags: {},
          },
        });
      } catch (error) {
        console.error('Failed to initialize PostHog:', error);
      }
    };

    // Wait for page to be interactive before loading analytics
    if (document.readyState === 'complete') {
      // Page already loaded, initialize immediately
      setTimeout(initializePostHog, 0);
    } else {
      // Wait for page load
      window.addEventListener('load', initializePostHog, { once: true });
    }

    return () => {
      // Cleanup on unmount
      if (isReady) {
        posthog.reset();
      }
    };
  }, []);

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (!isReady || !POSTHOG_KEY) return;

    try {
      posthog.capture(eventName, properties);
    } catch (error) {
      // Never let analytics errors break the app
      console.error('Failed to track event:', error);
    }
  };

  const identifyUser = (userId: string, traits?: Record<string, any>) => {
    if (!isReady || !POSTHOG_KEY) return;

    try {
      posthog.identify(userId, traits);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  };

  return (
    <AnalyticsContext.Provider value={{ isReady, trackEvent, identifyUser }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// Helper function to track page views
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;

  try {
    posthog.capture('$pageview', {
      page_name: pageName,
      ...properties,
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
}
