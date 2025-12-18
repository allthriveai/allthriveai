/**
 * InlineHeroEditor - Slide-out tray for editing hero display inline on project pages
 *
 * Provides access to all hero display modes (Image, Video, Slideshow, Prompt, Slide Up)
 * directly from the project view page without navigating to a separate editor.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { XMarkIcon, SwatchIcon } from '@heroicons/react/24/outline';
import { HeroDisplaySection } from '../fields/HeroDisplaySection';
import { GRADIENT_OVERLAY } from '../constants';
import { uploadImage, uploadFile } from '@/services/upload';
import { updateProject } from '@/services/projects';
import type { Project } from '@/types/models';

interface InlineHeroEditorProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdate: (project: Project) => void;
  /** File dropped from drag-and-drop on HeroImage - will be uploaded when tray opens */
  pendingFile?: File | null;
  /** Called after pendingFile has been processed */
  onPendingFileProcessed?: () => void;
}

export function InlineHeroEditor({
  project,
  isOpen,
  onClose,
  onProjectUpdate,
  pendingFile,
  onPendingFileProcessed,
}: InlineHeroEditorProps) {
  // Hero display state
  const [heroDisplayMode, setHeroDisplayMode] = useState<'image' | 'video' | 'slideshow' | 'quote' | 'slideup'>(
    project.content?.heroDisplayMode || 'image'
  );
  const [featuredImageUrl, setFeaturedImageUrl] = useState(project.featuredImageUrl || '');
  const [heroVideoUrl, setHeroVideoUrl] = useState(project.content?.heroVideoUrl || '');
  const [heroSlideshowImages, setHeroSlideshowImages] = useState<string[]>(
    project.content?.heroSlideshowImages || []
  );
  const [heroQuote, setHeroQuote] = useState(project.content?.heroQuote || '');

  // Slide-up elements
  const [slideUpElement1Type, setSlideUpElement1Type] = useState<'image' | 'video' | 'text'>(
    project.content?.heroSlideUpElement1?.type || 'image'
  );
  const [slideUpElement1Content, setSlideUpElement1Content] = useState(
    project.content?.heroSlideUpElement1?.content || ''
  );
  const [slideUpElement1Caption, setSlideUpElement1Caption] = useState(
    project.content?.heroSlideUpElement1?.caption || ''
  );
  const [slideUpElement2Type, setSlideUpElement2Type] = useState<'image' | 'video' | 'text'>(
    project.content?.heroSlideUpElement2?.type || 'text'
  );
  const [slideUpElement2Content, setSlideUpElement2Content] = useState(
    project.content?.heroSlideUpElement2?.content || ''
  );
  const [slideUpElement2Caption, setSlideUpElement2Caption] = useState(
    project.content?.heroSlideUpElement2?.caption || ''
  );

  // Hero background gradient
  const [heroGradientFrom, setHeroGradientFrom] = useState(
    project.content?.heroGradientFrom || ''
  );
  const [heroGradientTo, setHeroGradientTo] = useState(
    project.content?.heroGradientTo || ''
  );

  // Upload states
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingSlideUp1, setIsUploadingSlideUp1] = useState(false);
  const [isUploadingSlideUp2, setIsUploadingSlideUp2] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Track if user has made changes (to prevent auto-save loops)
  const [hasUserChanges, setHasUserChanges] = useState(false);

  // Track when we last synced from project - ignore state changes within this window
  // This prevents the "track user changes" effect from triggering during sync
  const lastSyncTimestampRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 500; // Ignore changes for 500ms after sync

  // Track if we've already initialized for this tray session
  // This prevents re-syncing while the tray is open (which interrupts file uploads)
  const hasInitializedRef = useRef(false);
  const lastProjectIdRef = useRef<number | null>(null);

  // Track upload intent - set when user clicks upload area, cleared after timeout
  // This blocks sync during file picker interaction
  const uploadIntentTimestampRef = useRef<number>(0);
  const UPLOAD_INTENT_WINDOW_MS = 10000; // Block sync for 10 seconds after clicking upload

  // Track if any upload is in progress (to prevent sync during uploads)
  const isAnyUploadInProgress = isUploadingFeatured || isUploadingVideo || isUploadingSlideUp1 || isUploadingSlideUp2;

  // Sync state from project - only on initial open or when project ID changes
  // This is critical: we must NOT re-sync while the tray is open and user is interacting
  // because re-syncing causes re-renders that destroy file inputs mid-upload
  useEffect(() => {
    const timeSinceUploadIntent = Date.now() - uploadIntentTimestampRef.current;

    // Reset initialization when tray closes
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // NEVER sync while an upload is in progress - this would wipe out the upload
    if (isAnyUploadInProgress) {
      return;
    }

    // NEVER sync while user might be in file picker (within upload intent window)
    if (timeSinceUploadIntent < UPLOAD_INTENT_WINDOW_MS) {
      return;
    }

    // Check if this is a new project (different ID) - if so, force re-init
    const projectChanged = lastProjectIdRef.current !== null && lastProjectIdRef.current !== project.id;
    if (projectChanged) {
      hasInitializedRef.current = false;
    }
    lastProjectIdRef.current = project.id;

    // If already initialized for this tray session, don't re-sync
    // This prevents interrupting file uploads when parent re-renders
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    // Record sync timestamp - changes within SYNC_DEBOUNCE_MS will be ignored
    lastSyncTimestampRef.current = Date.now();

    setHeroDisplayMode(project.content?.heroDisplayMode || 'image');
    setFeaturedImageUrl(project.featuredImageUrl || '');
    setHeroVideoUrl(project.content?.heroVideoUrl || '');
    setHeroSlideshowImages(project.content?.heroSlideshowImages || []);
    setHeroQuote(project.content?.heroQuote || '');
    setSlideUpElement1Type(project.content?.heroSlideUpElement1?.type || 'image');
    setSlideUpElement1Content(project.content?.heroSlideUpElement1?.content || '');
    setSlideUpElement1Caption(project.content?.heroSlideUpElement1?.caption || '');
    setSlideUpElement2Type(project.content?.heroSlideUpElement2?.type || 'text');
    setSlideUpElement2Content(project.content?.heroSlideUpElement2?.content || '');
    setSlideUpElement2Caption(project.content?.heroSlideUpElement2?.caption || '');
    setHeroGradientFrom(project.content?.heroGradientFrom || '');
    setHeroGradientTo(project.content?.heroGradientTo || '');
    // Reset user changes flag immediately (no timeout - timestamp-based now)
    setHasUserChanges(false);
  }, [isOpen, project, isAnyUploadInProgress]);

  // Save changes to the project
  const saveChanges = useCallback(async () => {
    setIsSaving(true);
    try {
      // Only send hero-specific content fields to avoid re-sending large data like github.tree
      // The backend will merge this with existing content
      const heroContent: Record<string, unknown> = {
        heroDisplayMode,
      };

      // Only include fields that have values
      if (heroVideoUrl) heroContent.heroVideoUrl = heroVideoUrl;
      if (heroSlideshowImages.length > 0) heroContent.heroSlideshowImages = heroSlideshowImages;
      if (heroQuote) heroContent.heroQuote = heroQuote;
      if (heroGradientFrom) heroContent.heroGradientFrom = heroGradientFrom;
      if (heroGradientTo) heroContent.heroGradientTo = heroGradientTo;
      if (slideUpElement1Content) {
        heroContent.heroSlideUpElement1 = {
          type: slideUpElement1Type,
          content: slideUpElement1Content,
          caption: slideUpElement1Caption || undefined,
        };
      }
      if (slideUpElement2Content) {
        heroContent.heroSlideUpElement2 = {
          type: slideUpElement2Type,
          content: slideUpElement2Content,
          caption: slideUpElement2Caption || undefined,
        };
      }

      // Preserve existing non-hero content fields
      const existingContent = project.content || {};
      const updatedContent = {
        ...existingContent,
        ...heroContent,
        // Clear hero fields that are now empty
        heroVideoUrl: heroVideoUrl || undefined,
        heroSlideshowImages: heroSlideshowImages.length > 0 ? heroSlideshowImages : undefined,
        heroQuote: heroQuote || undefined,
        heroSlideUpElement1: slideUpElement1Content ? heroContent.heroSlideUpElement1 : undefined,
        heroSlideUpElement2: slideUpElement2Content ? heroContent.heroSlideUpElement2 : undefined,
        heroGradientFrom: heroGradientFrom || undefined,
        heroGradientTo: heroGradientTo || undefined,
      };

      // Remove the large github.tree if it exists (it's only needed for initial import)
      const github = updatedContent.github as { tree?: unknown } | undefined;
      if (github?.tree) {
        const { tree: _tree, ...githubWithoutTree } = github;
        updatedContent.github = githubWithoutTree;
      }

      const payload = {
        featuredImageUrl: featuredImageUrl,
        content: updatedContent as typeof project.content,
      };
      const updated = await updateProject(project.id, payload);
      onProjectUpdate(updated);
    } catch (error) {
      console.error('Failed to save hero changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    project,
    heroDisplayMode,
    featuredImageUrl,
    heroVideoUrl,
    heroSlideshowImages,
    heroQuote,
    slideUpElement1Type,
    slideUpElement1Content,
    slideUpElement1Caption,
    slideUpElement2Type,
    slideUpElement2Content,
    slideUpElement2Caption,
    heroGradientFrom,
    heroGradientTo,
    onProjectUpdate,
  ]);

  // Track user changes (skip changes that happen during/immediately after sync)
  useEffect(() => {
    // Skip if we're within the sync debounce window
    const timeSinceSync = Date.now() - lastSyncTimestampRef.current;
    if (timeSinceSync < SYNC_DEBOUNCE_MS) {
      return;
    }
    setHasUserChanges(true);
  }, [
    heroDisplayMode,
    featuredImageUrl,
    heroVideoUrl,
    heroSlideshowImages,
    heroQuote,
    slideUpElement1Type,
    slideUpElement1Content,
    slideUpElement1Caption,
    slideUpElement2Type,
    slideUpElement2Content,
    slideUpElement2Caption,
    heroGradientFrom,
    heroGradientTo,
  ]);

  // Auto-save on changes (debounced) - only when user has made changes
  useEffect(() => {
    if (!isOpen || !hasUserChanges) {
      return;
    }

    const timer = setTimeout(() => {
      saveChanges();
      setHasUserChanges(false);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, hasUserChanges, saveChanges]);

  // Track upload intent - called when user clicks on upload area (before file picker opens)
  const handleUploadIntent = useCallback(() => {
    uploadIntentTimestampRef.current = Date.now();
  }, []);

  // Handle pending file from drag-and-drop on HeroImage
  // This effect runs when the tray opens with a pending file
  const pendingFileProcessedRef = useRef<File | null>(null);
  useEffect(() => {
    if (!isOpen || !pendingFile) return;

    // Don't process the same file twice
    if (pendingFileProcessedRef.current === pendingFile) return;
    pendingFileProcessedRef.current = pendingFile;

    // Determine file type and upload accordingly
    if (pendingFile.type.startsWith('image/')) {
      // Upload as featured image
      setIsUploadingFeatured(true);
      uploadImage(pendingFile, 'projects', true)
        .then((response) => {
          setFeaturedImageUrl(response.url);
          setHeroDisplayMode('image');
        })
        .catch((error) => {
          console.error('Failed to upload dropped image:', error);
        })
        .finally(() => {
          setIsUploadingFeatured(false);
          onPendingFileProcessed?.();
        });
    } else if (pendingFile.type.startsWith('video/')) {
      // Upload as hero video
      setIsUploadingVideo(true);
      uploadFile(pendingFile, 'projects/videos', true)
        .then((response) => {
          setHeroVideoUrl(response.url);
          setHeroDisplayMode('video');
        })
        .catch((error) => {
          console.error('Failed to upload dropped video:', error);
        })
        .finally(() => {
          setIsUploadingVideo(false);
          onPendingFileProcessed?.();
        });
    }
  }, [isOpen, pendingFile, onPendingFileProcessed]);

  // Upload handlers
  const handleFeaturedImageUpload = useCallback(async (file: File) => {
    setIsUploadingFeatured(true);
    try {
      const response = await uploadImage(file, 'projects', true);
      setFeaturedImageUrl(response.url);
    } catch (error) {
      console.error('Failed to upload featured image:', error);
    } finally {
      setIsUploadingFeatured(false);
    }
  }, []);

  const handleVideoUpload = useCallback(async (file: File) => {
    setIsUploadingVideo(true);
    try {
      const response = await uploadFile(file, 'projects/videos', true);
      setHeroVideoUrl(response.url);
    } catch (error) {
      console.error('Failed to upload video:', error);
    } finally {
      setIsUploadingVideo(false);
    }
  }, []);

  const handleSlideUpElement1Upload = useCallback(async (file: File, type: 'image' | 'video') => {
    setIsUploadingSlideUp1(true);
    try {
      const response = type === 'image'
        ? await uploadImage(file, 'projects', true)
        : await uploadFile(file, 'projects/videos', true);
      setSlideUpElement1Content(response.url);
    } catch (error) {
      console.error('Failed to upload slide-up element 1:', error);
    } finally {
      setIsUploadingSlideUp1(false);
    }
  }, []);

  const handleSlideUpElement2Upload = useCallback(async (file: File, type: 'image' | 'video') => {
    setIsUploadingSlideUp2(true);
    try {
      const response = type === 'image'
        ? await uploadImage(file, 'projects', true)
        : await uploadFile(file, 'projects/videos', true);
      setSlideUpElement2Content(response.url);
    } catch (error) {
      console.error('Failed to upload slide-up element 2:', error);
    } finally {
      setIsUploadingSlideUp2(false);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={(e) => {
          // Only close if clicking directly on the backdrop, not on elements inside the tray
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />

      {/* Slide-out Tray */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-gray-900 border-l border-white/10 shadow-2xl z-50 overflow-y-auto animate-slide-in-right"
        onClick={(e) => {
          // Prevent any clicks inside the tray from bubbling to the backdrop
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Hero Display</h2>
            <p className="text-sm text-white/60">Choose how to showcase your project</p>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-sm text-primary-400">Saving...</span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <HeroDisplaySection
            heroDisplayMode={heroDisplayMode}
            setHeroDisplayMode={setHeroDisplayMode}
            featuredImageUrl={featuredImageUrl}
            setFeaturedImageUrl={setFeaturedImageUrl}
            handleFeaturedImageUpload={handleFeaturedImageUpload}
            isUploadingFeatured={isUploadingFeatured}
            heroVideoUrl={heroVideoUrl}
            setHeroVideoUrl={setHeroVideoUrl}
            handleVideoUpload={handleVideoUpload}
            isUploadingVideo={isUploadingVideo}
            heroSlideshowImages={heroSlideshowImages}
            setHeroSlideshowImages={setHeroSlideshowImages}
            heroQuote={heroQuote}
            setHeroQuote={setHeroQuote}
            slideUpElement1Type={slideUpElement1Type}
            slideUpElement1Content={slideUpElement1Content}
            slideUpElement1Caption={slideUpElement1Caption}
            setSlideUpElement1Type={setSlideUpElement1Type}
            setSlideUpElement1Content={setSlideUpElement1Content}
            setSlideUpElement1Caption={setSlideUpElement1Caption}
            handleSlideUpElement1Upload={handleSlideUpElement1Upload}
            isUploadingSlideUp1={isUploadingSlideUp1}
            slideUpElement2Type={slideUpElement2Type}
            slideUpElement2Content={slideUpElement2Content}
            slideUpElement2Caption={slideUpElement2Caption}
            setSlideUpElement2Type={setSlideUpElement2Type}
            setSlideUpElement2Content={setSlideUpElement2Content}
            setSlideUpElement2Caption={setSlideUpElement2Caption}
            handleSlideUpElement2Upload={handleSlideUpElement2Upload}
            isUploadingSlideUp2={isUploadingSlideUp2}
            isSaving={isSaving}
            onUploadIntent={handleUploadIntent}
          />

          {/* Background Gradient Section */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <SwatchIcon className="w-5 h-5 text-white/70" />
              <h3 className="text-sm font-medium text-white">Background Gradient</h3>
            </div>
            <p className="text-xs text-white/50 mb-4">
              Customize the hero background gradient colors. Leave empty for default.
            </p>

            {/* Gradient Preview */}
            <div
              className="w-full h-24 rounded-lg mb-4 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${heroGradientFrom || GRADIENT_OVERLAY.DEFAULT_FROM} 0%, ${heroGradientTo || GRADIENT_OVERLAY.DEFAULT_TO} 100%)`
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/80 text-sm font-medium drop-shadow-lg">Preview</span>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-2">From Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heroGradientFrom || GRADIENT_OVERLAY.DEFAULT_FROM}
                    onChange={(e) => setHeroGradientFrom(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-white/20"
                  />
                  <input
                    type="text"
                    value={heroGradientFrom || ''}
                    onChange={(e) => setHeroGradientFrom(e.target.value)}
                    placeholder="e.g. #7c3aed"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-2">To Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heroGradientTo || GRADIENT_OVERLAY.DEFAULT_TO}
                    onChange={(e) => setHeroGradientTo(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-white/20"
                  />
                  <input
                    type="text"
                    value={heroGradientTo || ''}
                    onChange={(e) => setHeroGradientTo(e.target.value)}
                    placeholder="e.g. #4f46e5"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30"
                  />
                </div>
              </div>
            </div>

            {/* Preset Gradients */}
            <div className="mt-4">
              <label className="block text-xs text-white/60 mb-2">Presets</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { from: '#7c3aed', to: '#4f46e5', name: 'Violet' },
                  { from: '#0ea5e9', to: '#6366f1', name: 'Sky' },
                  { from: '#10b981', to: '#06b6d4', name: 'Emerald' },
                  { from: '#f59e0b', to: '#ef4444', name: 'Sunset' },
                  { from: '#ec4899', to: '#8b5cf6', name: 'Pink' },
                  { from: '#0a0a12', to: '#1e1b4b', name: 'Dark' },
                  { from: '#1e3a5f', to: '#0f172a', name: 'Navy' },
                  { from: '#064e3b', to: '#0f172a', name: 'Forest' },
                  { from: '#4c1d95', to: '#0f172a', name: 'Plum' },
                  { from: '#7f1d1d', to: '#0f172a', name: 'Wine' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setHeroGradientFrom(preset.from);
                      setHeroGradientTo(preset.to);
                    }}
                    className={`h-10 rounded-lg border-2 transition-transform hover:scale-105 ${
                      heroGradientFrom === preset.from && heroGradientTo === preset.to
                        ? 'border-white'
                        : 'border-transparent'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Reset Button */}
            {(heroGradientFrom || heroGradientTo) && (
              <button
                onClick={() => {
                  setHeroGradientFrom('');
                  setHeroGradientTo('');
                }}
                className="mt-4 w-full px-3 py-2 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors border border-white/10"
              >
                Reset to default gradient
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
