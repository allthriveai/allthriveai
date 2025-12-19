/**
 * useEmberOnboarding Hook
 *
 * Manages Ember's onboarding state - tracking which adventures are completed,
 * whether to show the modal/banner, and persisting state to localStorage.
 * Ember is the friendly dragon guide for new AllThrive users.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Legacy IDs for backwards compatibility, new IDs for avatar-focused onboarding
export type AdventureId = 'battle_pip' | 'add_project' | 'explore' | 'personalize' | 'play' | 'learn';

interface EmberOnboardingState {
  hasSeenModal: boolean;
  completedAdventures: AdventureId[];
  isDismissed: boolean;
  welcomePointsAwarded: boolean;
}

const STORAGE_KEY = 'ember_onboarding';

// Dev mode: Force onboarding to always show for testing
// Set to true to always show onboarding, false for normal behavior
const DEV_FORCE_ONBOARDING = import.meta.env.DEV && false;

if (DEV_FORCE_ONBOARDING) {
  console.log('[EmberOnboarding] DEV MODE: Forcing onboarding to always show');
}

const defaultState: EmberOnboardingState = {
  hasSeenModal: false,
  completedAdventures: [],
  isDismissed: false,
  welcomePointsAwarded: false,
};

function getStorageKey(userId: number | string): string {
  return `${STORAGE_KEY}_${userId}`;
}

function loadState(userId: number | string): EmberOnboardingState {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      return { ...defaultState, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[EmberOnboarding] Failed to load state:', e);
  }
  return defaultState;
}

function saveState(userId: number | string, state: EmberOnboardingState): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch (e) {
    console.error('[EmberOnboarding] Failed to save state:', e);
  }
}

export function useEmberOnboarding() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<EmberOnboardingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if user is on a battle invite page - skip onboarding for these users
  // so they can accept the battle challenge without interruption
  const isOnBattleInvitePage = location.pathname.startsWith('/battle/invite/');

  // Check if user is on a public/landing page - don't show onboarding on these pages
  // even if the user is authenticated (e.g., PWA with inherited cookies)
  // Note: /explore is NOT included here - authenticated users should see the banner there
  const publicPages = ['/', '/about', '/tools', '/login', '/signup', '/privacy', '/terms'];
  const isOnPublicPage = publicPages.includes(location.pathname) ||
    location.pathname.startsWith('/@') || // Profile pages
    location.pathname.startsWith('/play/prompt-battles/') || // Battle share pages
    location.pathname.startsWith('/battles/') || // Legacy battle share pages
    location.pathname.startsWith('/styleguide');

  // Load state when user changes
  useEffect(() => {
    if (user?.id) {
      const loaded = loadState(user.id);
      setState(loaded);
      setIsLoaded(true);
    } else {
      setState(defaultState);
      setIsLoaded(false);
    }
  }, [user?.id]);

  // Save state when it changes
  useEffect(() => {
    if (user?.id && isLoaded) {
      saveState(user.id, state);
    }
  }, [user?.id, state, isLoaded]);

  // Should show the initial modal (first time user, but NOT for guest users, battle invite pages, or public pages)
  // Guest users are temporary accounts created for battle invitations - they shouldn't see onboarding
  // Battle invite pages should go straight to accepting the challenge without interruption
  // Public pages (landing, about, etc.) shouldn't show onboarding even if user has inherited auth cookies
  //
  // In dev mode with DEV_FORCE_ONBOARDING=true, always show onboarding for testing
  const shouldShowModal = DEV_FORCE_ONBOARDING
    ? isAuthenticated && isLoaded && !user?.isGuest && !isOnBattleInvitePage && !isOnPublicPage
    : isAuthenticated &&
      isLoaded &&
      !state.hasSeenModal &&
      !state.isDismissed &&
      !user?.isGuest &&
      !isOnBattleInvitePage &&
      !isOnPublicPage;

  // Should show the banner (has seen modal, hasn't dismissed, hasn't completed all 4 adventures)
  // Also skip for guest users, battle invite pages, and public pages
  // Once all 4 adventures are complete, banner never shows again
  const shouldShowBanner =
    isAuthenticated &&
    isLoaded &&
    state.hasSeenModal &&
    !state.isDismissed &&
    state.completedAdventures.length < 4 &&
    !user?.isGuest &&
    !isOnBattleInvitePage &&
    !isOnPublicPage;

  // All 4 adventures completed (battle_pip, add_project, explore, personalize)
  const allAdventuresComplete = state.completedAdventures.length >= 4;

  // Mark modal as seen
  const markModalSeen = useCallback(() => {
    setState((prev) => ({ ...prev, hasSeenModal: true }));
  }, []);

  // Complete an adventure
  const completeAdventure = useCallback((adventureId: AdventureId) => {
    setState((prev) => {
      if (prev.completedAdventures.includes(adventureId)) {
        return prev;
      }
      return {
        ...prev,
        completedAdventures: [...prev.completedAdventures, adventureId],
      };
    });
  }, []);

  // Dismiss the onboarding (modal or banner)
  const dismissOnboarding = useCallback(() => {
    setState((prev) => ({ ...prev, isDismissed: true, hasSeenModal: true }));
  }, []);

  // Award welcome points (only once)
  const awardWelcomePoints = useCallback(() => {
    setState((prev) => {
      if (prev.welcomePointsAwarded) return prev;
      // TODO: Call API to actually award points
      return { ...prev, welcomePointsAwarded: true };
    });
  }, []);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    setState(defaultState);
    if (user?.id) {
      localStorage.removeItem(getStorageKey(user.id));
    }
  }, [user?.id]);

  // Check if a specific adventure is complete
  const isAdventureComplete = useCallback(
    (adventureId: AdventureId) => {
      return state.completedAdventures.includes(adventureId);
    },
    [state.completedAdventures]
  );

  return {
    // State
    isLoaded,
    hasSeenModal: state.hasSeenModal,
    completedAdventures: state.completedAdventures,
    isDismissed: state.isDismissed,
    welcomePointsAwarded: state.welcomePointsAwarded,

    // Computed
    shouldShowModal,
    shouldShowBanner,
    allAdventuresComplete,

    // Actions
    markModalSeen,
    completeAdventure,
    dismissOnboarding,
    awardWelcomePoints,
    resetOnboarding,
    isAdventureComplete,
  };
}

export type { EmberOnboardingState };
