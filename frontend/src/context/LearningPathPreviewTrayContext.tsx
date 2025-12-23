import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type RefObject } from 'react';
import { LearningPathPreviewTray } from '@/components/learning/LearningPathPreviewTray';
import type { PublicLearningPath } from '@/services/learningPaths';

interface LearningPathPreviewTrayContextValue {
  /** Open the learning path preview tray for a specific path */
  openLearningPathPreview: (learningPath: PublicLearningPath) => void;
  /** Close the learning path preview tray */
  closeLearningPathPreview: () => void;
  /** Whether the learning path preview tray is currently open */
  isLearningPathPreviewOpen: boolean;
  /** The current learning path being displayed (null if closed) */
  currentLearningPath: PublicLearningPath | null;
  /** Register a feed scroll container for scroll-to-close on mobile */
  setFeedScrollContainer: (element: HTMLElement | null) => void;
  /** Ref to the feed scroll container */
  feedScrollContainerRef: RefObject<HTMLElement | null>;
}

const LearningPathPreviewTrayContext = createContext<LearningPathPreviewTrayContextValue | undefined>(undefined);

interface LearningPathPreviewTrayProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages the global learning path preview tray state.
 */
export function LearningPathPreviewTrayProvider({ children }: LearningPathPreviewTrayProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLearningPath, setCurrentLearningPath] = useState<PublicLearningPath | null>(null);
  const feedScrollContainerRef = useRef<HTMLElement | null>(null);

  const openLearningPathPreview = useCallback((learningPath: PublicLearningPath) => {
    // Close any open tool trays first
    window.dispatchEvent(new CustomEvent('closeAllToolTrays'));
    setCurrentLearningPath(learningPath);
    setIsOpen(true);
  }, []);

  const closeLearningPathPreview = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setFeedScrollContainer = useCallback((element: HTMLElement | null) => {
    feedScrollContainerRef.current = element;
  }, []);

  return (
    <LearningPathPreviewTrayContext.Provider
      value={{
        openLearningPathPreview,
        closeLearningPathPreview,
        isLearningPathPreviewOpen: isOpen,
        currentLearningPath,
        setFeedScrollContainer,
        feedScrollContainerRef,
      }}
    >
      {children}
      <LearningPathPreviewTray
        isOpen={isOpen}
        onClose={closeLearningPathPreview}
        learningPath={currentLearningPath}
        feedScrollContainerRef={feedScrollContainerRef}
      />
    </LearningPathPreviewTrayContext.Provider>
  );
}

/**
 * Hook to access the learning path preview tray context.
 */
export function useLearningPathPreviewTray(): LearningPathPreviewTrayContextValue {
  const context = useContext(LearningPathPreviewTrayContext);
  if (context === undefined) {
    throw new Error('useLearningPathPreviewTray must be used within a LearningPathPreviewTrayProvider');
  }
  return context;
}

/**
 * Safe version that returns null when outside the provider.
 */
export function useLearningPathPreviewTraySafe(): LearningPathPreviewTrayContextValue | null {
  const context = useContext(LearningPathPreviewTrayContext);
  return context ?? null;
}
