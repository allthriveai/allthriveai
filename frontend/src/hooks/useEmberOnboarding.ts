/**
 * useEmberOnboarding Hook
 *
 * Manages Ember's onboarding state - tracking which adventures are completed,
 * whether to show the modal/banner, and persisting state to localStorage.
 * Ember is the friendly dragon guide for new AllThrive users.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type AdventureId = 'battle_pip' | 'add_project' | 'explore' | 'personalize';

interface EmberOnboardingState {
  hasSeenModal: boolean;
  completedAdventures: AdventureId[];
  isDismissed: boolean;
  welcomePointsAwarded: boolean;
}

const STORAGE_KEY = 'ember_onboarding';

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
  const [state, setState] = useState<EmberOnboardingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // Should show the initial modal (first time user)
  const shouldShowModal = isAuthenticated && isLoaded && !state.hasSeenModal && !state.isDismissed;

  // Should show the banner (has seen modal, hasn't dismissed, hasn't completed all)
  const shouldShowBanner =
    isAuthenticated &&
    isLoaded &&
    state.hasSeenModal &&
    !state.isDismissed &&
    state.completedAdventures.length < 3;

  // All adventures completed
  const allAdventuresComplete = state.completedAdventures.length === 3;

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
