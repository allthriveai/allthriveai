import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type RefObject } from 'react';
import { LessonPreviewTray } from '@/components/learning/LessonPreviewTray';
import type { PublicLesson } from '@/services/learningPaths';

interface LessonPreviewTrayContextValue {
  /** Open the lesson preview tray for a specific lesson */
  openLessonPreview: (lesson: PublicLesson) => void;
  /** Close the lesson preview tray */
  closeLessonPreview: () => void;
  /** Whether the lesson preview tray is currently open */
  isLessonPreviewOpen: boolean;
  /** The current lesson being displayed (null if closed) */
  currentLesson: PublicLesson | null;
  /** Register a feed scroll container for scroll-to-close on mobile */
  setFeedScrollContainer: (element: HTMLElement | null) => void;
  /** Ref to the feed scroll container */
  feedScrollContainerRef: RefObject<HTMLElement | null>;
}

const LessonPreviewTrayContext = createContext<LessonPreviewTrayContextValue | undefined>(undefined);

interface LessonPreviewTrayProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages the global lesson preview tray state.
 */
export function LessonPreviewTrayProvider({ children }: LessonPreviewTrayProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<PublicLesson | null>(null);
  const feedScrollContainerRef = useRef<HTMLElement | null>(null);

  const openLessonPreview = useCallback((lesson: PublicLesson) => {
    // Close any open tool trays first
    window.dispatchEvent(new CustomEvent('closeAllToolTrays'));
    setCurrentLesson(lesson);
    setIsOpen(true);
  }, []);

  const closeLessonPreview = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setFeedScrollContainer = useCallback((element: HTMLElement | null) => {
    feedScrollContainerRef.current = element;
  }, []);

  return (
    <LessonPreviewTrayContext.Provider
      value={{
        openLessonPreview,
        closeLessonPreview,
        isLessonPreviewOpen: isOpen,
        currentLesson,
        setFeedScrollContainer,
        feedScrollContainerRef,
      }}
    >
      {children}
      <LessonPreviewTray
        isOpen={isOpen}
        onClose={closeLessonPreview}
        lesson={currentLesson}
      />
    </LessonPreviewTrayContext.Provider>
  );
}

/**
 * Hook to access the lesson preview tray context.
 */
export function useLessonPreviewTray(): LessonPreviewTrayContextValue {
  const context = useContext(LessonPreviewTrayContext);
  if (context === undefined) {
    throw new Error('useLessonPreviewTray must be used within a LessonPreviewTrayProvider');
  }
  return context;
}

/**
 * Safe version that returns null when outside the provider.
 */
export function useLessonPreviewTraySafe(): LessonPreviewTrayContextValue | null {
  const context = useContext(LessonPreviewTrayContext);
  return context ?? null;
}
