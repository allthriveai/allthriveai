/**
 * CuratedArticleLayout - Beautiful layout for expert-curated RSS articles
 *
 * Features:
 * - Hero section with category-colored gradient background
 * - Prominent curator information with avatar
 * - Structured expert review with semantic formatting
 * - "Read Full Article" call-to-action button
 * - Category-themed accent colors throughout
 * - Full light/dark mode support
 * - Admin edit panel for title, description, and image regeneration
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, ClockIcon, UserIcon, PencilIcon, ArrowPathIcon, XMarkIcon, CheckIcon, PlusIcon, TagIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useProjectContext } from '@/context/ProjectContext';
import { useTopicTray } from '@/context/TopicTrayContext';
import { useAuth } from '@/hooks/useAuth';
import { getCategoryColors } from '@/utils/categoryColors';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { adminEditProject, VISUAL_STYLES, type VisualStyle, updateProjectTags, getTools, getTaxonomies } from '@/services/projects';
import { getImpersonationStatus } from '@/services/impersonation';
import type { Tool, Taxonomy } from '@/types/models';

/**
 * Format the expert review into structured HTML with headers and sections
 * Handles markdown-style headers (## Header) and paragraphs
 */
function formatExpertReview(review: string): string {
  if (!review) return '';

  // Check if the review has markdown headers
  if (review.includes('## ')) {
    // Split by markdown headers
    const sections = review.split(/^## /m).filter(Boolean);

    let html = '';
    sections.forEach((section, index) => {
      const lines = section.trim().split('\n');
      const header = lines[0].trim();
      const content = lines.slice(1).join(' ').trim();

      if (index === 0 && !review.startsWith('## ')) {
        // First section without a header (intro text)
        html += `<p class="text-xl font-medium leading-relaxed mb-6">${section.trim()}</p>`;
      } else if (header && content) {
        html += `
          <div class="mb-6">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-white/50 mb-2">${header}</h3>
            <p class="text-lg leading-relaxed text-gray-700 dark:text-white/90">${content}</p>
          </div>
        `;
      } else if (header) {
        // Header with content on same line or no content
        html += `<p class="text-lg leading-relaxed mb-4 text-gray-700 dark:text-white/90">${header}</p>`;
      }
    });

    return html;
  }

  // Fallback: Split into sentences for better readability
  const sentences = review.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length <= 2) {
    // Short review - just render as a paragraph
    return `<p class="text-lg leading-relaxed">${review}</p>`;
  }

  // For longer reviews, structure them nicely
  const lead = sentences[0];
  const rest = sentences.slice(1);

  let html = `<p class="text-xl font-medium leading-relaxed mb-6">${lead}</p>`;

  if (rest.length > 0) {
    html += `<p class="text-lg leading-relaxed opacity-80">${rest.join(' ')}</p>`;
  }

  return html;
}

export function CuratedArticleLayout() {
  const {
    project,
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
    isAuthenticated,
    setProject,
  } = useProjectContext();

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { openTopicTray } = useTopicTray();

  // Check if user is impersonating (admin acting as another user)
  // Only check if authenticated and NOT already an admin (admins don't need impersonation check)
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    async function checkImpersonation() {
      // Skip check if not authenticated or already admin
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

  // Can edit if admin OR if impersonating (impersonation means an admin is acting as this user)
  const canEdit = isAdmin || isImpersonating;

  // Tool tray state
  const [isToolTrayOpen, setIsToolTrayOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');

  // Admin edit state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<VisualStyle>('cyberpunk');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Tools and tags editing state
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Taxonomy[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>(project.tools || []);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(project.categories || []);
  const [editTopics, setEditTopics] = useState<string[]>(project.topics || []);
  const [newTopic, setNewTopic] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  // Fetch available tools and categories when admin panel opens
  useEffect(() => {
    if (isAdminPanelOpen && canEdit) {
      // Fetch tools
      getTools().then(tools => {
        setAvailableTools(tools);
      }).catch(err => {
        console.error('Failed to fetch tools:', err);
      });

      // Fetch categories
      getTaxonomies('category').then(categories => {
        setAvailableCategories(categories);
      }).catch(err => {
        console.error('Failed to fetch categories:', err);
      });

      // Reset selections to current project values
      setSelectedToolIds(project.tools || []);
      setSelectedCategoryIds(project.categories || []);
      setEditTopics(project.topics || []);
    }
  }, [isAdminPanelOpen, canEdit, project.tools, project.categories, project.topics]);

  // Handle saving text changes
  const handleSaveTextChanges = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setAdminError(null);

    try {
      const updatedProject = await adminEditProject(project.id, {
        title: editTitle !== project.title ? editTitle : undefined,
        description: editDescription !== project.description ? editDescription : undefined,
      });
      setProject(updatedProject);
      setIsAdminPanelOpen(false);
    } catch (error: any) {
      // Use generic error message to avoid exposing internal details
      console.error('Admin edit error:', error);
      setAdminError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle regenerating image
  const handleRegenerateImage = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    setAdminError(null);

    try {
      const updatedProject = await adminEditProject(project.id, {
        regenerateImage: true,
        visualStyle: selectedVisualStyle,
      });
      setProject(updatedProject);
    } catch (error: any) {
      // Use generic error message to avoid exposing internal details
      console.error('Admin regenerate image error:', error);
      setAdminError('Failed to regenerate image. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle saving tools, categories, and topics
  const handleSaveTags = async () => {
    if (isSavingTags) return;
    setIsSavingTags(true);
    setAdminError(null);

    try {
      const updatedProject = await updateProjectTags(project.id, {
        tools: selectedToolIds,
        categories: selectedCategoryIds,
        topics: editTopics,
      });
      setProject(updatedProject);
    } catch (error: any) {
      console.error('Admin save tags error:', error);
      setAdminError('Failed to save tags. Please try again.');
    } finally {
      setIsSavingTags(false);
    }
  };

  // Handle adding a new topic
  const handleAddTopic = () => {
    const trimmedTopic = newTopic.trim();
    if (trimmedTopic && !editTopics.includes(trimmedTopic)) {
      setEditTopics([...editTopics, trimmedTopic]);
      setNewTopic('');
    }
  };

  // Handle removing a topic
  const handleRemoveTopic = (topicToRemove: string) => {
    setEditTopics(editTopics.filter(t => t !== topicToRemove));
  };

  // Toggle tool selection
  const handleToggleTool = (toolId: number) => {
    setSelectedToolIds(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Toggle category selection
  const handleToggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Filter tools by search query
  const filteredTools = availableTools.filter(tool =>
    tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

  const handleToolClick = (toolSlug: string) => {
    setSelectedToolSlug(toolSlug);
    setIsToolTrayOpen(true);
  };

  // Get category colors
  const primaryCategory = project.categoriesDetails?.[0];
  const { from: categoryFromColor, to: categoryToColor } = getCategoryColors(
    primaryCategory?.color,
    project.id
  );

  // Get content sections
  const overview = project.content?.sections?.find((s: any) => s.type === 'overview');
  const linksSection = project.content?.sections?.find((s: any) => s.type === 'links');

  // Extract curator info - use fullName from overview metrics if available
  const reviewerMetric = overview?.content?.metrics?.find((m: any) => m.label === 'Reviewed by');
  const curatorName = reviewerMetric?.value || project.username;
  const curatorAvatar = project.userAvatarUrl;
  const sourceLink = linksSection?.content?.links?.[0];

  // Extract metrics
  const metrics = overview?.content?.metrics || [];
  const publishedDate = metrics.find((m: any) => m.label === 'Published')?.value;
  const originalAuthor = metrics.find((m: any) => m.label === 'Author')?.value;

  // Get expert review (description)
  // Prefer overview.content.description (the full AI-generated expert review) over project.description
  // which may just be a short category/tag name for curated articles
  const overviewDescription = overview?.content?.description || '';
  const expertReview = overviewDescription || project.description || '';

  return (
    <>
      {/* Hero Section - Full viewport height with category gradient */}
      <div className="relative min-h-screen w-full flex items-center overflow-hidden bg-white dark:bg-gray-950">
        {/* Background - Category-colored gradient orbs */}
        <div className="absolute inset-0 z-0">
          {project.featuredImageUrl ? (
            <>
              <img
                src={project.featuredImageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Light mode: white overlay, Dark mode: dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/90 to-white dark:from-gray-950/70 dark:via-gray-950/85 dark:to-gray-950" />
            </>
          ) : (
            <>
              {/* Light mode: light gradient, Dark mode: dark gradient */}
              <div className="w-full h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
              {/* Category-colored gradient orbs - more subtle in light mode */}
              <div
                className="absolute top-0 left-0 w-[60%] h-[60%] rounded-full blur-[120px] opacity-20 dark:opacity-30 animate-pulse"
                style={{ background: categoryFromColor }}
              />
              <div
                className="absolute bottom-0 right-0 w-[50%] h-[50%] rounded-full blur-[100px] opacity-15 dark:opacity-20"
                style={{ background: categoryToColor }}
              />
            </>
          )}

          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${categoryFromColor}50, transparent)`
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          {/* Category Badge */}
          <div className="flex items-center gap-3 mb-8">
            {primaryCategory && (
              <span
                className="px-4 py-1.5 text-sm font-semibold rounded-full border backdrop-blur-xl shadow-lg"
                style={{
                  backgroundColor: `${categoryFromColor}20`,
                  borderColor: `${categoryFromColor}40`,
                  color: categoryFromColor,
                }}
              >
                {primaryCategory.name}
              </span>
            )}
            <span className="text-gray-500 dark:text-gray-400 text-sm">Curated Article</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-8">
            {project.title}
          </h1>

          {/* Curator Info Card */}
          <div className="flex items-center gap-4 mb-10 p-4 bg-gray-100/80 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10">
            {/* Avatar with gradient ring */}
            <div
              className="relative w-14 h-14 rounded-full p-[2px]"
              style={{
                background: `linear-gradient(135deg, ${categoryFromColor}, ${categoryToColor})`
              }}
            >
              {curatorAvatar ? (
                <img
                  src={curatorAvatar}
                  alt={curatorName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-gray-500 dark:text-white/60" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="text-gray-500 dark:text-white/60 text-sm">Curated by</p>
              <Link
                to={`/${project.username}`}
                className="text-gray-900 dark:text-white font-semibold hover:underline"
              >
                {curatorName}
              </Link>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-gray-500 dark:text-white/50 text-sm">
              {publishedDate && (
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="w-4 h-4" />
                  <span>{publishedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Expert Review - Main Content */}
          <div className="mb-10">
            <h2
              className="text-lg font-semibold mb-4 uppercase tracking-wider"
              style={{ color: categoryFromColor }}
            >
              Expert Take
            </h2>

            <div
              className="prose prose-lg dark:prose-invert max-w-none prose-p:text-gray-700 dark:prose-p:text-white/90 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: formatExpertReview(expertReview)
              }}
            />
          </div>

          {/* Tools Mentioned - show AI tools from taxonomy */}
          {project.toolsDetails && project.toolsDetails.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Tools Mentioned
              </h3>
              <div className="flex flex-wrap gap-3">
                {project.toolsDetails.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.slug)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30 hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer"
                  >
                    {tool.logoUrl && (
                      <img
                        src={tool.logoUrl}
                        alt={tool.name}
                        className="w-5 h-5 rounded object-cover"
                      />
                    )}
                    <span className="text-sm text-gray-700 dark:text-white/80">{tool.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics Covered - Clickable to open topic tray */}
          {project.topics && project.topics.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.topics.slice(0, 6).map((topic: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => openTopicTray(topic)}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors cursor-pointer"
                  >
                    #{topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Original Author Attribution */}
          {originalAuthor && (
            <p className="text-gray-400 dark:text-white/40 text-sm mb-8">
              Originally written by <span className="text-gray-500 dark:text-white/60">{originalAuthor}</span>
            </p>
          )}

          {/* Call to Action - Read Full Article */}
          {sourceLink && (
            <div className="mb-10">
              <a
                href={sourceLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group"
                style={{
                  background: `linear-gradient(135deg, ${categoryFromColor}, ${categoryToColor})`,
                  boxShadow: `0 4px 20px ${categoryFromColor}40`,
                }}
              >
                <span>Read Full Article</span>
                <ArrowTopRightOnSquareIcon className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <p className="mt-3 text-gray-400 dark:text-white/40 text-sm">
                {sourceLink.label?.replace('Read full article on ', 'Source: ') || 'View original source'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-6 border-t border-gray-200 dark:border-white/10">
            <ProjectActions
              isLiked={isLiked}
              heartCount={heartCount}
              isLiking={isLiking}
              isAuthenticated={isAuthenticated}
              onLikeClick={toggleLike}
              likeRewardId={likeRewardId}
              onCommentClick={openCommentTray}
              onShareClick={openShareModal}
              externalUrl={project.externalUrl}
              variant="hero"
            />
          </div>
        </div>
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
          onClose={() => setIsToolTrayOpen(false)}
          toolSlug={selectedToolSlug}
        />
      )}

      {/* Admin Edit Button - Fixed position */}
      {canEdit && !isAdminPanelOpen && (
        <button
          onClick={() => {
            setEditTitle(project.title);
            setEditDescription(project.description || '');
            setIsAdminPanelOpen(true);
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-all hover:scale-105"
          title="Admin Edit"
        >
          <PencilIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Edit</span>
        </button>
      )}

      {/* Admin Edit Panel - Slide-in from right */}
      {canEdit && isAdminPanelOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <PencilIcon className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Edit</h3>
            </div>
            <button
              onClick={() => setIsAdminPanelOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Error Display */}
            {adminError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{adminError}</p>
              </div>
            )}

            {/* Title Edit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Description/Expert Review Edit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expert Review
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                placeholder="Use ## headers for sections..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tip: Use ## Header to create sections
              </p>
            </div>

            {/* Save Text Changes Button */}
            <button
              onClick={handleSaveTextChanges}
              disabled={isSaving || (editTitle === project.title && editDescription === project.description)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Save Text Changes
                </>
              )}
            </button>

            {/* Tools, Categories, and Topics Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Tools & Tags
              </h4>

              {/* Tools Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tools Mentioned
                </label>
                {/* Search Input */}
                <input
                  type="text"
                  value={toolSearchQuery}
                  onChange={(e) => setToolSearchQuery(e.target.value)}
                  placeholder="Search tools..."
                  className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {/* Selected Tools */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedToolIds.map(toolId => {
                    const tool = availableTools.find(t => t.id === toolId);
                    if (!tool) return null;
                    return (
                      <span
                        key={toolId}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700"
                      >
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt="" className="w-3 h-3 rounded" />
                        )}
                        {tool.name}
                        <button
                          onClick={() => handleToggleTool(toolId)}
                          className="ml-1 hover:text-red-500"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {/* Available Tools Dropdown */}
                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  {filteredTools.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No tools found</p>
                  ) : (
                    filteredTools.slice(0, 20).map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => handleToggleTool(tool.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          selectedToolIds.includes(tool.id)
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt="" className="w-4 h-4 rounded" />
                        )}
                        <span>{tool.name}</span>
                        {selectedToolIds.includes(tool.id) && (
                          <CheckIcon className="w-4 h-4 ml-auto" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Categories Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => handleToggleCategory(category.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        selectedCategoryIds.includes(category.id)
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics (Freeform Tags) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topics
                </label>
                {/* Current Topics */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                    >
                      <TagIcon className="w-3 h-3" />
                      {topic}
                      <button
                        onClick={() => handleRemoveTopic(topic)}
                        className="ml-1 hover:text-red-500"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Add New Topic */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTopic();
                      }
                    }}
                    placeholder="Add a topic..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTopic}
                    disabled={!newTopic.trim()}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Save Tags Button */}
              <button
                onClick={handleSaveTags}
                disabled={isSavingTags}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isSavingTags ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Saving Tags...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Save Tools & Tags
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4" />
                Regenerate Hero Image
              </h4>

              {/* Current Image Preview */}
              {project.featuredImageUrl && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Current Image:</p>
                  <img
                    src={project.featuredImageUrl}
                    alt="Current hero"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Visual Style Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visual Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VISUAL_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedVisualStyle(style.id)}
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        selectedVisualStyle === style.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{style.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{style.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Regenerate Button */}
              <button
                onClick={handleRegenerateImage}
                disabled={isRegenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all disabled:cursor-not-allowed"
              >
                {isRegenerating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Generating with Gemini...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-5 h-5" />
                    Regenerate Image
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                Uses Gemini AI to generate a new hero image based on the article content
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for admin panel */}
      {canEdit && isAdminPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsAdminPanelOpen(false)}
        />
      )}
    </>
  );
}
