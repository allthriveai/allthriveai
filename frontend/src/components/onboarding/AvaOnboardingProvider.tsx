/**
 * AvaOnboardingProvider
 *
 * Global provider for Ava's onboarding experience.
 * Ava is the friendly AI guide for new AllThrive users.
 * Onboarding now happens in the intelligent chat (AvaHomePage/ChatSidebar).
 * This provider handles the banner for remaining adventures.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AdventureId } from '@/hooks/useAvaOnboarding';
import { useAvaOnboarding } from '@/hooks/useAvaOnboarding';

interface AvaOnboardingContextValue {
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

const AvaOnboardingContext = createContext<AvaOnboardingContextValue | null>(null);

export function useAvaOnboardingContext() {
  const context = useContext(AvaOnboardingContext);
  if (!context) {
    throw new Error('useAvaOnboardingContext must be used within AvaOnboardingProvider');
  }
  return context;
}

// Safe version that returns null if not in provider (for optional use)
export function useAvaOnboardingContextSafe() {
  return useContext(AvaOnboardingContext);
}

interface AvaOnboardingProviderProps {
  children: ReactNode;
}

export function AvaOnboardingProvider({ children }: AvaOnboardingProviderProps) {
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
  } = useAvaOnboarding();

  // Determine if banner should show
  // Once all 4 adventures are complete, banner never shows again (no celebration mode)
  const showBanner = shouldShowBanner && !allAdventuresComplete;

  const contextValue: AvaOnboardingContextValue = {
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

  // Onboarding modal is now replaced by in-chat onboarding in AvaHomePage/ChatSidebar
  return (
    <AvaOnboardingContext.Provider value={contextValue}>
      {children}
    </AvaOnboardingContext.Provider>
  );
}

export default AvaOnboardingProvider;
