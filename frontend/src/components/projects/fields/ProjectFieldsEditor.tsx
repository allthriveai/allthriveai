/**
 * ProjectFieldsEditor - Reusable, composable project fields editor
 *
 * This component provides a scalable, template-based system for editing project fields.
 * It can be used in both quick-edit trays and full editor pages, with the same consistent fields.
 *
 * Design principles:
 * - Composable: Each field is a separate component that can be arranged in any order
 * - Testable: Each field component can be tested independently
 * - Scalable: Easy to add new templates or field configurations
 * - Maintainable: Single source of truth for field definitions
 *
 * @example
 * <ProjectFieldsEditor
 *   template="quick-edit"
 *   editorProps={editorProps}
 * />
 */

import { BasicInfoSection } from './BasicInfoSection';
import { BannerImageSection } from './BannerImageSection';
import { ProjectUrlSection } from './ProjectUrlSection';
import { ToolsSection } from './ToolsSection';
import { TopicsSection } from './TopicsSection';
import { DescriptionSection } from './DescriptionSection';
import { HeroDisplaySection } from './HeroDisplaySection';

// Template configuration type
interface TemplateConfig {
  sections: Array<{
    id: string;
    component: React.ComponentType<any>;
    props?: Record<string, any>;
    order: number;
  }>;
}

// Available templates
const TEMPLATES: Record<string, TemplateConfig> = {
  'quick-edit': {
    sections: [
      { id: 'basic-info', component: BasicInfoSection, order: 1 },
      { id: 'banner-image', component: BannerImageSection, order: 2 },
      { id: 'project-url', component: ProjectUrlSection, order: 3 },
      { id: 'tools', component: ToolsSection, order: 4 },
      { id: 'topics', component: TopicsSection, order: 5 },
      { id: 'description', component: DescriptionSection, order: 6, props: { maxWords: 200 } },
      // Note: hero-display is in the separate "Hero Display" tab for quick-edit
    ],
  },
  'quick-edit-hero': {
    sections: [
      { id: 'hero-display', component: HeroDisplaySection, order: 1 },
    ],
  },
  'full-edit': {
    sections: [
      { id: 'basic-info', component: BasicInfoSection, order: 1 },
      { id: 'banner-image', component: BannerImageSection, order: 2 },
      { id: 'project-url', component: ProjectUrlSection, order: 3 },
      { id: 'tools', component: ToolsSection, order: 4 },
      { id: 'topics', component: TopicsSection, order: 5 },
      { id: 'description', component: DescriptionSection, order: 6, props: { maxWords: 200 } },
      { id: 'hero-display', component: HeroDisplaySection, order: 7 },
    ],
  },
};

interface ProjectFieldsEditorProps {
  // Template to use ('quick-edit', 'full-edit', or custom config)
  template?: string | TemplateConfig;
  // Props from ProjectEditor's editorProps
  editorProps: {
    projectTitle: string;
    setProjectTitle: (title: string) => void;
    bannerUrl: string;
    setBannerUrl: (url: string) => void;
    handleBannerUpload: (file: File) => void;
    isUploadingBanner: boolean;
    projectUrl: string;
    setProjectUrl: (url: string) => void;
    projectTools: number[];
    setProjectTools: (tools: number[]) => void;
    projectTopics: number[];
    setProjectTopics: (topics: number[]) => void;
    availableTopics: any[];
    projectDescription: string;
    setProjectDescription: (description: string) => void;
    heroDisplayMode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
    setHeroDisplayMode: (mode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup') => void;
    featuredImageUrl?: string;
    heroQuote?: string;
    heroVideoUrl?: string;
    heroSlideshowImages?: string[];
    isSaving: boolean;
  };
}

export function ProjectFieldsEditor({
  template = 'quick-edit',
  editorProps,
}: ProjectFieldsEditorProps) {
  // Resolve template configuration
  const config: TemplateConfig = typeof template === 'string'
    ? TEMPLATES[template] || TEMPLATES['quick-edit']
    : template;

  // Sort sections by order
  const sortedSections = [...config.sections].sort((a, b) => a.order - b.order);

  // Map section IDs to their required props
  const getSectionProps = (sectionId: string, customProps: Record<string, any> = {}) => {
    const baseProps = { isSaving: editorProps.isSaving, ...customProps };

    switch (sectionId) {
      case 'basic-info':
        return {
          ...baseProps,
          projectTitle: editorProps.projectTitle,
          setProjectTitle: editorProps.setProjectTitle,
        };
      case 'banner-image':
        return {
          ...baseProps,
          bannerUrl: editorProps.bannerUrl,
          setBannerUrl: editorProps.setBannerUrl,
          handleBannerUpload: editorProps.handleBannerUpload,
          isUploadingBanner: editorProps.isUploadingBanner,
        };
      case 'project-url':
        return {
          ...baseProps,
          projectUrl: editorProps.projectUrl,
          setProjectUrl: editorProps.setProjectUrl,
        };
      case 'tools':
        return {
          ...baseProps,
          projectTools: editorProps.projectTools,
          setProjectTools: editorProps.setProjectTools,
        };
      case 'topics':
        return {
          ...baseProps,
          projectTopics: editorProps.projectTopics,
          setProjectTopics: editorProps.setProjectTopics,
          availableTopics: editorProps.availableTopics,
        };
      case 'description':
        return {
          ...baseProps,
          projectDescription: editorProps.projectDescription,
          setProjectDescription: editorProps.setProjectDescription,
        };
      case 'hero-display':
        return {
          ...baseProps,
          heroDisplayMode: editorProps.heroDisplayMode,
          setHeroDisplayMode: editorProps.setHeroDisplayMode,
          featuredImageUrl: editorProps.featuredImageUrl,
          heroQuote: editorProps.heroQuote,
          heroVideoUrl: editorProps.heroVideoUrl,
          heroSlideshowImages: editorProps.heroSlideshowImages,
        };
      default:
        return baseProps;
    }
  };

  return (
    <div className="space-y-6">
      {sortedSections.map((section) => {
        const Component = section.component;
        const props = getSectionProps(section.id, section.props);

        return (
          <Component
            key={section.id}
            {...props}
          />
        );
      })}
    </div>
  );
}

// Export section components for direct use if needed
export {
  BasicInfoSection,
  BannerImageSection,
  ProjectUrlSection,
  ToolsSection,
  TopicsSection,
  DescriptionSection,
  HeroDisplaySection,
};

// Export template configurations for extensibility
export { TEMPLATES };
export type { TemplateConfig };
