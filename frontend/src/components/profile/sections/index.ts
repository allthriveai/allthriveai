/**
 * Profile Section Components
 *
 * Export profile section components for easy importing.
 *
 * Section types by template:
 * - Explorer: About, Learning Goals, Links
 * - Builder: About, Featured Projects, Skills, Links
 * - Creator: About, Storefront, Featured Projects, Links
 * - Curation: About, Featured Content, Links
 * - Battle Bot: About, Battle Stats, Recent Battles
 */

export { ProfileSectionRenderer, ProfileSections, type ProfileUser } from './ProfileSectionRenderer';

// Core sections (all templates)
export { AboutSection } from './AboutSection';
export { LinksSection } from './LinksSection';
export { CustomSection } from './CustomSection';

// Builder sections
export { FeaturedProjectsSection } from './FeaturedProjectsSection';
export { SkillsSection } from './SkillsSection';

// Explorer sections
export { LearningGoalsSection } from './LearningGoalsSection';

// Creator sections
export { StorefrontSection } from './StorefrontSection';

// Curation sections
export { FeaturedContentSection } from './FeaturedContentSection';

// Battle Bot sections
export { BattleStatsSection } from './BattleStatsSection';
export { RecentBattlesSection } from './RecentBattlesSection';
