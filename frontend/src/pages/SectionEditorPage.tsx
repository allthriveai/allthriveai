/**
 * SectionEditorPage - Main page for the section-based project editor
 *
 * This page provides an inline editing experience similar to Notion,
 * where users can edit their project content directly in a layout
 * that mirrors the published view.
 *
 * Key features:
 * - Inline editing of all project metadata
 * - Drag-and-drop section reordering
 * - Real-time preview of changes
 * - Auto-save with visual feedback
 *
 * This replaces the legacy ProjectEditorPage for all projects.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO } from '@/components/common/SEO';
import { getProjectBySlug } from '@/services/projects';
import type { Project } from '@/types/models';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  SectionEditorProvider,
  useSectionEditorContext,
} from '@/contexts/SectionEditorContext';
import { EditorTopBar } from '@/components/projects/editor/EditorTopBar';
import { EditorSidebar } from '@/components/projects/editor/EditorSidebar';
import { BannerEditor } from '@/components/projects/editor/BannerEditor';
import { SectionsEditorCanvas } from '@/components/projects/editor/SectionsEditorCanvas';

// ============================================================================
// Main Page Component
// ============================================================================

export default function SectionEditorPage() {
  const { username, projectSlug } = useParams<{
    username: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load project data
  useEffect(() => {
    async function loadProject() {
      if (!projectSlug || !username) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getProjectBySlug(username, projectSlug);
        setProject(data);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Project not found');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectSlug, username]);

  // Handle slug change (navigate to new URL)
  const handleSlugChange = (newSlug: string) => {
    if (username) {
      navigate(`/${username}/${newSlug}/edit`, { replace: true });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading editor...</p>
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
              The project you're trying to edit doesn't exist or you don't have
              permission to edit it.
            </p>
            <Link
              to={`/${username}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout autoCollapseSidebar>
      <SEO
        title={`Edit: ${project.title}`}
        description={`Editing ${project.title}`}
      />
      <SectionEditorProvider
        project={project}
        onProjectUpdate={setProject}
        onSlugChange={handleSlugChange}
      >
        <EditorContent />
      </SectionEditorProvider>
    </DashboardLayout>
  );
}

// ============================================================================
// Editor Content (uses context)
// ============================================================================

function EditorContent() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <EditorTopBar />

      {/* Settings Sidebar */}
      <EditorSidebar />

      {/* Main Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner Editor */}
        <BannerEditor />

        {/* Content Area */}
        <div className="max-w-6xl mx-auto px-8 py-12">
          {/* Inline Editable Title */}
          <InlineEditableTitle />

          {/* Inline Editable Description */}
          <InlineEditableDescription />

          {/* Sections Editor Canvas */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
            <SectionsEditorCanvas />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Editable Components
// ============================================================================

function InlineEditableTitle() {
  const { title, setTitle } = useSectionEditorContext();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(title);

  // Sync local value when title changes externally
  useEffect(() => {
    setLocalValue(title);
  }, [title]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== title) {
      setTitle(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full text-4xl md:text-5xl font-bold bg-transparent border-b-2 border-primary-500 focus:outline-none text-gray-900 dark:text-white mb-6"
        placeholder="Project Title"
        autoFocus
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-4xl md:text-5xl font-bold cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors text-gray-900 dark:text-white mb-6"
    >
      {title || 'Click to add title...'}
    </h1>
  );
}

function InlineEditableDescription() {
  const { description, setDescription } = useSectionEditorContext();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(description);

  // Sync local value when description changes externally
  useEffect(() => {
    setLocalValue(description);
  }, [description]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== description) {
      setDescription(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(description);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full text-lg bg-transparent border-2 border-primary-500 rounded-lg p-3 focus:outline-none text-gray-600 dark:text-gray-300 mb-8 resize-none min-h-[100px]"
        placeholder="Add a description for your project..."
        autoFocus
        rows={4}
      />
    );
  }

  return (
    <p
      onClick={() => setIsEditing(true)}
      className="text-lg cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-2 -mx-2 transition-colors text-gray-600 dark:text-gray-300 mb-8 min-h-[60px]"
    >
      {description || 'Click to add a description...'}
    </p>
  );
}
