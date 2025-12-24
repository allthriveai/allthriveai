/**
 * ClippedArticleLayout - Clean "mini landing page" for clipped web content
 *
 * Design philosophy: "Look at this cool thing I found"
 * The focus is on the SOURCE content, not user commentary.
 *
 * Layout:
 * 1. Hero image (big, beautiful)
 * 2. Title + source attribution
 * 3. Overview/description
 * 4. Key features (if extracted)
 * 5. Gallery (images from the page)
 * 6. Topics/tags
 * 7. Footer with clipper info + social actions
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { useProjectContext } from '@/context/ProjectContext';
import { updateProject, getTaxonomies } from '@/services/projects';
import { getCategoryColors } from '@/utils/categoryColors';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import {
  InlineEditableTitle,
  EditModeIndicator,
} from '../shared/InlineEditable';
import { TldrSection } from '../shared/TldrSection';
import { InlineToolsEditor } from '../shared/InlineToolsEditor';
import { ProjectSections } from '../sections';
import type { ProjectSection, SectionType } from '@/types/sections';
import { createDefaultSectionContent, generateSectionId } from '@/types/sections';
import type { Taxonomy } from '@/types/models';

/**
 * Extract domain from URL for display
 */
function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'external link';
  }
}

/**
 * Get favicon URL for a domain
 */
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function ClippedArticleLayout() {
  const {
    project,
    setProject,
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
    isAuthenticated,
  } = useProjectContext();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allCategories, setAllCategories] = useState<Taxonomy[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);

  // Computed editing state
  const isEditing = isOwner && isEditMode;

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Fetch categories when picker opens
  useEffect(() => {
    if (showCategoryPicker && allCategories.length === 0 && !categoriesLoading) {
      setCategoriesLoading(true);
      getTaxonomies('category')
        .then(setAllCategories)
        .catch(console.error)
        .finally(() => setCategoriesLoading(false));
    }
  }, [showCategoryPicker, allCategories.length, categoriesLoading]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(event.target as Node)) {
        setShowCategoryPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to filter content keys to only allowed ones for updates
  // Note: We exclude large read-only data (github, figma, reddit) that was imported
  const filterContentKeys = useCallback((contentObj: Record<string, unknown> | undefined): Record<string, unknown> => {
    const allowedKeys = [
      'blocks', 'cover', 'tags', 'metadata',
      'heroDisplayMode', 'heroQuote', 'heroVideoUrl', 'heroSlideshowImages',
      'heroSlideUpElement1', 'heroSlideUpElement2', 'heroGradientFrom', 'heroGradientTo',
      'templateVersion', 'sections', 'tldrBgColor', 'techStack', 'video'
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

  // Handle inline title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    try {
      const updated = await updateProject(project.id, { title: newTitle });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }, [project.id, setProject]);

  // Handle tools change
  const handleToolsChange = useCallback(async (toolIds: number[]) => {
    try {
      setIsSaving(true);
      const updated = await updateProject(project.id, { tools: toolIds });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update tools:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [project.id, setProject]);

  // Handle category change
  const handleCategoryChange = useCallback(async (categoryId: number) => {
    try {
      const updated = await updateProject(project.id, { categories: [categoryId] });
      setProject(updated);
      setShowCategoryPicker(false);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  }, [project.id, setProject]);

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error('Failed to reorder sections:', error);
      setProject(originalProject);
    }
  }, [project, setProject, filterContentKeys]);

  // Get category colors
  const primaryCategory = project.categoriesDetails?.[0];
  const { from: categoryFromColor, to: categoryToColor } = getCategoryColors(
    primaryCategory?.color,
    project.id
  );

  // Get source URL and domain
  const sourceUrl = project.externalUrl;
  const sourceDomain = sourceUrl ? getDomainFromUrl(sourceUrl) : null;
  const faviconUrl = sourceUrl ? getFaviconUrl(sourceUrl) : '';

  // Parse sections from content (template v2)
  const sections = useMemo(() => {
    const content = project.content as { sections?: ProjectSection[] } | undefined;
    return content?.sections || [];
  }, [project.content]);

  // Get hero image
  const heroImage = project.featuredImageUrl || project.bannerUrl;

  // Format date
  const savedDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full bg-white dark:bg-gray-950">
        {/* Hero Image - Full Width */}
        {heroImage && (
          <div className="relative w-full aspect-[21/9] max-h-[500px] overflow-hidden">
            <img
              src={heroImage}
              alt={project.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-gray-950 via-transparent to-transparent" />
          </div>
        )}

        {/* Content Container */}
        <div className="relative max-w-4xl mx-auto px-6 sm:px-8">
          {/* Owner Menu */}
          {isOwner && (
            <div className="absolute top-4 right-4 z-30">
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <EllipsisVerticalIcon className="w-6 h-6" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* If no hero, add some top padding */}
          {!heroImage && <div className="pt-16" />}

          {/* Title & Source - Positioned to overlap hero slightly */}
          <div className={heroImage ? '-mt-24 relative z-10' : ''}>
            {/* Category Badge - editable for owners */}
            {isEditing ? (
              <div className="relative inline-block mb-4" ref={categoryPickerRef}>
                <button
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                  className="group flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full border backdrop-blur-xl shadow-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: `${categoryFromColor}20`,
                    borderColor: `${categoryFromColor}40`,
                    color: categoryFromColor,
                  }}
                >
                  {primaryCategory?.name || 'Select Category'}
                  <ChevronDownIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                </button>
                {showCategoryPicker && (
                  <div className="absolute top-full left-0 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl z-50">
                    {categoriesLoading ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
                    ) : (
                      <div className="p-2">
                        {allCategories.map((category) => {
                          const { from: catColor } = getCategoryColors(category.color, category.id);
                          const isSelected = primaryCategory?.id === category.id;
                          return (
                            <button
                              key={category.id}
                              onClick={() => handleCategoryChange(category.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                                isSelected
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: catColor }}
                              />
                              {category.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : primaryCategory ? (
              <span
                className="inline-block px-4 py-1.5 text-sm font-semibold rounded-full border backdrop-blur-xl shadow-lg mb-4"
                style={{
                  backgroundColor: `${categoryFromColor}20`,
                  borderColor: `${categoryFromColor}40`,
                  color: categoryFromColor,
                }}
              >
                {primaryCategory.name}
              </span>
            ) : null}

            {/* Title - Inline Editable for Owners */}
            <InlineEditableTitle
              value={project.title}
              isEditable={isEditing}
              onChange={handleTitleChange}
              placeholder="Enter title..."
              className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6"
              as="h1"
            />

            {/* Source Attribution Bar */}
            {sourceUrl && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 mb-8">
                {/* Favicon + Domain */}
                <div className="flex items-center gap-3 flex-1">
                  {faviconUrl && (
                    <img
                      src={faviconUrl}
                      alt=""
                      className="w-6 h-6 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <GlobeAltIcon className="w-4 h-4" />
                    <span className="font-medium">{sourceDomain}</span>
                  </div>
                </div>

                {/* Visit Source Button */}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${categoryFromColor}, ${categoryToColor})`,
                  }}
                >
                  <span>Visit Site</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {/* Description/TL;DR - editable for owners */}
          {(project.description || isEditing) && (
            <div className="mb-12">
              <TldrSection
                project={project}
                isEditing={isEditing}
                onProjectUpdate={setProject}
                darkMode={false}
              />
            </div>
          )}

          {/* Project Sections - Full CRUD support */}
          {(sections.length > 0 || isEditing) && (
            <div className="mb-12">
              <ProjectSections
                sections={sections}
                isEditing={isEditing}
                onSectionUpdate={handleSectionUpdate}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onReorderSections={handleReorderSections}
              />
            </div>
          )}

          {/* Tools - editable for owners */}
          {(isEditing || (project.toolsDetails && project.toolsDetails.length > 0)) && (
            <div className="mb-12">
              <InlineToolsEditor
                tools={project.toolsDetails || []}
                toolIds={project.tools || []}
                isEditing={isEditing}
                onToolClick={openToolTray}
                onToolsChange={handleToolsChange}
                isSaving={isSaving}
                darkMode={false}
              />
            </div>
          )}

          {/* Topics */}
          {project.topicsDetails && project.topicsDetails.length > 0 && (
            <div className="mb-12">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.topicsDetails.slice(0, 8).map((topic: Taxonomy) => (
                  <span
                    key={topic.id}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                  >
                    {topic.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer - Clipper Info + Actions */}
          <div className="py-8 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Clipped By */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <FontAwesomeIcon icon={faPaperclip} className="w-4 h-4" />
                  <span className="text-sm">Clipped by</span>
                </div>
                <Link
                  to={`/${project.username}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {project.userAvatarUrl ? (
                    <img
                      src={project.userAvatarUrl}
                      alt={project.username}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    @{project.username}
                  </span>
                </Link>
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  · {savedDate}
                </span>
              </div>

              {/* Action Buttons */}
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
                variant="compact"
              />
            </div>
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
        <ToolTray isOpen={isToolTrayOpen} onClose={closeToolTray} toolSlug={selectedToolSlug} />
      )}

      {/* Edit Mode Indicator */}
      <EditModeIndicator
        isOwner={isOwner}
        isEditMode={isEditMode}
        onToggle={toggleEditMode}
        isSaving={isSaving}
      />
    </>
  );
}
