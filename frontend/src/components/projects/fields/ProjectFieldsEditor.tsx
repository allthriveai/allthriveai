/**
 * ProjectFieldsEditor - Reusable, composable project fields editor
 *
 * This component provides a scalable, template-based system for editing project fields.
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
    projectCategories: number[];
    setProjectCategories: (categories: number[]) => void;
    availableCategories: any[];
    projectTopics: string[];
    setProjectTopics: (topics: string[]) => void;
    projectDescription: string;
    setProjectDescription: (description: string) => void;
    // Hero display props
    heroDisplayMode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
    setHeroDisplayMode: (mode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup') => void;
    featuredImageUrl?: string;
    setFeaturedImageUrl?: (url: string) => void;
    handleFeaturedImageUpload?: (file: File) => void;
    isUploadingFeatured?: boolean;
    heroVideoUrl?: string;
    setHeroVideoUrl?: (url: string) => void;
    handleVideoUpload?: (file: File) => void;
    isUploadingVideo?: boolean;
    heroSlideshowImages?: string[];
    setHeroSlideshowImages?: (images: string[]) => void;
    heroQuote?: string;
    setHeroQuote?: (quote: string) => void;
    slideUpElement1Type?: 'image' | 'video' | 'text';
    slideUpElement1Content?: string;
    slideUpElement1Caption?: string;
    setSlideUpElement1Type?: (type: 'image' | 'video' | 'text') => void;
    setSlideUpElement1Content?: (content: string) => void;
    setSlideUpElement1Caption?: (caption: string) => void;
    handleSlideUpElement1Upload?: (file: File, type: 'image' | 'video') => void;
    isUploadingSlideUp1?: boolean;
    slideUpElement2Type?: 'image' | 'video' | 'text';
    slideUpElement2Content?: string;
    slideUpElement2Caption?: string;
    setSlideUpElement2Type?: (type: 'image' | 'video' | 'text') => void;
    setSlideUpElement2Content?: (content: string) => void;
    setSlideUpElement2Caption?: (caption: string) => void;
    handleSlideUpElement2Upload?: (file: File, type: 'image' | 'video') => void;
    isUploadingSlideUp2?: boolean;
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
          projectCategories: editorProps.projectCategories,
          setProjectCategories: editorProps.setProjectCategories,
          availableCategories: editorProps.availableCategories,
          projectTopics: editorProps.projectTopics,
          setProjectTopics: editorProps.setProjectTopics,
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
          setFeaturedImageUrl: editorProps.setFeaturedImageUrl,
          handleFeaturedImageUpload: editorProps.handleFeaturedImageUpload,
          isUploadingFeatured: editorProps.isUploadingFeatured,
          heroVideoUrl: editorProps.heroVideoUrl,
          setHeroVideoUrl: editorProps.setHeroVideoUrl,
          handleVideoUpload: editorProps.handleVideoUpload,
          isUploadingVideo: editorProps.isUploadingVideo,
          heroSlideshowImages: editorProps.heroSlideshowImages,
          setHeroSlideshowImages: editorProps.setHeroSlideshowImages,
          heroQuote: editorProps.heroQuote,
          setHeroQuote: editorProps.setHeroQuote,
          slideUpElement1Type: editorProps.slideUpElement1Type,
          slideUpElement1Content: editorProps.slideUpElement1Content,
          slideUpElement1Caption: editorProps.slideUpElement1Caption,
          setSlideUpElement1Type: editorProps.setSlideUpElement1Type,
          setSlideUpElement1Content: editorProps.setSlideUpElement1Content,
          setSlideUpElement1Caption: editorProps.setSlideUpElement1Caption,
          handleSlideUpElement1Upload: editorProps.handleSlideUpElement1Upload,
          isUploadingSlideUp1: editorProps.isUploadingSlideUp1,
          slideUpElement2Type: editorProps.slideUpElement2Type,
          slideUpElement2Content: editorProps.slideUpElement2Content,
          slideUpElement2Caption: editorProps.slideUpElement2Caption,
          setSlideUpElement2Type: editorProps.setSlideUpElement2Type,
          setSlideUpElement2Content: editorProps.setSlideUpElement2Content,
          setSlideUpElement2Caption: editorProps.setSlideUpElement2Caption,
          handleSlideUpElement2Upload: editorProps.handleSlideUpElement2Upload,
          isUploadingSlideUp2: editorProps.isUploadingSlideUp2,
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
