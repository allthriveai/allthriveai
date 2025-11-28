import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject, deleteProjectRedirect } from '@/services/projects';
import {
  BasicInfoSection,
  HeroDisplaySection,
  ProjectUrlSection,
  DescriptionSection,
  TopicsSection,
} from '@/components/projects/fields';
import { ToolSelector } from '@/components/projects/ToolSelector';
import type { Project } from '@/types/models';
import { generateSlug } from '@/utils/slug';
import { ProjectEditor } from '@/components/projects/ProjectEditor';
import { BlockEditor, AddBlockMenu } from '@/components/projects/BlockEditorComponents';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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

  // Page-specific UI state (not in ProjectEditor)
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tldr' | 'details'>('tldr');
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Simplified project loading (ProjectEditor handles field initialization)
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
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectSlug, username]);

  // Slug change handler for page navigation
  const handleSlugChange = (newSlug: string) => {
    if (username) {
      navigate(`/${username}/${newSlug}/edit`, { replace: true });
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
    <ProjectEditor project={project} onProjectUpdate={setProject} onSlugChange={handleSlugChange}>
      {(editorProps) => (
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
              {editorProps.projectTitle || 'Untitled Project'}
            </h1>
            {editorProps.isSaving ? (
              <p className="text-xs text-gray-500">Saving...</p>
            ) : editorProps.lastSaved ? (
              <p className="text-xs text-gray-500">Saved {editorProps.lastSaved.toLocaleTimeString()}</p>
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
            <div className="p-6">
              <ProjectSettingsSection
                project={project}
                onProjectUpdate={setProject}
                editorProps={editorProps}
                onPreviewClick={() => {
                  window.open(`/${project.username}/${project.slug}`, '_blank');
                  setShowSettingsSidebar(false);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner Image Section - Full Width */}
        <div className="mb-12">
          <div className="relative">
            {editorProps.bannerUrl ? (
                <div className="group relative w-full h-80 overflow-hidden cursor-pointer" onClick={() => editorProps.setShowBannerEdit(!editorProps.showBannerEdit)}>
                  <img
                    src={editorProps.bannerUrl}
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
                     onClick={() => editorProps.setShowBannerEdit(true)}>
                  <div className="text-center">
                    <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Add a banner image</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">This appears on your project card</p>
                  </div>
                </div>
              )}

              {/* Banner Edit Modal */}
              {editorProps.showBannerEdit && (
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
                              editorProps.setBannerUrl(gradientUrl);
                            }}
                            className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                              editorProps.bannerUrl === gradientUrl
                                ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800'
                                : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
                            }`}
                          >
                            <img
                              src={gradientUrl}
                              alt={`Gradient ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {editorProps.bannerUrl === gradientUrl && (
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
                            {editorProps.isUploadingBanner ? (
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
                              if (file) editorProps.handleBannerUpload(file);
                            }}
                            className="hidden"
                            disabled={editorProps.isUploadingBanner}
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
                          value={editorProps.bannerUrl}
                          onChange={(e) => editorProps.setBannerUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') editorProps.setShowBannerEdit(false);
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
                          editorProps.setBannerUrl('');
                          editorProps.setShowBannerEdit(false);
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => editorProps.setShowBannerEdit(false)}
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
            <BasicInfoSection
              projectTitle={editorProps.projectTitle}
              setProjectTitle={editorProps.setProjectTitle}
              isSaving={editorProps.isSaving}
            />

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
                    if (!editorProps.heroQuote && !editorProps.heroVideoUrl && editorProps.heroSlideshowImages.length === 0) {
                      editorProps.setHeroDisplayMode('image');
                    }
                  }}
                  disabled={editorProps.heroQuote || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    editorProps.heroDisplayMode === 'image'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : editorProps.heroQuote || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0
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
                    if (!editorProps.featuredImageUrl && !editorProps.heroQuote && editorProps.heroSlideshowImages.length === 0) {
                      editorProps.setHeroDisplayMode('video');
                    }
                  }}
                  disabled={editorProps.featuredImageUrl || editorProps.heroQuote || editorProps.heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    editorProps.heroDisplayMode === 'video'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : editorProps.featuredImageUrl || editorProps.heroQuote || editorProps.heroSlideshowImages.length > 0
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
                    if (!editorProps.featuredImageUrl && !editorProps.heroVideoUrl && !editorProps.heroQuote) {
                      editorProps.setHeroDisplayMode('slideshow');
                    }
                  }}
                  disabled={editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroQuote}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    editorProps.heroDisplayMode === 'slideshow'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroQuote
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
                    if (!editorProps.featuredImageUrl && !editorProps.heroVideoUrl && editorProps.heroSlideshowImages.length === 0) {
                      editorProps.setHeroDisplayMode('quote');
                    }
                  }}
                  disabled={editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    editorProps.heroDisplayMode === 'quote'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0
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
                    if (!editorProps.featuredImageUrl && !editorProps.heroVideoUrl && editorProps.heroSlideshowImages.length === 0 && !editorProps.heroQuote) {
                      editorProps.setHeroDisplayMode('slideup');
                    }
                  }}
                  disabled={editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0 || editorProps.heroQuote}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    editorProps.heroDisplayMode === 'slideup'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : editorProps.featuredImageUrl || editorProps.heroVideoUrl || editorProps.heroSlideshowImages.length > 0 || editorProps.heroQuote
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <FaArrowUp className="w-5 h-5" />
                  <span className="font-medium">Slide Up</span>
                </button>
              </div>

              {/* Image Tab Content */}
              {editorProps.heroDisplayMode === 'image' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
                  {editorProps.featuredImageUrl ? (
                    <div className="relative group">
                      <img
                        src={editorProps.featuredImageUrl}
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
                              if (file) editorProps.handleFeaturedImageUpload(file);
                            }}
                            className="hidden"
                            disabled={editorProps.isUploadingFeatured}
                          />
                          {editorProps.isUploadingFeatured ? 'Uploading...' : 'Change'}
                        </label>
                        <button
                          onClick={() => editorProps.setFeaturedImageUrl('')}
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
                            {editorProps.isUploadingFeatured ? 'Uploading...' : 'Drop an image here or click to upload'}
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
                            if (file) editorProps.handleFeaturedImageUpload(file);
                          }}
                          className="hidden"
                          disabled={editorProps.isUploadingFeatured}
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
                          value={editorProps.featuredImageUrl}
                          onChange={(e) => editorProps.setFeaturedImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          disabled={editorProps.isSaving}
                          className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Video Tab Content */}
              {editorProps.heroDisplayMode === 'video' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg space-y-4">
                  {editorProps.heroVideoUrl && (editorProps.heroVideoUrl.endsWith('.mp4') || editorProps.heroVideoUrl.endsWith('.webm') || editorProps.heroVideoUrl.endsWith('.ogg') || editorProps.heroVideoUrl.includes('/projects/videos/')) ? (
                    <div className="relative group">
                      <video
                        src={editorProps.heroVideoUrl}
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
                              if (file) editorProps.handleVideoUpload(file);
                            }}
                            className="hidden"
                            disabled={editorProps.isUploadingVideo}
                          />
                          {editorProps.isUploadingVideo ? 'Uploading...' : 'Change Video'}
                        </label>
                        <button
                          onClick={() => editorProps.setHeroVideoUrl('')}
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
                            {editorProps.isUploadingVideo ? 'Uploading video...' : 'Drop an MP4 video here or click to upload'}
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
                            if (file) editorProps.handleVideoUpload(file);
                          }}
                          className="hidden"
                          disabled={editorProps.isUploadingVideo}
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
                          value={editorProps.heroVideoUrl}
                          onChange={(e) => editorProps.setHeroVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          disabled={editorProps.isSaving || editorProps.isUploadingVideo}
                          className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slideshow Tab Content */}
              {editorProps.heroDisplayMode === 'slideshow' && (
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
                  {editorProps.heroSlideshowImages.length > 0 && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;

                        const oldIndex = editorProps.heroSlideshowImages.indexOf(active.id as string);
                        const newIndex = editorProps.heroSlideshowImages.indexOf(over.id as string);

                        if (oldIndex !== -1 && newIndex !== -1) {
                          editorProps.setHeroSlideshowImages(arrayMove(editorProps.heroSlideshowImages, oldIndex, newIndex));
                        }
                      }}
                    >
                      <SortableContext items={editorProps.heroSlideshowImages}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          {editorProps.heroSlideshowImages.map((imageUrl, index) => (
                            <SlideshowImageItem
                              key={imageUrl}
                              id={imageUrl}
                              imageUrl={imageUrl}
                              index={index}
                              onRemove={() => {
                                const newImages = [...editorProps.heroSlideshowImages];
                                newImages.splice(index, 1);
                                editorProps.setHeroSlideshowImages(newImages);
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

                        editorProps.setIsUploadingFeatured(true);
                        try {
                          const uploadedUrls: string[] = [];
                          for (const file of files) {
                            const data = await uploadImage(file, 'projects', true);
                            uploadedUrls.push(data.url);
                          }
                          editorProps.setHeroSlideshowImages([...editorProps.heroSlideshowImages, ...uploadedUrls]);
                        } catch (error: any) {
                          console.error('Upload error:', error);
                          alert(error.message || 'Failed to upload images');
                        } finally {
                          editorProps.setIsUploadingFeatured(false);
                        }
                        e.target.value = ''; // Reset input
                      }}
                      disabled={editorProps.isUploadingFeatured || editorProps.isSaving}
                      className="hidden"
                    />
                    <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                      {editorProps.isUploadingFeatured ? (
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

                  {editorProps.heroSlideshowImages.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {editorProps.heroSlideshowImages.length} image{editorProps.heroSlideshowImages.length !== 1 ? 's' : ''} added
                    </p>
                  )}
                </div>
              )}

              {/* Quote Tab Content */}
              {editorProps.heroDisplayMode === 'quote' && (
                <div className="p-6 border-2 border-gray-300 dark:border-gray-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Share your prompt or project details
                  </p>
                  <textarea
                    value={editorProps.heroQuote}
                    onChange={(e) => editorProps.setHeroQuote(e.target.value)}
                    placeholder="Enter your quote here..."
                    disabled={editorProps.isSaving}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 resize-none"
                  />
                </div>
              )}

              {/* Slide-up Tab Content */}
              {editorProps.heroDisplayMode === 'slideup' && (
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
                          onClick={() => editorProps.setSlideUpElement1Type('image')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement1Type === 'image'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaImage className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editorProps.setSlideUpElement1Type('video')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement1Type === 'video'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaVideo className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editorProps.setSlideUpElement1Type('text')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement1Type === 'text'
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
                        {editorProps.slideUpElement1Type === 'image' ? 'Image' : editorProps.slideUpElement1Type === 'video' ? 'Video' : 'Text Content'}
                      </label>
                      {editorProps.slideUpElement1Type === 'text' ? (
                        <textarea
                          value={editorProps.slideUpElement1Content}
                          onChange={(e) => editorProps.setSlideUpElement1Content(e.target.value)}
                          placeholder="Enter text content..."
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        />
                      ) : editorProps.slideUpElement1Type === 'image' ? (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) editorProps.handleSlideUpElement1Upload(file, 'image');
                              }}
                              disabled={editorProps.isUploadingSlideUp1}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {editorProps.isUploadingSlideUp1 ? (
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
                            value={editorProps.slideUpElement1Content}
                            onChange={(e) => editorProps.setSlideUpElement1Content(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={editorProps.isUploadingSlideUp1}
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
                                if (file) editorProps.handleSlideUpElement1Upload(file, 'video');
                              }}
                              disabled={editorProps.isUploadingSlideUp1}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {editorProps.isUploadingSlideUp1 ? (
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
                            value={editorProps.slideUpElement1Content}
                            onChange={(e) => editorProps.setSlideUpElement1Content(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                            disabled={editorProps.isUploadingSlideUp1}
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
                        value={editorProps.slideUpElement1Caption}
                        onChange={(e) => editorProps.setSlideUpElement1Caption(e.target.value)}
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
                          onClick={() => editorProps.setSlideUpElement2Type('image')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement2Type === 'image'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaImage className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editorProps.setSlideUpElement2Type('video')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement2Type === 'video'
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <FaVideo className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editorProps.setSlideUpElement2Type('text')}
                          className={`flex-1 px-3 py-2 rounded border-2 transition-all ${
                            editorProps.slideUpElement2Type === 'text'
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
                        {editorProps.slideUpElement2Type === 'image' ? 'Image' : editorProps.slideUpElement2Type === 'video' ? 'Video' : 'Text Content'}
                      </label>
                      {editorProps.slideUpElement2Type === 'text' ? (
                        <textarea
                          value={editorProps.slideUpElement2Content}
                          onChange={(e) => editorProps.setSlideUpElement2Content(e.target.value)}
                          placeholder="Enter text content..."
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-2 focus:ring-primary-500"
                        />
                      ) : editorProps.slideUpElement2Type === 'image' ? (
                        <div className="space-y-2">
                          <label className="block w-full cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) editorProps.handleSlideUpElement2Upload(file, 'image');
                              }}
                              disabled={editorProps.isUploadingSlideUp2}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {editorProps.isUploadingSlideUp2 ? (
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
                            value={editorProps.slideUpElement2Content}
                            onChange={(e) => editorProps.setSlideUpElement2Content(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={editorProps.isUploadingSlideUp2}
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
                                if (file) editorProps.handleSlideUpElement2Upload(file, 'video');
                              }}
                              disabled={editorProps.isUploadingSlideUp2}
                              className="hidden"
                            />
                            <div className="px-4 py-3 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                              {editorProps.isUploadingSlideUp2 ? (
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
                            value={editorProps.slideUpElement2Content}
                            onChange={(e) => editorProps.setSlideUpElement2Content(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
                            disabled={editorProps.isUploadingSlideUp2}
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
                        value={editorProps.slideUpElement2Caption}
                        onChange={(e) => editorProps.setSlideUpElement2Caption(e.target.value)}
                        placeholder="Add a caption..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Project URL */}
            <ProjectUrlSection
              projectUrl={editorProps.projectUrl}
              setProjectUrl={editorProps.setProjectUrl}
              isSaving={editorProps.isSaving}
            />

            {/* Tools Used */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Tools Used
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Select the technologies and tools used in this project
              </p>
              <ToolSelector
                selectedToolIds={editorProps.projectTools}
                onChange={editorProps.setProjectTools}
                disabled={editorProps.isSaving}
              />
            </div>

            {/* Categories and Topics */}
            <TopicsSection
              projectCategories={editorProps.projectCategories}
              availableCategories={editorProps.availableCategories}
              setProjectCategories={editorProps.setProjectCategories}
              projectTopics={editorProps.projectTopics}
              setProjectTopics={editorProps.setProjectTopics}
              isSaving={editorProps.isSaving}
            />

            {/* Why it's cool - Description */}
            <DescriptionSection
              projectDescription={editorProps.projectDescription}
              setProjectDescription={editorProps.setProjectDescription}
              isSaving={editorProps.isSaving}
              maxWords={200}
            />
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

                const oldIndex = editorProps.blocks.findIndex(b => b.id === active.id);
                const newIndex = editorProps.blocks.findIndex(b => b.id === over.id);
                editorProps.setBlocks(arrayMove(editorProps.blocks, oldIndex, newIndex));
              }}
            >
              <SortableContext items={editorProps.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {editorProps.blocks.map((block, index) => (
                  <div key={block.id}>
                    <BlockEditor
                      block={block}
                      isFocused={editorProps.focusedBlockId === block.id}
                      onFocus={() => editorProps.setFocusedBlockId(block.id)}
                      onBlur={() => editorProps.setFocusedBlockId(null)}
                      onChange={(updated) => {
                        editorProps.setBlocks(editorProps.blocks.map(b => b.id === block.id ? { ...block, ...updated } : b));
                      }}
                      onDelete={() => {
                        editorProps.setBlocks(editorProps.blocks.filter(b => b.id !== block.id));
                      }}
                    />

                    {/* Add Block Menu */}
                    <AddBlockMenu
                      show={editorProps.showAddMenu === block.id}
                      onAdd={(type) => editorProps.addBlock(block.id, type)}
                      onToggle={() => editorProps.setShowAddMenu(editorProps.showAddMenu === block.id ? null : block.id)}
                    />
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            {/* Add block at end */}
            {editorProps.blocks.length === 0 && (
              <button
                onClick={() => editorProps.addBlock(null, 'text')}
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
      )}
    </ProjectEditor>
  );
}
