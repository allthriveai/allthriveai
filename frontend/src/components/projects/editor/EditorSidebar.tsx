/**
 * EditorSidebar - Settings panel for the section editor
 *
 * Slide-out panel that provides access to:
 * - Visibility settings (showcase, highlighted, private)
 * - URL/slug customization
 * - Tools selection
 * - Categories and topics
 * - Project external URL
 *
 * Uses the SectionEditorContext for all state management.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  XMarkIcon,
  EyeIcon,
  TrashIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { FaStar, FaLock, FaEye } from 'react-icons/fa';
import { useSectionEditorContext } from '@/contexts/SectionEditorContext';
import { updateProject, deleteProjectRedirect } from '@/services/projects';
import { generateSlug } from '@/utils/slug';
import { ToolSelector } from '@/components/projects/ToolSelector';

export function EditorSidebar() {
  const {
    project,
    sidebarOpen,
    setSidebarOpen,
    slug,
    setSlug,
    customSlugSet,
    setCustomSlugSet,
    title,
    externalUrl,
    setExternalUrl,
    tools,
    setTools,
    isSaving,
  } = useSectionEditorContext();

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    }

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, setSidebarOpen]);

  // Handle Escape key to close
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    }

    if (sidebarOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [sidebarOpen, setSidebarOpen]);

  // Local project state for visibility toggles (need to sync with parent)
  const handleUpdateProject = async (updates: Record<string, boolean>) => {
    try {
      await updateProject(project.id, updates);
      // Note: The context will sync on next save
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  if (!sidebarOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto transform transition-transform"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Project Settings
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Visibility Settings */}
          <VisibilitySection
            project={project}
            isSaving={isSaving}
            onUpdate={handleUpdateProject}
          />

          {/* Project URL */}
          <UrlSection
            project={project}
            slug={slug}
            setSlug={setSlug}
            customSlugSet={customSlugSet}
            setCustomSlugSet={setCustomSlugSet}
            title={title}
          />

          {/* External URL */}
          <ExternalUrlSection
            externalUrl={externalUrl}
            setExternalUrl={setExternalUrl}
            isSaving={isSaving}
          />

          {/* Tools Used */}
          <ToolsSection tools={tools} setTools={setTools} isSaving={isSaving} />

          {/* Preview Link */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Actions
            </h3>
            <Link
              to={`/${project.username}/${project.slug}`}
              target="_blank"
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <EyeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Preview Project
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  See how it looks to visitors
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Visibility Section
// ============================================================================

interface VisibilitySectionProps {
  project: { isHighlighted?: boolean; isShowcase: boolean; isPrivate?: boolean };
  isSaving: boolean;
  onUpdate: (updates: Record<string, boolean>) => Promise<void>;
}

function VisibilitySection({
  project,
  isSaving,
  onUpdate,
}: VisibilitySectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Visibility
      </h3>
      <div className="space-y-2">
        {/* Top Highlighted */}
        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex items-center gap-3">
            <FaStar className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Top Highlighted
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Featured at the very top
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={project.isHighlighted || false}
            onChange={() =>
              onUpdate({ isHighlighted: !project.isHighlighted })
            }
            disabled={isSaving}
            className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
          />
        </label>

        {/* Showcase */}
        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex items-center gap-3">
            <FaEye className="w-5 h-5 text-primary-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Showcase Profile
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Display in showcase section
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={project.isShowcase}
            onChange={() => onUpdate({ isShowcase: !project.isShowcase })}
            disabled={isSaving}
            className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
          />
        </label>

        {/* Private */}
        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex items-center gap-3">
            <FaLock className="w-5 h-5 text-gray-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Private Project
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Only visible to you
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={project.isPrivate || false}
            onChange={() => onUpdate({ isPrivate: !project.isPrivate })}
            disabled={isSaving}
            className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
          />
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// URL Section
// ============================================================================

interface UrlSectionProps {
  project: { id: number; username: string; redirects?: Array<{ id: number; oldSlug: string }> };
  slug: string;
  setSlug: (slug: string) => void;
  customSlugSet: boolean;
  setCustomSlugSet: (set: boolean) => void;
  title: string;
}

function UrlSection({
  project,
  slug,
  setSlug,
  customSlugSet,
  setCustomSlugSet,
  title,
}: UrlSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Project URL
      </h3>

      {/* Current URL Display */}
      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Current URL
        </p>
        <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
          {typeof window !== 'undefined' && window.location.origin}/
          {project.username}/{slug || 'untitled'}
        </p>
      </div>

      {/* Slug Editor */}
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            URL Slug
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              /{project.username}/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setCustomSlugSet(true);
              }}
              placeholder="project-slug"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </label>

        {customSlugSet && (
          <button
            onClick={() => {
              setCustomSlugSet(false);
              const newSlug = generateSlug(title);
              setSlug(newSlug);
            }}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Reset to auto-generate from title
          </button>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> Old URLs will automatically redirect to the new
          one.
        </p>
      </div>

      {/* Active Redirects */}
      {project.redirects && project.redirects.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Active Redirects
          </h4>
          <div className="space-y-2">
            {project.redirects.map((redirect) => (
              <div
                key={redirect.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                    /{project.username}/{redirect.oldSlug}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        `Delete redirect from "/${redirect.oldSlug}"?\n\nThis URL will no longer work.`
                      )
                    ) {
                      try {
                        await deleteProjectRedirect(project.id, redirect.id);
                      } catch (error) {
                        console.error('Failed to delete redirect:', error);
                      }
                    }
                  }}
                  className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete redirect"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// External URL Section
// ============================================================================

interface ExternalUrlSectionProps {
  externalUrl: string;
  setExternalUrl: (url: string) => void;
  isSaving: boolean;
}

function ExternalUrlSection({
  externalUrl,
  setExternalUrl,
  isSaving,
}: ExternalUrlSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        External Link
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Link to your live project, demo, or repository.
      </p>
      <div className="relative">
        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://example.com"
          disabled={isSaving}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Tools Section
// ============================================================================

interface ToolsSectionProps {
  tools: number[];
  setTools: (tools: number[]) => void;
  isSaving: boolean;
}

function ToolsSection({ tools, setTools, isSaving }: ToolsSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Tools Used
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Select the technologies and tools used in this project.
      </p>
      <ToolSelector
        selectedToolIds={tools}
        onChange={setTools}
        disabled={isSaving}
      />
    </div>
  );
}
