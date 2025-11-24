import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProject, deleteProjectRedirect } from '@/services/projects';
import { getTools } from '@/services/tools';
import { uploadImage, uploadFile } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ToolSelector } from '@/components/projects/ToolSelector';
import { TopicDropdown } from '@/components/projects/TopicDropdown';
import type { Project, ProjectBlock } from '@/types/models';
import type { TopicSlug } from '@/config/topics';
import { generateSlug } from '@/utils/slug';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  XMarkIcon,
  PhotoIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  FaImage,
  FaVideo,
  FaQuoteLeft,
  FaImages,
  FaArrowUp,
  FaCamera,
  FaEye,
  FaStar,
  FaLock,
} from 'react-icons/fa';

interface ProjectEditTrayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdate: (updatedProject: Project) => void;
}

type TabId = 'content' | 'hero' | 'settings';

export function ProjectEditTray({ isOpen, onClose, project, onProjectUpdate }: ProjectEditTrayProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track if initial load is complete
  const isInitialLoadRef = useRef(true);
  const saveVersionRef = useRef(0);

  // Editor state
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
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
  const [projectTopics, setProjectTopics] = useState<TopicSlug[]>([]);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Initialize state from project (only on initial open)
  useEffect(() => {
    if (project && isOpen) {
      setThumbnailUrl(project.thumbnailUrl || '');
      setProjectTitle(project.title || '');
      setEditableSlug(project.slug || '');
      setFeaturedImageUrl(project.featuredImageUrl || '');
      setProjectUrl(project.externalUrl || '');
      setProjectDescription(project.description || '');
      setProjectTools(project.tools || []);

      const topics = [
        ...(project.primaryTopic ? [project.primaryTopic] : []),
        ...(project.secondaryTopics || [])
      ];
      setProjectTopics(topics);

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
      }, 100);
    }
  }, [project.id, isOpen]);

  // Load tools
  useEffect(() => {
    async function loadTools() {
      try {
        const response = await getTools({ ordering: 'name' });
        setAllTools(response.results);
      } catch (error) {
        console.error('Failed to load tools:', error);
      }
    }
    loadTools();
  }, []);

  // Auto-suggest topics when tools change
  useEffect(() => {
    if (allTools.length === 0 || isInitialLoadRef.current) return;

    const suggestedTopics: TopicSlug[] = [];
    projectTools.forEach(toolId => {
      const tool = allTools.find(t => t.id === toolId);
      if (tool?.suggestedTopics) {
        tool.suggestedTopics.forEach((topic: TopicSlug) => {
          if (!suggestedTopics.includes(topic) && !projectTopics.includes(topic)) {
            suggestedTopics.push(topic);
          }
        });
      }
    });

    if (suggestedTopics.length > 0) {
      setProjectTopics(prev => {
        const newTopics = [...prev];
        suggestedTopics.forEach(topic => {
          if (!newTopics.includes(topic)) {
            newTopics.push(topic);
          }
        });
        return newTopics;
      });
    }
  }, [projectTools, allTools, projectTopics]);

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
      thumbnailUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
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
      thumbnailUrl,
      projectTitle,
      editableSlug,
      featuredImageUrl,
      projectUrl,
      projectDescription,
      projectTools,
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
        thumbnailUrl,
        featuredImageUrl,
        externalUrl: projectUrl,
        tools: projectTools,
        primaryTopic: projectTopics[0],
        secondaryTopics: projectTopics.slice(1),
        content: {
          blocks: blocks.map((block: any) => {
            const { id, ...rest } = block;
            return rest;
          }),
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

        // Preserve like state from original project (backend doesn't return this)
        const projectWithLikes = {
          ...updatedProject,
          isLikedByUser: project.isLikedByUser,
          heartCount: project.heartCount,
        };

        // Update parent without causing re-render that closes tray
        onProjectUpdate(projectWithLikes);

        // Only navigate if slug actually changed and is different from current URL
        if (updatedProject.slug !== project.slug && project.username) {
          // Use window history to avoid component unmounting
          window.history.replaceState({}, '', `/${project.username}/${updatedProject.slug}`);
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
  }, [project, formData, navigate, editableSlug, onProjectUpdate]);

  // Autosave effect
  useEffect(() => {
    if (!hasUnsavedChanges || !project) return;

    const timer = setTimeout(() => {
      handleSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, project, handleSave]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-[fade-in_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[600px] lg:w-[700px] bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto animate-[slide-in-right_0.3s_ease-out]">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Project</h2>
              {isSaving ? (
                <p className="text-xs text-gray-500">Saving...</p>
              ) : lastSaved ? (
                <p className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/${project.username}/${project.slug}/edit`)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Open full editor"
              >
                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-800 px-6">
            <nav className="flex gap-4" aria-label="Tabs">
              {[
                { id: 'content' as const, label: 'Content', icon: PhotoIcon },
                { id: 'hero' as const, label: 'Hero Display', icon: FaImage },
                { id: 'settings' as const, label: 'Settings', icon: Cog6ToothIcon },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'content' && (
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="Enter your project title"
                    disabled={isSaving}
                    className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description of your project"
                    rows={3}
                    disabled={isSaving}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {/* Tools */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Tools & Technologies
                  </label>
                  <ToolSelector
                    selectedToolIds={projectTools}
                    onChange={setProjectTools}
                  />
                </div>

                {/* Topics */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Topics
                  </label>
                  <TopicDropdown
                    selectedTopics={projectTopics}
                    onChange={setProjectTopics}
                  />
                </div>

                {/* External URL */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Project URL
                  </label>
                  <input
                    type="url"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={isSaving}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link to live project, GitHub repo, or demo
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'hero' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose how to showcase your project in the hero section
                </p>

                {/* Hero Display Mode Tabs */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setHeroDisplayMode('image')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      heroDisplayMode === 'image'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <FaImage />
                    Image
                  </button>
                  <button
                    onClick={() => setHeroDisplayMode('video')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      heroDisplayMode === 'video'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <FaVideo />
                    Video
                  </button>
                  <button
                    onClick={() => setHeroDisplayMode('quote')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      heroDisplayMode === 'quote'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <FaQuoteLeft />
                    Quote
                  </button>
                  <button
                    onClick={() => setHeroDisplayMode('slideshow')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      heroDisplayMode === 'slideshow'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <FaImages />
                    Slideshow
                  </button>
                  <button
                    onClick={() => setHeroDisplayMode('slideup')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      heroDisplayMode === 'slideup'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <FaArrowUp />
                    Slide Up
                  </button>
                </div>

                {/* Mode-specific inputs */}
                {heroDisplayMode === 'image' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Featured Image
                    </label>
                    {featuredImageUrl ? (
                      <div className="relative group">
                        <img src={featuredImageUrl} alt="Featured" className="w-full rounded-lg" />
                        <button
                          onClick={() => setFeaturedImageUrl('')}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-500">
                        <PhotoIcon className="w-12 h-12 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFeaturedImageUpload(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}

                {heroDisplayMode === 'quote' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Quote Text
                    </label>
                    <textarea
                      value={heroQuote}
                      onChange={(e) => setHeroQuote(e.target.value)}
                      placeholder="Enter your quote or key message..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                {heroDisplayMode === 'video' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Video URL
                    </label>
                    <input
                      type="url"
                      value={heroVideoUrl}
                      onChange={(e) => setHeroVideoUrl(e.target.value)}
                      placeholder="YouTube, Vimeo, or Loom URL"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Visibility Options */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Visibility</h3>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <div className="flex items-center gap-3">
                        <FaStar className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Showcase</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Display in showcase section</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={project.isShowcase}
                        onChange={async () => {
                          try {
                            const updated = await updateProject(project.id, {
                              isShowcase: !project.isShowcase,
                            });
                            onProjectUpdate(updated);
                          } catch (error) {
                            console.error('Failed to update:', error);
                          }
                        }}
                        className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <div className="flex items-center gap-3">
                        <FaLock className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Private</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Hide from public</p>
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
                            onProjectUpdate(updated);
                          } catch (error) {
                            console.error('Failed to update:', error);
                          }
                        }}
                        className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Project Slug */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Project URL</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">/{project.username}/</span>
                      <input
                        type="text"
                        value={editableSlug}
                        onChange={(e) => {
                          setEditableSlug(e.target.value);
                          setCustomSlugSet(true);
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    {customSlugSet && (
                      <button
                        onClick={() => {
                          setCustomSlugSet(false);
                          setEditableSlug(generateSlug(projectTitle));
                        }}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Reset to auto-generate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
