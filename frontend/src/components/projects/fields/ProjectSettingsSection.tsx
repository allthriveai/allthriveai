/**
 * ProjectSettingsSection - Reusable project settings UI
 * Used in both ProjectEditTray and ProjectEditorPage
 */

import { useState } from 'react';
import { updateProject, listProjects, deleteProjectRedirect } from '@/services/projects';
import type { Project } from '@/types/models';
import { generateSlug } from '@/utils/slug';
import { FaStar, FaLock, FaEye } from 'react-icons/fa';
import { EyeIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ProjectSettingsSectionProps {
  project: Project;
  onProjectUpdate: (updatedProject: Project) => void;
  editorProps: {
    editableSlug: string;
    customSlugSet: boolean;
    projectTitle: string;
    isSaving: boolean;
    setEditableSlug: (slug: string) => void;
    setCustomSlugSet: (set: boolean) => void;
    handleToggleShowcase?: () => Promise<void>;
  };
  /** Callback when preview is clicked (optional) */
  onPreviewClick?: () => void;
}

export function ProjectSettingsSection({
  project,
  onProjectUpdate,
  editorProps,
  onPreviewClick,
}: ProjectSettingsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Visibility Options */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Visibility</h3>
        <div className="space-y-2">
          {/* Top Highlighted */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <FaStar className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Top Highlighted</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Featured at the very top of your profile</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={project.isHighlighted || false}
              onChange={async () => {
                try {
                  const updated = await updateProject(project.id, {
                    isHighlighted: !project.isHighlighted,
                  });
                  onProjectUpdate(updated);
                } catch (error) {
                  console.error('Failed to update:', error);
                }
              }}
              disabled={editorProps.isSaving}
              className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
            />
          </label>

          {/* Showcase */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <FaEye className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Showcase Profile</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Display in showcase section</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={project.isShowcase}
              onChange={async () => {
                if (editorProps.handleToggleShowcase) {
                  await editorProps.handleToggleShowcase();
                } else {
                  try {
                    const updated = await updateProject(project.id, {
                      isShowcase: !project.isShowcase,
                    });
                    onProjectUpdate(updated);
                  } catch (error) {
                    console.error('Failed to update:', error);
                  }
                }
              }}
              disabled={editorProps.isSaving}
              className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
            />
          </label>

          {/* Private */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <FaLock className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Private Project</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hide from public, only visible to you</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={project.isPrivate || false}
              onChange={async () => {
                try {
                  const updated = await updateProject(project.id, {
                    isPrivate: !project.isPrivate,
                  });
                  onProjectUpdate(updated);
                } catch (error) {
                  console.error('Failed to update:', error);
                }
              }}
              disabled={editorProps.isSaving}
              className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
            />
          </label>
        </div>
      </div>

      {/* Preview & Actions */}
      {onPreviewClick && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
          <div className="space-y-2">
            <button
              onClick={onPreviewClick}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <EyeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Preview</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See how it looks</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Project URL Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Project URL</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Customize your project's URL. Changes will automatically create a redirect from the old URL.
        </p>

        {/* Current URL Display */}
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current URL</p>
          <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
            {typeof window !== 'undefined' && window.location.origin}/{project.username}/{editorProps.editableSlug || 'untitled'}
          </p>
        </div>

        {/* Slug Editor */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-gray-400">URL Slug</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">/{project.username}/</span>
              <input
                type="text"
                value={editorProps.editableSlug}
                onChange={(e) => {
                  editorProps.setEditableSlug(e.target.value);
                  editorProps.setCustomSlugSet(true);
                }}
                placeholder="project-slug"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </label>

          {editorProps.customSlugSet && (
            <button
              onClick={() => {
                editorProps.setCustomSlugSet(false);
                const newSlug = generateSlug(editorProps.projectTitle);
                editorProps.setEditableSlug(newSlug);
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
            <strong>Note:</strong> When you change the URL, the old URL will automatically redirect to the new one, so existing links won't break.
          </p>
        </div>

        {/* Active Redirects */}
        {project.redirects && project.redirects.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Active Redirects</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              These old URLs redirect to your current project URL
            </p>
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(redirect.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete redirect from "/${redirect.oldSlug}"?\n\nThis URL will no longer work and cannot be undone.`)) {
                        try {
                          await deleteProjectRedirect(project.id, redirect.id);
                          // Refresh project data
                          const projects = await listProjects();
                          const updatedProject = projects.find(p => p.id === project.id);
                          if (updatedProject) {
                            onProjectUpdate(updatedProject);
                          }
                        } catch (error) {
                          console.error('Failed to delete redirect:', error);
                          alert('Failed to delete redirect. Please try again.');
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
    </div>
  );
}
