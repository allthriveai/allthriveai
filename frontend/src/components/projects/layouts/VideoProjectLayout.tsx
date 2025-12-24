/**
 * VideoProjectLayout - Layout optimized for video projects (YouTube, etc.)
 *
 * Features a full-width video player at the top with project details below.
 * Designed for curated YouTube content where the video is the primary focus.
 * Includes admin edit panel for tools, tags, and content editing.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProjectContext } from '@/context/ProjectContext';
import { useTopicTray } from '@/context/TopicTrayContext';
import { useAuth } from '@/hooks/useAuth';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import { updateProject } from '@/services/projects';
import { getImpersonationStatus } from '@/services/impersonation';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '../shared/InlineEditable';
import { ProjectHero, InlineHeroEditor } from '../hero';
import { ProjectSections } from '../sections';
import type { ProjectSection, SectionType } from '@/types/sections';
import { createDefaultSectionContent, generateSectionId } from '@/types/sections';
import {
  CodeBracketIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { getTools, updateProjectTags } from '@/services/projects';
import type { Tool, Taxonomy } from '@/types/models';

// Convert plain URLs to markdown links before parsing
// This ensures URLs in YouTube descriptions become clickable
function linkifyText(text: string): string {
  // Match URLs - simplified regex for better browser compatibility
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  // Don't double-link URLs that are already in markdown link format
  return text.replace(urlRegex, (match, url, offset) => {
    // Check if this URL is already part of a markdown link
    const before = text.slice(Math.max(0, offset - 2), offset);
    if (before.endsWith('](') || before.endsWith('>[')) {
      return match;
    }
    return `[${url}](${url})`;
  });
}

export function VideoProjectLayout() {
  const {
    project,
    isOwner,
    isLiked,
    heartCount,
    isLiking,
    toggleLike,
    likeRewardId,
    isShareModalOpen,
    openShareModal,
    closeShareModal,
    isCommentTrayOpen,
    openCommentTray,
    closeCommentTray,
    isToolTrayOpen,
    selectedToolSlug,
    openToolTray,
    closeToolTray,
    handleDelete,
    handleToggleShowcase,
    isAuthenticated,
    setProject,
  } = useProjectContext();

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { openTopicTray } = useTopicTray();

  const [showMenu, setShowMenu] = useState(false);

  // Check if user is impersonating (admin acting as another user)
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    async function checkImpersonation() {
      if (!isAuthenticated || isAdmin) {
        setIsImpersonating(false);
        return;
      }
      try {
        const status = await getImpersonationStatus();
        setIsImpersonating(status.isImpersonating);
      } catch {
        setIsImpersonating(false);
      }
    }
    checkImpersonation();
  }, [isAuthenticated, isAdmin]);

  const canEdit = isOwner || isAdmin || isImpersonating;

  // Edit mode state (toggle between view and edit modes)
  const [isEditMode, setIsEditMode] = useState(true); // Default to edit mode for owners
  const [isSaving, setIsSaving] = useState(false);

  // Computed editing state - must be able to edit AND in edit mode
  const isEditing = canEdit && isEditMode;

  // Toggle between edit and published view
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Inline editing state for tools and topics
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>(project.tools || []);
  const [editTopics, setEditTopics] = useState<string[]>(
    project.topicsDetails?.map((t: Taxonomy) => t.name) || []
  );
  const [newTopic, setNewTopic] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  // Fetch available tools when entering edit mode
  useEffect(() => {
    if (isEditing) {
      getTools().then(tools => {
        setAvailableTools(tools);
      }).catch(err => {
        console.error('Failed to fetch tools:', err);
      });

      // Reset selections to current project values
      setSelectedToolIds(project.tools || []);
      setEditTopics(project.topicsDetails?.map((t: Taxonomy) => t.name) || []);
    }
  }, [isEditing, project.tools, project.topicsDetails]);

  // Filter tools by search query
  const filteredTools = availableTools.filter(tool =>
    tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

  // Handle saving tools and topics (auto-save)
  const saveTagsUpdate = useCallback(async (tools: number[], topics: string[]) => {
    if (isSavingTags) return;
    setIsSavingTags(true);

    try {
      const updatedProject = await updateProjectTags(project.id, {
        tools,
        topics,
      });
      setProject(updatedProject);
    } catch (error: unknown) {
      console.error('Failed to save tags:', error);
    } finally {
      setIsSavingTags(false);
    }
  }, [project.id, setProject, isSavingTags]);

  // Handle adding a new topic (with auto-save)
  const handleAddTopic = useCallback(() => {
    const trimmedTopic = newTopic.trim();
    if (trimmedTopic && !editTopics.includes(trimmedTopic)) {
      const newTopics = [...editTopics, trimmedTopic];
      setEditTopics(newTopics);
      setNewTopic('');
      saveTagsUpdate(selectedToolIds, newTopics);
    }
  }, [newTopic, editTopics, selectedToolIds, saveTagsUpdate]);

  // Handle removing a topic (with auto-save)
  const handleRemoveTopic = useCallback((topicToRemove: string) => {
    const newTopics = editTopics.filter(t => t !== topicToRemove);
    setEditTopics(newTopics);
    saveTagsUpdate(selectedToolIds, newTopics);
  }, [editTopics, selectedToolIds, saveTagsUpdate]);

  // Toggle tool selection (with auto-save)
  const handleToggleTool = useCallback((toolId: number) => {
    const newToolIds = selectedToolIds.includes(toolId)
      ? selectedToolIds.filter(id => id !== toolId)
      : [...selectedToolIds, toolId];
    setSelectedToolIds(newToolIds);
    saveTagsUpdate(newToolIds, editTopics);
  }, [selectedToolIds, editTopics, saveTagsUpdate]);

  // Handle inline title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setIsSaving(true);
    try {
      const updated = await updateProject(project.id, { title: newTitle });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update title:', error);
    } finally {
      setIsSaving(false);
    }
  }, [project.id, setProject]);

  // Handle inline description change
  const handleDescriptionChange = useCallback(async (newDescription: string) => {
    setIsSaving(true);
    try {
      const updated = await updateProject(project.id, { description: newDescription });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update description:', error);
    } finally {
      setIsSaving(false);
    }
  }, [project.id, setProject]);

  // Helper to filter content keys to only allowed ones
  const filterContentKeys = useCallback((contentObj: Record<string, unknown> | undefined): Record<string, unknown> => {
    const allowedKeys = [
      'blocks', 'cover', 'tags', 'metadata', 'video',
      'heroDisplayMode', 'heroQuote', 'heroVideoUrl', 'heroSlideshowImages',
      'heroSlideUpElement1', 'heroSlideUpElement2',
      'templateVersion', 'sections', 'github', 'figma'
    ];
    const filtered: Record<string, unknown> = {};
    if (contentObj) {
      for (const key of allowedKeys) {
        if (key in contentObj) {
          filtered[key] = contentObj[key];
        }
      }
    }
    return filtered;
  }, []);

  // Handle section content update (auto-save)
  const handleSectionUpdate = useCallback(async (sectionId: string, content: ProjectSection['content']) => {
    if (!project.content?.sections) return;

    const updatedSections = project.content.sections.map((section: ProjectSection) =>
      section.id === sectionId ? { ...section, content } : section
    );

    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      sections: updatedSections,
    };

    const originalProject = project;
    setProject({ ...project, content: updatedContent });
    setIsSaving(true);

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: unknown) {
      console.error('Failed to update section:', error);
      setProject(originalProject);
    } finally {
      setIsSaving(false);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle adding a new section
  const handleAddSection = useCallback(async (type: SectionType, afterSectionId?: string) => {
    const currentSections = project.content?.sections || [];

    const newSection: ProjectSection = {
      id: generateSectionId(type),
      type,
      enabled: true,
      order: 0,
      content: createDefaultSectionContent(type),
    };

    let insertIndex = 0;
    if (afterSectionId) {
      const afterIndex = currentSections.findIndex(s => s.id === afterSectionId);
      if (afterIndex !== -1) {
        insertIndex = afterIndex + 1;
      } else {
        insertIndex = currentSections.length;
      }
    }

    const newSections = [...currentSections];
    newSections.splice(insertIndex, 0, newSection);
    const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));

    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      templateVersion: 2 as const,
      sections: reorderedSections,
    };

    const originalProject = project;
    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: unknown) {
      console.error('Failed to add section:', error);
      setProject(originalProject);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle deleting a section
  const handleDeleteSection = useCallback(async (sectionId: string) => {
    if (!project.content?.sections) return;

    const newSections = project.content.sections
      .filter(s => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx }));

    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      sections: newSections,
    };

    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: unknown) {
      console.error('Failed to delete section:', error);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle reordering sections (drag-and-drop)
  const handleReorderSections = useCallback(async (reorderedSections: ProjectSection[]) => {
    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      templateVersion: 2 as const,
      sections: reorderedSections,
    };

    const originalProject = project;
    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: unknown) {
      console.error('Failed to reorder sections:', error);
      setProject(originalProject);
    }
  }, [project, setProject, filterContentKeys]);

  // Check for template v2 sections
  const hasTemplateSections = project.content?.templateVersion === 2 && (project.content?.sections?.length ?? 0) > 0;

  // Hero editor state
  const [isHeroEditorOpen, setIsHeroEditorOpen] = useState(false);

  // Extract video info from content
  // Handle both VideoContent object and legacy string format
  const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
  const sectionContent = project.content?.sections?.[0]?.content || {};
  const videoId = videoContent.videoId || (typeof sectionContent === 'object' && 'videoId' in sectionContent ? sectionContent.videoId : undefined);
  const channelName = videoContent.channelName || '';
  const channelId = videoContent.channelId || '';

  // Check for direct video upload (S3/MinIO URL)
  const directVideoUrl = videoContent.url || (typeof sectionContent === 'object' && 'url' in sectionContent ? sectionContent.url : '') || '';
  const isDirectUpload = directVideoUrl && !directVideoUrl.includes('youtube.com') && !directVideoUrl.includes('youtu.be');

  // Detect if this is a YouTube Short or vertical video
  // Check both video metadata and section content for isShort and isVertical flags
  const hasVerticalFlag = videoContent.isShort || videoContent.isVertical || (typeof sectionContent === 'object' && ('isShort' in sectionContent ? sectionContent.isShort : false)) || (typeof sectionContent === 'object' && ('isVertical' in sectionContent ? sectionContent.isVertical : false)) || false;
  // Also auto-detect from URL pattern (youtube.com/shorts/) - check heroVideoUrl or section content
  const videoUrl = project.content?.heroVideoUrl || directVideoUrl || '';
  const urlIsShort = typeof videoUrl === 'string' && (videoUrl.includes('/shorts/') || videoUrl.includes('youtube.com/shorts'));
  const isShort = hasVerticalFlag || urlIsShort;

  // Build YouTube embed URL - disable autoplay for desktop/tablet
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0` : null;
  const youtubeUrl = videoId
    ? (isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`)
    : project.externalUrl;
  const channelUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : null;

  return (
    <>
      {/* Edit Mode Toggle for Owners/Editors */}
      <EditModeIndicator isOwner={canEdit} isEditMode={isEditMode} onToggle={toggleEditMode} isSaving={isSaving} />

      {/* Video Section - Full Width */}
      <div className="w-full bg-black">
        {/* Owner Menu */}
        {isOwner && (
          <div className="absolute top-4 right-4 z-30">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
              >
                <EllipsisVerticalIcon className="w-6 h-6" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden z-50">
                  <button
                    onClick={() => {
                      handleToggleShowcase();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                  >
                    {project.isShowcased ? (
                      <>
                        <EyeSlashIcon className="w-4 h-4" />
                        Remove from Showcase
                      </>
                    ) : (
                      <>
                        <EyeIcon className="w-4 h-4" />
                        Add to Showcase
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 flex items-center gap-3 border-t border-gray-200/50 dark:border-gray-700/50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Player - Supports both YouTube embeds and direct uploads */}
        {/* Handles 9:16 vertical (shorts) and 16:9 horizontal aspect ratios */}
        {isDirectUpload ? (
          // Direct video upload - HTML5 native video player
          <div className={`flex justify-center ${isShort ? 'py-4' : ''}`}>
            <div
              className={`relative w-full ${isShort ? 'rounded-xl' : ''}`}
              style={isShort ? {
                maxWidth: '360px',
                aspectRatio: '9 / 16',
              } : {
                maxWidth: '1152px', // 6xl
              }}
            >
              <video
                src={directVideoUrl}
                title={project.title}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className={`w-full h-full ${isShort ? 'rounded-xl object-cover' : ''}`}
                style={!isShort ? { aspectRatio: '16 / 9' } : undefined}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        ) : isShort ? (
          // YouTube Shorts - Vertical 9:16 aspect ratio, centered with max height
          <div className="flex justify-center py-4">
            <div
              className="relative w-full rounded-xl"
              style={{
                maxWidth: '360px',  // Standard Short width
                aspectRatio: '9 / 16',
              }}
            >
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={project.title}
                  className="absolute inset-0 w-full h-full rounded-xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-xl">
                  <p className="text-gray-400">Video not available</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Regular YouTube video - 16:9 aspect ratio, full width
          <div className="w-full max-w-6xl mx-auto">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={project.title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <p className="text-gray-400">Video not available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hero Section - Only show for non-video hero modes since video is already rendered above */}
      {/* Skip hero entirely for video projects - the main video player is the hero */}
      {project.content?.heroDisplayMode && project.content.heroDisplayMode !== 'video' && project.content.heroDisplayMode !== 'image' && (
        <ProjectHero
          project={project}
          isEditing={isEditing}
          onEditClick={() => setIsHeroEditorOpen(true)}
        />
      )}

      {/* Inline Hero Editor Tray */}
      <InlineHeroEditor
        project={project}
        isOpen={isHeroEditorOpen}
        onClose={() => setIsHeroEditorOpen(false)}
        onProjectUpdate={setProject}
      />

      {/* Video Details Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Title and Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {/* Title - Inline Editable */}
            <InlineEditableTitle
              value={project.title}
              isEditable={isEditing}
              onChange={handleTitleChange}
              placeholder="Enter project title..."
              className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2"
              as="h1"
            />

            {/* Channel/Author and Date Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {/* Show YouTube channel for YouTube videos, or "By @username" for uploads */}
              {!isDirectUpload && channelName && channelUrl ? (
                <>
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {channelName}
                  </a>
                  <span>•</span>
                </>
              ) : null}
              <span>
                {new Date(project.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <span>•</span>
              <span>{isDirectUpload ? 'By' : 'Curated by'}</span>
              <Link
                to={`/${project.username}`}
                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                @{project.username}
              </Link>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0">
            <ProjectActions
              isLiked={isLiked}
              heartCount={heartCount}
              isLiking={isLiking}
              isAuthenticated={isAuthenticated}
              onLikeClick={toggleLike}
              likeRewardId={likeRewardId}
              onCommentClick={openCommentTray}
              onShareClick={openShareModal}
              externalUrl={isDirectUpload ? undefined : youtubeUrl}
              variant="compact"
            />
          </div>
        </div>

        {/* Description - Inline Editable */}
        {(project.description || isEditing) && (
          <div className="mb-6">
            {isEditing ? (
              <InlineEditableText
                value={project.description || ''}
                isEditable={isEditing}
                onChange={handleDescriptionChange}
                placeholder="Add a description for your project..."
                className="text-gray-700 dark:text-gray-300"
                multiline
                rows={4}
              />
            ) : (
              <div
                className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 [&_a]:text-primary-600 [&_a]:dark:text-primary-400 [&_a]:break-all"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(marked.parse(linkifyText(project.description || '')) as string)
                }}
              />
            )}
          </div>
        )}

        {/* Tools Section - Inline Editable */}
        {(isEditing || (project.toolsDetails && project.toolsDetails.length > 0)) && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tools</p>
            {isEditing ? (
              <div className="space-y-3">
                {/* Selected Tools */}
                <div className="flex flex-wrap gap-2">
                  {selectedToolIds.map(toolId => {
                    const tool = availableTools.find(t => t.id === toolId) || project.toolsDetails?.find(t => t.id === toolId);
                    if (!tool) return null;
                    return (
                      <span
                        key={toolId}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full border border-amber-200 dark:border-amber-700"
                      >
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt={tool.name} className="w-4 h-4 rounded object-cover" />
                        )}
                        <span className="text-sm font-medium">{tool.name}</span>
                        <button
                          onClick={() => handleToggleTool(toolId)}
                          className="ml-1 hover:text-red-500"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {/* Tool Search & Add */}
                <div className="relative">
                  <input
                    type="text"
                    value={toolSearchQuery}
                    onChange={(e) => setToolSearchQuery(e.target.value)}
                    placeholder="Search tools to add..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {toolSearchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-lg z-10">
                      {filteredTools.filter(t => !selectedToolIds.includes(t.id)).slice(0, 10).map(tool => (
                        <button
                          key={tool.id}
                          onClick={() => {
                            handleToggleTool(tool.id);
                            setToolSearchQuery('');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {tool.logoUrl && (
                            <img src={tool.logoUrl} alt="" className="w-4 h-4 rounded" />
                          )}
                          {tool.name}
                        </button>
                      ))}
                      {filteredTools.filter(t => !selectedToolIds.includes(t.id)).length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-500">No tools found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {project.toolsDetails?.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => openToolTray(tool.slug)}
                    className="group flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    {tool.logoUrl ? (
                      <img src={tool.logoUrl} alt={tool.name} className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <CodeBracketIcon className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tool.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Topics Section - Inline Editable */}
        {(isEditing || (project.topicsDetails && project.topicsDetails.length > 0)) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topics</p>
            {isEditing ? (
              <div className="space-y-3">
                {/* Current Topics */}
                <div className="flex flex-wrap gap-2">
                  {editTopics.map((topic, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700"
                    >
                      #{topic}
                      <button
                        onClick={() => handleRemoveTopic(topic)}
                        className="ml-1 hover:text-red-500"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Add Topic Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                    placeholder="Add a topic..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTopic}
                    disabled={!newTopic.trim()}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {project.topicsDetails?.map((topic: Taxonomy) => (
                  <button
                    key={topic.id}
                    onClick={() => openTopicTray(topic.name)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                  >
                    #{topic.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Sections - Editable content blocks */}
      {/* Filter out video sections since the main video is already rendered at the top */}
      {(hasTemplateSections || isEditing) && (
        <ProjectSections
          sections={((project.content?.sections || []) as ProjectSection[]).filter(s => s.type !== 'video')}
          isEditing={isEditing}
          onSectionUpdate={handleSectionUpdate}
          onAddSection={handleAddSection}
          onDeleteSection={handleDeleteSection}
          onReorderSections={handleReorderSections}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
        title={project.title}
        username={project.username}
        slug={project.slug}
      />

      {/* Comment Tray */}
      <CommentTray
        isOpen={isCommentTrayOpen}
        onClose={closeCommentTray}
        project={project}
        isAuthenticated={isAuthenticated}
      />

      {/* Tool Tray */}
      {selectedToolSlug && (
        <ToolTray
          isOpen={isToolTrayOpen}
          onClose={closeToolTray}
          toolSlug={selectedToolSlug}
        />
      )}

    </>
  );
}
