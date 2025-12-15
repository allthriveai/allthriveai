import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type RefObject } from 'react';
import { ProjectPreviewTray } from '@/components/projects/ProjectPreviewTray';
import type { Project } from '@/types/models';

interface ProjectPreviewTrayContextValue {
  /** Open the project preview tray for a specific project */
  openProjectPreview: (project: Project) => void;
  /** Close the project preview tray */
  closeProjectPreview: () => void;
  /** Whether the project preview tray is currently open */
  isProjectPreviewOpen: boolean;
  /** The current project being displayed (null if closed) */
  currentProject: Project | null;
  /** Register a feed scroll container for scroll-to-close on mobile */
  setFeedScrollContainer: (element: HTMLElement | null) => void;
  /** Ref to the feed scroll container */
  feedScrollContainerRef: RefObject<HTMLElement | null>;
}

const ProjectPreviewTrayContext = createContext<ProjectPreviewTrayContextValue | undefined>(undefined);

interface ProjectPreviewTrayProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages the global project preview tray state.
 *
 * Add this provider to your app layout (e.g., DashboardLayout) to enable
 * project previews throughout the application.
 *
 * @example
 * ```tsx
 * // In DashboardLayout.tsx
 * import { ProjectPreviewTrayProvider } from '@/context/ProjectPreviewTrayContext';
 *
 * export function DashboardLayout({ children }) {
 *   return (
 *     <ProjectPreviewTrayProvider>
 *       {children}
 *     </ProjectPreviewTrayProvider>
 *   );
 * }
 *
 * // In any component
 * import { useProjectPreviewTray } from '@/context/ProjectPreviewTrayContext';
 *
 * function ProjectCard({ project }) {
 *   const { openProjectPreview } = useProjectPreviewTray();
 *   return (
 *     <button onClick={() => openProjectPreview(project)}>
 *       Preview
 *     </button>
 *   );
 * }
 * ```
 */
export function ProjectPreviewTrayProvider({ children }: ProjectPreviewTrayProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const feedScrollContainerRef = useRef<HTMLElement | null>(null);

  const openProjectPreview = useCallback((project: Project) => {
    // Close any open tool trays first
    window.dispatchEvent(new CustomEvent('closeAllToolTrays'));
    setCurrentProject(project);
    setIsOpen(true);
  }, []);

  const closeProjectPreview = useCallback(() => {
    setIsOpen(false);
    // Note: We don't clear currentProject immediately to allow
    // the close animation to complete with the content still visible
  }, []);

  const setFeedScrollContainer = useCallback((element: HTMLElement | null) => {
    feedScrollContainerRef.current = element;
  }, []);

  return (
    <ProjectPreviewTrayContext.Provider
      value={{
        openProjectPreview,
        closeProjectPreview,
        isProjectPreviewOpen: isOpen,
        currentProject,
        setFeedScrollContainer,
        feedScrollContainerRef,
      }}
    >
      {children}
      <ProjectPreviewTray
        isOpen={isOpen}
        onClose={closeProjectPreview}
        project={currentProject}
        feedScrollContainerRef={feedScrollContainerRef}
      />
    </ProjectPreviewTrayContext.Provider>
  );
}

/**
 * Hook to access the project preview tray context.
 *
 * Must be used within a ProjectPreviewTrayProvider.
 *
 * @throws Error if used outside of ProjectPreviewTrayProvider
 *
 * @example
 * ```tsx
 * const { openProjectPreview } = useProjectPreviewTray();
 *
 * <button onClick={() => openProjectPreview(project)}>
 *   Quick Preview
 * </button>
 * ```
 */
export function useProjectPreviewTray(): ProjectPreviewTrayContextValue {
  const context = useContext(ProjectPreviewTrayContext);
  if (context === undefined) {
    throw new Error('useProjectPreviewTray must be used within a ProjectPreviewTrayProvider');
  }
  return context;
}

/**
 * Safe version of useProjectPreviewTray that returns null when outside ProjectPreviewTrayProvider.
 * Use this in components that may render before the provider is available.
 */
export function useProjectPreviewTraySafe(): ProjectPreviewTrayContextValue | null {
  const context = useContext(ProjectPreviewTrayContext);
  return context ?? null;
}
