/**
 * DefaultProjectLayout - Standard layout for projects without specialized layouts
 *
 * Used for: prompts, image collections, and any new project types.
 * Renders the full-height hero section with project details below.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { renderContent } from '@/utils/markdown';
import { useProjectContext } from '@/context/ProjectContext';
import { updateProject, getTaxonomies } from '@/services/projects';
import { ProjectHero } from '../hero';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '../shared/InlineEditable';
import { EditableBlocksContainer } from '../shared/EditableBlocksContainer';
import { ProjectSections } from '../sections';
import type { ProjectSection, SectionType } from '@/types/sections';
import { createDefaultSectionContent, generateSectionId } from '@/types/sections';
import type { Taxonomy } from '@/types/models';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import {
  CodeBracketIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  CalendarIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { getCategoryColors } from '@/utils/categoryColors';

/**
 * Strip HTML tags and normalize text for comparison.
 * Used to filter placeholder blocks that duplicate the title.
 */
function normalizeText(text: string | undefined | null): string {
  return (text || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
}

/**
 * Check if a content block is a placeholder heading that should be hidden.
 * Filters out: first block if it's a heading matching the project title or "untitled project"
 */
function isPlaceholderBlock(
  block: { type: string; style?: string; content?: string },
  index: number,
  projectTitle: string
): boolean {
  const isHeading = block.type === 'text' && block.style === 'heading';
  if (!isHeading || index !== 0) return false;

  const normalizedContent = normalizeText(block.content);
  return (
    normalizedContent === normalizeText(projectTitle) ||
    normalizedContent === 'untitled project'
  );
}

export function DefaultProjectLayout() {
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
    handleToggleShowcase,
    isAuthenticated,
  } = useProjectContext();

  const [showMenu, setShowMenu] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // Default to published view
  const [isSaving, setIsSaving] = useState(false);

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allCategories, setAllCategories] = useState<Taxonomy[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editedDate, setEditedDate] = useState<string>('');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Toggle between edit and published view
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  // Computed editing state - must be owner AND in edit mode
  const isEditing = isOwner && isEditMode;

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
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Handle date change (updates publishedDate which is the editable date field)
  const handleDateChange = useCallback(async (newDate: string) => {
    try {
      const updated = await updateProject(project.id, { publishedDate: newDate });
      setProject(updated);
      setShowDatePicker(false);
    } catch (error) {
      console.error('Failed to update date:', error);
    }
  }, [project.id, setProject]);

  // Get the display date - prefer publishedDate if set, otherwise createdAt
  const displayDate = project.publishedDate || project.createdAt;

  // Handle inline title change
  const handleTitleChange = useCallback(async (newTitle: string) => {
    try {
      const updated = await updateProject(project.id, { title: newTitle });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }, [project.id, setProject]);

  // Handle inline description change
  const handleDescriptionChange = useCallback(async (newDescription: string) => {
    try {
      const updated = await updateProject(project.id, { description: newDescription });
      setProject(updated);
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  }, [project.id, setProject]);

  // Helper to filter content keys to only allowed ones
  const filterContentKeys = useCallback((contentObj: Record<string, unknown> | undefined): Record<string, unknown> => {
    const allowedKeys = [
      'blocks', 'cover', 'tags', 'metadata',
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

    // Update the section content locally first for immediate feedback
    const updatedSections = project.content.sections.map((section: ProjectSection) =>
      section.id === sectionId ? { ...section, content } : section
    );

    // Update project with new sections (filter out read-only keys)
    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      sections: updatedSections,
    };

    // Store original for rollback
    const originalProject = project;

    // Optimistic update - show changes immediately
    setProject({ ...project, content: updatedContent });
    setIsSaving(true);

    try {
      // Save to backend
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: any) {
      console.error('Failed to update section:', error);
      console.error('Error details:', error?.response?.data || error?.message || error);
      // Rollback on error
      setProject(originalProject);
    } finally {
      setIsSaving(false);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle adding a new section
  const handleAddSection = useCallback(async (type: SectionType, afterSectionId?: string) => {
    // Ensure we have a valid project content with sections
    const currentSections = project.content?.sections || [];

    const newSection: ProjectSection = {
      id: generateSectionId(type),
      type,
      enabled: true,
      order: 0,
      content: createDefaultSectionContent(type),
    };

    // Determine insertion index
    // - If afterSectionId is undefined, insert at the beginning (index 0)
    // - If afterSectionId is provided, insert after that section
    let insertIndex = 0; // Default to beginning
    if (afterSectionId) {
      const afterIndex = currentSections.findIndex(s => s.id === afterSectionId);
      if (afterIndex !== -1) {
        insertIndex = afterIndex + 1;
      } else {
        // Section not found, add at end
        insertIndex = currentSections.length;
      }
    }

    // Insert and reorder
    const newSections = [...currentSections];
    newSections.splice(insertIndex, 0, newSection);

    // Update order values
    const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));

    // Use helper to filter out read-only keys
    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      templateVersion: 2 as const,
      sections: reorderedSections,
    };

    // Store original for rollback
    const originalProject = project;

    // Optimistic update
    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: any) {
      console.error('Failed to add section:', error?.response?.data || error);
      // Rollback on error
      setProject(originalProject);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle deleting a section
  const handleDeleteSection = useCallback(async (sectionId: string) => {
    if (!project.content?.sections) return;

    const newSections = project.content.sections
      .filter(s => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx }));

    // Use helper to filter out read-only keys
    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      sections: newSections,
    };

    // Optimistic update
    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: any) {
      console.error('Failed to delete section:', error);
    }
  }, [project, setProject, filterContentKeys]);

  // Handle reordering sections (drag-and-drop)
  const handleReorderSections = useCallback(async (reorderedSections: ProjectSection[]) => {
    // Use helper to filter out read-only keys
    const updatedContent = {
      ...filterContentKeys(project.content as Record<string, unknown>),
      templateVersion: 2 as const,
      sections: reorderedSections,
    };

    // Store original for rollback
    const originalProject = project;

    // Optimistic update
    setProject({ ...project, content: updatedContent });

    try {
      const updated = await updateProject(project.id, { content: updatedContent });
      setProject(updated);
    } catch (error: any) {
      console.error('Failed to reorder sections:', error?.response?.data || error);
      // Rollback on error
      setProject(originalProject);
    }
  }, [project, setProject, filterContentKeys]);

  // Filter out placeholder/empty blocks
  const visibleBlocks = project.content?.blocks?.filter(
    (block, index) => !isPlaceholderBlock(block, index, project.title)
  ) || [];

  // Check for template v2 sections
  const hasTemplateSections = project.content?.templateVersion === 2 && (project.content?.sections?.length ?? 0) > 0;

  return (
    <>
      {/* Edit Mode Toggle for Owners */}
      <EditModeIndicator isOwner={isOwner} isEditMode={isEditMode} onToggle={toggleEditMode} isSaving={isSaving} />

      {/* Full Height Hero Section */}
      {(() => {
        // Get category colors for consistent theming
        const primaryCategory = project.categoriesDetails?.[0];
        const { from: categoryFromColor, to: categoryToColor } = getCategoryColors(
          primaryCategory?.color,
          project.id
        );

        return (
      <div className="relative min-h-screen w-full flex items-center overflow-hidden bg-gray-900">
        {/* Background Layer - Category colored gradient with animated orbs */}
        <div className="absolute inset-0 z-0">
          {project.bannerUrl ? (
            <>
              <img
                src={project.bannerUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div
                className="absolute inset-0 backdrop-blur-[1px]"
                style={{
                  background: `linear-gradient(to right, rgba(10,10,18,0.95), rgba(10,10,18,0.7) 50%, ${categoryFromColor}20 100%)`
                }}
              />
            </>
          ) : (
            <>
              {/* Dark base with category-colored gradient orbs */}
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg, #0a0a12 0%, #0f1420 50%, #0a0a12 100%)`
                }}
              />
              {/* Animated category color orbs */}
              <div
                className="absolute top-0 left-0 w-[60%] h-[60%] rounded-full blur-[120px] opacity-30"
                style={{ background: categoryFromColor }}
              />
              <div
                className="absolute bottom-0 right-0 w-[50%] h-[50%] rounded-full blur-[100px] opacity-20"
                style={{ background: categoryToColor }}
              />
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full blur-[80px] opacity-15"
                style={{ background: categoryFromColor }}
              />
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${categoryFromColor}50, transparent)`
                }}
              />
            </>
          )}
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 md:py-8">
          {/* Owner Menu */}
          {isOwner && (
            <div className="absolute top-0 right-8 z-30">
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                >
                  <EllipsisVerticalIcon className="w-8 h-8" />
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

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center pt-6">
            {/* Left Column: Text Content */}
            <div className="space-y-6 lg:space-y-10">
              <div className="space-y-6 relative">
                {/* Author Badge & Category */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Category Badge - editable for owners */}
                  {isEditing ? (
                    <div className="relative" ref={categoryPickerRef}>
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
                        <div className="absolute top-full left-0 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl z-50">
                          {categoriesLoading ? (
                            <div className="p-4 text-center text-white/60 text-sm">Loading...</div>
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
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
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
                      className="px-4 py-1.5 text-sm font-semibold rounded-full border backdrop-blur-xl shadow-lg"
                      style={{
                        backgroundColor: `${categoryFromColor}20`,
                        borderColor: `${categoryFromColor}40`,
                        color: categoryFromColor,
                      }}
                    >
                      {primaryCategory.name}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 text-white/90 text-sm shadow-lg">
                    <span className="font-light opacity-70">by</span>
                    <Link to={`/${project.username}`} className="font-semibold hover:text-primary-300 transition-colors">
                      @{project.username}
                    </Link>
                  </div>
                  {/* Date - editable for owners */}
                  {isEditing ? (
                    <div className="relative" ref={datePickerRef}>
                      <button
                        onClick={() => {
                          setEditedDate(displayDate.split('T')[0]);
                          setShowDatePicker(!showDatePicker);
                        }}
                        className="group flex items-center gap-2 text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/5 hover:bg-black/30 hover:text-white/80 transition-colors"
                      >
                        <CalendarIcon className="w-4 h-4" />
                        {new Date(displayDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </button>
                      {showDatePicker && (
                        <div className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl z-50">
                          <input
                            type="date"
                            value={editedDate}
                            onChange={(e) => setEditedDate(e.target.value)}
                            className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-white/20 focus:border-primary-500 focus:outline-none text-sm"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setShowDatePicker(false)}
                              className="flex-1 px-3 py-1.5 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDateChange(editedDate)}
                              className="flex-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
                      {new Date(displayDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  )}
                </div>

                {/* Title - Inline Editable for Owners */}
                <div className="flex items-center gap-3 flex-wrap">
                  <InlineEditableTitle
                    value={project.title}
                    isEditable={isEditing}
                    onChange={handleTitleChange}
                    placeholder="Enter project title..."
                    className="text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 tracking-tight leading-tight drop-shadow-2xl"
                    as="h1"
                  />
                  {/* Clipped Badge */}
                  {project.type === 'clipped' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/20 text-pink-300 text-sm font-medium rounded-full border border-pink-500/30 backdrop-blur-sm">
                      <FontAwesomeIcon icon={faPaperclip} className="w-3.5 h-3.5" />
                      Clipped
                    </span>
                  )}
                </div>
              </div>

              {/* Description - Inline Editable for Owners */}
              {(project.description || isOwner) && (
                <div className="relative p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-400 to-secondary-400 opacity-80" />
                  {isEditing ? (
                    <InlineEditableText
                      value={project.description || ''}
                      isEditable={isEditing}
                      onChange={handleDescriptionChange}
                      placeholder="Add a description for your project..."
                      className="prose prose-lg prose-invert max-w-none pl-2"
                      multiline
                      rows={4}
                    />
                  ) : (
                    <div
                      className="prose prose-lg prose-invert max-w-none pl-2"
                      dangerouslySetInnerHTML={{
                        __html: renderContent(project.description || '')
                      }}
                    />
                  )}
                </div>
              )}

              {/* Tools Used */}
              {project.toolsDetails && project.toolsDetails.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] pl-1">Built With</p>
                  <div className="flex flex-wrap gap-3">
                    {project.toolsDetails.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => openToolTray(tool.slug)}
                        className="group flex items-center gap-2.5 px-4 py-2 bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/30 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                      >
                        {tool.logoUrl ? (
                          <img src={tool.logoUrl} alt={tool.name} className="w-5 h-5 rounded-md object-cover shadow-sm" />
                        ) : (
                          <CodeBracketIcon className="w-5 h-5 text-white/70" />
                        )}
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{tool.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {/* Action Buttons */}
              <div className="pt-6">
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

            {/* Right Column: Hero Display */}
            <div className="flex items-center justify-center perspective-1000">
              <ProjectHero
                project={project}
                onToolClick={openToolTray}
                onLikeToggle={toggleLike}
                onCommentClick={openCommentTray}
                isLiked={isLiked}
                heartCount={heartCount}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Project Details Section - show for owners even if empty (so they can add blocks) */}
      {hasTemplateSections ? (
        <ProjectSections
          sections={(project.content.sections || []) as import('@/types/sections').ProjectSection[]}
          isEditing={isEditing}
          onSectionUpdate={handleSectionUpdate}
          onAddSection={handleAddSection}
          onDeleteSection={handleDeleteSection}
          onReorderSections={handleReorderSections}
        />
      ) : (visibleBlocks.length > 0 || isOwner) && (
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Project Details</h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Content Blocks - full CRUD with add/remove/reorder */}
          <EditableBlocksContainer
            project={project}
            isOwner={isEditing}
            onProjectUpdate={setProject}
          />
        </div>
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
