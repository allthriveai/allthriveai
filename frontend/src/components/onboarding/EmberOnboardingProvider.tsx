/**
 * EmberOnboardingProvider
 *
 * Global provider for Ember's onboarding experience.
 * Ember is the friendly dragon guide for new AllThrive users.
 * Onboarding now happens in the intelligent chat (EmberHomePage/ChatSidebar).
 * This provider handles the banner for remaining adventures.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AdventureId } from '@/hooks/useEmberOnboarding';
import { useEmberOnboarding } from '@/hooks/useEmberOnboarding';

interface EmberOnboardingContextValue {
  // State
  isLoaded: boolean;
  hasSeenModal: boolean;
  completedAdventures: AdventureId[];
  isDismissed: boolean;
  allAdventuresComplete: boolean;
  shouldShowBanner: boolean;

  // Actions
  completeAdventure: (adventureId: AdventureId) => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
  isAdventureComplete: (adventureId: AdventureId) => boolean;
}

const EmberOnboardingContext = createContext<EmberOnboardingContextValue | null>(null);

export function useEmberOnboardingContext() {
  const context = useContext(EmberOnboardingContext);
  if (!context) {
    throw new Error('useEmberOnboardingContext must be used within EmberOnboardingProvider');
  }
  return context;
}

// Safe version that returns null if not in provider (for optional use)
export function useEmberOnboardingContextSafe() {
  return useContext(EmberOnboardingContext);
}

interface EmberOnboardingProviderProps {
  children: ReactNode;
}

export function EmberOnboardingProvider({ children }: EmberOnboardingProviderProps) {
  const {
    isLoaded,
    hasSeenModal,
    completedAdventures,
    isDismissed,
    shouldShowBanner,
    allAdventuresComplete,
    completeAdventure,
    dismissOnboarding,
    resetOnboarding,
    isAdventureComplete,
  } = useEmberOnboarding();

  // Determine if banner should show
  // Once all 4 adventures are complete, banner never shows again (no celebration mode)
  const showBanner = shouldShowBanner && !allAdventuresComplete;

  const contextValue: EmberOnboardingContextValue = {
    isLoaded,
    hasSeenModal,
    completedAdventures,
    isDismissed,
    allAdventuresComplete,
    shouldShowBanner: showBanner,
    completeAdventure,
    dismissOnboarding,
    resetOnboarding,
    isAdventureComplete,
  };

  // Onboarding modal is now replaced by in-chat onboarding in EmberHomePage/ChatSidebar
  return (
    <EmberOnboardingContext.Provider value={contextValue}>
      {children}
    </EmberOnboardingContext.Provider>
  );
}

export default EmberOnboardingProvider;
