/**
 * Tour System Types
 *
 * Type definitions for the reusable tour/walkthrough system.
 * Tours are guided experiences led by Ember that navigate users through platform features.
 */

import type { AdventureId } from '@/hooks/useEmberOnboarding';

export type TourId = 'platform_walkthrough';

/**
 * A single step in a tour.
 */
export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** Page to navigate to AFTER this step when clicking Next (optional - stays on current page if not specified) */
  targetPath?: string;
  /** Title shown in the modal header */
  title: string;
  /** Ember's dialogue for this step - shown with typewriter effect */
  dialogue: string | string[];
  /** Optional bullet points to highlight key features */
  features?: string[];
  /** Delay in ms before showing the modal after navigation (useful for page load) */
  showDelay?: number;
  /** Icon to display for this step (FontAwesome icon name) */
  icon?: string;
  /** Gradient colors for the step card */
  gradient?: string;
}

/**
 * Complete definition of a tour.
 */
export interface TourDefinition {
  /** Unique identifier for this tour */
  id: TourId;
  /** Display title for the tour */
  title: string;
  /** Short description of what the tour covers */
  description: string;
  /** Ordered list of steps in the tour */
  steps: TourStep[];
  /** Adventure ID to mark complete when tour finishes (links to onboarding system) */
  adventureId?: AdventureId;
  /** Points awarded on completion */
  completionPoints?: number;
}

/**
 * Persisted tour state (stored in localStorage).
 */
export interface TourState {
  /** Currently active tour ID (null if no tour is active) */
  tourId: TourId | null;
  /** Current step index within the active tour */
  currentStepIndex: number;
  /** Whether a tour is currently active */
  isActive: boolean;
  /** List of completed tour IDs */
  completedTours: TourId[];
  /** Timestamp when the current tour was started */
  startedAt?: string;
}

/**
 * Default tour state.
 */
export const defaultTourState: TourState = {
  tourId: null,
  currentStepIndex: 0,
  isActive: false,
  completedTours: [],
};
