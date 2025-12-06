/**
 * EmberOnboardingProvider
 *
 * Global provider for Ember's onboarding experience.
 * Ember is the friendly dragon guide for new AllThrive users.
 * Shows the modal on first login, then the banner for remaining adventures.
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useSageOnboarding, type AdventureId } from '@/hooks/useSageOnboarding';
import { SageOnboardingModal } from './SageOnboardingModal';
import { useAuth } from '@/hooks/useAuth';

interface SageOnboardingContextValue {
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

const SageOnboardingContext = createContext<SageOnboardingContextValue | null>(null);

export function useSageOnboardingContext() {
  const context = useContext(SageOnboardingContext);
  if (!context) {
    throw new Error('useSageOnboardingContext must be used within SageOnboardingProvider');
  }
  return context;
}

// Safe version that returns null if not in provider (for optional use)
export function useSageOnboardingContextSafe() {
  return useContext(SageOnboardingContext);
}

interface SageOnboardingProviderProps {
  children: ReactNode;
}

export function SageOnboardingProvider({ children }: SageOnboardingProviderProps) {
  const { user } = useAuth();
  const {
    isLoaded,
    hasSeenModal,
    completedAdventures,
    isDismissed,
    shouldShowModal,
    shouldShowBanner,
    allAdventuresComplete,
    markModalSeen,
    completeAdventure,
    dismissOnboarding,
    awardWelcomePoints,
    resetOnboarding,
    isAdventureComplete,
  } = useSageOnboarding();

  // Handle adventure selection from modal
  const handleSelectAdventure = useCallback(
    (adventureId: AdventureId) => {
      completeAdventure(adventureId);
      awardWelcomePoints();
    },
    [completeAdventure, awardWelcomePoints]
  );

  // Handle modal close (mark as seen even if skipped)
  const handleModalClose = useCallback(() => {
    markModalSeen();
  }, [markModalSeen]);

  // Determine if banner should show (either in progress or celebration)
  const showBanner = shouldShowBanner || (allAdventuresComplete && !isDismissed);

  const contextValue: SageOnboardingContextValue = {
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

  return (
    <SageOnboardingContext.Provider value={contextValue}>
      {children}

      {/* Modal for first-time users */}
      <SageOnboardingModal
        isOpen={shouldShowModal}
        onClose={handleModalClose}
        onSelectAdventure={handleSelectAdventure}
        username={user?.username || user?.firstName || 'Adventurer'}
      />
    </SageOnboardingContext.Provider>
  );
}

export default SageOnboardingProvider;
