import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

  const openProjectPreview = useCallback((project: Project) => {
    setCurrentProject(project);
    setIsOpen(true);
  }, []);

  const closeProjectPreview = useCallback(() => {
    setIsOpen(false);
    // Note: We don't clear currentProject immediately to allow
    // the close animation to complete with the content still visible
  }, []);

  return (
    <ProjectPreviewTrayContext.Provider
      value={{
        openProjectPreview,
        closeProjectPreview,
        isProjectPreviewOpen: isOpen,
        currentProject,
      }}
    >
      {children}
      <ProjectPreviewTray
        isOpen={isOpen}
        onClose={closeProjectPreview}
        project={currentProject}
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
