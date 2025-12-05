/**
 * ProjectDetailPage - Thin orchestration layer for project display
 *
 * This page handles:
 * - Data fetching and loading states
 * - Analysis polling for GitHub/Figma projects
 * - SEO metadata
 * - Routing to appropriate layout via ProjectLayoutRouter
 *
 * All display logic is delegated to layout components via ProjectContext.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { getProjectBySlug, deleteProject, updateProject } from '@/services/projects';
import { trackProjectView, getViewSourceFromReferrer } from '@/services/tracking';
import type { Project } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { ProjectProvider } from '@/context/ProjectContext';
import { ProjectLayoutRouter } from '@/components/projects/layouts';

/** Polling interval for analysis status (GitHub/Figma projects) */
const ANALYSIS_POLL_INTERVAL_MS = 3000;

export default function ProjectDetailPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to track loading state for event handlers (avoids stale closure)
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Load project data
  useEffect(() => {
    async function loadProject() {
      if (!username || !projectSlug) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getProjectBySlug(username, projectSlug);
        setProject(data);

        // Track the view (fire and forget - don't block UI)
        if (data.id) {
          trackProjectView(data.id, getViewSourceFromReferrer());
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Project not found');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();

    // Reload when window regains focus or becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoadingRef.current) {
        loadProject();
      }
    };

    const handleFocus = () => {
      if (!isLoadingRef.current) {
        loadProject();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [username, projectSlug]);

  // Analysis polling for GitHub and Figma projects
  useEffect(() => {
    if (!project) return;

    // Determine which content key to check based on project type
    const contentKey = project.type === 'github_repo'
      ? 'github'
      : project.type === 'figma_design'
      ? 'figma'
      : null;

    if (!contentKey) return;

    const status = project.content?.[contentKey]?.analysis_status;

    // Poll if analysis is pending
    if (status === 'pending') {
      const pollInterval = setInterval(async () => {
        if (!username || !projectSlug) return;

        try {
          const updated = await getProjectBySlug(username, projectSlug);
          const newStatus = updated.content?.[contentKey]?.analysis_status;

          if (newStatus !== 'pending') {
            setProject(updated);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Failed to poll for analysis status:', error);
          clearInterval(pollInterval);
        }
      }, ANALYSIS_POLL_INTERVAL_MS);

      return () => clearInterval(pollInterval);
    }
  }, [project, username, projectSlug]);

  const isOwner = isAuthenticated && user && project && user.username.toLowerCase() === project.username.toLowerCase();

  // Handler functions for ProjectContext
  const handleDelete = async () => {
    if (!project) return;

    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await deleteProject(project.id);
      navigate(`/${username}`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  const handleToggleShowcase = async () => {
    if (!project) return;

    try {
      const updatedProject = await updateProject(project.id, {
        isShowcased: !project.isShowcased,
      });
      setProject(updatedProject);
    } catch (error) {
      console.error('Failed to update showcase setting:', error);
      alert('Failed to update showcase setting');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The project you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <button
              onClick={() => navigate(`/${username}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Render project with appropriate layout
  return (
    <DashboardLayout autoCollapseSidebar>
      <SEO
        title={project.title}
        description={project.description || `${project.title} by @${project.username} on All Thrive AI`}
        image={project.featuredImageUrl || project.bannerUrl || 'https://allthrive.ai/og-image.jpg'}
        url={`https://allthrive.ai/${username}/${projectSlug}`}
        type="article"
      />
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
        <ProjectProvider
          project={project}
          onProjectUpdate={setProject}
          isOwner={isOwner || false}
          isAuthenticated={isAuthenticated}
          onDelete={handleDelete}
          onToggleShowcase={handleToggleShowcase}
        >
          <ProjectLayoutRouter />
        </ProjectProvider>
      </div>
    </DashboardLayout>
  );
}
