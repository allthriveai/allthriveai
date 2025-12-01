/**
 * ComponentRenderer - Routes component types to their renderers
 *
 * This is the main entry point for rendering project components.
 * It maps each component type to its corresponding React component.
 */

import type { ProjectComponent } from '@/types/components';

// Base components
import {
  HeroComponent,
  StatsComponent,
  FeatureGridComponent,
  TechStackComponent,
  TextComponent,
  LinksComponent,
  ImageGalleryComponent,
  PromptComponent,
} from './base';

// GitHub components
import {
  GitHubStatsComponent,
  GitHubLanguagesComponent,
  GitHubContributorsComponent,
} from './github';

interface ComponentRendererProps {
  component: ProjectComponent;
}

/**
 * Renders a single project component based on its type
 */
export function ComponentRenderer({ component }: ComponentRendererProps) {
  // Skip hidden components
  if (component.isVisible === false) {
    return null;
  }

  switch (component.type) {
    // Base components
    case 'hero':
      return <HeroComponent component={component} />;
    case 'stats':
      return <StatsComponent component={component} />;
    case 'feature-grid':
      return <FeatureGridComponent component={component} />;
    case 'tech-stack':
      return <TechStackComponent component={component} />;
    case 'text':
      return <TextComponent component={component} />;
    case 'links':
      return <LinksComponent component={component} />;
    case 'image-gallery':
      return <ImageGalleryComponent component={component} />;
    case 'prompt':
      return <PromptComponent component={component} />;

    // GitHub components
    case 'github-stats':
      return <GitHubStatsComponent component={component} />;
    case 'github-languages':
      return <GitHubLanguagesComponent component={component} />;
    case 'github-contributors':
      return <GitHubContributorsComponent component={component} />;

    // TODO: Add more components as they're created
    // case 'github-activity':
    // case 'diagram':
    // case 'video':
    // case 'cta':
    // case 'figma-embed':
    // case 'figma-frames':
    // case 'reddit-thread':

    default:
      // Log unknown component types in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Unknown component type: ${(component as any).type}`);
      }
      return null;
  }
}

/**
 * Renders a list of project components
 */
interface ComponentListProps {
  components: ProjectComponent[];
  className?: string;
}

export function ComponentList({ components, className }: ComponentListProps) {
  // Sort components by order
  const sortedComponents = [...components].sort((a, b) => a.order - b.order);

  return (
    <div className={className}>
      {sortedComponents.map((component) => (
        <ComponentRenderer key={component.id} component={component} />
      ))}
    </div>
  );
}
