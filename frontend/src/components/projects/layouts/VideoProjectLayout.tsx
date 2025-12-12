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
import { Linkify } from '@/components/common/Linkify';
import { updateProject, updateProjectTags, getTools, getTaxonomies } from '@/services/projects';
import { getImpersonationStatus } from '@/services/impersonation';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '../shared/InlineEditable';
import type { Tool, Taxonomy } from '@/types/models';
import {
  CodeBracketIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Toggle between edit and published view
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Computed editing state - must be able to edit AND in edit mode
  const isEditing = canEdit && isEditMode;

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

  // Admin panel state (for tools/tags editing - keep this for advanced editing)
  const [isAdminPanelOpen] = useState(false);
  const [_adminError] = useState<string | null>(null);

  // Tools and tags editing state
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [_availableCategories] = useState<Taxonomy[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>(project.tools || []);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(project.categories || []);
  const [editTopics, setEditTopics] = useState<string[]>(project.topics || []);
  const [newTopic, setNewTopic] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [toolSearchQuery] = useState('');

  // Fetch available tools and categories when admin panel opens
  useEffect(() => {
    if (isAdminPanelOpen && canEdit) {
      getTools().then(tools => {
        setAvailableTools(tools);
      }).catch(err => {
        console.error('Failed to fetch tools:', err);
      });

      getTaxonomies('category').then(categories => {
        setAvailableCategories(categories);
      }).catch(err => {
        console.error('Failed to fetch categories:', err);
      });

      setSelectedToolIds(project.tools || []);
      setSelectedCategoryIds(project.categories || []);
      setEditTopics(project.topics || []);
    }
  }, [isAdminPanelOpen, canEdit, project.tools, project.categories, project.topics]);

  // Handle saving tools, categories, and topics
  const _handleSaveTags = async () => {
    if (isSavingTags) return;
    setIsSavingTags(true);

    try {
      const updatedProject = await updateProjectTags(project.id, {
        tools: selectedToolIds,
        categories: selectedCategoryIds,
        topics: editTopics,
      });
      setProject(updatedProject);
    } catch (error: unknown) {
      console.error('Admin save tags error:', error);
    } finally {
      setIsSavingTags(false);
    }
  };

  const _handleAddTopic = () => {
    const trimmedTopic = newTopic.trim();
    if (trimmedTopic && !editTopics.includes(trimmedTopic)) {
      setEditTopics([...editTopics, trimmedTopic]);
      setNewTopic('');
    }
  };

  const _handleRemoveTopic = (topicToRemove: string) => {
    setEditTopics(editTopics.filter(t => t !== topicToRemove));
  };

  const _handleToggleTool = (toolId: number) => {
    setSelectedToolIds(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const _handleToggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const _filteredTools = availableTools.filter(tool =>
    tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

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

  // DEBUG: Log detection values
  console.log('[VideoProjectLayout] video detection:', {
    videoContent,
    isDirectUpload,
    directVideoUrl,
    videoId,
    isShort
  });

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
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                <Linkify>{project.description}</Linkify>
              </p>
            )}
          </div>
        )}

        {/* Tools/Topics Row */}
        {project.toolsDetails && project.toolsDetails.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {project.toolsDetails.map((tool) => (
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
          </div>
        )}

        {/* Topics Pills - Clickable to open topic tray */}
        {project.topics && project.topics.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topics</p>
            <div className="flex flex-wrap gap-2">
              {project.topics.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => openTopicTray(topic)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                >
                  #{topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
