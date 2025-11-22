import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject, deleteProjectRedirect } from '@/services/projects';
import { uploadImage, uploadFile } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ToolSelector } from '@/components/projects/ToolSelector';
import type { Project, ProjectBlock } from '@/types/models';
import { generateSlug } from '@/utils/slug';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeftIcon,
  EyeIcon,
  PlusIcon,
  Bars3Icon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  FaColumns,
  FaFont,
  FaImage,
  FaVideo,
  FaFileAlt,
  FaMousePointer,
  FaMinus,
  FaExpand,
  FaCompress,
  FaStar,
  FaLock,
  FaEye,
  FaCamera,
  FaQuoteLeft,
  FaImages,
  FaArrowUp,
} from 'react-icons/fa';

export default function ProjectEditorPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track if initial load is complete to avoid triggering autosave on mount
  const isInitialLoadRef = useRef(true);
  // Track save version to prevent race conditions
  const saveVersionRef = useRef(0);

  // Editor state - stored directly as we edit
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null); // Block ID to show menu after
  const [activeTab, setActiveTab] = useState<'tldr' | 'details'>('tldr'); // Tab state
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Metadata fields - separate from page builder blocks
  const [projectTitle, setProjectTitle] = useState('');
  const [editableSlug, setEditableSlug] = useState('');
  const [customSlugSet, setCustomSlugSet] = useState(false); // Track if user manually set slug
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTools, setProjectTools] = useState<number[]>([]);
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);

  // Hero display state
  const [heroDisplayMode, setHeroDisplayMode] = useState<'image' | 'video' | 'slideshow' | 'quote' | 'slideup'>('image');
  const [heroQuote, setHeroQuote] = useState('');
  const [heroVideoUrl, setHeroVideoUrl] = useState('');
  const [heroSlideshowImages, setHeroSlideshowImages] = useState<string[]>([]);
  // Slide-up hero state
  const [slideUpElement1Type, setSlideUpElement1Type] = useState<'image' | 'video' | 'text'>('image');
  const [slideUpElement1Content, setSlideUpElement1Content] = useState('');
  const [slideUpElement1Caption, setSlideUpElement1Caption] = useState('');
  const [slideUpElement2Type, setSlideUpElement2Type] = useState<'image' | 'video' | 'text'>('text');
  const [slideUpElement2Content, setSlideUpElement2Content] = useState('');
  const [slideUpElement2Caption, setSlideUpElement2Caption] = useState('');
  const [isUploadingSlideUp1, setIsUploadingSlideUp1] = useState(false);
  const [isUploadingSlideUp2, setIsUploadingSlideUp2] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!projectSlug || !username) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const projects = await listProjects();
        const foundProject = projects.find(p => p.slug === projectSlug && p.username === username);

        if (!foundProject) {
          setError('Project not found');
          return;
        }

        setProject(foundProject);
        setThumbnailUrl(foundProject.thumbnailUrl || '');
        setProjectTitle(foundProject.title || '');
        setEditableSlug(foundProject.slug || '');
        setFeaturedImageUrl(foundProject.featuredImageUrl || '');
        setProjectUrl(foundProject.externalUrl || '');
        setProjectDescription(foundProject.description || '');
        setProjectTools(foundProject.tools || []);

        // Load hero display fields from content
        setHeroDisplayMode(foundProject.content?.heroDisplayMode || 'image');
        setHeroQuote(foundProject.content?.heroQuote || '');
        setHeroVideoUrl(foundProject.content?.heroVideoUrl || '');
        setHeroSlideshowImages(foundProject.content?.heroSlideshowImages || []);
        // Load slideup elements
        setSlideUpElement1Type(foundProject.content?.heroSlideUpElement1?.type || 'image');
        setSlideUpElement1Content(foundProject.content?.heroSlideUpElement1?.content || '');
        setSlideUpElement1Caption(foundProject.content?.heroSlideUpElement1?.caption || '');
        setSlideUpElement2Type(foundProject.content?.heroSlideUpElement2?.type || 'text');
        setSlideUpElement2Content(foundProject.content?.heroSlideUpElement2?.content || '');
        setSlideUpElement2Caption(foundProject.content?.heroSlideUpElement2?.caption || '');

        // Initialize blocks
        const blocksWithIds = (foundProject.content?.blocks || []).map((block: any) => ({
          ...block,
          id: block.id || crypto.randomUUID(),
        }));

        // If no blocks, start with a title block
        if (blocksWithIds.length === 0) {
          blocksWithIds.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: foundProject.title || 'Untitled Project',
            style: 'heading',
          });
        }

        setBlocks(blocksWithIds);

        // Mark initial load as complete after a short delay
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectSlug, username]);

  // Auto-generate slug from title (unless manually customized)
  useEffect(() => {
    if (projectTitle && !customSlugSet) {
      const newSlug = generateSlug(projectTitle);
      if (newSlug !== editableSlug) {
        setEditableSlug(newSlug);
      }
    }
  }, [projectTitle, customSlugSet, editableSlug]);

  // Memoize form data to prevent unnecessary re-renders
  const formData = useMemo(
    () => ({
      blocks,
      thumbnailUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
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
      thumbnailUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
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

  // Mark as having unsaved changes when form data changes (skip initial load)
  useEffect(() => {
    if (project && blocks.length > 0 && !isInitialLoadRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [project, blocks.length, formData]);

  const handleSave = useCallback(async () => {
    if (!project) return;

    // Increment save version to track this save operation
    const currentSaveVersion = ++saveVersionRef.current;

    setIsSaving(true);
    console.log('🔄 Autosave starting (version', currentSaveVersion, ')...');

    try {
      const payload = {
        title: projectTitle || 'Untitled Project',
        slug: editableSlug,
        description: projectDescription,
        thumbnailUrl,
        featuredImageUrl,
        externalUrl: projectUrl,
        tools: projectTools,
        content: {
          blocks: blocks.map(({ id, ...block }) => block), // Remove IDs before saving
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

      console.log('📤 Sending payload:', JSON.stringify(payload.content, null, 2));

      const updatedProject = await updateProject(project.id, payload);

      // Only update state if this is still the latest save operation (prevent race conditions)
      if (currentSaveVersion === saveVersionRef.current) {
        console.log('✅ Save successful (version', currentSaveVersion, ')!');

        setProject(updatedProject);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);

        // Navigate to new URL if slug changed
        if (updatedProject.slug !== editableSlug && username) {
          navigate(`/${username}/${updatedProject.slug}/edit`, { replace: true });
          setEditableSlug(updatedProject.slug);
        }
      } else {
        console.log('⚠️ Skipping stale save result (version', currentSaveVersion, 'vs current', saveVersionRef.current, ')');
      }
    } catch (err: any) {
      console.error('❌ AUTOSAVE FAILED');
      console.error('Full error object:', err);
      console.error('Error details:', err?.details);
      console.error('Error message:', err?.error);
      console.error('Status code:', err?.statusCode);

      // Show user-visible error for debugging
      if (err?.details) {
        console.warn('⚠️ Backend validation error:', JSON.stringify(err.details, null, 2));
      }
    } finally {
      // Only clear saving state if this is still the latest operation
      if (currentSaveVersion === saveVersionRef.current) {
        setIsSaving(false);
      }
    }
  }, [project, formData, username, navigate, editableSlug]);

  // Autosave effect - debounced save after changes
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
        isShowcase: !project.isShowcase,
      });
      setProject(updatedProject);
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
      newBlock.containerWidth = 'full';  // full or boxed
      newBlock.columns = [
        { id: crypto.randomUUID(), blocks: [] },
        { id: crypto.randomUUID(), blocks: [] },
      ];
    } else if (type === 'video') {
      newBlock.url = '';
      newBlock.embedUrl = '';  // For YouTube/Vimeo
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
      newBlock.style = 'primary';  // primary, secondary, outline
      newBlock.size = 'medium';  // small, medium, large
    } else if (type === 'divider') {
      newBlock.style = 'line';  // line, dotted, dashed, space
    }

    if (afterId === null) {
      setBlocks([...blocks, newBlock]);
    } else {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
    }

    setShowAddMenu(null);
    setTimeout(() => setFocusedBlockId(newBlock.id), 100);
  };

  const handleBannerUpload = async (file: File) => {
    setIsUploadingBanner(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      setThumbnailUrl(data.url);
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
      alert(error.message || 'Failed to upload video');
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading editor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <Link
              to={`/${username}/${projectSlug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Project
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/${username}/${projectSlug}`}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Back to project"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {projectTitle || 'Untitled Project'}
            </h1>
            {isSaving ? (
              <p className="text-xs text-gray-500">Saving...</p>
            ) : lastSaved ? (
              <p className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/${project.username}/${project.slug}`, '_blank')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <EyeIcon className="w-5 h-5" />
            <span className="hidden md:inline">Preview</span>
          </button>
          <button
            onClick={() => setShowSettingsSidebar(true)}
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Project settings"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Settings Sidebar */}
      {showSettingsSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSettingsSidebar(false)}
          />

          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Settings</h2>
              <button
                onClick={() => setShowSettingsSidebar(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Visibility Options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Visibility</h3>
                <div className="space-y-2">
                  {/* Top Highlighted */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <FaStar className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Top Highlighted</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Featured at the very top of your profile</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={project.isHighlighted || false}
                      onChange={async () => {
                        try {
                          const updated = await updateProject(project.id, {
                            isHighlighted: !project.isHighlighted,
                          });
                          setProject(updated);
                        } catch (error) {
                          console.error('Failed to update:', error);
                        }
                      }}
                      disabled={isSaving}
                      className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
                    />
                  </label>

                  {/* Showcase */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <FaEye className="w-5 h-5 text-primary-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Showcase Profile</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Display in showcase section</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={project.isShowcase}
                      onChange={handleToggleShowcase}
                      disabled={isSaving}
                      className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
                    />
                  </label>

                  {/* Private */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <FaLock className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Private Project</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Hide from public, only visible to you</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={project.isPrivate || false}
                      onChange={async () => {
                        try {
                          const updated = await updateProject(project.id, {
                            isPrivate: !project.isPrivate,
                          });
                          setProject(updated);
                        } catch (error) {
                          console.error('Failed to update:', error);
                        }
                      }}
                      disabled={isSaving}
                      className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>

              {/* Preview & Publish */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      window.open(`/${project.username}/${project.slug}`, '_blank');
                      setShowSettingsSidebar(false);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <EyeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">Preview</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">See how it looks</p>
                      </div>
                    </div>
                  </button>

                </div>
              </div>

              {/* Project URL Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Project URL</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Customize your project's URL. Changes will automatically create a redirect from the old URL.
                </p>

                {/* Current URL Display */}
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current URL</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                    {window.location.origin}/{project.username}/{editableSlug || 'untitled'}
                  </p>
                </div>

                {/* Slug Editor */}
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs text-gray-500 dark:text-gray-400">URL Slug</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">/{project.username}/</span>
                      <input
                        type="text"
                        value={editableSlug}
                        onChange={(e) => {
                          setEditableSlug(e.target.value);
                          setCustomSlugSet(true);
                        }}
                        placeholder="project-slug"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </label>

                  {customSlugSet && (
                    <button
                      onClick={() => {
                        setCustomSlugSet(false);
                        const newSlug = generateSlug(projectTitle);
                        setEditableSlug(newSlug);
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Reset to auto-generate from title
                    </button>
                  )}
                </div>

                {/* Info Note */}
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> When you change the URL, the old URL will automatically redirect to the new one, so existing links won't break.
                  </p>
                </div>

                {/* Active Redirects */}
                {project.redirects && project.redirects.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Active Redirects</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      These old URLs redirect to your current project URL
                    </p>
                    <div className="space-y-2">
                      {project.redirects.map((redirect) => (
                        <div
                          key={redirect.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                              /{project.username}/{redirect.oldSlug}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Created {new Date(redirect.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete redirect from "/${redirect.oldSlug}"?\n\nThis URL will no longer work and cannot be undone.`)) {
                                try {
                                  await deleteProjectRedirect(project.id, redirect.id);
                                  // Refresh project data
                                  const projects = await listProjects();
                                  const updatedProject = projects.find(p => p.id === project.id);
                                  if (updatedProject) {
                                    setProject(updatedProject);
                                  }
                                } catch (error) {
                                  console.error('Failed to delete redirect:', error);
                                  alert('Failed to delete redirect. Please try again.');
                                }
                              }
                            }}
                            className="ml-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            aria-label="Delete redirect"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner Image Section - Full Width */}
        <div className="mb-12">
          <div className="relative">
            {thumbnailUrl ? (
                <div className="group relative w-full h-80 overflow-hidden cursor-pointer" onClick={() => setShowBannerEdit(!showBannerEdit)}>
                  <img
                    src={thumbnailUrl}
                    alt="Project banner"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
                    }}
                  />
                  {/* Gradient overlay matching published page */}
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-900/40 backdrop-blur-[1px]" />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center">
                      <FaCamera className="w-12 h-12 text-white mx-auto mb-3" />
                      <p className="text-white font-medium text-lg">Change Banner</p>
                      <p className="text-white/80 text-sm mt-1">Click to upload or change image</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-80 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer"
                     onClick={() => setShowBannerEdit(true)}>
                  <div className="text-center">
                    <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Add a banner image</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">This appears on your project card</p>
                  </div>
                </div>
              )}

              {/* Banner Edit Modal */}
              {showBannerEdit && (
                <div className="mt-4 mx-8 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div className="space-y-4">
                    {/* Gradient Options Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Choose a Gradient
                      </label>
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          'https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&h=400&fit=crop',
                          'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1600&h=400&fit=crop',
                          'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&h=400&fit=crop',
                          'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1600&h=400&fit=crop',
                          'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=1600&h=400&fit=crop'
                        ].map((gradientUrl, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setThumbnailUrl(gradientUrl);
                            }}
                            className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                              thumbnailUrl === gradientUrl
                                ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800'
                                : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
                            }`}
                          >
                            <img
                              src={gradientUrl}
                              alt={`Gradient ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {thumbnailUrl === gradientUrl && (
                              <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                                <CheckCircleIcon className="w-8 h-8 text-white drop-shadow-lg" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                    </div>

                    {/* Upload Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Upload Banner Image
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <div className="px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-center">
                            {isUploadingBanner ? (
                              <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">Click to upload or drag & drop</span>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleBannerUpload(file);
                            }}
                            className="hidden"
                            disabled={isUploadingBanner}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Recommended size: 1600x400px (4:1 ratio). Max 5MB.
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                    </div>

                    {/* URL Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Banner Image URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={thumbnailUrl}
                          onChange={(e) => setThumbnailUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setShowBannerEdit(false);
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="https://example.com/banner.jpg"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setThumbnailUrl('');
                          setShowBannerEdit(false);
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setShowBannerEdit(false)}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-5xl mx-auto px-8">
            <nav className="flex gap-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('tldr')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'tldr'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                TL;DR
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'details'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Project Details
              </button>
            </nav>
          </div>
        </div>

        {/* TL;DR Tab Content */}
        {activeTab === 'tldr' && (
          <div className="max-w-5xl mx-auto px-8 py-8">
            <div className="space-y-6">
            {/* Page Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Page Title
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Enter your project title"
                disabled={isSaving}
                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Hero Display */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Hero Display
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Choose how to showcase your project (Select only one option. To use a different hero display, remove content from your current selection.)
              </p>

              {/* Tab Navigation for Hero Display */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!heroQuote && !heroVideoUrl && heroSlideshowImages.length === 0) {
                      setHeroDisplayMode('image');
                    }
                  }}
                  disabled={heroQuote || heroVideoUrl || heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    heroDisplayMode === 'image'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : heroQuote || heroVideoUrl || heroSlideshowImages.length > 0
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaImage className="w-5 h-5" />
                  <span className="font-medium">Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!featuredImageUrl && !heroQuote && heroSlideshowImages.length === 0) {
                      setHeroDisplayMode('video');
                    }
                  }}
                  disabled={featuredImageUrl || heroQuote || heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    heroDisplayMode === 'video'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : featuredImageUrl || heroQuote || heroSlideshowImages.length > 0
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaVideo className="w-5 h-5" />
                  <span className="font-medium">Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!featuredImageUrl && !heroVideoUrl && !heroQuote) {
                      setHeroDisplayMode('slideshow');
                    }
                  }}
                  disabled={featuredImageUrl || heroVideoUrl || heroQuote}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    heroDisplayMode === 'slideshow'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : featuredImageUrl || heroVideoUrl || heroQuote
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaImages className="w-5 h-5" />
                  <span className="font-medium">Slideshow</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!featuredImageUrl && !heroVideoUrl && heroSlideshowImages.length === 0) {
                      setHeroDisplayMode('quote');
                    }
                  }}
                  disabled={featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    heroDisplayMode === 'quote'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaQuoteLeft className="w-5 h-5" />
                  <span className="font-medium">Prompt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!featuredImageUrl && !heroVideoUrl && heroSlideshowImages.length === 0 && !heroQuote) {
                      setHeroDisplayMode('slideup');
                    }
                  }}
                  disabled={featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0 || heroQuote}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    heroDisplayMode === 'slideup'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : featuredImageUrl || heroVideoUrl || heroSlideshowImages.length > 0 || heroQuote
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaArrowUp className="w-5 h-5" />
                  <span className="font-medium">Slide Up</span>
                </button>
              </div>

              {/* Image Tab Content */}
              {heroDisplayMode === 'image' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
                  {featuredImageUrl ? (
                    <div className="relative group">
                      <img
                        src={featuredImageUrl}
                        alt="Hero"
                        className="w-full max-h-96 object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
                        <label className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFeaturedImageUpload(file);
                            }}
                            className="hidden"
                            disabled={isUploadingFeatured}
                          />
                          {isUploadingFeatured ? 'Uploading...' : 'Change'}
                        </label>
                        <button
                          onClick={() => setFeaturedImageUrl('')}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                          <PhotoIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
                          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                            {isUploadingFeatured ? 'Uploading...' : 'Drop an image here or click to upload'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Recommended: 1200x630px (1.91:1 ratio)
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFeaturedImageUpload(file);
                          }}
                          className="hidden"
                          disabled={isUploadingFeatured}
                        />
                      </label>
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <input
                          type="url"
                          value={featuredImageUrl}
                          onChange={(e) => setFeaturedImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          disabled={isSaving}
                          className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Video Tab Content */}
              {heroDisplayMode === 'video' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-4">
                  {heroVideoUrl && (heroVideoUrl.endsWith('.mp4') || heroVideoUrl.endsWith('.webm') || heroVideoUrl.endsWith('.ogg') || heroVideoUrl.includes('/projects/videos/')) ? (
                    <div className="relative group">
                      <video
                        src={heroVideoUrl}
                        controls
                        className="w-full max-h-96 rounded-lg"
                        onError={(e) => {
                          console.error('Video load error');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
                        <label className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/ogg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(file);
                            }}
                            className="hidden"
                            disabled={isUploadingVideo}
                          />
                          {isUploadingVideo ? 'Uploading...' : 'Change Video'}
                        </label>
                        <button
                          onClick={() => setHeroVideoUrl('')}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                          <FaVideo className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
                          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                            {isUploadingVideo ? 'Uploading video...' : 'Drop an MP4 video here or click to upload'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Supports MP4, WebM, OGG formats
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/ogg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoUpload(file);
                          }}
                          className="hidden"
                          disabled={isUploadingVideo}
                        />
                      </label>
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Video URL (YouTube, Vimeo, Loom)
                        </label>
                        <input
                          type="url"
                          value={heroVideoUrl}
                          onChange={(e) => setHeroVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          disabled={isSaving || isUploadingVideo}
                          className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slideshow Tab Content */}
              {heroDisplayMode === 'slideshow' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Slideshow Images
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Upload multiple images for your slideshow. Drag to reorder.
                    </p>
                  </div>

                  {/* Image Grid with Drag-and-Drop */}
                  {heroSlideshowImages.length > 0 && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;

                        const oldIndex = heroSlideshowImages.indexOf(active.id as string);
                        const newIndex = heroSlideshowImages.indexOf(over.id as string);

                        if (oldIndex !== -1 && newIndex !== -1) {
                          setHeroSlideshowImages(arrayMove(heroSlideshowImages, oldIndex, newIndex));
                        }
                      }}
                    >
                      <SortableContext items={heroSlideshowImages}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          {heroSlideshowImages.map((imageUrl, index) => (
                            <SlideshowImageItem
                              key={imageUrl}
                              id={imageUrl}
                              imageUrl={imageUrl}
                              index={index}
                              onRemove={() => {
                                const newImages = [...heroSlideshowImages];
                                newImages.splice(index, 1);
                                setHeroSlideshowImages(newImages);
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* Upload Area */}
                  <label className="block w-full cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;

                        setIsUploadingFeatured(true);
                        try {
                          const uploadedUrls: string[] = [];
                          for (const file of files) {
                            const data = await uploadImage(file, 'projects', true);
                            uploadedUrls.push(data.url);
                          }
                          setHeroSlideshowImages([...heroSlideshowImages, ...uploadedUrls]);
                        } catch (error: any) {
                          console.error('Upload error:', error);
                          alert(error.message || 'Failed to upload images');
                        } finally {
                          setIsUploadingFeatured(false);
                        }
                        e.target.value = ''; // Reset input
                      }}
                      disabled={isUploadingFeatured || isSaving}
                      className="hidden"
                    />
                    <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {isUploadingFeatured ? (
                        <>
                          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-gray-600 dark:text-gray-400">Uploading images...</p>
                        </>
                      ) : (
                        <>
                          <FaImages className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                            Click to upload images
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Select multiple images at once
                          </p>
                        </>
                      )}
                    </div>
                  </label>

                  {heroSlideshowImages.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {heroSlideshowImages.length} image{heroSlideshowImages.length !== 1 ? 's' : ''} added
                    </p>
                  )}
                </div>
              )}

              {/* Quote Tab Content */}
              {heroDisplayMode === 'quote' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Share your prompt or project details
                  </p>
                  <textarea
                    value={heroQuote}
                    onChange={(e) => setHeroQuote(e.target.value)}
                    placeholder="Enter your quote here..."
                    disabled={isSaving}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 resize-none"
                  />
                </div>
              )}

              {/* Slide-up Tab Content */}
              {heroDisplayMode === 'slideup' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-6">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Create a two-part display where the second element slides up on click (desktop) or automatically on mobile.
                    </p>
                  </div>

                  {/* Element 1 */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Element 1 (Always Visible)
                    </h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Type
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSlideUpElement1Type('image')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement1Type === 'image'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaImage className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideUpElement1Type('video')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement1Type === 'video'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaVideo className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideUpElement1Type('text')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement1Type === 'text'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaFont className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {slideUpElement1Type === 'image' ? 'Image' : slideUpElement1Type === 'video' ? 'Video' : 'Text Content'}
                      </label>
                      {slideUpElement1Type === 'text' ? (
                        <textarea
                          value={slideUpElement1Content}
                          onChange={(e) => setSlideUpElement1Content(e.target.value)}
                          placeholder="Enter text content..."
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        />
                      ) : slideUpElement1Type === 'image' ? (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlideUpElement1Upload(file, 'image');
                              }}
                              disabled={isUploadingSlideUp1}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {isUploadingSlideUp1 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload image</p>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          </div>
                          <input
                            type="url"
                            value={slideUpElement1Content}
                            onChange={(e) => setSlideUpElement1Content(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={isUploadingSlideUp1}
                            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/ogg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlideUpElement1Upload(file, 'video');
                              }}
                              disabled={isUploadingSlideUp1}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {isUploadingSlideUp1 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Uploading video...</p>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload MP4 video</p>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          </div>
                          <input
                            type="url"
                            value={slideUpElement1Content}
                            onChange={(e) => setSlideUpElement1Content(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                            disabled={isUploadingSlideUp1}
                            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Caption (optional)
                      </label>
                      <input
                        type="text"
                        value={slideUpElement1Caption}
                        onChange={(e) => setSlideUpElement1Caption(e.target.value)}
                        placeholder="Add a caption..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Element 2 */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Element 2 (Slides Up)
                    </h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Type
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSlideUpElement2Type('image')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement2Type === 'image'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaImage className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideUpElement2Type('video')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement2Type === 'video'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaVideo className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideUpElement2Type('text')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            slideUpElement2Type === 'text'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaFont className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {slideUpElement2Type === 'image' ? 'Image' : slideUpElement2Type === 'video' ? 'Video' : 'Text Content'}
                      </label>
                      {slideUpElement2Type === 'text' ? (
                        <textarea
                          value={slideUpElement2Content}
                          onChange={(e) => setSlideUpElement2Content(e.target.value)}
                          placeholder="Enter text content..."
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-2 focus:ring-primary-500"
                        />
                      ) : slideUpElement2Type === 'image' ? (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlideUpElement2Upload(file, 'image');
                              }}
                              disabled={isUploadingSlideUp2}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {isUploadingSlideUp2 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload image</p>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          </div>
                          <input
                            type="url"
                            value={slideUpElement2Content}
                            onChange={(e) => setSlideUpElement2Content(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={isUploadingSlideUp2}
                            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/ogg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlideUpElement2Upload(file, 'video');
                              }}
                              disabled={isUploadingSlideUp2}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {isUploadingSlideUp2 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Uploading video...</p>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload MP4 video</p>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          </div>
                          <input
                            type="url"
                            value={slideUpElement2Content}
                            onChange={(e) => setSlideUpElement2Content(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                            disabled={isUploadingSlideUp2}
                            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Caption (optional)
                      </label>
                      <input
                        type="text"
                        value={slideUpElement2Caption}
                        onChange={(e) => setSlideUpElement2Caption(e.target.value)}
                        placeholder="Add a caption..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Project URL */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Project URL
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Link to live demo, GitHub repo, or external project page
              </p>
              <input
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://example.com/my-project"
                disabled={isSaving}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Tools Used */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Tools Used
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Select the technologies and tools used in this project
              </p>
              <ToolSelector
                selectedToolIds={projectTools}
                onChange={setProjectTools}
                disabled={isSaving}
              />
            </div>

            {/* Why it's cool - Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Why It's Cool
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Share what makes this project interesting (max 200 characters)
              </p>
              <textarea
                value={projectDescription}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 200) {
                    setProjectDescription(value);
                  }
                }}
                placeholder="What makes this project special? What did you learn or accomplish?"
                disabled={isSaving}
                maxLength={200}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${
                  projectDescription.length >= 200
                    ? 'text-red-500 dark:text-red-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {projectDescription.length}/200
                </span>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Project Details Tab Content */}
        {activeTab === 'details' && (
          <div className="py-8 px-8">
            <div className="max-w-5xl mx-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;

                const oldIndex = blocks.findIndex(b => b.id === active.id);
                const newIndex = blocks.findIndex(b => b.id === over.id);
                setBlocks(arrayMove(blocks, oldIndex, newIndex));
              }}
            >
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block, index) => (
                  <div key={block.id}>
                    <BlockEditor
                      block={block}
                      isFocused={focusedBlockId === block.id}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(updated) => {
                        setBlocks(blocks.map(b => b.id === block.id ? { ...block, ...updated } : b));
                      }}
                      onDelete={() => {
                        setBlocks(blocks.filter(b => b.id !== block.id));
                      }}
                    />

                    {/* Add Block Menu */}
                    <AddBlockMenu
                      show={showAddMenu === block.id}
                      onAdd={(type) => addBlock(block.id, type)}
                      onToggle={() => setShowAddMenu(showAddMenu === block.id ? null : block.id)}
                    />
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            {/* Add block at end */}
            {blocks.length === 0 && (
              <button
                onClick={() => addBlock(null, 'text')}
                className="w-full py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors"
              >
                Click to add your first block
              </button>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Block Editor Component
function BlockEditor({ block, isFocused, onFocus, onBlur, onChange, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Create sensors for nested drag and drop (column blocks)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const addColumnBlock = (columnIndex: number, type: 'text' | 'image' | 'video' | 'file' | 'button' | 'divider') => {
    const newBlock: any = {
      id: crypto.randomUUID(),
      type,
    };

    // Initialize block based on type
    if (type === 'text') {
      newBlock.content = '';
      newBlock.style = 'body';
    } else if (type === 'image') {
      newBlock.url = '';
      newBlock.caption = '';
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

    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: [...updatedColumns[columnIndex].blocks, newBlock],
    };

    onChange({ columns: updatedColumns });
  };

  const updateColumnBlock = (columnIndex: number, blockId: string, updates: any) => {
    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: updatedColumns[columnIndex].blocks.map((b: any) =>
        b.id === blockId ? { ...b, ...updates } : b
      ),
    };
    onChange({ columns: updatedColumns });
  };

  const deleteColumnBlock = (columnIndex: number, blockId: string) => {
    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: updatedColumns[columnIndex].blocks.filter((b: any) => b.id !== blockId),
    };
    onChange({ columns: updatedColumns });
  };

  const changeColumnCount = (count: 1 | 2 | 3) => {
    const currentColumns = block.columns || [];
    const newColumns = [];

    for (let i = 0; i < count; i++) {
      if (currentColumns[i]) {
        newColumns.push(currentColumns[i]);
      } else {
        newColumns.push({ id: crypto.randomUUID(), blocks: [] });
      }
    }

    // If reducing columns, merge extra blocks into last column
    if (count < currentColumns.length) {
      const extraBlocks = currentColumns.slice(count).flatMap((col: any) => col.blocks);
      if (extraBlocks.length > 0) {
        newColumns[count - 1].blocks = [...newColumns[count - 1].blocks, ...extraBlocks];
      }
    }

    onChange({ columnCount: count, columns: newColumns });
  };

  const toggleContainerWidth = () => {
    const newWidth = block.containerWidth === 'full' ? 'boxed' : 'full';
    onChange({ containerWidth: newWidth });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative mb-2"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Hover Toolbar - Top Right Corner */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button {...attributes} {...listeners} className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded shadow-md cursor-grab active:cursor-grabbing border border-gray-200 dark:border-gray-700" title="Drag to reorder">
          <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button onClick={onDelete} className="p-2 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded shadow-md border border-gray-200 dark:border-gray-700" title="Delete block">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Block Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus-within:border-primary-500 transition-colors">
        {block.type === 'columns' ? (
          <div>
            {/* Column controls */}
            <div className="flex gap-2 mb-4 justify-between pr-20">
              {/* Container width toggle */}
              <button
                onClick={toggleContainerWidth}
                className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1.5"
                title={block.containerWidth === 'boxed' ? 'Switch to full width' : 'Switch to boxed container'}
              >
                {block.containerWidth === 'boxed' ? (
                  <><FaCompress className="w-3.5 h-3.5" /> Boxed</>
                ) : (
                  <><FaExpand className="w-3.5 h-3.5" /> Full Width</>
                )}
              </button>

              {/* Column count selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => changeColumnCount(1)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 1
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  1 Col
                </button>
                <button
                  onClick={() => changeColumnCount(2)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 2
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  2 Col
                </button>
                <button
                  onClick={() => changeColumnCount(3)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 3
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  3 Col
                </button>
              </div>
            </div>

            {/* Columns with Drag & Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over) return;

                // Parse IDs: format is "columnIndex-blockId"
                const [activeColIdx, activeBlockId] = String(active.id).split('-');
                const activeColumnIndex = parseInt(activeColIdx);

                // Handle dropping on column container (empty area)
                if (String(over.id).startsWith('column-')) {
                  const overColumnIndex = parseInt(String(over.id).replace('column-', ''));

                  if (activeColumnIndex !== overColumnIndex) {
                    // Move to different column (append to end)
                    const sourceBlocks = [...block.columns[activeColumnIndex].blocks];
                    const blockIndex = sourceBlocks.findIndex((b: any) => b.id === activeBlockId);
                    const [movedBlock] = sourceBlocks.splice(blockIndex, 1);

                    const updatedColumns = [...block.columns];
                    updatedColumns[activeColumnIndex] = {
                      ...updatedColumns[activeColumnIndex],
                      blocks: sourceBlocks,
                    };
                    updatedColumns[overColumnIndex] = {
                      ...updatedColumns[overColumnIndex],
                      blocks: [...block.columns[overColumnIndex].blocks, movedBlock],
                    };
                    onChange({ columns: updatedColumns });
                  }
                  return;
                }

                const [overColIdx, overBlockId] = String(over.id).split('-');
                const overColumnIndex = parseInt(overColIdx);

                if (activeColumnIndex === overColumnIndex) {
                  // Reorder within same column
                  const columnBlocks = block.columns[activeColumnIndex].blocks;
                  const oldIndex = columnBlocks.findIndex((b: any) => b.id === activeBlockId);
                  const newIndex = columnBlocks.findIndex((b: any) => b.id === overBlockId);

                  if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                    const updatedColumns = [...block.columns];
                    updatedColumns[activeColumnIndex] = {
                      ...updatedColumns[activeColumnIndex],
                      blocks: arrayMove(columnBlocks, oldIndex, newIndex),
                    };
                    onChange({ columns: updatedColumns });
                  }
                } else {
                  // Move between columns
                  const sourceBlocks = [...block.columns[activeColumnIndex].blocks];
                  const targetBlocks = [...block.columns[overColumnIndex].blocks];
                  const blockIndex = sourceBlocks.findIndex((b: any) => b.id === activeBlockId);

                  if (blockIndex === -1) return;

                  const [movedBlock] = sourceBlocks.splice(blockIndex, 1);

                  const targetIndex = targetBlocks.findIndex((b: any) => b.id === overBlockId);
                  targetBlocks.splice(targetIndex >= 0 ? targetIndex : targetBlocks.length, 0, movedBlock);

                  const updatedColumns = [...block.columns];
                  updatedColumns[activeColumnIndex] = {
                    ...updatedColumns[activeColumnIndex],
                    blocks: sourceBlocks,
                  };
                  updatedColumns[overColumnIndex] = {
                    ...updatedColumns[overColumnIndex],
                    blocks: targetBlocks,
                  };
                  onChange({ columns: updatedColumns });
                }
              }}
            >
              <div className={block.containerWidth === 'boxed' ? 'max-w-6xl mx-auto' : ''}>
                <div className={`grid gap-4 ${
                  block.columnCount === 1 ? 'grid-cols-1' :
                  block.columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                {block.columns?.map((column: any, colIndex: number) => (
                  <SortableContext key={`sortable-${colIndex}`} items={column.blocks.map((b: any) => `${colIndex}-${b.id}`)} strategy={verticalListSortingStrategy}>
                    <div key={column.id} id={`column-${colIndex}`} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[200px]">
                      {column.blocks?.length === 0 ? (
                        <div className="h-full flex flex-wrap items-center justify-center gap-1.5">
                        <button onClick={() => addColumnBlock(colIndex, 'text')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaFont className="w-3 h-3" /> Text</button>
                        <button onClick={() => addColumnBlock(colIndex, 'image')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaImage className="w-3 h-3" /> Image</button>
                        <button onClick={() => addColumnBlock(colIndex, 'video')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaVideo className="w-3 h-3" /> Video</button>
                        <button onClick={() => addColumnBlock(colIndex, 'file')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaFileAlt className="w-3 h-3" /> File</button>
                        <button onClick={() => addColumnBlock(colIndex, 'button')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaMousePointer className="w-3 h-3" /> Button</button>
                        <button onClick={() => addColumnBlock(colIndex, 'divider')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaMinus className="w-3 h-3" /> Divider</button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {column.blocks.map((colBlock: any) => (
                            <DraggableColumnBlock
                              key={colBlock.id}
                              id={`${colIndex}-${colBlock.id}`}
                              block={colBlock}
                              onChange={(updates: any) => updateColumnBlock(colIndex, colBlock.id, updates)}
                              onDelete={() => deleteColumnBlock(colIndex, colBlock.id)}
                              onUpload={handleUpload}
                            />
                          ))}
                          <div className="flex flex-wrap gap-1 justify-center pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => addColumnBlock(colIndex, 'text')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Text</button>
                            <button onClick={() => addColumnBlock(colIndex, 'image')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Image</button>
                            <button onClick={() => addColumnBlock(colIndex, 'video')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Video</button>
                            <button onClick={() => addColumnBlock(colIndex, 'file')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> File</button>
                            <button onClick={() => addColumnBlock(colIndex, 'button')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Button</button>
                            <button onClick={() => addColumnBlock(colIndex, 'divider')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Divider</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                ))}
                </div>
              </div>
            </DndContext>
          </div>
        ) : block.type === 'text' ? (
          <div>
            {block.style === 'heading' ? (
              <input
                type="text"
                value={block.content}
                onChange={(e) => onChange({ content: e.target.value })}
                className="w-full text-4xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white"
                placeholder="Title"
              />
            ) : (
              <RichTextEditor
                content={block.content || ''}
                onChange={(content) => onChange({ content })}
                placeholder="Start writing..."
              />
            )}
          </div>
        ) : (
          <div>
            {block.url ? (
              <div>
                <img src={block.url} alt={block.caption} className="w-full rounded-lg mb-2" />
                <input
                  type="text"
                  value={block.caption || ''}
                  onChange={(e) => onChange({ caption: e.target.value })}
                  className="w-full text-sm text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                  placeholder="Add a caption..."
                />
              </div>
            ) : (
              <div>
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center">
                  {isUploading ? (
                    <div className="text-gray-500">Uploading...</div>
                  ) : (
                    <>
                      <PhotoIcon className="w-12 h-12 text-gray-400 mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file);
                        }}
                        className="hidden"
                        id={`upload-${block.id}`}
                      />
                      <label
                        htmlFor={`upload-${block.id}`}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg cursor-pointer"
                      >
                        Upload Image
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Draggable Column Block Wrapper
function DraggableColumnBlock({ id, block, onChange, onDelete, onUpload }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ColumnBlockEditor
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onUpload={onUpload}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// Column Block Editor
function ColumnBlockEditor({ block, onChange, onDelete, onUpload, dragHandleProps }: any) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadFile(file, 'projects/videos', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="group/col relative bg-gray-50 dark:bg-gray-900/50 rounded p-2">
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/col:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-gray-300 dark:bg-gray-600 rounded"
        >
          <Bars3Icon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
        </div>
      )}

      <button
        onClick={onDelete}
        className="absolute -top-1 -right-1 opacity-0 group-hover/col:opacity-100 transition-opacity p-1 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full"
      >
        <TrashIcon className="w-3 h-3" />
      </button>

      {block.type === 'text' ? (
        <RichTextEditor
          content={block.content || ''}
          onChange={(content) => onChange({ content })}
          placeholder="Start writing..."
          className="text-sm"
        />
      ) : block.type === 'video' ? (
        <div>
          {block.url ? (
            <div>
              <video src={block.url} controls className="w-full rounded mb-1" />
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => onChange({ caption: e.target.value })}
                className="w-full text-xs text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                placeholder="Caption..."
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded flex flex-col items-center justify-center">
              {isUploading ? (
                <div className="text-xs text-gray-500">Uploading...</div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    className="hidden"
                    id={`col-upload-${block.id}`}
                  />
                  <label
                    htmlFor={`col-upload-${block.id}`}
                    className="px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs cursor-pointer"
                  >
                    Upload Video
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      ) : block.type === 'image' ? (
        <div>
          {block.url ? (
            <div>
              <img src={block.url} alt={block.caption} className="w-full rounded mb-1" />
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => onChange({ caption: e.target.value })}
                className="w-full text-xs text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                placeholder="Caption..."
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded flex flex-col items-center justify-center">
              {isUploading ? (
                <div className="text-xs text-gray-500">Uploading...</div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    className="hidden"
                    id={`col-upload-${block.id}`}
                  />
                  <label
                    htmlFor={`col-upload-${block.id}`}
                    className="px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs cursor-pointer"
                  >
                    Upload Image
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 p-2">
          Block type "{block.type}" not supported in columns yet
        </div>
      )}
    </div>
  );
}

// Slideshow Image Item with Drag-and-Drop
function SlideshowImageItem({ id, imageUrl, index, onRemove }: { id: string; imageUrl: string; index: number; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        title="Drag to reorder"
      >
        <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </div>

      <img
        src={imageUrl}
        alt={`Slideshow image ${index + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
        }}
      />

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={onRemove}
          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
        {index + 1}
      </div>
    </div>
  );
}

// Add Block Menu Component
function AddBlockMenu({ show, onAdd, onToggle }: any) {
  return (
    <div className="relative h-12 flex items-center justify-center group">
      <button
        onClick={onToggle}
        className="opacity-30 group-hover:opacity-100 transition-opacity p-2 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-solid hover:border-primary-500"
      >
        <PlusIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
      </button>

      {show && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 grid grid-cols-4 gap-2 z-10">
          <button
            onClick={() => onAdd('columns')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaColumns className="w-3.5 h-3.5" /> Columns
          </button>
          <button
            onClick={() => onAdd('text')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaFont className="w-3.5 h-3.5" /> Text
          </button>
          <button
            onClick={() => onAdd('image')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaImage className="w-3.5 h-3.5" /> Image
          </button>
          <button
            onClick={() => onAdd('video')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaVideo className="w-3.5 h-3.5" /> Video
          </button>
          <button
            onClick={() => onAdd('file')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaFileAlt className="w-3.5 h-3.5" /> File
          </button>
          <button
            onClick={() => onAdd('button')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaMousePointer className="w-3.5 h-3.5" /> Button
          </button>
          <button
            onClick={() => onAdd('divider')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaMinus className="w-3.5 h-3.5" /> Divider
          </button>
        </div>
      )}
    </div>
  );
}
