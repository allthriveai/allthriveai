/**
 * ProjectContext - Shared state and actions for project detail views
 *
 * Provides project data, ownership status, and common actions (like, share,
 * comment, edit) to all child components without prop drilling.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project } from '@/types/models';
import { useProjectLike } from '@/hooks/useProjectLike';
import { useProjectShare } from '@/hooks/useProjectShare';

// ============================================================================
// Types
// ============================================================================

interface ProjectContextValue {
  // Project data
  project: Project;
  setProject: (project: Project) => void;

  // Ownership
  isOwner: boolean;

  // Like actions
  isLiked: boolean;
  heartCount: number;
  isLiking: boolean;
  toggleLike: () => Promise<void>;
  likeRewardId: string;

  // Share actions
  isShareModalOpen: boolean;
  openShareModal: () => void;
  closeShareModal: () => void;

  // Comment tray
  isCommentTrayOpen: boolean;
  openCommentTray: () => void;
  closeCommentTray: () => void;

  // Tool tray (centralized to prevent stacking)
  isToolTrayOpen: boolean;
  selectedToolSlug: string | null;
  openToolTray: (toolSlug: string) => void;
  closeToolTray: () => void;

  // Close all trays helper
  closeAllTrays: () => void;

  // Owner actions
  handleDelete: () => Promise<void>;
  handleToggleShowcase: () => Promise<void>;

  // Auth state
  isAuthenticated: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================


export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ProjectProviderProps {
  project: Project;
  onProjectUpdate?: (project: Project) => void;
  isOwner: boolean;
  isAuthenticated: boolean;
  onDelete: () => Promise<void>;
  onToggleShowcase: () => Promise<void>;
  children: ReactNode;
}

export function ProjectProvider({
  project: initialProject,
  onProjectUpdate,
  isOwner,
  isAuthenticated,
  onDelete,
  onToggleShowcase,
  children,
}: ProjectProviderProps) {
  // Project state - sync with prop changes (e.g., from polling)
  const [project, setProjectState] = useState(initialProject);

  useEffect(() => {
    setProjectState(initialProject);
  }, [initialProject]);

  const setProject = useCallback((updatedProject: Project) => {
    setProjectState(updatedProject);
    onProjectUpdate?.(updatedProject);
  }, [onProjectUpdate]);

  // Like hook
  const {
    isLiked,
    heartCount,
    isLiking,
    toggleLike,
    rewardId: likeRewardId,
  } = useProjectLike({
    projectId: project.id,
    initialIsLiked: project.isLikedByUser || false,
    initialHeartCount: project.heartCount || 0,
    isAuthenticated,
  });

  // Share hook
  const { isShareModalOpen, openShareModal: baseOpenShareModal, closeShareModal } = useProjectShare();

  // Comment tray state
  const [isCommentTrayOpen, setIsCommentTrayOpen] = useState(false);

  // Tool tray state (centralized)
  const [isToolTrayOpen, setIsToolTrayOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);

  // Close all trays helper - closes all sidebars/trays
  const closeAllTrays = useCallback(() => {
    setIsCommentTrayOpen(false);
    setIsToolTrayOpen(false);
    setSelectedToolSlug(null);
  }, []);

  // Open functions that close other trays first
  const openCommentTray = useCallback(() => {
    closeAllTrays();
    setIsCommentTrayOpen(true);
  }, [closeAllTrays]);

  const closeCommentTray = useCallback(() => setIsCommentTrayOpen(false), []);

  const openToolTray = useCallback((toolSlug: string) => {
    closeAllTrays();
    setSelectedToolSlug(toolSlug);
    setIsToolTrayOpen(true);
  }, [closeAllTrays]);

  const closeToolTray = useCallback(() => {
    setIsToolTrayOpen(false);
    setSelectedToolSlug(null);
  }, []);

  // Wrap share modal to close trays first
  const openShareModal = useCallback(() => {
    closeAllTrays();
    baseOpenShareModal();
  }, [closeAllTrays, baseOpenShareModal]);

  const value: ProjectContextValue = {
    project,
    setProject,
    isOwner,
    isLiked,
    heartCount,
    isLiking,
    toggleLike,
    likeRewardId,
    isShareModalOpen,
    openShareModal,
    closeShareModal,
    isCommentTrayOpen,
    openCommentTray,
    closeCommentTray,
    isToolTrayOpen,
    selectedToolSlug,
    openToolTray,
    closeToolTray,
    closeAllTrays,
    handleDelete: onDelete,
    handleToggleShowcase: onToggleShowcase,
    isAuthenticated,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
