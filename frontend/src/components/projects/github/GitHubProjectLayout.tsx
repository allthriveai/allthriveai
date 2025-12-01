/**
 * GitHubProjectLayout - Display layout for GitHub repository projects
 *
 * Features:
 * - Hero section with title, description, and stats
 * - Quick Start commands
 * - Tech Stack grid
 * - Architecture diagram
 * - Key Features cards
 * - Project structure tree
 *
 * Inline Editing (for owners):
 * - Title and description are editable inline
 * - Changes auto-save via ProjectContext
 */

import { useCallback, useState } from 'react';
import type { Project } from '@/types/models';
import { useProjectContext } from '@/contexts/ProjectContext';
import { updateProject } from '@/services/projects';
import { TechStackGrid } from './TechStackGrid';
import { DirectoryTree } from './DirectoryTree';
import { MermaidDiagram } from '../shared/MermaidDiagram';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '../shared/InlineEditable';
import {
  CodeBracketIcon,
  CubeIcon,
  FolderIcon,
  RocketLaunchIcon,
  StarIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface GitHubProjectLayoutProps {
  project: Project;
}

export function GitHubProjectLayout({ project }: GitHubProjectLayoutProps) {
  const { isOwner, setProject } = useProjectContext();
  const analysis = project.content?.github?.analysis;
  const githubData = project.content?.github;

  const [isEditMode, setIsEditMode] = useState(true);
  const toggleEditMode = useCallback(() => setIsEditMode(prev => !prev), []);
  const isEditing = isOwner && isEditMode;

  // Handle title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    try {
      const updated = await updateProject(project.id, { title: newTitle });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }, [project.id, setProject]);

  // Handle description change
  const handleDescriptionChange = useCallback(async (newDescription: string) => {
    try {
      const updated = await updateProject(project.id, { description: newDescription });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  }, [project.id, setProject]);

  if (!analysis) {
    return null;
  }

  const hasQuickStart = analysis.quick_start && analysis.quick_start.length > 0;
  const hasFeatures = analysis.features_discovered && analysis.features_discovered.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Edit Mode Toggle for Owners */}
      <EditModeIndicator isOwner={isOwner} isEditMode={isEditMode} onToggle={toggleEditMode} />

      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-4">
          <InlineEditableTitle
            value={project.title}
            isEditable={isEditing}
            onChange={handleTitleChange}
            placeholder="Enter project title..."
            className="text-4xl font-bold text-gray-900 dark:text-white"
            as="h1"
          />
          {githubData?.stars !== undefined && githubData.stars > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0 ml-4">
              <StarIcon className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-gray-900 dark:text-white">{githubData.stars.toLocaleString()}</span>
            </div>
          )}
        </div>

        <InlineEditableText
          value={project.description || ''}
          isEditable={isEditing}
          onChange={handleDescriptionChange}
          placeholder="Add a description for your project..."
          className="text-xl text-gray-600 dark:text-gray-400 mb-6"
          multiline
          rows={3}
        />

        {/* Project Type Badge */}
        {analysis.project_type && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-lg mb-4">
            <CubeIcon className="w-5 h-5" />
            <span className="font-semibold capitalize">{analysis.project_type} Project</span>
          </div>
        )}

        {/* GitHub Link */}
        {project.externalUrl && (
          <div className="mt-4">
            <a
              href={project.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              <LinkIcon className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-16">
        {/* Quick Start Section */}
        {hasQuickStart && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <RocketLaunchIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Quick Start</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
              <div className="space-y-4">
                {analysis.quick_start.map((cmd: { label: string; command: string }, index: number) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{cmd.label}</p>
                      <code className="block px-4 py-2 bg-gray-900 dark:bg-gray-950 text-green-400 rounded font-mono text-sm">
                        {cmd.command}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tech Stack Section */}
        {analysis.tech_stack && Object.keys(analysis.tech_stack).length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <CodeBracketIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Tech Stack</h2>
            </div>
            <TechStackGrid technologies={analysis.tech_stack} />
          </section>
        )}

        {/* Architecture Diagram Section */}
        {analysis.architecture_diagram && (
          <section>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Architecture</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
              <MermaidDiagram code={analysis.architecture_diagram} />
            </div>
          </section>
        )}

        {/* Features Section */}
        {hasFeatures && (
          <section>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Key Features</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {analysis.features_discovered.map((feature: { title: string; tech: string; files?: string[] }, index: number) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{feature.tech}</p>
                  {feature.files && feature.files.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {feature.files.map((file, fileIndex) => (
                        <code
                          key={fileIndex}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-mono"
                        >
                          {file}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Project Structure Section */}
        {analysis.directory_tree && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <FolderIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Project Structure</h2>
            </div>
            <DirectoryTree tree={analysis.directory_tree} />
          </section>
        )}
      </div>

      {/* Analysis Footer */}
      {githubData?.analyzed_at && (
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Repository analyzed {new Date(githubData.analyzed_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
