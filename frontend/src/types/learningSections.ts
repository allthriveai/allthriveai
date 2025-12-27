/**
 * Learning Sections - Types for organizing learning paths into custom sections
 *
 * This enables drag-and-drop organization of topics into sections with:
 * - Flexible nesting (max 2 levels)
 * - Full metadata (titles, descriptions, estimated time, collapse state)
 * - Mixed children (topics + nested sections)
 */

/**
 * A user-created section for organizing topics
 */
export interface LearningSection {
  id: string;
  type: 'section';
  title: string;
  description: string;
  estimatedMinutes: number;
  isCollapsed: boolean;
  color?: string;
  children: LearningSectionChild[];
}

/**
 * Reference to a topic by slug - used inside section.children
 */
export interface TopicRef {
  type: 'topic';
  topicSlug: string;
}

/**
 * A section child can be either a nested section or a topic reference
 */
export type LearningSectionChild = LearningSection | TopicRef;

/**
 * Root-level sections organization structure
 * - sections array only contains LearningSection (not bare TopicRef)
 * - TopicRef only appears inside section.children
 */
export interface SectionsOrganization {
  version: number;
  sections: LearningSection[];
}

/**
 * Type guard to check if a child is a LearningSection
 */
export function isLearningSection(child: LearningSectionChild): child is LearningSection {
  return child.type === 'section';
}

/**
 * Type guard to check if a child is a TopicRef
 */
export function isTopicRef(child: LearningSectionChild): child is TopicRef {
  return child.type === 'topic';
}

/**
 * Progress info for a section or topic
 */
export interface SectionProgress {
  completed: number;
  total: number;
  percentage: number;
}

/**
 * API response for sections organization endpoint
 */
export interface SectionsOrganizationResponse {
  sectionsOrganization: SectionsOrganization | null;
  topics: TopicSectionData[];
}

/**
 * Topic section data from the learning path
 * Matches the structure returned by the API
 */
export interface TopicSectionData {
  slug: string;
  name: string;
  description?: string;
  estimatedMinutes?: number;
  concepts: ConceptData[];
}

/**
 * Concept data within a topic
 */
export interface ConceptData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  masteryLevel: number;
  isCompleted: boolean;
}

/**
 * Create a new empty section with default values
 */
export function createEmptySection(id: string, title = 'New Section'): LearningSection {
  return {
    id,
    type: 'section',
    title,
    description: '',
    estimatedMinutes: 0,
    isCollapsed: false,
    children: [],
  };
}

/**
 * Create a topic reference
 */
export function createTopicRef(topicSlug: string): TopicRef {
  return {
    type: 'topic',
    topicSlug,
  };
}

/**
 * Create default sections organization with all topics in a single "My Path" section
 */
export function createDefaultSectionsOrganization(topicSlugs: string[]): SectionsOrganization {
  return {
    version: 1,
    sections: [
      {
        id: crypto.randomUUID(),
        type: 'section',
        title: 'My Path',
        description: '',
        estimatedMinutes: 0,
        isCollapsed: false,
        children: topicSlugs.map((slug) => createTopicRef(slug)),
      },
    ],
  };
}
