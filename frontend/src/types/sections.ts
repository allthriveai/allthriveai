/**
 * Project Section Types
 *
 * Defines the structured section-based template system for project portfolios.
 * Each section type has a specific purpose and visual treatment.
 */

// ============================================================================
// SECTION TYPE DEFINITIONS
// ============================================================================

export type SectionType =
  | 'overview'
  | 'features'
  | 'tech_stack'
  | 'gallery'
  | 'video'
  | 'architecture'
  | 'demo'
  | 'challenges'
  | 'links'
  | 'slideup'
  | 'custom';

// ============================================================================
// OVERVIEW SECTION
// ============================================================================

export interface Metric {
  icon: 'star' | 'download' | 'user' | 'code' | 'fork' | 'eye' | 'clock';
  label: string;
  value: string;
}

export interface OverviewSectionContent {
  headline: string;        // One-liner hook (bold, large text)
  description: string;     // 2-3 sentences max (markdown supported)
  metrics?: Metric[];      // Optional stats like stars, downloads
  previewImage?: string;   // Optional preview image URL (from README or repo)
}

// ============================================================================
// FEATURES SECTION
// ============================================================================

export interface Feature {
  icon: string;            // Emoji or icon name (e.g., "rocket", "shield")
  title: string;           // Feature title
  description: string;     // 1-2 sentence description
}

export interface FeaturesSectionContent {
  features: Feature[];
}

// ============================================================================
// TECH STACK SECTION
// ============================================================================

export interface Technology {
  name: string;            // "React", "Python", etc.
  icon?: string;           // SimpleIcons slug or URL
  version?: string;        // Optional version
  url?: string;            // Link to docs/homepage
}

export interface TechCategory {
  name: string;            // "Frontend", "Backend", "Infrastructure", etc.
  technologies: Technology[];
}

export interface TechStackSectionContent {
  categories: TechCategory[];
}

// ============================================================================
// GALLERY SECTION
// ============================================================================

export interface GalleryImage {
  url: string;
  caption?: string;
  thumbnail?: string;      // Smaller preview image
  alt?: string;            // Accessibility alt text
}

export type GalleryLayout = 'carousel' | 'grid' | 'masonry';

export interface GallerySectionContent {
  images: GalleryImage[];
  layout: GalleryLayout;
  title?: string;
}

// ============================================================================
// VIDEO SECTION
// ============================================================================

export interface VideoSectionContent {
  url: string;               // Watch URL (e.g., youtube.com/watch?v=...) or direct video URL (S3/MinIO)
  embedUrl?: string;         // Embed URL (e.g., youtube.com/embed/...)
  platform: 'youtube' | 'vimeo' | 'loom' | 'direct' | 'other';
  videoId: string;           // Platform-specific video ID (empty for direct uploads)
  thumbnail?: string;        // Video thumbnail URL
  title?: string;            // Optional section title
  filename?: string;         // Original filename (for direct uploads)
  fileType?: string;         // MIME type (for direct uploads)
}

// ============================================================================
// ARCHITECTURE SECTION
// ============================================================================

export interface ArchitectureSectionContent {
  diagram: string;         // Mermaid code
  description?: string;    // Brief explanation
  title?: string;          // Custom title (default: "System Architecture")
}

// ============================================================================
// DEMO SECTION
// ============================================================================

export interface VideoEmbed {
  type: 'youtube' | 'vimeo' | 'loom' | 'direct' | 'embed';
  url: string;
  embedUrl?: string;       // For iframe embeds
  thumbnail?: string;      // Preview image
}

export interface DemoCTA {
  label: string;           // "Try Demo", "View Live"
  url: string;
  style: 'primary' | 'secondary' | 'outline';
  icon?: string;           // Optional icon
}

export interface DemoSectionContent {
  video?: VideoEmbed;
  liveUrl?: string;        // Direct link to live demo
  ctas: DemoCTA[];
  title?: string;
}

// ============================================================================
// CHALLENGES SECTION
// ============================================================================

export interface Challenge {
  challenge: string;       // The problem faced
  solution: string;        // How it was solved
  outcome?: string;        // Results/impact (optional)
}

export interface ChallengesSectionContent {
  title?: string;          // Custom title (default: "Challenges & Solutions")
  items: Challenge[];
}

// ============================================================================
// LINKS SECTION
// ============================================================================

export interface ResourceLink {
  label: string;           // "Documentation", "Blog Post"
  url: string;
  icon?: string;           // "book", "video", "github", "external"
  description?: string;    // Optional description
}

export interface LinksSectionContent {
  links: ResourceLink[];
  title?: string;
  style?: 'default' | 'subtle';  // 'subtle' for expert review source links
}

// ============================================================================
// SLIDEUP SECTION
// ============================================================================

export interface SlideUpElement {
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
}

export interface SlideUpSectionContent {
  element1: SlideUpElement;
  element2?: SlideUpElement;
}

// ============================================================================
// CUSTOM SECTION (free-form blocks)
// ============================================================================

import type { ProjectBlock } from './models';

export interface CustomSectionContent {
  title?: string;
  blocks: ProjectBlock[];
}

// ============================================================================
// UNIFIED SECTION CONTENT TYPE
// ============================================================================

export type SectionContent =
  | OverviewSectionContent
  | FeaturesSectionContent
  | TechStackSectionContent
  | GallerySectionContent
  | VideoSectionContent
  | ArchitectureSectionContent
  | DemoSectionContent
  | ChallengesSectionContent
  | LinksSectionContent
  | SlideUpSectionContent
  | CustomSectionContent;

// ============================================================================
// PROJECT SECTION
// ============================================================================

export interface ProjectSection<T extends SectionContent = SectionContent> {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  content: T;
}

// Type guards for section content
export function isOverviewSection(section: ProjectSection): section is ProjectSection<OverviewSectionContent> {
  return section.type === 'overview';
}

export function isFeaturesSection(section: ProjectSection): section is ProjectSection<FeaturesSectionContent> {
  return section.type === 'features';
}

export function isTechStackSection(section: ProjectSection): section is ProjectSection<TechStackSectionContent> {
  return section.type === 'tech_stack';
}

export function isGallerySection(section: ProjectSection): section is ProjectSection<GallerySectionContent> {
  return section.type === 'gallery';
}

export function isVideoSection(section: ProjectSection): section is ProjectSection<VideoSectionContent> {
  return section.type === 'video';
}

export function isArchitectureSection(section: ProjectSection): section is ProjectSection<ArchitectureSectionContent> {
  return section.type === 'architecture';
}

export function isDemoSection(section: ProjectSection): section is ProjectSection<DemoSectionContent> {
  return section.type === 'demo';
}

export function isChallengesSection(section: ProjectSection): section is ProjectSection<ChallengesSectionContent> {
  return section.type === 'challenges';
}

export function isLinksSection(section: ProjectSection): section is ProjectSection<LinksSectionContent> {
  return section.type === 'links';
}

export function isSlideUpSection(section: ProjectSection): section is ProjectSection<SlideUpSectionContent> {
  return section.type === 'slideup';
}

export function isCustomSection(section: ProjectSection): section is ProjectSection<CustomSectionContent> {
  return section.type === 'custom';
}

// ============================================================================
// EXTENDED PROJECT CONTENT WITH SECTIONS
// ============================================================================

export interface ProjectContentWithSections {
  // Template version for migrations
  templateVersion: 2;

  // Section configuration
  sections: ProjectSection[];

  // Legacy support (backwards compatibility)
  blocks?: ProjectBlock[];

  // Hero settings (already exist in current system)
  heroDisplayMode?: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
  heroQuote?: string;
  heroVideoUrl?: string;
  heroSlideshowImages?: string[];
  heroSlideUpElement1?: {
    type: 'image' | 'video' | 'text';
    content: string;
    caption?: string;
  };
  heroSlideUpElement2?: {
    type: 'image' | 'video' | 'text';
    content: string;
    caption?: string;
  };

  // Raw platform data (for regeneration)
  github?: Record<string, unknown>;
  figma?: Record<string, unknown>;
}

// ============================================================================
// DEFAULT SECTION ORDER
// ============================================================================

export const DEFAULT_SECTION_ORDER: SectionType[] = [
  'overview',
  'features',
  'demo',
  'slideup',
  'gallery',
  'tech_stack',
  'architecture',
  'challenges',
  'links',
  'custom',
];

// ============================================================================
// SECTION METADATA
// ============================================================================

export interface SectionMetadata {
  type: SectionType;
  title: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
}

export const SECTION_METADATA: Record<SectionType, SectionMetadata> = {
  overview: {
    type: 'overview',
    title: 'Overview',
    description: 'Quick summary with key metrics',
    icon: 'DocumentTextIcon',
    defaultEnabled: true,
  },
  features: {
    type: 'features',
    title: 'Key Features',
    description: 'Highlight what makes this project special',
    icon: 'SparklesIcon',
    defaultEnabled: true,
  },
  tech_stack: {
    type: 'tech_stack',
    title: 'Tech Stack',
    description: 'Technologies and tools used',
    icon: 'CodeBracketIcon',
    defaultEnabled: true,
  },
  gallery: {
    type: 'gallery',
    title: 'Gallery',
    description: 'Screenshots and visual demos',
    icon: 'PhotoIcon',
    defaultEnabled: true,
  },
  video: {
    type: 'video',
    title: 'Video',
    description: 'Embedded video from YouTube, Vimeo, or Loom',
    icon: 'VideoCameraIcon',
    defaultEnabled: true,
  },
  architecture: {
    type: 'architecture',
    title: 'Architecture',
    description: 'System design and structure',
    icon: 'CubeTransparentIcon',
    defaultEnabled: true,
  },
  demo: {
    type: 'demo',
    title: 'Demo',
    description: 'Video walkthrough or live demo',
    icon: 'PlayCircleIcon',
    defaultEnabled: false,
  },
  challenges: {
    type: 'challenges',
    title: 'Challenges & Solutions',
    description: 'Problems solved and lessons learned',
    icon: 'LightBulbIcon',
    defaultEnabled: false,
  },
  links: {
    type: 'links',
    title: 'Resources',
    description: 'Documentation and related links',
    icon: 'LinkIcon',
    defaultEnabled: false,
  },
  slideup: {
    type: 'slideup',
    title: 'Slide Up',
    description: 'Two-part interactive display with reveal animation',
    icon: 'ArrowUpIcon',
    defaultEnabled: false,
  },
  custom: {
    type: 'custom',
    title: 'Custom Section',
    description: 'Free-form content blocks',
    icon: 'PlusCircleIcon',
    defaultEnabled: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create default content for a new section based on its type.
 */
export function createDefaultSectionContent(type: SectionType): SectionContent {
  switch (type) {
    case 'overview':
      return {
        headline: '',
        description: '',
        metrics: [],
      } as OverviewSectionContent;
    case 'features':
      return {
        features: [
          { icon: 'FaRocket', title: 'Feature 1', description: 'Describe this feature...' },
        ],
      } as FeaturesSectionContent;
    case 'tech_stack':
      return {
        categories: [],
      } as TechStackSectionContent;
    case 'gallery':
      return {
        images: [],
        layout: 'grid',
      } as GallerySectionContent;
    case 'video':
      return {
        url: '',
        platform: 'youtube',
        video_id: '',
      } as VideoSectionContent;
    case 'architecture':
      return {
        diagram: '',
        description: '',
      } as ArchitectureSectionContent;
    case 'demo':
      return {
        ctas: [],
      } as DemoSectionContent;
    case 'challenges':
      return {
        items: [],
      } as ChallengesSectionContent;
    case 'links':
      return {
        links: [],
      } as LinksSectionContent;
    case 'slideup':
      return {
        element1: { type: 'image', content: '' },
        element2: { type: 'text', content: '' },
      } as SlideUpSectionContent;
    case 'custom':
      return {
        title: 'Custom Section',
        blocks: [],
      } as CustomSectionContent;
    default:
      return { blocks: [] } as CustomSectionContent;
  }
}

/**
 * Generate a unique section ID.
 */
export function generateSectionId(type: SectionType): string {
  return `section-${type}-${Math.random().toString(36).substr(2, 9)}`;
}
