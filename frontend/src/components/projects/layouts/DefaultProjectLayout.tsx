/**
 * DefaultProjectLayout - Standard layout for projects without specialized layouts
 *
 * Used for: prompts, image collections, and any new project types.
 * Renders the full-height hero section with project details below.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { renderContent } from '@/utils/markdown';
import { useProjectContext } from '@/contexts/ProjectContext';
import { updateProject } from '@/services/projects';
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
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { ProjectEditTray } from '../ProjectEditTray';
import {
  CodeBracketIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

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
    isEditTrayOpen,
    openEditTray,
    closeEditTray,
    handleDelete,
    handleToggleShowcase,
    isAuthenticated,
  } = useProjectContext();

  const [showMenu, setShowMenu] = useState(false);
  const [showToolTray, setShowToolTray] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);

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

  // Filter out placeholder/empty blocks
  const visibleBlocks = project.content?.blocks?.filter(
    (block, index) => !isPlaceholderBlock(block, index, project.title)
  ) || [];

  // Check for template v2 sections
  const hasTemplateSections = project.content?.templateVersion === 2 && project.content?.sections?.length > 0;

  return (
    <>
      {/* Edit Mode Indicator for Owners */}
      <EditModeIndicator isOwner={isOwner} />

      {/* Full Height Hero Section */}
      <div className="relative min-h-screen w-full flex items-center overflow-hidden bg-gray-900">
        {/* Background Layer */}
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
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-900/40 backdrop-blur-[1px]" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-900 to-gray-900" />
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
                        setShowMenu(false);
                        openEditTray();
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PencilIcon className="w-4 h-4" />
                        Quick Edit
                      </div>
                      <kbd className="px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">E</kbd>
                    </button>
                    <button
                      onClick={() => {
                        handleToggleShowcase();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                    >
                      {project.isShowcase ? (
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
                {/* Author Badge */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 text-white/90 text-sm shadow-lg">
                    <span className="font-light opacity-70">by</span>
                    <Link to={`/${project.username}`} className="font-semibold hover:text-primary-300 transition-colors">
                      @{project.username}
                    </Link>
                  </div>
                  <span className="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {/* Title - Inline Editable for Owners */}
                <InlineEditableTitle
                  value={project.title}
                  isEditable={isOwner}
                  onChange={handleTitleChange}
                  placeholder="Enter project title..."
                  className="text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 tracking-tight leading-tight drop-shadow-2xl"
                  as="h1"
                />
              </div>

              {/* Description - Inline Editable for Owners */}
              {(project.description || isOwner) && (
                <div className="relative p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-400 to-secondary-400 opacity-80" />
                  {isOwner ? (
                    <InlineEditableText
                      value={project.description || ''}
                      isEditable={isOwner}
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
                        onClick={() => {
                          setSelectedToolSlug(tool.slug);
                          setShowToolTray(true);
                        }}
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
                onToolClick={(slug) => {
                  setSelectedToolSlug(slug);
                  setShowToolTray(true);
                }}
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

      {/* Project Details Section - show for owners even if empty (so they can add blocks) */}
      {hasTemplateSections ? (
        <ProjectSections sections={project.content.sections} />
      ) : (visibleBlocks.length > 0 || isOwner) && (
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Project Details</h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Content Blocks - full CRUD with add/remove/reorder */}
          <EditableBlocksContainer
            project={project}
            isOwner={isOwner}
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
          isOpen={showToolTray}
          onClose={() => {
            setShowToolTray(false);
            setSelectedToolSlug(null);
          }}
          toolSlug={selectedToolSlug}
        />
      )}

      {/* Edit Tray */}
      <ProjectEditTray
        isOpen={isEditTrayOpen}
        onClose={closeEditTray}
        project={project}
        onProjectUpdate={setProject}
      />
    </>
  );
}
