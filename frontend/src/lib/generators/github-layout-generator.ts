/**
 * GitHub Layout Generator
 *
 * Transforms GitHub repository data into a ProjectComponentLayout.
 * This generator intelligently selects and configures components
 * based on available data from the GitHub API and AI analysis.
 */

import type {
  ProjectComponentLayout,
  ProjectComponent,
  HeroComponent,
  StatsComponent,
  FeatureGridComponent,
  TechStackComponent,
  TextComponent,
  LinksComponent,
  ImageGalleryComponent,
  PromptComponent,
  DiagramComponent,
  GitHubStatsComponent,
  GitHubLanguagesComponent,
  GitHubContributorsComponent,
} from '@/types/components';
import { createComponent } from '@/types/components';

/**
 * Input data from GitHub API (repo_data)
 */
export interface GitHubRepoData {
  name: string;
  description?: string;
  language?: string;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  watchers_count?: number;
  owner?: string;
  html_url?: string;
  homepage?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  default_branch?: string;
  license?: { name: string; spdx_id: string } | null;
  tree?: Array<{ path: string; type: string }>;
  tech_stack?: {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
  };
}

/**
 * Input data from AI analysis (analyze_github_repo result)
 */
export interface GitHubAnalysisResult {
  description?: string;
  category_ids?: number[];
  topics?: string[];
  tool_names?: string[];
  hero_image?: string;
  hero_quote?: string;
  readme_blocks?: LegacyBlock[];
  mermaid_diagrams?: string[];
  demo_urls?: string[];
  demo_videos?: string[];
  generated_diagram?: string;
}

/**
 * Legacy block format from existing parser
 */
interface LegacyBlock {
  type: string;
  style?: string;
  content?: string;
  code?: string;
  caption?: string;
  images?: Array<{ url: string; alt?: string }>;
  items?: string[];
  columns?: number;
}

/**
 * Combined input for the layout generator
 */
export interface GitHubLayoutInput {
  repoData: GitHubRepoData;
  analysis: GitHubAnalysisResult;
  contributors?: Array<{
    login: string;
    avatar_url: string;
    contributions: number;
    html_url: string;
  }>;
  languages?: Record<string, number>;
}

/**
 * Generate a unique component ID
 */
function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert legacy blocks to new component format
 */
function convertLegacyBlocks(
  blocks: LegacyBlock[],
  startOrder: number
): ProjectComponent[] {
  const components: ProjectComponent[] = [];
  let order = startOrder;

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.style === 'heading') {
          // Skip headings for now, they'll be incorporated into sections
          continue;
        }
        if (block.content) {
          components.push(
            createComponent('text', {
              id: generateId(),
              order: order++,
              data: {
                content: block.content,
                variant: 'body',
              },
            }) as TextComponent
          );
        }
        break;

      case 'imageGrid':
        if (block.images && block.images.length > 0) {
          components.push(
            createComponent('image-gallery', {
              id: generateId(),
              order: order++,
              data: {
                images: block.images.map((img) => ({
                  url: img.url,
                  alt: img.alt || 'Project screenshot',
                })),
                layout: block.images.length <= 2 ? 'grid-2' : 'grid-3',
                caption: block.caption,
              },
            }) as ImageGalleryComponent
          );
        }
        break;

      case 'mermaid':
        if (block.code) {
          components.push(
            createComponent('diagram', {
              id: generateId(),
              order: order++,
              data: {
                type: 'mermaid',
                code: block.code,
                title: 'Architecture',
                caption: block.caption || 'System architecture diagram',
              },
            }) as DiagramComponent
          );
        }
        break;

      case 'list':
        if (block.items && block.items.length > 0) {
          // Convert list to feature grid
          components.push(
            createComponent('feature-grid', {
              id: generateId(),
              order: order++,
              data: {
                features: block.items.slice(0, 6).map((item, i) => ({
                  title: item.split(':')[0] || `Feature ${i + 1}`,
                  description: item.includes(':') ? item.split(':').slice(1).join(':').trim() : item,
                })),
                columns: block.items.length <= 3 ? 3 : 2,
                variant: 'cards',
              },
            }) as FeatureGridComponent
          );
        }
        break;

      case 'code':
        // Convert code blocks to text with code styling
        if (block.content) {
          components.push(
            createComponent('text', {
              id: generateId(),
              order: order++,
              data: {
                content: `\`\`\`\n${block.content}\n\`\`\``,
                variant: 'body',
              },
            }) as TextComponent
          );
        }
        break;
    }
  }

  return components;
}

/**
 * Generate the hero component
 */
function generateHeroComponent(
  input: GitHubLayoutInput,
  order: number
): HeroComponent {
  const { repoData, analysis } = input;

  return createComponent('hero', {
    id: generateId(),
    order,
    data: {
      title: repoData.name.replace(/-/g, ' ').replace(/_/g, ' '),
      subtitle: analysis.description || repoData.description || '',
      backgroundImage: analysis.hero_image,
      variant: analysis.hero_image ? 'image' : 'gradient',
      gradientFrom: 'violet-600',
      gradientTo: 'indigo-600',
      alignment: 'center',
      ctaButtons: [
        ...(repoData.html_url
          ? [{ label: 'View on GitHub', url: repoData.html_url, variant: 'primary' as const }]
          : []),
        ...(repoData.homepage
          ? [{ label: 'Live Demo', url: repoData.homepage, variant: 'secondary' as const }]
          : []),
      ],
    },
  }) as HeroComponent;
}

/**
 * Generate GitHub stats component
 */
function generateGitHubStatsComponent(
  input: GitHubLayoutInput,
  order: number
): GitHubStatsComponent {
  const { repoData } = input;

  return createComponent('github-stats', {
    id: generateId(),
    order,
    data: {
      owner: repoData.owner || '',
      repo: repoData.name,
      stats: {
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        issues: repoData.open_issues_count || 0,
        watchers: repoData.watchers_count || 0,
      },
      variant: 'detailed',
      showChart: true,
    },
  }) as GitHubStatsComponent;
}

/**
 * Generate tech stack component
 */
function generateTechStackComponent(
  input: GitHubLayoutInput,
  order: number
): TechStackComponent | null {
  const { repoData, analysis } = input;
  const techStack = repoData.tech_stack;

  const technologies: Array<{ name: string; category?: string; icon?: string }> = [];

  // Add primary language
  if (repoData.language) {
    technologies.push({ name: repoData.language, category: 'language' });
  }

  // Add languages from tech stack
  if (techStack?.languages) {
    techStack.languages.forEach((lang) => {
      if (lang !== repoData.language) {
        technologies.push({ name: lang, category: 'language' });
      }
    });
  }

  // Add frameworks
  if (techStack?.frameworks) {
    techStack.frameworks.forEach((fw) => {
      technologies.push({ name: fw, category: 'framework' });
    });
  }

  // Add tools
  if (techStack?.tools) {
    techStack.tools.forEach((tool) => {
      technologies.push({ name: tool, category: 'tool' });
    });
  }

  // Add AI tools from analysis
  if (analysis.tool_names) {
    analysis.tool_names.forEach((tool) => {
      technologies.push({ name: tool, category: 'ai-tool' });
    });
  }

  if (technologies.length === 0) {
    return null;
  }

  return createComponent('tech-stack', {
    id: generateId(),
    order,
    data: {
      title: 'Tech Stack',
      technologies: technologies.slice(0, 12), // Limit to 12
      variant: 'grid',
      showCategories: true,
    },
  }) as TechStackComponent;
}

/**
 * Generate languages component
 */
function generateLanguagesComponent(
  input: GitHubLayoutInput,
  order: number
): GitHubLanguagesComponent | null {
  const { languages, repoData } = input;

  if (!languages || Object.keys(languages).length === 0) {
    return null;
  }

  return createComponent('github-languages', {
    id: generateId(),
    order,
    data: {
      owner: repoData.owner || '',
      repo: repoData.name,
      languages,
      variant: 'bar',
    },
  }) as GitHubLanguagesComponent;
}

/**
 * Generate contributors component
 */
function generateContributorsComponent(
  input: GitHubLayoutInput,
  order: number
): GitHubContributorsComponent | null {
  const { contributors, repoData } = input;

  if (!contributors || contributors.length === 0) {
    return null;
  }

  return createComponent('github-contributors', {
    id: generateId(),
    order,
    data: {
      owner: repoData.owner || '',
      repo: repoData.name,
      contributors: contributors.slice(0, 10).map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
        profileUrl: c.html_url,
      })),
      variant: 'grid',
      showContributions: true,
    },
  }) as GitHubContributorsComponent;
}

/**
 * Generate prompt/quote component
 */
function generatePromptComponent(
  input: GitHubLayoutInput,
  order: number
): PromptComponent | null {
  const { analysis, repoData } = input;

  if (!analysis.hero_quote) {
    return null;
  }

  return createComponent('prompt', {
    id: generateId(),
    order,
    data: {
      prompt: analysis.hero_quote,
      source: repoData.name,
      sourceUrl: repoData.html_url,
      variant: 'card',
    },
  }) as PromptComponent;
}

/**
 * Generate links component
 */
function generateLinksComponent(
  input: GitHubLayoutInput,
  order: number
): LinksComponent | null {
  const { repoData, analysis } = input;
  const links: Array<{ label: string; url: string; type?: string }> = [];

  // GitHub repo link
  if (repoData.html_url) {
    links.push({ label: 'GitHub Repository', url: repoData.html_url, type: 'github' });
  }

  // Homepage/demo
  if (repoData.homepage) {
    links.push({ label: 'Live Demo', url: repoData.homepage, type: 'website' });
  }

  // Demo URLs from analysis
  if (analysis.demo_urls) {
    analysis.demo_urls.forEach((url, i) => {
      if (url !== repoData.homepage) {
        links.push({ label: `Demo ${i + 1}`, url, type: 'demo' });
      }
    });
  }

  if (links.length === 0) {
    return null;
  }

  return createComponent('links', {
    id: generateId(),
    order,
    data: {
      title: 'Links & Resources',
      links,
      variant: 'cards',
    },
  }) as LinksComponent;
}

/**
 * Generate stats component from repo metrics
 */
function generateStatsComponent(
  input: GitHubLayoutInput,
  order: number
): StatsComponent {
  const { repoData } = input;

  const stats: Array<{ label: string; value: string | number; icon?: string }> = [];

  if (repoData.stargazers_count !== undefined) {
    stats.push({
      label: 'Stars',
      value: repoData.stargazers_count.toLocaleString(),
      icon: 'star',
    });
  }

  if (repoData.forks_count !== undefined) {
    stats.push({
      label: 'Forks',
      value: repoData.forks_count.toLocaleString(),
      icon: 'git-fork',
    });
  }

  if (repoData.watchers_count !== undefined) {
    stats.push({
      label: 'Watchers',
      value: repoData.watchers_count.toLocaleString(),
      icon: 'eye',
    });
  }

  if (repoData.open_issues_count !== undefined) {
    stats.push({
      label: 'Issues',
      value: repoData.open_issues_count.toLocaleString(),
      icon: 'circle-dot',
    });
  }

  return createComponent('stats', {
    id: generateId(),
    order,
    data: {
      stats,
      variant: 'cards',
      columns: stats.length,
    },
  }) as StatsComponent;
}

/**
 * Main generator function - creates a complete ProjectComponentLayout
 * from GitHub repository data and AI analysis
 */
export function generateGitHubLayout(input: GitHubLayoutInput): ProjectComponentLayout {
  const components: ProjectComponent[] = [];
  let order = 0;

  // 1. Hero section (always first)
  components.push(generateHeroComponent(input, order++));

  // 2. Stats row
  components.push(generateStatsComponent(input, order++));

  // 3. Quote/prompt if available
  const promptComponent = generatePromptComponent(input, order);
  if (promptComponent) {
    components.push(promptComponent);
    order++;
  }

  // 4. Tech stack
  const techStackComponent = generateTechStackComponent(input, order);
  if (techStackComponent) {
    components.push(techStackComponent);
    order++;
  }

  // 5. Convert legacy README blocks
  if (input.analysis.readme_blocks && input.analysis.readme_blocks.length > 0) {
    const convertedComponents = convertLegacyBlocks(input.analysis.readme_blocks, order);
    components.push(...convertedComponents);
    order += convertedComponents.length;
  }

  // 6. GitHub-specific components
  // Languages breakdown
  const languagesComponent = generateLanguagesComponent(input, order);
  if (languagesComponent) {
    components.push(languagesComponent);
    order++;
  }

  // Contributors
  const contributorsComponent = generateContributorsComponent(input, order);
  if (contributorsComponent) {
    components.push(contributorsComponent);
    order++;
  }

  // 7. Links & resources (near the end)
  const linksComponent = generateLinksComponent(input, order);
  if (linksComponent) {
    components.push(linksComponent);
    order++;
  }

  return {
    version: '1.0',
    integration: 'github',
    sourceUrl: input.repoData.html_url,
    generatedAt: new Date().toISOString(),
    components,
    metadata: {
      sourceData: {
        repoName: input.repoData.name,
        owner: input.repoData.owner,
        language: input.repoData.language,
        stars: input.repoData.stargazers_count,
      },
    },
  };
}

/**
 * Create a minimal GitHub layout with just essential components
 * Useful for quick previews or repos with limited data
 */
export function generateMinimalGitHubLayout(input: GitHubLayoutInput): ProjectComponentLayout {
  const components: ProjectComponent[] = [];
  let order = 0;

  // Just hero and stats
  components.push(generateHeroComponent(input, order++));
  components.push(generateStatsComponent(input, order++));

  // Tech stack if available
  const techStackComponent = generateTechStackComponent(input, order);
  if (techStackComponent) {
    components.push(techStackComponent);
    order++;
  }

  return {
    version: '1.0',
    integration: 'github',
    sourceUrl: input.repoData.html_url,
    generatedAt: new Date().toISOString(),
    components,
  };
}
