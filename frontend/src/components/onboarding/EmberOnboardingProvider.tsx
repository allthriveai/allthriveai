/**
 * EmberOnboardingProvider
 *
 * Global provider for Ember's onboarding experience.
 * Ember is the friendly dragon guide for new AllThrive users.
 * Shows the modal on first login, then the banner for remaining adventures.
 */

import { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AdventureId } from '@/hooks/useEmberOnboarding';
import { useEmberOnboarding } from '@/hooks/useEmberOnboarding';
import { EmberOnboardingModal } from './EmberOnboardingModal';
import { useAuth } from '@/hooks/useAuth';

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
  } = useEmberOnboarding();

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

  return (
    <EmberOnboardingContext.Provider value={contextValue}>
      {children}

      {/* Modal for first-time users */}
      <EmberOnboardingModal
        isOpen={shouldShowModal}
        onClose={handleModalClose}
        onSelectAdventure={handleSelectAdventure}
        username={user?.username || user?.firstName || 'Adventurer'}
      />
    </EmberOnboardingContext.Provider>
  );
}

export default EmberOnboardingProvider;
