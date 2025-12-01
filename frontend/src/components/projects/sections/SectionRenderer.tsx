/**
 * SectionRenderer - Routes project sections to their specific renderers
 *
 * This component takes a ProjectSection and renders the appropriate
 * section component based on the section type.
 */

import type { ProjectSection } from '@/types/sections';
import { OverviewSection } from './OverviewSection';
import { FeaturesSection } from './FeaturesSection';
import { TechStackSection } from './TechStackSection';
import { GallerySection } from './GallerySection';
import { ArchitectureSection } from './ArchitectureSection';
import { DemoSection } from './DemoSection';
import { ChallengesSection } from './ChallengesSection';
import { LinksSection } from './LinksSection';
import { CustomSection } from './CustomSection';

interface SectionRendererProps {
  section: ProjectSection;
  isEditing?: boolean;
  onUpdate?: (content: ProjectSection['content']) => void;
}

export function SectionRenderer({ section, isEditing, onUpdate }: SectionRendererProps) {
  if (!section.enabled) {
    return null;
  }

  const commonProps = { isEditing, onUpdate };

  switch (section.type) {
    case 'overview':
      return <OverviewSection content={section.content as any} {...commonProps} />;
    case 'features':
      return <FeaturesSection content={section.content as any} {...commonProps} />;
    case 'tech_stack':
      return <TechStackSection content={section.content as any} {...commonProps} />;
    case 'gallery':
      return <GallerySection content={section.content as any} {...commonProps} />;
    case 'architecture':
      return <ArchitectureSection content={section.content as any} {...commonProps} />;
    case 'demo':
      return <DemoSection content={section.content as any} {...commonProps} />;
    case 'challenges':
      return <ChallengesSection content={section.content as any} {...commonProps} />;
    case 'links':
      return <LinksSection content={section.content as any} {...commonProps} />;
    case 'custom':
      return <CustomSection content={section.content as any} {...commonProps} />;
    default:
      return null;
  }
}

/**
 * ProjectSections - Renders all enabled sections in order
 */
interface ProjectSectionsProps {
  sections: ProjectSection[];
  isEditing?: boolean;
  onSectionUpdate?: (sectionId: string, content: ProjectSection['content']) => void;
}

export function ProjectSections({ sections, isEditing, onSectionUpdate }: ProjectSectionsProps) {
  const enabledSections = sections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledSections.length === 0) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
      <div className="space-y-16">
        {enabledSections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            isEditing={isEditing}
            onUpdate={onSectionUpdate ? (content) => onSectionUpdate(section.id, content) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
