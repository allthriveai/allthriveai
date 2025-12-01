/**
 * ProjectLayoutRouter - Routes projects to their appropriate layout component
 *
 * This component centralizes all layout selection logic, making it easy to:
 * - Add new project types with dedicated layouts
 * - Handle pending states for async analysis
 * - Provide consistent fallback behavior
 *
 * Must be used within a ProjectProvider.
 */

import type { Project } from '@/types/models';
import { useProjectContext } from '@/context/ProjectContext';
import { GitHubProjectLayout } from '../github/GitHubProjectLayout';
import { GitHubProjectPendingView } from '../github/GitHubProjectPendingView';
import { FigmaProjectLayout } from '../figma/FigmaProjectLayout';
import { FigmaProjectPendingView } from '../figma/FigmaProjectPendingView';
import { RedditThreadLayout } from '../reddit/RedditThreadLayout';
import { DefaultProjectLayout } from './DefaultProjectLayout';

/**
 * Determines the analysis status for a project based on its type.
 * Returns null for project types without async analysis.
 */
function getAnalysisStatus(project: Project): 'pending' | 'complete' | null {
  const contentKey = project.type === 'github_repo'
    ? 'github'
    : project.type === 'figma_design'
    ? 'figma'
    : null;

  if (!contentKey) return null;

  const status = project.content?.[contentKey]?.analysis_status;
  return status || null;
}

export function ProjectLayoutRouter() {
  const { project } = useProjectContext();
  const analysisStatus = getAnalysisStatus(project);

  // GitHub Repository Layout
  if (project.type === 'github_repo') {
    // Show pending view while analysis is in progress
    if (analysisStatus === 'pending') {
      return <GitHubProjectPendingView project={project} />;
    }
    // Show full layout when analysis is complete
    if (analysisStatus === 'complete' && project.content?.github?.analysis) {
      return <GitHubProjectLayout project={project} />;
    }
    // Fall through to default if no analysis yet
  }

  // Figma Design Layout
  if (project.type === 'figma_design') {
    // Show pending view while analysis is in progress
    if (analysisStatus === 'pending') {
      return <FigmaProjectPendingView project={project} />;
    }
    // Show full layout when analysis is complete
    if (analysisStatus === 'complete' && project.content?.figma?.analysis) {
      return <FigmaProjectLayout project={project} />;
    }
    // Fall through to default if no analysis yet
  }

  // Reddit Thread Layout
  if (project.type === 'reddit_thread') {
    return <RedditThreadLayout project={project} />;
  }

  // Default layout for all other project types:
  // - prompts
  // - image_collection
  // - other
  // - github_repo without analysis
  // - figma_design without analysis
  return <DefaultProjectLayout />;
}
