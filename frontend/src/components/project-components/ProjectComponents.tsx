/**
 * ProjectComponents - Main container for rendering project component layouts
 *
 * This component takes a ProjectComponentLayout and renders all components
 * in the correct order with proper spacing and layout.
 *
 * Features:
 * - Renders component layouts generated from integrations (GitHub, Figma, etc.)
 * - Supports inline editing when used within a ProjectProvider context
 * - Responsive design with proper spacing
 */

import { useState, useCallback } from 'react';
import type { ProjectComponentLayout } from '@/types/components';
import { ComponentList } from './ComponentRenderer';
import { useProjectContext } from '@/context/ProjectContext';
import { EditModeIndicator } from '@/components/projects/shared/InlineEditable';

interface ProjectComponentsProps {
  layout: ProjectComponentLayout;
  className?: string;
}

/**
 * Main container for rendering a project's component-based layout
 */
export function ProjectComponents({ layout, className }: ProjectComponentsProps) {
  const { components } = layout;
  const [isEditMode, setIsEditMode] = useState(true);
  const toggleEditMode = useCallback(() => setIsEditMode(prev => !prev), []);

  // Try to get project context for edit mode indicator
  let isOwner = false;
  try {
    const context = useProjectContext();
    isOwner = context.isOwner;
  } catch {
    // Not within a ProjectProvider
  }

  if (!components || components.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No content available for this project.
      </div>
    );
  }

  return (
    <div className={`project-components max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${className || ''}`}>
      {/* Edit Mode Toggle for Owners */}
      <EditModeIndicator isOwner={isOwner} isEditMode={isEditMode} onToggle={toggleEditMode} />

      {/* Component Layout */}
      <div className="space-y-12">
        <ComponentList components={components} />
      </div>
    </div>
  );
}

/**
 * Example layout for demonstration and testing
 */
export const EXAMPLE_GITHUB_LAYOUT: ProjectComponentLayout = {
  version: '1.0',
  integration: 'github',
  sourceUrl: 'https://github.com/anthropics/claude-code',
  generatedAt: new Date().toISOString(),
  components: [
    {
      id: 'hero-1',
      type: 'hero',
      order: 0,
      data: {
        title: 'Claude Code',
        subtitle: 'AI-powered coding assistant',
        description:
          'An agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.',
        variant: 'gradient',
        gradientFrom: 'violet-600',
        gradientTo: 'indigo-600',
        badges: [
          { label: 'TypeScript' },
          { label: 'CLI' },
          { label: 'AI' },
        ],
        primaryCta: {
          label: 'View on GitHub',
          url: 'https://github.com/anthropics/claude-code',
        },
        secondaryCta: {
          label: 'Documentation',
          url: 'https://docs.anthropic.com/claude-code',
        },
      },
    },
    {
      id: 'github-stats-1',
      type: 'github-stats',
      order: 1,
      data: {
        repoUrl: 'https://github.com/anthropics/claude-code',
        repoName: 'claude-code',
        owner: 'anthropics',
        stars: 15420,
        forks: 892,
        watchers: 234,
        issues: 45,
        pullRequests: 12,
        license: 'MIT',
        lastUpdated: '2024-01-15T10:30:00Z',
        variant: 'full',
      },
    },
    {
      id: 'stats-1',
      type: 'stats',
      order: 2,
      data: {
        stats: [
          { label: 'Downloads', value: '250K+', icon: 'download' },
          { label: 'Active Users', value: '50K+', icon: 'users' },
          { label: 'Commands', value: '100+', icon: 'terminal' },
          { label: 'Languages', value: '20+', icon: 'code' },
        ],
        variant: 'highlight',
      },
    },
    {
      id: 'languages-1',
      type: 'github-languages',
      order: 3,
      data: {
        title: 'Languages',
        languages: [
          { name: 'TypeScript', percentage: 78.5, color: '#3178c6' },
          { name: 'JavaScript', percentage: 12.3, color: '#f7df1e' },
          { name: 'Python', percentage: 5.2, color: '#3572A5' },
          { name: 'Shell', percentage: 4.0, color: '#89e051' },
        ],
        variant: 'bar',
      },
    },
    {
      id: 'features-1',
      type: 'feature-grid',
      order: 4,
      data: {
        title: 'Key Features',
        features: [
          {
            title: 'Natural Language Commands',
            description:
              'Write code using plain English. Describe what you want and Claude Code makes it happen.',
            icon: '💬',
          },
          {
            title: 'Codebase Understanding',
            description:
              'Analyzes your entire project structure, dependencies, and patterns to provide contextual help.',
            icon: '🧠',
          },
          {
            title: 'Multi-file Editing',
            description:
              'Make coordinated changes across multiple files with a single command.',
            icon: '📁',
          },
          {
            title: 'Git Integration',
            description:
              'Create commits, branches, and PRs with AI-generated messages that follow your conventions.',
            icon: '🔀',
          },
        ],
        columns: 2,
        variant: 'cards',
      },
    },
    {
      id: 'tech-stack-1',
      type: 'tech-stack',
      order: 5,
      data: {
        title: 'Built With',
        technologies: [
          { name: 'TypeScript', logoUrl: 'https://cdn.simpleicons.org/typescript' },
          { name: 'Node.js', logoUrl: 'https://cdn.simpleicons.org/nodedotjs' },
          { name: 'React', logoUrl: 'https://cdn.simpleicons.org/react' },
          { name: 'Anthropic API', icon: '🤖' },
          { name: 'Git', logoUrl: 'https://cdn.simpleicons.org/git' },
        ],
        variant: 'chips',
      },
    },
    {
      id: 'contributors-1',
      type: 'github-contributors',
      order: 6,
      data: {
        title: 'Top Contributors',
        contributors: [
          {
            username: 'user1',
            avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
            profileUrl: 'https://github.com/user1',
            contributions: 234,
          },
          {
            username: 'user2',
            avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
            profileUrl: 'https://github.com/user2',
            contributions: 156,
          },
          {
            username: 'user3',
            avatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
            profileUrl: 'https://github.com/user3',
            contributions: 98,
          },
        ],
        showContributions: true,
        variant: 'avatars',
      },
    },
    {
      id: 'links-1',
      type: 'links',
      order: 7,
      data: {
        title: 'Resources',
        links: [
          {
            label: 'Documentation',
            url: 'https://docs.anthropic.com/claude-code',
            description: 'Complete guide to using Claude Code',
            type: 'docs',
          },
          {
            label: 'GitHub Repository',
            url: 'https://github.com/anthropics/claude-code',
            description: 'Source code and issues',
            type: 'github',
          },
          {
            label: 'Getting Started Video',
            url: 'https://youtube.com/watch?v=example',
            description: '5-minute introduction tutorial',
            type: 'video',
          },
        ],
        variant: 'cards',
      },
    },
  ],
};

/**
 * Hook to parse component layout from project content
 */
export function useProjectLayout(
  projectContent: unknown
): ProjectComponentLayout | null {
  // Check if content has component layout structure
  if (
    projectContent &&
    typeof projectContent === 'object' &&
    'version' in projectContent &&
    'components' in projectContent
  ) {
    return projectContent as ProjectComponentLayout;
  }
  return null;
}

export default ProjectComponents;
