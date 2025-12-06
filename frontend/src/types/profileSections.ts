/**
 * Profile Section Types
 *
 * Defines the customizable section system for user profile Showcase pages.
 * Showcase is full-width and fully customizable.
 * Other tabs (Playground, Learning, Activity) use sidebar layout.
 *
 * TEMPLATES determine default sections based on user type:
 * - Explorer: New users, learners
 * - Builder: Developers, makers with projects
 * - Creator: Content creators, sellers
 * - Curation: AI curators (RSS aggregators, etc.)
 * - BattleBot: AI battle opponents (Pip)
 */

import type { ProjectBlock } from './models';

// ============================================================================
// PROFILE TEMPLATES
// ============================================================================

export type ProfileTemplate =
  | 'explorer'    // New users, learners - About, Learning Goals, Links
  | 'builder'     // Developers, makers - About, Featured Projects, Skills, Links
  | 'creator'     // Content creators - About, Storefront, Featured Work, Links
  | 'curation'    // AI curators - About, Featured Content, Links
  | 'battle_bot'; // Battle bots (Pip) - About, Battle Stats, Recent Battles

export interface ProfileTemplateConfig {
  id: ProfileTemplate;
  name: string;
  description: string;
  icon: string;
  sections: ProfileSectionType[];
  defaultSections: ProfileSectionType[];  // Alias for sections (used in UI)
  forTiers?: string[];      // Which user tiers this applies to
  forRoles?: string[];      // Which user roles this applies to
  requiresProjects?: boolean;
}

export const PROFILE_TEMPLATES: Record<ProfileTemplate, ProfileTemplateConfig> = {
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Perfect for learners and newcomers. Highlight what you\'re learning and where to find you.',
    icon: 'CompassIcon',
    sections: ['about', 'learning_goals', 'links'],
    defaultSections: ['about', 'learning_goals', 'links'],
    requiresProjects: false,
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'Showcase your projects and technical skills. Great for developers and makers.',
    icon: 'WrenchScrewdriverIcon',
    sections: ['about', 'featured_projects', 'skills', 'links'],
    defaultSections: ['about', 'featured_projects', 'skills', 'links'],
    requiresProjects: true,
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    description: 'Feature your products and services. Ideal for content creators and sellers.',
    icon: 'SparklesIcon',
    sections: ['about', 'storefront', 'featured_projects', 'links'],
    defaultSections: ['about', 'storefront', 'featured_projects', 'links'],
    forRoles: ['creator'],
  },
  curation: {
    id: 'curation',
    name: 'Curator',
    description: 'Highlight curated content and discoveries. For AI aggregators and curators.',
    icon: 'NewspaperIcon',
    sections: ['about', 'featured_content', 'links'],
    defaultSections: ['about', 'featured_content', 'links'],
    forTiers: ['curation'],
  },
  battle_bot: {
    id: 'battle_bot',
    name: 'Battle Bot',
    description: 'Show off battle stats and history. For AI battle opponents.',
    icon: 'BoltIcon',
    sections: ['about', 'battle_stats', 'recent_battles'],
    defaultSections: ['about', 'battle_stats', 'recent_battles'],
    forTiers: ['curation'],
  },
};

// ============================================================================
// SECTION TYPE DEFINITIONS
// ============================================================================

export type ProfileSectionType =
  | 'about'              // Bio/story (rich text)
  | 'links'              // Social & external links grid
  | 'skills'             // Skill badges/tags
  | 'learning_goals'     // What they're learning/interested in
  | 'featured_projects'  // Masonry project cards (max 6)
  | 'storefront'         // Products/services for creators
  | 'featured_content'   // Curated content for curation bots
  | 'battle_stats'       // Win/loss record for battle bots
  | 'recent_battles'     // Battle history for battle bots
  | 'custom';            // Free-form blocks

// ============================================================================
// ABOUT SECTION
// ============================================================================

export interface AboutSectionContent {
  bio: string;           // Rich text bio (HTML)
  showLocation?: boolean;
  showPronouns?: boolean;
  showStatus?: boolean;
}

// ============================================================================
// LINKS SECTION
// ============================================================================

export interface LinkItem {
  label: string;
  url: string;
  icon?: string;         // Icon slug or URL
  isPrimary?: boolean;   // Featured/highlighted link
}

export interface LinksSectionContent {
  links: LinkItem[];
  layout?: 'grid' | 'list' | 'buttons';
}

// ============================================================================
// SKILLS SECTION
// ============================================================================

export interface Skill {
  name: string;
  category?: string;     // e.g., "Frontend", "Backend", "AI/ML"
  level?: 'learning' | 'proficient' | 'expert';
  icon?: string;
}

export interface SkillsSectionContent {
  skills: Skill[];
  showCategories?: boolean;
  showLevels?: boolean;
  layout?: 'tags' | 'categories' | 'grid';
}

// ============================================================================
// LEARNING GOALS SECTION
// ============================================================================

export interface LearningGoal {
  topic: string;
  description?: string;
  progress?: number;     // 0-100 percentage
  resources?: string[];  // URLs to learning resources
}

export interface LearningGoalsSectionContent {
  goals: LearningGoal[];
  showProgress?: boolean;
  title?: string;        // Custom title (default: "Currently Learning")
}

// ============================================================================
// FEATURED PROJECTS SECTION
// ============================================================================

export interface FeaturedProjectsSectionContent {
  projectIds: number[];
  maxProjects: number;   // Default: 6
  layout?: 'masonry' | 'grid' | 'carousel';
  showDescription?: boolean;
}

// ============================================================================
// STOREFRONT SECTION
// ============================================================================

export interface StorefrontItem {
  id: string;
  title: string;
  description?: string;
  price?: string;        // Display price (e.g., "$29", "Free", "From $10")
  url?: string;          // Link to purchase/more info (required for external products)
  imageUrl?: string;
  badge?: string;        // e.g., "New", "Popular", "Sale"
  category?: string;     // e.g., "Course", "Template", "Service"
  // Native AllThrive product support
  productId?: number;    // Links to a native marketplace Product (if set, url is ignored)
  currency?: string;     // Currency code for native products (e.g., "USD")
}

export interface StorefrontSectionContent {
  items: StorefrontItem[];
  title?: string;        // Custom title (default: "Shop")
  layout?: 'grid' | 'list' | 'featured';
}

// ============================================================================
// FEATURED CONTENT SECTION (for Curation bots)
// ============================================================================

export interface FeaturedContentSectionContent {
  projectIds: number[];  // Curated content IDs
  maxItems: number;
  title?: string;        // Custom title (default: "Curated Picks")
  layout?: 'masonry' | 'grid' | 'list';
}

// ============================================================================
// BATTLE STATS SECTION (for Battle bots)
// ============================================================================

export interface BattleStatsSectionContent {
  showWinRate?: boolean;
  showStreak?: boolean;
  showTotalBattles?: boolean;
  showRanking?: boolean;
  // Stats are loaded dynamically from API
}

// ============================================================================
// RECENT BATTLES SECTION (for Battle bots)
// ============================================================================

export interface RecentBattlesSectionContent {
  maxBattles: number;    // Default: 6
  showOutcome?: boolean;
  showChallenge?: boolean;
  layout?: 'grid' | 'list';
  // Battles are loaded dynamically from API
}

// ============================================================================
// CUSTOM SECTION
// ============================================================================

export interface CustomSectionContent {
  title: string;
  blocks: ProjectBlock[];
}

// ============================================================================
// UNIFIED SECTION CONTENT TYPE
// ============================================================================

export type ProfileSectionContent =
  | AboutSectionContent
  | LinksSectionContent
  | SkillsSectionContent
  | LearningGoalsSectionContent
  | FeaturedProjectsSectionContent
  | StorefrontSectionContent
  | FeaturedContentSectionContent
  | BattleStatsSectionContent
  | RecentBattlesSectionContent
  | CustomSectionContent;

// ============================================================================
// PROFILE SECTION
// ============================================================================

export interface ProfileSection<T extends ProfileSectionContent = ProfileSectionContent> {
  id: string;
  type: ProfileSectionType;
  visible: boolean;
  order: number;
  title?: string;        // Custom title override
  content: T;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isAboutSection(
  section: ProfileSection
): section is ProfileSection<AboutSectionContent> {
  return section.type === 'about';
}

export function isLinksSection(
  section: ProfileSection
): section is ProfileSection<LinksSectionContent> {
  return section.type === 'links';
}

export function isSkillsSection(
  section: ProfileSection
): section is ProfileSection<SkillsSectionContent> {
  return section.type === 'skills';
}

export function isLearningGoalsSection(
  section: ProfileSection
): section is ProfileSection<LearningGoalsSectionContent> {
  return section.type === 'learning_goals';
}

export function isFeaturedProjectsSection(
  section: ProfileSection
): section is ProfileSection<FeaturedProjectsSectionContent> {
  return section.type === 'featured_projects';
}

export function isStorefrontSection(
  section: ProfileSection
): section is ProfileSection<StorefrontSectionContent> {
  return section.type === 'storefront';
}

export function isFeaturedContentSection(
  section: ProfileSection
): section is ProfileSection<FeaturedContentSectionContent> {
  return section.type === 'featured_content';
}

export function isBattleStatsSection(
  section: ProfileSection
): section is ProfileSection<BattleStatsSectionContent> {
  return section.type === 'battle_stats';
}

export function isRecentBattlesSection(
  section: ProfileSection
): section is ProfileSection<RecentBattlesSectionContent> {
  return section.type === 'recent_battles';
}

export function isCustomSection(
  section: ProfileSection
): section is ProfileSection<CustomSectionContent> {
  return section.type === 'custom';
}

// ============================================================================
// SECTION METADATA
// ============================================================================

export interface ProfileSectionMetadata {
  type: ProfileSectionType;
  title: string;
  description: string;
  icon: string;
  defaultVisible: boolean;
  singleton: boolean;
  forTemplates?: ProfileTemplate[];  // Which templates include this by default
}

export const PROFILE_SECTION_METADATA: Record<ProfileSectionType, ProfileSectionMetadata> = {
  about: {
    type: 'about',
    title: 'About',
    description: 'Tell your story with a rich bio section',
    icon: 'UserIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['explorer', 'builder', 'creator', 'curation', 'battle_bot'],
  },
  links: {
    type: 'links',
    title: 'Links',
    description: 'Share your social profiles and important links',
    icon: 'LinkIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['explorer', 'builder', 'creator', 'curation'],
  },
  skills: {
    type: 'skills',
    title: 'Skills',
    description: 'Showcase your technical skills and expertise',
    icon: 'CodeBracketIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['builder'],
  },
  learning_goals: {
    type: 'learning_goals',
    title: 'Learning Goals',
    description: 'Share what you\'re currently learning',
    icon: 'AcademicCapIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['explorer'],
  },
  featured_projects: {
    type: 'featured_projects',
    title: 'Featured Projects',
    description: 'Highlight your best work (up to 6 projects)',
    icon: 'RocketLaunchIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['builder', 'creator'],
  },
  storefront: {
    type: 'storefront',
    title: 'Storefront',
    description: 'Sell your products, courses, and services',
    icon: 'ShoppingBagIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['creator'],
  },
  featured_content: {
    type: 'featured_content',
    title: 'Featured Content',
    description: 'Curated picks and discoveries',
    icon: 'NewspaperIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['curation'],
  },
  battle_stats: {
    type: 'battle_stats',
    title: 'Battle Stats',
    description: 'Show your battle record and stats',
    icon: 'ChartBarIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['battle_bot'],
  },
  recent_battles: {
    type: 'recent_battles',
    title: 'Recent Battles',
    description: 'Display recent battle history',
    icon: 'BoltIcon',
    defaultVisible: true,
    singleton: true,
    forTemplates: ['battle_bot'],
  },
  custom: {
    type: 'custom',
    title: 'Custom Section',
    description: 'Add free-form content with text, images, and more',
    icon: 'PlusCircleIcon',
    defaultVisible: false,
    singleton: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create default content for a new profile section based on its type.
 */
export function createDefaultProfileSectionContent(
  type: ProfileSectionType
): ProfileSectionContent {
  switch (type) {
    case 'about':
      return {
        bio: '',
        showLocation: true,
        showPronouns: true,
        showStatus: true,
      } as AboutSectionContent;

    case 'links':
      return {
        links: [],
        layout: 'grid',
      } as LinksSectionContent;

    case 'skills':
      return {
        skills: [],
        showCategories: true,
        showLevels: false,
        layout: 'tags',
      } as SkillsSectionContent;

    case 'learning_goals':
      return {
        goals: [],
        showProgress: true,
        title: 'Currently Learning',
      } as LearningGoalsSectionContent;

    case 'featured_projects':
      return {
        projectIds: [],
        maxProjects: 6,
        layout: 'masonry',
        showDescription: true,
      } as FeaturedProjectsSectionContent;

    case 'storefront':
      return {
        items: [],
        title: 'Shop',
        layout: 'grid',
      } as StorefrontSectionContent;

    case 'featured_content':
      return {
        projectIds: [],
        maxItems: 6,
        title: 'Curated Picks',
        layout: 'masonry',
      } as FeaturedContentSectionContent;

    case 'battle_stats':
      return {
        showWinRate: true,
        showStreak: true,
        showTotalBattles: true,
        showRanking: false,
      } as BattleStatsSectionContent;

    case 'recent_battles':
      return {
        maxBattles: 6,
        showOutcome: true,
        showChallenge: true,
        layout: 'grid',
      } as RecentBattlesSectionContent;

    case 'custom':
      return {
        title: 'Custom Section',
        blocks: [],
      } as CustomSectionContent;

    default:
      return {
        bio: '',
      } as AboutSectionContent;
  }
}

/**
 * Generate a unique profile section ID.
 */
export function generateProfileSectionId(type: ProfileSectionType): string {
  return `profile-section-${type}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine the best template for a user based on their profile.
 */
export function selectTemplateForUser(user: {
  tier?: string;
  role?: string;
  username?: string;
  projectCount?: number;
}): ProfileTemplate {
  // Battle bot check (Pip)
  if (user.tier === 'curation' && user.username?.toLowerCase() === 'pip') {
    return 'battle_bot';
  }

  // Curation tier
  if (user.tier === 'curation') {
    return 'curation';
  }

  // Creator role
  if (user.role === 'creator') {
    return 'creator';
  }

  // Has projects = builder
  if (user.projectCount && user.projectCount > 0) {
    return 'builder';
  }

  // Default to explorer
  return 'explorer';
}

/**
 * Get default profile sections for a template.
 */
export function getDefaultSectionsForTemplate(template: ProfileTemplate): ProfileSection[] {
  const config = PROFILE_TEMPLATES[template];

  return config.sections.map((type, index) => ({
    id: generateProfileSectionId(type),
    type,
    visible: true,
    order: index,
    content: createDefaultProfileSectionContent(type),
  }));
}

/**
 * Get default profile sections for a user (auto-selects template).
 */
export function getDefaultProfileSections(user?: {
  tier?: string;
  role?: string;
  username?: string;
  projectCount?: number;
}): ProfileSection[] {
  const template = user ? selectTemplateForUser(user) : 'explorer';
  return getDefaultSectionsForTemplate(template);
}

/**
 * Get available section types for adding to a profile.
 * Filters out singletons that already exist.
 */
export function getAvailableSectionTypes(
  existingSections: ProfileSection[],
  userRole?: string,
  userTier?: string
): ProfileSectionType[] {
  const existingTypes = new Set(existingSections.map(s => s.type));

  return (Object.keys(PROFILE_SECTION_METADATA) as ProfileSectionType[]).filter(type => {
    const metadata = PROFILE_SECTION_METADATA[type];

    // Check if singleton already exists
    if (metadata.singleton && existingTypes.has(type)) {
      return false;
    }

    // Storefront only for creators
    if (type === 'storefront' && userRole !== 'creator') {
      return false;
    }

    // Battle sections only for battle bots
    if ((type === 'battle_stats' || type === 'recent_battles') && userTier !== 'curation') {
      return false;
    }

    // Featured content only for curation tier
    if (type === 'featured_content' && userTier !== 'curation') {
      return false;
    }

    return true;
  });
}
