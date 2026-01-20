/**
 * EchoAgentContext
 * US-024: Centralized state management for Echo Creator Coach
 *
 * Provides mode state, active idea tracking, and session context
 * for the conversation-first redesign.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  EchoMode,
  EchoAgentState,
  EchoSessionContext,
  SuggestedIdea,
  ContentPillar,
  Platform,
} from '@/types/contentEngine';

// Action types for mode transitions
interface EchoAgentActions {
  setMode: (mode: EchoMode) => void;
  setActiveIdea: (idea: SuggestedIdea | null) => void;
  setActivePillars: (pillars: ContentPillar[]) => void;
  setActivePlatforms: (platforms: Platform[]) => void;
  transitionTo: (mode: EchoMode, idea?: SuggestedIdea | null) => void;
  recordIdeaSaved: () => void;
  recordAction: (action: string) => void;
  resetSession: () => void;
}

// Combined context type
interface EchoAgentContextType extends EchoAgentState, EchoAgentActions {}

// Initial session context
const initialSessionContext: EchoSessionContext = {
  ideasSavedThisSession: 0,
  lastAction: undefined,
  lastActionTime: undefined,
};

// Initial state
const initialState: EchoAgentState = {
  mode: 'idle',
  activeIdea: null,
  activePillars: [],
  activePlatforms: [],
  sessionContext: initialSessionContext,
};

// Create context with undefined default
const EchoAgentContext = createContext<EchoAgentContextType | undefined>(
  undefined
);

interface EchoAgentProviderProps {
  children: ReactNode;
  initialMode?: EchoMode;
}

/**
 * EchoAgentProvider
 *
 * Provides centralized state management for Echo Creator Coach.
 * Wraps the content engine UI to share state across components.
 */
export function EchoAgentProvider({
  children,
  initialMode = 'idle',
}: EchoAgentProviderProps) {
  const [mode, setModeState] = useState<EchoMode>(initialMode);
  const [activeIdea, setActiveIdeaState] = useState<SuggestedIdea | null>(null);
  const [activePillars, setActivePillarsState] = useState<ContentPillar[]>([]);
  const [activePlatforms, setActivePlatformsState] = useState<Platform[]>([]);
  const [sessionContext, setSessionContext] =
    useState<EchoSessionContext>(initialSessionContext);

  // Set mode with logging for invalid transitions
  const setMode = useCallback((newMode: EchoMode) => {
    const validModes: EchoMode[] = [
      'idle',
      'brainstorm',
      'create',
      'schedule',
      'review',
    ];
    if (!validModes.includes(newMode)) {
      console.warn(`Invalid EchoMode transition attempted: ${newMode}`);
    }
    setModeState(newMode);
  }, []);

  // Set active idea
  const setActiveIdea = useCallback((idea: SuggestedIdea | null) => {
    setActiveIdeaState(idea);
  }, []);

  // Set active pillars
  const setActivePillars = useCallback((pillars: ContentPillar[]) => {
    setActivePillarsState(pillars);
  }, []);

  // Set active platforms
  const setActivePlatforms = useCallback((platforms: Platform[]) => {
    setActivePlatformsState(platforms);
  }, []);

  // Transition to a new mode with optional idea
  const transitionTo = useCallback(
    (newMode: EchoMode, idea?: SuggestedIdea | null) => {
      setMode(newMode);
      if (idea !== undefined) {
        setActiveIdea(idea);
      }

      // Record the transition
      setSessionContext((prev) => ({
        ...prev,
        lastAction: `transition_to_${newMode}`,
        lastActionTime: new Date(),
      }));
    },
    [setMode, setActiveIdea]
  );

  // Record that an idea was saved
  const recordIdeaSaved = useCallback(() => {
    setSessionContext((prev) => ({
      ...prev,
      ideasSavedThisSession: prev.ideasSavedThisSession + 1,
      lastAction: 'idea_saved',
      lastActionTime: new Date(),
    }));
  }, []);

  // Record a generic action
  const recordAction = useCallback((action: string) => {
    setSessionContext((prev) => ({
      ...prev,
      lastAction: action,
      lastActionTime: new Date(),
    }));
  }, []);

  // Reset session context
  const resetSession = useCallback(() => {
    setModeState('idle');
    setActiveIdeaState(null);
    setSessionContext(initialSessionContext);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<EchoAgentContextType>(
    () => ({
      // State
      mode,
      activeIdea,
      activePillars,
      activePlatforms,
      sessionContext,
      // Actions
      setMode,
      setActiveIdea,
      setActivePillars,
      setActivePlatforms,
      transitionTo,
      recordIdeaSaved,
      recordAction,
      resetSession,
    }),
    [
      mode,
      activeIdea,
      activePillars,
      activePlatforms,
      sessionContext,
      setMode,
      setActiveIdea,
      setActivePillars,
      setActivePlatforms,
      transitionTo,
      recordIdeaSaved,
      recordAction,
      resetSession,
    ]
  );

  return (
    <EchoAgentContext.Provider value={value}>
      {children}
    </EchoAgentContext.Provider>
  );
}

/**
 * useEchoAgent hook
 *
 * Returns the Echo Agent state and actions.
 * Must be used within an EchoAgentProvider.
 */
export function useEchoAgent(): EchoAgentContextType {
  const context = useContext(EchoAgentContext);

  if (context === undefined) {
    throw new Error('useEchoAgent must be used within an EchoAgentProvider');
  }

  return context;
}

// Export the context for testing purposes
export { EchoAgentContext };
