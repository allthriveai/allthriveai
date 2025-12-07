/**
 * SectionEditorContext - State management for the section-based project editor
 *
 * This context provides a clean, type-safe API for editing projects with sections.
 * It handles:
 * - Project metadata (title, description, banner, etc.)
 * - Hero display configuration
 * - Section CRUD operations (create, read, update, delete, reorder)
 * - Auto-save with debouncing
 * - Upload handlers for images/videos
 * - UI state (sidebar, active section)
 *
 * Design principles:
 * - Strongly typed with TypeScript
 * - Immutable state updates
 * - Optimistic UI updates
 * - Debounced autosave to prevent API spam
 * - Clear separation between metadata, hero, and sections
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Project, ProjectPayload } from '@/types/models';
import type {
  ProjectSection,
  SectionType,
  SectionContent,
  OverviewSectionContent,
  FeaturesSectionContent,
} from '@/types/sections';
import { updateProject } from '@/services/projects';
import { uploadImage, uploadFile } from '@/services/upload';
import { generateSlug } from '@/utils/slug';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';

// ============================================================================
// Types
// ============================================================================

/** Hero display mode options */
export type HeroDisplayMode = 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';

/** Slide-up element configuration */
export interface SlideUpElement {
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
}

/** Hero content configuration */
export interface HeroContent {
  quote: string;
  videoUrl: string;
  slideshowImages: string[];
  slideUpElement1: SlideUpElement | null;
  slideUpElement2: SlideUpElement | null;
}

/** Upload state for tracking individual upload operations */
interface UploadState {
  banner: boolean;
  featuredImage: boolean;
  video: boolean;
  slideUp1: boolean;
  slideUp2: boolean;
}

/** Context value interface - the public API for consumers */
export interface SectionEditorContextValue {
  // ========== Project Data ==========
  project: Project;

  // ========== Save State ==========
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  save: () => Promise<void>;

  // ========== Metadata ==========
  title: string;
  setTitle: (title: string) => void;
  slug: string;
  setSlug: (slug: string) => void;
  customSlugSet: boolean;
  setCustomSlugSet: (set: boolean) => void;
  description: string;
  setDescription: (description: string) => void;
  bannerUrl: string;
  setBannerUrl: (url: string) => void;
  featuredImageUrl: string;
  setFeaturedImageUrl: (url: string) => void;
  externalUrl: string;
  setExternalUrl: (url: string) => void;
  tools: number[];
  setTools: (tools: number[]) => void;
  categories: number[];
  setCategories: (categories: number[]) => void;
  topics: string[];
  setTopics: (topics: string[]) => void;

  // ========== Hero Display ==========
  heroDisplayMode: HeroDisplayMode;
  setHeroDisplayMode: (mode: HeroDisplayMode) => void;
  heroContent: HeroContent;
  updateHeroContent: (updates: Partial<HeroContent>) => void;

  // ========== Sections ==========
  sections: ProjectSection[];
  updateSectionContent: (sectionId: string, content: SectionContent) => void;
  addSection: (type: SectionType, afterId?: string) => void;
  deleteSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  toggleSectionEnabled: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;

  // ========== Upload Handlers ==========
  uploadState: UploadState;
  handleBannerUpload: (file: File) => Promise<void>;
  handleFeaturedImageUpload: (file: File) => Promise<void>;
  handleVideoUpload: (file: File) => Promise<string>;
  handleImageUpload: (file: File) => Promise<string>;
  handleSlideUpUpload: (
    elementNumber: 1 | 2,
    file: File,
    type: 'image' | 'video'
  ) => Promise<void>;

  // ========== UI State ==========
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
}

// ============================================================================
// Context
// ============================================================================

const SectionEditorContext = createContext<SectionEditorContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the section editor context.
 * Must be used within a SectionEditorProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSectionEditorContext(): SectionEditorContextValue {
  const context = useContext(SectionEditorContext);
  if (!context) {
    throw new Error(
      'useSectionEditorContext must be used within a SectionEditorProvider'
    );
  }
  return context;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initialize sections from a project that may not have sections.
 * Creates default sections based on existing project data.
 */
function initializeSectionsFromProject(project: Project): ProjectSection[] {
  // If project already has sections, use them
  const content = project.content as { sections?: ProjectSection[] } | undefined;
  const existingSections = content?.sections;
  if (existingSections && Array.isArray(existingSections) && existingSections.length > 0) {
    return existingSections;
  }

  const sections: ProjectSection[] = [];

  // Always add Overview section
  sections.push({
    id: crypto.randomUUID(),
    type: 'overview',
    enabled: true,
    order: 0,
    content: {
      headline: project.title || '',
      description: project.description || '',
      metrics: [],
    } as OverviewSectionContent,
  });

  // Add Features section (empty for user to populate)
  sections.push({
    id: crypto.randomUUID(),
    type: 'features',
    enabled: true,
    order: 1,
    content: {
      features: [],
    } as FeaturesSectionContent,
  });

  return sections;
}

/**
 * Create default content for a new section based on its type.
 */
function createDefaultSectionContent(type: SectionType): SectionContent {
  switch (type) {
    case 'overview':
      return { headline: '', description: '', metrics: [] };
    case 'features':
      return { features: [] };
    case 'tech_stack':
      return { categories: [] };
    case 'gallery':
      return { images: [], layout: 'grid' };
    case 'architecture':
      return { diagram: '', description: '' };
    case 'demo':
      return { ctas: [] };
    case 'challenges':
      return { items: [] };
    case 'links':
      return { links: [] };
    case 'custom':
      return { blocks: [] };
    default:
      return { blocks: [] } as import('@/types/sections').SectionContent;
  }
}

// ============================================================================
// Provider
// ============================================================================

interface SectionEditorProviderProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
  onSlugChange?: (newSlug: string) => void;
  children: ReactNode;
}

export function SectionEditorProvider({
  project,
  onProjectUpdate,
  onSlugChange,
  children,
}: SectionEditorProviderProps) {
  // ========== Refs ==========
  const isInitialLoadRef = useRef(true);
  const saveVersionRef = useRef(0);

  // ========== Save State ==========
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ========== Metadata State ==========
  const [title, setTitleState] = useState(project.title || '');
  const [slug, setSlugState] = useState(project.slug || '');
  const [customSlugSet, setCustomSlugSet] = useState(false);
  const [description, setDescriptionState] = useState(project.description || '');
  const [bannerUrl, setBannerUrlState] = useState(project.bannerUrl || '');
  const [featuredImageUrl, setFeaturedImageUrlState] = useState(
    project.featuredImageUrl || ''
  );
  const [externalUrl, setExternalUrlState] = useState(project.externalUrl || '');
  const [tools, setToolsState] = useState<number[]>(project.tools || []);
  const [categories, setCategoriesState] = useState<number[]>(
    project.categories || []
  );
  const [topics, setTopicsState] = useState<string[]>(project.topics || []);

  // ========== Hero State ==========
  const [heroDisplayMode, setHeroDisplayModeState] = useState<HeroDisplayMode>(
    (project.content?.heroDisplayMode as HeroDisplayMode) || 'image'
  );
  const [heroContent, setHeroContentState] = useState<HeroContent>({
    quote: project.content?.heroQuote || '',
    videoUrl: project.content?.heroVideoUrl || '',
    slideshowImages: project.content?.heroSlideshowImages || [],
    slideUpElement1: project.content?.heroSlideUpElement1 || null,
    slideUpElement2: project.content?.heroSlideUpElement2 || null,
  });

  // ========== Sections State ==========
  const [sections, setSectionsState] = useState<ProjectSection[]>(() =>
    initializeSectionsFromProject(project)
  );

  // ========== Upload State ==========
  const [uploadState, setUploadState] = useState<UploadState>({
    banner: false,
    featuredImage: false,
    video: false,
    slideUp1: false,
    slideUp2: false,
  });

  // ========== UI State ==========
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ========== Wrapped Setters (mark changes as unsaved) ==========
  const markUnsaved = useCallback(() => {
    if (!isInitialLoadRef.current) {
      setHasUnsavedChanges(true);
    }
  }, []);

  const setTitle = useCallback(
    (value: string) => {
      setTitleState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setSlug = useCallback(
    (value: string) => {
      setSlugState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setDescription = useCallback(
    (value: string) => {
      setDescriptionState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setBannerUrl = useCallback(
    (value: string) => {
      setBannerUrlState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setFeaturedImageUrl = useCallback(
    (value: string) => {
      setFeaturedImageUrlState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setExternalUrl = useCallback(
    (value: string) => {
      setExternalUrlState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setTools = useCallback(
    (value: number[]) => {
      setToolsState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setCategories = useCallback(
    (value: number[]) => {
      setCategoriesState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setTopics = useCallback(
    (value: string[]) => {
      setTopicsState(value);
      markUnsaved();
    },
    [markUnsaved]
  );

  const setHeroDisplayMode = useCallback(
    (mode: HeroDisplayMode) => {
      setHeroDisplayModeState(mode);
      markUnsaved();
    },
    [markUnsaved]
  );

  const updateHeroContent = useCallback(
    (updates: Partial<HeroContent>) => {
      setHeroContentState((prev) => ({ ...prev, ...updates }));
      markUnsaved();
    },
    [markUnsaved]
  );

  // ========== Auto-generate Slug from Title ==========
  useEffect(() => {
    if (title && !customSlugSet) {
      const newSlug = generateSlug(title);
      if (newSlug !== slug) {
        setSlugState(newSlug);
      }
    }
  }, [title, customSlugSet, slug]);

  // ========== Mark Initial Load Complete ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // ========== Section Operations ==========
  const updateSectionContent = useCallback(
    (sectionId: string, content: SectionContent) => {
      setSectionsState((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, content } : section
        )
      );
      markUnsaved();
    },
    [markUnsaved]
  );

  const addSection = useCallback(
    (type: SectionType, afterId?: string) => {
      const newSection: ProjectSection = {
        id: crypto.randomUUID(),
        type,
        enabled: true,
        order: 0, // Will be recalculated
        content: createDefaultSectionContent(type),
      };

      setSectionsState((prev) => {
        let newSections: ProjectSection[];

        if (afterId) {
          const index = prev.findIndex((s) => s.id === afterId);
          newSections = [...prev];
          newSections.splice(index + 1, 0, newSection);
        } else {
          newSections = [...prev, newSection];
        }

        // Recalculate order
        return newSections.map((s, i) => ({ ...s, order: i }));
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      setSectionsState((prev) => {
        const filtered = prev.filter((s) => s.id !== sectionId);
        // Recalculate order
        return filtered.map((s, i) => ({ ...s, order: i }));
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const reorderSections = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSectionsState((prev) => {
        const reordered = arrayMove(prev, fromIndex, toIndex);
        // Recalculate order
        return reordered.map((s, i) => ({ ...s, order: i }));
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const toggleSectionEnabled = useCallback(
    (sectionId: string) => {
      setSectionsState((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? { ...section, enabled: !section.enabled }
            : section
        )
      );
      markUnsaved();
    },
    [markUnsaved]
  );

  const duplicateSection = useCallback(
    (sectionId: string) => {
      setSectionsState((prev) => {
        const index = prev.findIndex((s) => s.id === sectionId);
        if (index === -1) return prev;

        const original = prev[index];
        const duplicate: ProjectSection = {
          ...original,
          id: crypto.randomUUID(),
          order: 0, // Will be recalculated
        };

        const newSections = [...prev];
        newSections.splice(index + 1, 0, duplicate);

        // Recalculate order
        return newSections.map((s, i) => ({ ...s, order: i }));
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  // ========== Save Handler ==========
  const save = useCallback(async () => {
    const currentSaveVersion = ++saveVersionRef.current;
    setIsSaving(true);

    try {
      const payload: Partial<ProjectPayload> = {
        title: title || 'Untitled Project',
        slug,
        description,
        bannerUrl,
        featuredImageUrl,
        externalUrl,
        tools,
        categories,
        topics,
        content: {
          // Preserve existing content
          ...project.content,
          // Hero display
          heroDisplayMode,
          heroQuote: heroContent.quote,
          heroVideoUrl: heroContent.videoUrl,
          heroSlideshowImages: heroContent.slideshowImages,
          heroSlideUpElement1: heroContent.slideUpElement1 || undefined,
          heroSlideUpElement2: heroContent.slideUpElement2 || undefined,
          // Sections (template v2)
          templateVersion: 2,
          sections: sections.map((s) => ({
            id: s.id,
            type: s.type,
            enabled: s.enabled,
            order: s.order,
            content: s.content,
          })),
        },
      };

      const updatedProject = await updateProject(project.id, payload);

      // Only update state if this is still the latest save
      if (currentSaveVersion === saveVersionRef.current) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        onProjectUpdate(updatedProject);

        // Handle slug change navigation
        if (updatedProject.slug !== project.slug && onSlugChange) {
          onSlugChange(updatedProject.slug);
        }
      }
    } catch (error: unknown) {
      console.error('Save failed:', error);
      if (error && typeof error === 'object' && 'details' in error) {
        console.warn('Validation error:', JSON.stringify((error as { details: unknown }).details, null, 2));
      }
    } finally {
      if (currentSaveVersion === saveVersionRef.current) {
        setIsSaving(false);
      }
    }
  }, [
    title,
    slug,
    description,
    bannerUrl,
    featuredImageUrl,
    externalUrl,
    tools,
    categories,
    topics,
    heroDisplayMode,
    heroContent,
    sections,
    project,
    onProjectUpdate,
    onSlugChange,
  ]);

  // ========== Autosave Effect ==========
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      save();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, save]);

  // ========== Upload Handlers ==========
  const handleBannerUpload = useCallback(
    async (file: File) => {
      setUploadState((prev) => ({ ...prev, banner: true }));
      try {
        const data = await uploadImage(file, 'projects', true);
        setBannerUrl(data.url);
      } catch (error: unknown) {
        console.error('Banner upload error:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload banner image';
        throw new Error(message);
      } finally {
        setUploadState((prev) => ({ ...prev, banner: false }));
      }
    },
    [setBannerUrl]
  );

  const handleFeaturedImageUpload = useCallback(
    async (file: File) => {
      setUploadState((prev) => ({ ...prev, featuredImage: true }));
      try {
        const data = await uploadImage(file, 'projects', true);
        setFeaturedImageUrl(data.url);
      } catch (error: unknown) {
        console.error('Featured image upload error:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload featured image';
        throw new Error(message);
      } finally {
        setUploadState((prev) => ({ ...prev, featuredImage: false }));
      }
    },
    [setFeaturedImageUrl]
  );

  const handleVideoUpload = useCallback(async (file: File): Promise<string> => {
    setUploadState((prev) => ({ ...prev, video: true }));
    try {
      const data = await uploadFile(file, 'projects/videos', true);
      return data.url;
    } catch (error: unknown) {
      console.error('Video upload error:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload video';
      throw new Error(message);
    } finally {
      setUploadState((prev) => ({ ...prev, video: false }));
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const data = await uploadImage(file, 'projects', true);
    return data.url;
  }, []);

  const handleSlideUpUpload = useCallback(
    async (elementNumber: 1 | 2, file: File, type: 'image' | 'video') => {
      const stateKey = elementNumber === 1 ? 'slideUp1' : 'slideUp2';
      setUploadState((prev) => ({ ...prev, [stateKey]: true }));

      try {
        let url: string;
        if (type === 'image') {
          const data = await uploadImage(file, 'projects', true);
          url = data.url;
        } else {
          const data = await uploadFile(file, 'projects/videos', true);
          url = data.url;
        }

        const elementKey =
          elementNumber === 1 ? 'slideUpElement1' : 'slideUpElement2';
        updateHeroContent({
          [elementKey]: {
            type,
            content: url,
            caption: '',
          },
        });
      } catch (error: unknown) {
        console.error(`Slide-up ${elementNumber} upload error:`, error);
        const message = error instanceof Error ? error.message : `Failed to upload ${type}`;
        throw new Error(message);
      } finally {
        setUploadState((prev) => ({ ...prev, [stateKey]: false }));
      }
    },
    [updateHeroContent]
  );

  // ========== Memoized Context Value ==========
  const value = useMemo<SectionEditorContextValue>(
    () => ({
      // Project
      project,

      // Save state
      isSaving,
      lastSaved,
      hasUnsavedChanges,
      save,

      // Metadata
      title,
      setTitle,
      slug,
      setSlug,
      customSlugSet,
      setCustomSlugSet,
      description,
      setDescription,
      bannerUrl,
      setBannerUrl,
      featuredImageUrl,
      setFeaturedImageUrl,
      externalUrl,
      setExternalUrl,
      tools,
      setTools,
      categories,
      setCategories,
      topics,
      setTopics,

      // Hero
      heroDisplayMode,
      setHeroDisplayMode,
      heroContent,
      updateHeroContent,

      // Sections
      sections,
      updateSectionContent,
      addSection,
      deleteSection,
      reorderSections,
      toggleSectionEnabled,
      duplicateSection,

      // Uploads
      uploadState,
      handleBannerUpload,
      handleFeaturedImageUpload,
      handleVideoUpload,
      handleImageUpload,
      handleSlideUpUpload,

      // UI
      sidebarOpen,
      setSidebarOpen,
      activeSection,
      setActiveSection,
    }),
    [
      project,
      isSaving,
      lastSaved,
      hasUnsavedChanges,
      save,
      title,
      setTitle,
      slug,
      setSlug,
      customSlugSet,
      description,
      setDescription,
      bannerUrl,
      setBannerUrl,
      featuredImageUrl,
      setFeaturedImageUrl,
      externalUrl,
      setExternalUrl,
      tools,
      setTools,
      categories,
      setCategories,
      topics,
      setTopics,
      heroDisplayMode,
      setHeroDisplayMode,
      heroContent,
      updateHeroContent,
      sections,
      updateSectionContent,
      addSection,
      deleteSection,
      reorderSections,
      toggleSectionEnabled,
      duplicateSection,
      uploadState,
      handleBannerUpload,
      handleFeaturedImageUpload,
      handleVideoUpload,
      handleImageUpload,
      handleSlideUpUpload,
      sidebarOpen,
      activeSection,
    ]
  );

  return (
    <SectionEditorContext.Provider value={value}>
      {children}
    </SectionEditorContext.Provider>
  );
}
