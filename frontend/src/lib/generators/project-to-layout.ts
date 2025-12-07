/**
 * Project to Layout Converter
 *
 * Converts existing Project data (from the database) into a ProjectComponentLayout.
 * This allows us to render existing projects with the new component system
 * while we transition the backend to generate component layouts natively.
 */

import type { Project } from '@/types/models';
import type { ProjectComponentLayout, ProjectComponent } from '@/types/components';
import { createComponent } from '@/types/components';

/**
 * Generate a unique component ID
 */
function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert a GitHub project to a component layout
 */
export function convertGitHubProjectToLayout(project: Project): ProjectComponentLayout | null {
  const githubData = project.content?.github;
  const analysis = githubData?.analysis;

  // Always create a layout - even without github data we can show the hero
  const components: ProjectComponent[] = [];
  let order = 0;

  // 1. Hero component (always present)
  components.push(
    createComponent('hero', {
      id: generateId(),
      order: order++,
      data: {
        title: project.title,
        subtitle: project.description || '',
        backgroundImage: project.bannerUrl || project.featuredImageUrl,
        variant: project.bannerUrl ? 'image' : 'gradient',
        gradientFrom: 'violet-600',
        gradientTo: 'indigo-600',
        ...(project.externalUrl && { primaryCta: { label: 'View on GitHub', url: project.externalUrl } }),
      },
    })
  );

  // If no github data, return minimal layout
  if (!githubData) {
    return {
      version: '1.0',
      integration: 'github',
      sourceUrl: project.externalUrl,
      generatedAt: new Date().toISOString(),
      components,
      metadata: {
        sourceData: {
          projectId: project.id,
          projectSlug: project.slug,
        },
      },
    };
  }

  // 2. Stats component (if we have GitHub stats)
  if (githubData.stars !== undefined || githubData.forks !== undefined) {
    const stats: Array<{ label: string; value: string | number; icon?: string }> = [];

    if (githubData.stars !== undefined) {
      stats.push({
        label: 'Stars',
        value: githubData.stars.toLocaleString(),
        icon: 'star',
      });
    }
    if (githubData.forks !== undefined) {
      stats.push({
        label: 'Forks',
        value: githubData.forks.toLocaleString(),
        icon: 'git-fork',
      });
    }
    if (githubData.watchers !== undefined) {
      stats.push({
        label: 'Watchers',
        value: githubData.watchers.toLocaleString(),
        icon: 'eye',
      });
    }
    if (githubData.issues !== undefined) {
      stats.push({
        label: 'Issues',
        value: githubData.issues.toLocaleString(),
        icon: 'circle-dot',
      });
    }

    if (stats.length > 0) {
      components.push(
        createComponent('stats', {
          id: generateId(),
          order: order++,
          data: {
            stats,
            variant: 'cards',
          },
        })
      );
    }
  }

  // 3. Tech stack (from analysis)
  if (analysis?.tech_stack) {
    const techStack = analysis.tech_stack;
    const technologies: Array<{ name: string; category?: string }> = [];

    // Handle different tech stack formats
    if (Array.isArray(techStack)) {
      techStack.forEach((tech: string) => {
        technologies.push({ name: tech });
      });
    } else if (typeof techStack === 'object') {
      // It might be grouped by category
      Object.entries(techStack).forEach(([category, techs]) => {
        if (Array.isArray(techs)) {
          techs.forEach((tech: string) => {
            technologies.push({ name: tech, category });
          });
        }
      });
    }

    if (technologies.length > 0) {
      components.push(
        createComponent('tech-stack', {
          id: generateId(),
          order: order++,
          data: {
            title: 'Tech Stack',
            technologies: technologies.slice(0, 12),
            variant: 'grid',
            showCategories: true,
          },
        })
      );
    }
  }

  // 4. Features (from analysis)
  if (analysis?.features_discovered && analysis.features_discovered.length > 0) {
    components.push(
      createComponent('feature-grid', {
        id: generateId(),
        order: order++,
        data: {
          title: 'Key Features',
          features: analysis.features_discovered.map((feature: any) => ({
            title: feature.title || 'Feature',
            description: feature.tech || feature.description || '',
          })),
          columns: analysis.features_discovered.length <= 3 ? analysis.features_discovered.length : 2,
          variant: 'cards',
        },
      })
    );
  }

  // 5. Architecture diagram (from analysis)
  if (analysis?.architecture_diagram) {
    components.push(
      createComponent('diagram', {
        id: generateId(),
        order: order++,
        data: {
          diagramType: 'mermaid',
          code: analysis.architecture_diagram,
          title: 'Architecture',
          caption: 'System architecture diagram',
        },
      })
    );
  }

  // 6. Links
  type LinkType = 'demo' | 'video' | 'github' | 'article' | 'external' | 'docs';
  const links: Array<{ label: string; url: string; type?: LinkType; icon?: string }> = [];

  if (project.externalUrl) {
    links.push({ label: 'GitHub Repository', url: project.externalUrl, type: 'github', icon: 'github' });
  }

  // Add demo URLs if available
  if (analysis?.demo_urls) {
    analysis.demo_urls.forEach((url: string, i: number) => {
      links.push({ label: `Demo ${i + 1}`, url, type: 'demo', icon: 'link' });
    });
  }

  if (links.length > 0) {
    components.push(
      createComponent('links', {
        id: generateId(),
        order: order++,
        data: {
          title: 'Links & Resources',
          links,
          variant: 'cards',
        },
      })
    );
  }

  return {
    version: '1.0',
    integration: 'github',
    sourceUrl: project.externalUrl,
    generatedAt: new Date().toISOString(),
    components,
    metadata: {
      sourceData: {
        projectId: project.id,
        projectSlug: project.slug,
      },
    },
  };
}

/**
 * Check if a project has a stored component layout
 */
export function hasComponentLayout(project: Project): boolean {
  return Boolean(project.content?.componentLayout);
}

/**
 * Get the component layout from a project
 * Returns stored layout if available, or generates one from project data
 */
export function getProjectComponentLayout(project: Project): ProjectComponentLayout | null {
  // Check for stored component layout first
  if (project.content?.componentLayout) {
    return project.content.componentLayout as unknown as ProjectComponentLayout;
  }

  // Generate layout based on project type
  switch (project.type) {
    case 'github_repo':
      return convertGitHubProjectToLayout(project);
    // Add more project types as needed
    // case 'figma_design':
    //   return convertFigmaProjectToLayout(project);
    default:
      // For unknown types, create a minimal layout with just the hero
      return {
        version: '1.0',
        integration: 'custom',
        sourceUrl: project.externalUrl,
        generatedAt: new Date().toISOString(),
        components: [
          createComponent('hero', {
            id: generateId(),
            order: 0,
            data: {
              title: project.title,
              subtitle: project.description || '',
              variant: 'gradient',
              gradientFrom: 'violet-600',
              gradientTo: 'indigo-600',
            },
          }),
        ],
      };
  }
}
