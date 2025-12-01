/**
 * Project Component Types
 *
 * A component library for AI-generated project portfolio pages.
 * Components are reusable, visually engaging building blocks that
 * AI selects and populates based on available data from integrations.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * All available component types
 */
export type ComponentType =
  // Base components (universal)
  | 'hero'
  | 'stats'
  | 'feature-grid'
  | 'tech-stack'
  | 'image-gallery'
  | 'prompt'
  | 'diagram'
  | 'links'
  | 'text'
  | 'video'
  | 'cta'
  // GitHub-specific
  | 'github-stats'
  | 'github-contributors'
  | 'github-languages'
  | 'github-activity'
  // Figma-specific
  | 'figma-embed'
  | 'figma-frames'
  // Reddit-specific
  | 'reddit-thread'
  // More integrations to come...
  ;

/**
 * Integration/source types for project data
 */
export type IntegrationType =
  | 'github'
  | 'figma'
  | 'reddit'
  | 'youtube'
  | 'dribbble'
  | 'behance'
  | 'notion'
  | 'linear'
  | 'custom';

/**
 * Base interface for all components
 */
export interface BaseComponent {
  id: string;
  type: ComponentType;
  order: number;
  isVisible?: boolean;
}

// =============================================================================
// Base Components (Universal)
// =============================================================================

/**
 * Hero - Project introduction with visual impact
 */
export interface HeroComponent extends BaseComponent {
  type: 'hero';
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    variant: 'image' | 'video' | 'gradient' | 'slideshow' | 'minimal';
    // Visual options
    backgroundImage?: string;
    backgroundVideo?: string;
    slideshowImages?: string[];
    gradientFrom?: string;
    gradientTo?: string;
    // Optional overlay elements
    badges?: Array<{ label: string; icon?: string; url?: string }>;
    primaryCta?: { label: string; url: string };
    secondaryCta?: { label: string; url: string };
  };
}

/**
 * Stats - Key metrics display
 */
export interface StatsComponent extends BaseComponent {
  type: 'stats';
  data: {
    title?: string;
    stats: Array<{
      label: string;
      value: string | number;
      icon?: string;
      change?: { value: number; direction: 'up' | 'down' | 'neutral' };
      description?: string;
    }>;
    variant: 'cards' | 'inline' | 'highlight';
  };
}

/**
 * FeatureGrid - Showcase key features/highlights
 */
export interface FeatureGridComponent extends BaseComponent {
  type: 'feature-grid';
  data: {
    title?: string;
    subtitle?: string;
    features: Array<{
      title: string;
      description: string;
      icon?: string;
      image?: string;
      link?: string;
    }>;
    columns: 2 | 3 | 4;
    variant: 'cards' | 'list' | 'icons';
  };
}

/**
 * TechStack - Technologies and tools used
 */
export interface TechStackComponent extends BaseComponent {
  type: 'tech-stack';
  data: {
    title?: string;
    technologies: Array<{
      name: string;
      icon?: string;
      logoUrl?: string;
      category?: string;
      url?: string;
      description?: string;
    }>;
    showCategories?: boolean;
    variant: 'grid' | 'list' | 'chips';
  };
}

/**
 * ImageGallery - Visual showcase
 */
export interface ImageGalleryComponent extends BaseComponent {
  type: 'image-gallery';
  data: {
    title?: string;
    images: Array<{
      url: string;
      alt?: string;
      caption?: string;
      width?: number;
      height?: number;
    }>;
    variant: 'grid' | 'masonry' | 'carousel' | 'lightbox';
    columns?: 2 | 3 | 4;
  };
}

/**
 * Prompt - Prompt showcase or highlight
 */
export interface PromptComponent extends BaseComponent {
  type: 'prompt';
  data: {
    prompt: string;
    author?: string;
    authorTitle?: string;
    authorImage?: string;
    source?: string;
    sourceUrl?: string;
    variant: 'simple' | 'card' | 'hero';
    gradientFrom?: string;
    gradientTo?: string;
  };
}

/**
 * Diagram - Mermaid or visual diagrams
 */
export interface DiagramComponent extends BaseComponent {
  type: 'diagram';
  data: {
    title?: string;
    caption?: string;
    diagramType: 'mermaid' | 'image';
    // For mermaid
    code?: string;
    // For image-based diagrams
    imageUrl?: string;
    alt?: string;
  };
}

/**
 * Links - External resources and references
 */
export interface LinksComponent extends BaseComponent {
  type: 'links';
  data: {
    title?: string;
    links: Array<{
      label: string;
      url: string;
      description?: string;
      icon?: string;
      type?: 'docs' | 'github' | 'demo' | 'video' | 'article' | 'external';
    }>;
    variant: 'cards' | 'list' | 'compact';
  };
}

/**
 * Text - Rich text content block
 */
export interface TextComponent extends BaseComponent {
  type: 'text';
  data: {
    title?: string;
    content: string; // Markdown supported
    variant: 'prose' | 'centered' | 'highlight';
  };
}

/**
 * Video - Embedded video content
 */
export interface VideoComponent extends BaseComponent {
  type: 'video';
  data: {
    title?: string;
    url: string;
    embedUrl?: string;
    thumbnail?: string;
    caption?: string;
    provider?: 'youtube' | 'vimeo' | 'loom' | 'custom';
    autoplay?: boolean;
  };
}

/**
 * CTA - Call to action block
 */
export interface CTAComponent extends BaseComponent {
  type: 'cta';
  data: {
    title: string;
    description?: string;
    primaryButton: { label: string; url: string };
    secondaryButton?: { label: string; url: string };
    variant: 'banner' | 'card' | 'inline';
    backgroundImage?: string;
    gradientFrom?: string;
    gradientTo?: string;
  };
}

// =============================================================================
// GitHub-Specific Components
// =============================================================================

/**
 * GitHubStats - Repository statistics
 */
export interface GitHubStatsComponent extends BaseComponent {
  type: 'github-stats';
  data: {
    repoUrl: string;
    repoName: string;
    owner: string;
    stars: number;
    forks: number;
    watchers: number;
    issues: number;
    pullRequests?: number;
    license?: string;
    lastUpdated?: string;
    createdAt?: string;
    defaultBranch?: string;
    variant: 'full' | 'compact' | 'badges';
  };
}

/**
 * GitHubContributors - Contributor grid
 */
export interface GitHubContributorsComponent extends BaseComponent {
  type: 'github-contributors';
  data: {
    title?: string;
    contributors: Array<{
      username: string;
      avatarUrl: string;
      profileUrl: string;
      contributions: number;
    }>;
    showContributions?: boolean;
    limit?: number;
    variant: 'grid' | 'list' | 'avatars';
  };
}

/**
 * GitHubLanguages - Language breakdown
 */
export interface GitHubLanguagesComponent extends BaseComponent {
  type: 'github-languages';
  data: {
    title?: string;
    languages: Array<{
      name: string;
      percentage: number;
      color: string;
      bytes?: number;
    }>;
    variant: 'bar' | 'pie' | 'list';
  };
}

/**
 * GitHubActivity - Recent activity/commits
 */
export interface GitHubActivityComponent extends BaseComponent {
  type: 'github-activity';
  data: {
    title?: string;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      authorAvatar?: string;
      date: string;
      url: string;
    }>;
    limit?: number;
    showGraph?: boolean;
  };
}

// =============================================================================
// Figma-Specific Components
// =============================================================================

/**
 * FigmaEmbed - Embedded Figma file
 */
export interface FigmaEmbedComponent extends BaseComponent {
  type: 'figma-embed';
  data: {
    title?: string;
    fileUrl: string;
    embedUrl: string;
    nodeId?: string;
    caption?: string;
    allowFullscreen?: boolean;
  };
}

/**
 * FigmaFrames - Design frames showcase
 */
export interface FigmaFramesComponent extends BaseComponent {
  type: 'figma-frames';
  data: {
    title?: string;
    frames: Array<{
      name: string;
      imageUrl: string;
      nodeId?: string;
      width?: number;
      height?: number;
    }>;
    variant: 'grid' | 'carousel' | 'showcase';
  };
}

// =============================================================================
// Reddit-Specific Components
// =============================================================================

/**
 * RedditThread - Embedded Reddit thread
 */
export interface RedditThreadComponent extends BaseComponent {
  type: 'reddit-thread';
  data: {
    title: string;
    subreddit: string;
    author: string;
    postUrl: string;
    score: number;
    numComments: number;
    content?: string;
    thumbnail?: string;
    createdAt: string;
    variant: 'card' | 'embed' | 'preview';
  };
}

// =============================================================================
// Union Type & Layout
// =============================================================================

/**
 * Union of all component types
 */
export type ProjectComponent =
  | HeroComponent
  | StatsComponent
  | FeatureGridComponent
  | TechStackComponent
  | ImageGalleryComponent
  | PromptComponent
  | DiagramComponent
  | LinksComponent
  | TextComponent
  | VideoComponent
  | CTAComponent
  | GitHubStatsComponent
  | GitHubContributorsComponent
  | GitHubLanguagesComponent
  | GitHubActivityComponent
  | FigmaEmbedComponent
  | FigmaFramesComponent
  | RedditThreadComponent;

/**
 * Project component layout - the full structure AI generates
 */
export interface ProjectComponentLayout {
  version: '1.0';
  integration: IntegrationType;
  sourceUrl?: string;
  generatedAt: string;
  components: ProjectComponent[];
  metadata?: {
    aiModel?: string;
    generationPrompt?: string;
    sourceData?: Record<string, unknown>;
  };
}

// =============================================================================
// Component Registry & Utilities
// =============================================================================

/**
 * Component metadata for the registry
 */
export interface ComponentMeta {
  type: ComponentType;
  name: string;
  description: string;
  category: 'base' | 'github' | 'figma' | 'reddit' | 'youtube';
  icon: string;
  minWidth?: 'full' | 'half' | 'third';
  supportsEditing?: boolean;
}

/**
 * Registry of all available components
 */
export const COMPONENT_REGISTRY: ComponentMeta[] = [
  // Base components
  { type: 'hero', name: 'Hero', description: 'Project introduction with visual impact', category: 'base', icon: 'sparkles' },
  { type: 'stats', name: 'Stats', description: 'Key metrics display', category: 'base', icon: 'chart-bar' },
  { type: 'feature-grid', name: 'Features', description: 'Showcase key features', category: 'base', icon: 'squares-2x2' },
  { type: 'tech-stack', name: 'Tech Stack', description: 'Technologies used', category: 'base', icon: 'cpu-chip' },
  { type: 'image-gallery', name: 'Gallery', description: 'Image showcase', category: 'base', icon: 'photo' },
  { type: 'prompt', name: 'Prompt', description: 'Prompt showcase or highlight', category: 'base', icon: 'chat-bubble-bottom-center-text' },
  { type: 'diagram', name: 'Diagram', description: 'Visual diagram', category: 'base', icon: 'document-chart-bar' },
  { type: 'links', name: 'Links', description: 'External resources', category: 'base', icon: 'link' },
  { type: 'text', name: 'Text', description: 'Rich text content', category: 'base', icon: 'document-text' },
  { type: 'video', name: 'Video', description: 'Video embed', category: 'base', icon: 'play-circle' },
  { type: 'cta', name: 'Call to Action', description: 'Conversion block', category: 'base', icon: 'cursor-arrow-rays' },
  // GitHub components
  { type: 'github-stats', name: 'GitHub Stats', description: 'Repository statistics', category: 'github', icon: 'code-bracket' },
  { type: 'github-contributors', name: 'Contributors', description: 'Contributor grid', category: 'github', icon: 'users' },
  { type: 'github-languages', name: 'Languages', description: 'Language breakdown', category: 'github', icon: 'code-bracket-square' },
  { type: 'github-activity', name: 'Activity', description: 'Recent commits', category: 'github', icon: 'clock' },
  // Figma components
  { type: 'figma-embed', name: 'Figma Embed', description: 'Embedded Figma file', category: 'figma', icon: 'paint-brush' },
  { type: 'figma-frames', name: 'Design Frames', description: 'Frame showcase', category: 'figma', icon: 'squares-plus' },
  // Reddit components
  { type: 'reddit-thread', name: 'Reddit Thread', description: 'Thread preview', category: 'reddit', icon: 'chat-bubble-left-right' },
];

/**
 * Type guard to check if a component is a specific type
 */
export function isComponentType<T extends ProjectComponent>(
  component: ProjectComponent,
  type: T['type']
): component is T {
  return component.type === type;
}

/**
 * Create a new component with default values
 */
export function createComponent<T extends ComponentType>(
  type: T,
  data: Partial<Extract<ProjectComponent, { type: T }>['data']> = {}
): Extract<ProjectComponent, { type: T }> {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const defaults: Record<ComponentType, () => ProjectComponent> = {
    'hero': () => ({
      id, type: 'hero', order: 0,
      data: { title: '', variant: 'gradient' as const, ...data }
    }) as HeroComponent,
    'stats': () => ({
      id, type: 'stats', order: 0,
      data: { stats: [], variant: 'cards' as const, ...data }
    }) as StatsComponent,
    'feature-grid': () => ({
      id, type: 'feature-grid', order: 0,
      data: { features: [], columns: 3 as const, variant: 'cards' as const, ...data }
    }) as FeatureGridComponent,
    'tech-stack': () => ({
      id, type: 'tech-stack', order: 0,
      data: { technologies: [], variant: 'grid' as const, ...data }
    }) as TechStackComponent,
    'image-gallery': () => ({
      id, type: 'image-gallery', order: 0,
      data: { images: [], variant: 'grid' as const, ...data }
    }) as ImageGalleryComponent,
    'prompt': () => ({
      id, type: 'prompt', order: 0,
      data: { prompt: '', variant: 'simple' as const, ...data }
    }) as PromptComponent,
    'diagram': () => ({
      id, type: 'diagram', order: 0,
      data: { diagramType: 'mermaid' as const, ...data }
    }) as DiagramComponent,
    'links': () => ({
      id, type: 'links', order: 0,
      data: { links: [], variant: 'cards' as const, ...data }
    }) as LinksComponent,
    'text': () => ({
      id, type: 'text', order: 0,
      data: { content: '', variant: 'prose' as const, ...data }
    }) as TextComponent,
    'video': () => ({
      id, type: 'video', order: 0,
      data: { url: '', ...data }
    }) as VideoComponent,
    'cta': () => ({
      id, type: 'cta', order: 0,
      data: { title: '', primaryButton: { label: '', url: '' }, variant: 'card' as const, ...data }
    }) as CTAComponent,
    'github-stats': () => ({
      id, type: 'github-stats', order: 0,
      data: { repoUrl: '', repoName: '', owner: '', stars: 0, forks: 0, watchers: 0, issues: 0, variant: 'full' as const, ...data }
    }) as GitHubStatsComponent,
    'github-contributors': () => ({
      id, type: 'github-contributors', order: 0,
      data: { contributors: [], variant: 'grid' as const, ...data }
    }) as GitHubContributorsComponent,
    'github-languages': () => ({
      id, type: 'github-languages', order: 0,
      data: { languages: [], variant: 'bar' as const, ...data }
    }) as GitHubLanguagesComponent,
    'github-activity': () => ({
      id, type: 'github-activity', order: 0,
      data: { commits: [], ...data }
    }) as GitHubActivityComponent,
    'figma-embed': () => ({
      id, type: 'figma-embed', order: 0,
      data: { fileUrl: '', embedUrl: '', ...data }
    }) as FigmaEmbedComponent,
    'figma-frames': () => ({
      id, type: 'figma-frames', order: 0,
      data: { frames: [], variant: 'grid' as const, ...data }
    }) as FigmaFramesComponent,
    'reddit-thread': () => ({
      id, type: 'reddit-thread', order: 0,
      data: { title: '', subreddit: '', author: '', postUrl: '', score: 0, numComments: 0, createdAt: '', variant: 'card' as const, ...data }
    }) as RedditThreadComponent,
  };

  return defaults[type]() as Extract<ProjectComponent, { type: T }>;
}
