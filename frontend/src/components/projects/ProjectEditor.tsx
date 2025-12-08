import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { updateProject } from '@/services/projects';
import { getTools } from '@/services/tools';
import { uploadImage, uploadFile } from '@/services/upload';
import type { Project, ProjectBlock, Taxonomy } from '@/types/models';
import { api } from '@/services/api';
import { generateSlug } from '@/utils/slug';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';

// Allow time for React state updates to complete before enabling autosave
const INITIAL_LOAD_GRACE_PERIOD_MS = 100;

export interface ProjectEditorProps {
  /** The project to edit */
  project: Project;
  /** Callback when project is updated */
  onProjectUpdate: (updatedProject: Project) => void;
  /** Render children with editor state and handlers */
  children: (props: ProjectEditorRenderProps) => ReactNode;
  /** Optional: custom slug change handler (for page navigation) */
  onSlugChange?: (newSlug: string) => void;
}

export interface ProjectEditorRenderProps {
  // State
  blocks: ProjectBlock[];
  bannerUrl: string;
  showBannerEdit: boolean;
  isUploadingBanner: boolean;
  projectTitle: string;
  editableSlug: string;
  customSlugSet: boolean;
  featuredImageUrl: string;
  projectUrl: string;
  projectDescription: string;
  projectTools: number[];
  allTools: any[];
  projectCategories: number[];
  availableCategories: Taxonomy[];
  availableTopics: Taxonomy[];
  projectTopics: string[];
  isUploadingFeatured: boolean;
  heroDisplayMode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
  heroQuote: string;
  heroVideoUrl: string;
  heroSlideshowImages: string[];
  slideUpElement1Type: 'image' | 'video' | 'text';
  slideUpElement1Content: string;
  slideUpElement1Caption: string;
  slideUpElement2Type: 'image' | 'video' | 'text';
  slideUpElement2Content: string;
  slideUpElement2Caption: string;
  isUploadingSlideUp1: boolean;
  isUploadingSlideUp2: boolean;
  isUploadingVideo: boolean;
  showSettingsSidebar: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  focusedBlockId: string | null;
  showAddMenu: string | null;

  // Setters
  setBlocks: (blocks: ProjectBlock[]) => void;
  setBannerUrl: (url: string) => void;
  setShowBannerEdit: (show: boolean) => void;
  setProjectTitle: (title: string) => void;
  setEditableSlug: (slug: string) => void;
  setCustomSlugSet: (set: boolean) => void;
  setFeaturedImageUrl: (url: string) => void;
  setProjectUrl: (url: string) => void;
  setProjectDescription: (desc: string) => void;
  setProjectTools: (tools: number[]) => void;
  setProjectCategories: (categories: number[]) => void;
  setProjectTopics: (topics: string[]) => void;
  setHeroDisplayMode: (mode: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup') => void;
  setHeroQuote: (quote: string) => void;
  setHeroVideoUrl: (url: string) => void;
  setHeroSlideshowImages: (images: string[]) => void;
  setSlideUpElement1Type: (type: 'image' | 'video' | 'text') => void;
  setSlideUpElement1Content: (content: string) => void;
  setSlideUpElement1Caption: (caption: string) => void;
  setSlideUpElement2Type: (type: 'image' | 'video' | 'text') => void;
  setSlideUpElement2Content: (content: string) => void;
  setSlideUpElement2Caption: (caption: string) => void;
  setShowSettingsSidebar: (show: boolean) => void;
  setFocusedBlockId: (id: string | null) => void;
  setShowAddMenu: (id: string | null) => void;

  // Handlers
  handleSave: () => Promise<void>;
  handleBannerUpload: (file: File) => Promise<void>;
  handleFeaturedImageUpload: (file: File) => Promise<void>;
  handleVideoUpload: (file: File) => Promise<void>;
  handleSlideUpElement1Upload: (file: File, type: 'image' | 'video') => Promise<void>;
  handleSlideUpElement2Upload: (file: File, type: 'image' | 'video') => Promise<void>;
  handleToggleShowcase: () => Promise<void>;
  addBlock: (afterId: string | null, type: 'text' | 'image' | 'columns' | 'video' | 'file' | 'button' | 'divider') => void;
}

/**
 * ProjectEditor - Shared core component for project editing
 *
 * This component manages all state and logic for editing projects.
 * It uses a render props pattern to provide editor state and handlers to child components.
 *
 * Usage:
 * ```tsx
 * <ProjectEditor project={project} onProjectUpdate={handleUpdate}>
 *   {(editorProps) => (
 *     <YourEditorUI {...editorProps} />
 *   )}
 * </ProjectEditor>
 * ```
 */
export function ProjectEditor({ project, onProjectUpdate, children, onSlugChange }: ProjectEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track if initial load is complete
  const isInitialLoadRef = useRef(true);
  const saveVersionRef = useRef(0);

  // Editor state
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Metadata fields
  const [projectTitle, setProjectTitle] = useState('');
  const [editableSlug, setEditableSlug] = useState('');
  const [customSlugSet, setCustomSlugSet] = useState(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTools, setProjectTools] = useState<number[]>([]);
  const [allTools, setAllTools] = useState<any[]>([]);
  const [projectCategories, setProjectCategories] = useState<number[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Taxonomy[]>([]);
  const [projectTopics, setProjectTopics] = useState<string[]>([]);
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);

  // Hero display state
  const [heroDisplayMode, setHeroDisplayMode] = useState<'image' | 'video' | 'slideshow' | 'quote' | 'slideup'>('image');
  const [heroQuote, setHeroQuote] = useState('');
  const [heroVideoUrl, setHeroVideoUrl] = useState('');
  const [heroSlideshowImages, setHeroSlideshowImages] = useState<string[]>([]);
  const [slideUpElement1Type, setSlideUpElement1Type] = useState<'image' | 'video' | 'text'>('image');
  const [slideUpElement1Content, setSlideUpElement1Content] = useState('');
  const [slideUpElement1Caption, setSlideUpElement1Caption] = useState('');
  const [slideUpElement2Type, setSlideUpElement2Type] = useState<'image' | 'video' | 'text'>('text');
  const [slideUpElement2Content, setSlideUpElement2Content] = useState('');
  const [slideUpElement2Caption, setSlideUpElement2Caption] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingSlideUp1, setIsUploadingSlideUp1] = useState(false);
  const [isUploadingSlideUp2, setIsUploadingSlideUp2] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);

  // Block editing UI state
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null);

  // Initialize state from project
  useEffect(() => {
    if (project) {
      setBannerUrl(project.bannerUrl || '');
      setProjectTitle(project.title || '');
      setEditableSlug(project.slug || '');
      setFeaturedImageUrl(project.featuredImageUrl || '');
      setProjectUrl(project.externalUrl || '');
      setProjectDescription(project.description || '');
      setProjectTools(project.tools || []);
      setProjectCategories(project.categories || []);
      setProjectTopics(project.topics || []);

      setHeroDisplayMode(project.content?.heroDisplayMode || 'image');
      setHeroQuote(project.content?.heroQuote || '');
      setHeroVideoUrl(project.content?.heroVideoUrl || '');
      setHeroSlideshowImages(project.content?.heroSlideshowImages || []);
      setSlideUpElement1Type(project.content?.heroSlideUpElement1?.type || 'image');
      setSlideUpElement1Content(project.content?.heroSlideUpElement1?.content || '');
      setSlideUpElement1Caption(project.content?.heroSlideUpElement1?.caption || '');
      setSlideUpElement2Type(project.content?.heroSlideUpElement2?.type || 'text');
      setSlideUpElement2Content(project.content?.heroSlideUpElement2?.content || '');
      setSlideUpElement2Caption(project.content?.heroSlideUpElement2?.caption || '');

      const blocksWithIds = (project.content?.blocks || []).map((block: any) => ({
        ...block,
        id: block.id || crypto.randomUUID(),
      }));
      setBlocks(blocksWithIds);

      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, INITIAL_LOAD_GRACE_PERIOD_MS);
    }
  }, [project.id]);

  // Load tools and topics
  useEffect(() => {
    async function loadTools() {
      try {
        const response = await getTools({ ordering: 'name' });
        setAllTools(response.results);
      } catch (error) {
        console.error('Failed to load tools:', error);
      }
    }

    async function loadCategories() {
      try {
        const response = await api.get('/taxonomies/?taxonomy_type=category');
        setAvailableCategories(response.data.results || []);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    }

    loadTools();
    loadCategories();
  }, []);

  // Auto-generate slug from title
  useEffect(() => {
    if (projectTitle && !customSlugSet) {
      const newSlug = generateSlug(projectTitle);
      if (newSlug !== editableSlug) {
        setEditableSlug(newSlug);
      }
    }
  }, [projectTitle, customSlugSet, editableSlug]);

  // Memoize form data
  const formData = useMemo(
    () => ({
      blocks,
      bannerUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
      projectCategories,
      projectTopics,
      heroDisplayMode,
      heroQuote,
      heroVideoUrl,
      heroSlideshowImages,
      slideUpElement1Type,
      slideUpElement1Content,
      slideUpElement1Caption,
      slideUpElement2Type,
      slideUpElement2Content,
      slideUpElement2Caption,
    }),
    [
      blocks,
      bannerUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
      projectCategories,
      projectTopics,
      heroDisplayMode,
      heroQuote,
      heroVideoUrl,
      heroSlideshowImages,
      slideUpElement1Type,
      slideUpElement1Content,
      slideUpElement1Caption,
      slideUpElement2Type,
      slideUpElement2Content,
      slideUpElement2Caption,
    ]
  );

  // Mark as having unsaved changes
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!project) return;

    const currentSaveVersion = ++saveVersionRef.current;
    setIsSaving(true);

    try {
      const payload = {
        title: projectTitle || 'Untitled Project',
        slug: editableSlug,
        description: projectDescription,
        bannerUrl,
        featuredImageUrl,
        externalUrl: projectUrl,
        tools: projectTools,
        categories: projectCategories,
        topics: projectTopics,
        content: {
          blocks: blocks.map(({ id: _id, ...block }) => block),
          heroDisplayMode,
          heroQuote,
          heroVideoUrl,
          heroSlideshowImages,
          heroSlideUpElement1: slideUpElement1Content ? {
            type: slideUpElement1Type,
            content: slideUpElement1Content,
            caption: slideUpElement1Caption,
          } : undefined,
          heroSlideUpElement2: slideUpElement2Content ? {
            type: slideUpElement2Type,
            content: slideUpElement2Content,
            caption: slideUpElement2Caption,
          } : undefined,
        },
      };

      const updatedProject = await updateProject(project.id, payload);

      if (currentSaveVersion === saveVersionRef.current) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        onProjectUpdate(updatedProject);

        // Handle slug change
        if (updatedProject.slug !== project.slug && onSlugChange) {
          onSlugChange(updatedProject.slug);
        }
      }
    } catch (err: any) {
      console.error('❌ Save failed:', err);
      if (err?.details) {
        console.warn('⚠️ Backend validation error:', JSON.stringify(err.details, null, 2));
      }
    } finally {
      if (currentSaveVersion === saveVersionRef.current) {
        setIsSaving(false);
      }
    }
  }, [
    project,
    projectTitle,
    editableSlug,
    projectDescription,
    bannerUrl,
    featuredImageUrl,
    projectUrl,
    projectTools,
    projectCategories,
    projectTopics,
    blocks,
    heroDisplayMode,
    heroQuote,
    heroVideoUrl,
    heroSlideshowImages,
    slideUpElement1Type,
    slideUpElement1Content,
    slideUpElement1Caption,
    slideUpElement2Type,
    slideUpElement2Content,
    slideUpElement2Caption,
    onProjectUpdate,
    onSlugChange,
  ]);

  // Autosave effect
  useEffect(() => {
    if (!hasUnsavedChanges || !project) return;

    const timer = setTimeout(() => {
      handleSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, project, handleSave]);

  const handleToggleShowcase = async () => {
    if (!project) return;

    setIsSaving(true);
    try {
      const updatedProject = await updateProject(project.id, {
        isShowcased: !project.isShowcased,
      });
      onProjectUpdate(updatedProject);
    } catch (err) {
      console.error('Failed to update showcase setting:', err);
      alert('Failed to update showcase setting');
    } finally {
      setIsSaving(false);
    }
  };

  const addBlock = (afterId: string | null, type: 'text' | 'image' | 'columns' | 'video' | 'file' | 'button' | 'divider') => {
    const newBlock: any = {
      id: crypto.randomUUID(),
      type,
    };

    if (type === 'text') {
      newBlock.content = '';
      newBlock.style = 'body';
    } else if (type === 'image') {
      newBlock.url = '';
      newBlock.caption = '';
    } else if (type === 'columns') {
      newBlock.columnCount = 2;
      newBlock.containerWidth = 'full';
      newBlock.columns = [
        { id: crypto.randomUUID(), blocks: [] },
        { id: crypto.randomUUID(), blocks: [] },
      ];
    } else if (type === 'video') {
      newBlock.url = '';
      newBlock.embedUrl = '';
      newBlock.caption = '';
    } else if (type === 'file') {
      newBlock.url = '';
      newBlock.filename = '';
      newBlock.fileType = '';
      newBlock.fileSize = 0;
      newBlock.label = 'Download File';
      newBlock.icon = 'FaDownload';
    } else if (type === 'button') {
      newBlock.text = 'Click Here';
      newBlock.url = '';
      newBlock.icon = 'FaArrowRight';
      newBlock.style = 'primary';
      newBlock.size = 'medium';
    } else if (type === 'divider') {
      newBlock.style = 'line';
    }

    if (afterId === null) {
      setBlocks([...blocks, newBlock]);
    } else {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
    }
  };

  const handleBannerUpload = async (file: File) => {
    setIsUploadingBanner(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      setBannerUrl(data.url);
      setShowBannerEdit(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload banner image');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleFeaturedImageUpload = async (file: File) => {
    setIsUploadingFeatured(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      setFeaturedImageUrl(data.url);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload featured image');
    } finally {
      setIsUploadingFeatured(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setIsUploadingVideo(true);
    try {
      const data = await uploadFile(file, 'projects/videos', true);
      setHeroVideoUrl(data.url);
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to upload video';
      console.error('Detailed error:', errorMessage);
      alert(errorMessage);
      throw error;  // Re-throw for HeroDisplaySection to catch
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleSlideUpElement1Upload = async (file: File, type: 'image' | 'video') => {
    setIsUploadingSlideUp1(true);
    try {
      if (type === 'image') {
        const data = await uploadImage(file, 'projects', true);
        setSlideUpElement1Content(data.url);
      } else if (type === 'video') {
        const data = await uploadFile(file, 'projects/videos', true);
        setSlideUpElement1Content(data.url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || `Failed to upload ${type}`);
    } finally {
      setIsUploadingSlideUp1(false);
    }
  };

  const handleSlideUpElement2Upload = async (file: File, type: 'image' | 'video') => {
    setIsUploadingSlideUp2(true);
    try {
      if (type === 'image') {
        const data = await uploadImage(file, 'projects', true);
        setSlideUpElement2Content(data.url);
      } else if (type === 'video') {
        const data = await uploadFile(file, 'projects/videos', true);
        setSlideUpElement2Content(data.url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || `Failed to upload ${type}`);
    } finally {
      setIsUploadingSlideUp2(false);
    }
  };

  return (
    <>
      {children({
        // State
        blocks,
        bannerUrl,
        showBannerEdit,
        isUploadingBanner,
        projectTitle,
        editableSlug,
        customSlugSet,
        featuredImageUrl,
        projectUrl,
        projectDescription,
        projectTools,
        allTools,
        projectCategories,
        availableCategories,
        availableTopics: availableCategories,  // Alias for availableCategories
        projectTopics,
        isUploadingFeatured,
        heroDisplayMode,
        heroQuote,
        heroVideoUrl,
        heroSlideshowImages,
        slideUpElement1Type,
        slideUpElement1Content,
        slideUpElement1Caption,
        slideUpElement2Type,
        slideUpElement2Content,
        slideUpElement2Caption,
        isUploadingSlideUp1,
        isUploadingSlideUp2,
        isUploadingVideo,
        showSettingsSidebar,
        setShowSettingsSidebar,
        isSaving,
        lastSaved,
        hasUnsavedChanges,
        focusedBlockId,
        showAddMenu,

        // Setters
        setBlocks,
        setBannerUrl,
        setShowBannerEdit,
        setProjectTitle,
        setEditableSlug,
        setCustomSlugSet,
        setFeaturedImageUrl,
        setProjectUrl,
        setProjectDescription,
        setProjectTools,
        setProjectCategories,
        setProjectTopics,
        setHeroDisplayMode,
        setHeroQuote,
        setHeroVideoUrl,
        setHeroSlideshowImages,
        setSlideUpElement1Type,
        setSlideUpElement1Content,
        setSlideUpElement1Caption,
        setSlideUpElement2Type,
        setSlideUpElement2Content,
        setSlideUpElement2Caption,
        setFocusedBlockId,
        setShowAddMenu,

        // Handlers
        handleSave,
        handleBannerUpload,
        handleFeaturedImageUpload,
        handleVideoUpload,
        handleSlideUpElement1Upload,
        handleSlideUpElement2Upload,
        handleToggleShowcase,
        addBlock,
      })}
    </>
  );
}
