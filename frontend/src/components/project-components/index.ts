/**
 * Project Components Module
 *
 * A component library for AI-generated project portfolio pages.
 * This module provides reusable, visually engaging components that
 * can be composed to create beautiful project showcases.
 *
 * Usage:
 * ```tsx
 * import { ProjectComponents, EXAMPLE_GITHUB_LAYOUT } from '@/components/project-components';
 *
 * function ProjectPage() {
 *   return <ProjectComponents layout={layout} />;
 * }
 * ```
 */

// Main container
export { ProjectComponents, EXAMPLE_GITHUB_LAYOUT, useProjectLayout } from './ProjectComponents';

// Component renderer
export { ComponentRenderer, ComponentList } from './ComponentRenderer';

// Base components
export * from './base';

// GitHub components
export * from './github';

// Types (re-export from types module)
export type {
  ProjectComponent,
  ProjectComponentLayout,
  ComponentType,
  IntegrationType,
  BaseComponent,
  HeroComponent,
  StatsComponent,
  FeatureGridComponent,
  TechStackComponent,
  ImageGalleryComponent,
  PromptComponent,
  DiagramComponent,
  LinksComponent,
  TextComponent,
  VideoComponent,
  CTAComponent,
  GitHubStatsComponent,
  GitHubContributorsComponent,
  GitHubLanguagesComponent,
  GitHubActivityComponent,
  FigmaEmbedComponent,
  FigmaFramesComponent,
  RedditThreadComponent,
  ComponentMeta,
} from '@/types/components';

export { COMPONENT_REGISTRY, isComponentType, createComponent } from '@/types/components';
