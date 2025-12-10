/**
 * ClippedArticleLayout - Beautiful layout for user-clipped web content
 *
 * Features:
 * - Hero section with category-colored gradient background
 * - Prominent "Saved by" user information with avatar
 * - Editable "My Notes" section for user's personal thoughts
 * - "Visit Source" call-to-action button
 * - Category-themed accent colors throughout
 * - Full light/dark mode support
 * - Full editing capabilities for owners
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  UserIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { useProjectContext } from '@/context/ProjectContext';
import { getCategoryColors } from '@/utils/categoryColors';
import { updateProject } from '@/services/projects';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import {
  InlineEditableTitle,
  InlineEditableText,
  EditModeIndicator,
} from '../shared/InlineEditable';

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
    handleToggleShowcase,
    isAuthenticated,
  } = useProjectContext();

  const [showMenu, setShowMenu] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Toggle between edit and published view
  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  // Computed editing state - must be owner AND in edit mode
  const isEditing = isOwner && isEditMode;

  // Handle inline title change
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setIsSaving(true);
      try {
        const updated = await updateProject(project.id, { title: newTitle });
        setProject(updated);
      } catch (error) {
        console.error('Failed to update title:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [project.id, setProject]
  );

  // Handle inline description change
  const handleDescriptionChange = useCallback(
    async (newDescription: string) => {
      setIsSaving(true);
      try {
        const updated = await updateProject(project.id, { description: newDescription });
        setProject(updated);
      } catch (error) {
        console.error('Failed to update description:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [project.id, setProject]
  );

  // Get category colors
  const primaryCategory = project.categoriesDetails?.[0];
  const { from: categoryFromColor, to: categoryToColor } = getCategoryColors(
    primaryCategory?.color,
    project.id
  );

  // Get source URL and domain
  const sourceUrl = project.externalUrl;
  const sourceDomain = sourceUrl ? getDomainFromUrl(sourceUrl) : null;

  // Get user's notes (description)
  const userNotes = project.description || '';

  // Format date
  const savedDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      {/* Edit Mode Toggle for Owners */}
      <EditModeIndicator
        isOwner={isOwner}
        isEditMode={isEditMode}
        onToggle={toggleEditMode}
        isSaving={isSaving}
      />

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
              background: `linear-gradient(to right, transparent, ${categoryFromColor}50, transparent)`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          {/* Owner Menu */}
          {isOwner && (
            <div className="absolute top-4 right-4 z-30">
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors backdrop-blur-md"
                >
                  <EllipsisVerticalIcon className="w-6 h-6" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        handleToggleShowcase();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
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
                      className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category Badge & Clipped Badge */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300 text-sm font-medium rounded-full border border-pink-500/20 dark:border-pink-500/30 backdrop-blur-sm">
              <FontAwesomeIcon icon={faPaperclip} className="w-3.5 h-3.5" />
              Saved
            </span>
            {sourceDomain && (
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                from {sourceDomain}
              </span>
            )}
          </div>

          {/* Title - Editable */}
          <div className="mb-8">
            <InlineEditableTitle
              value={project.title}
              isEditable={isEditing}
              onChange={handleTitleChange}
              placeholder="Enter a title..."
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight"
              as="h1"
            />
          </div>

          {/* User Info Card */}
          <div className="flex items-center gap-4 mb-10 p-4 bg-gray-100/80 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10">
            {/* Avatar with gradient ring */}
            <div
              className="relative w-14 h-14 rounded-full p-[2px] flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${categoryFromColor}, ${categoryToColor})`,
              }}
            >
              {project.userAvatarUrl ? (
                <img
                  src={project.userAvatarUrl}
                  alt={project.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-gray-500 dark:text-white/60" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-gray-500 dark:text-white/60 text-sm">Saved by</p>
              <Link
                to={`/${project.username}`}
                className="text-gray-900 dark:text-white font-semibold hover:underline truncate block"
              >
                @{project.username}
              </Link>
            </div>

            {/* Saved Date */}
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-white/50 text-sm flex-shrink-0">
              <ClockIcon className="w-4 h-4" />
              <span>{savedDate}</span>
            </div>
          </div>

          {/* My Notes Section - Editable */}
          <div className="mb-10">
            <h2
              className="text-lg font-semibold mb-4 uppercase tracking-wider"
              style={{ color: categoryFromColor }}
            >
              {isOwner ? 'My Notes' : 'Notes'}
            </h2>

            {isEditing ? (
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
                <InlineEditableText
                  value={userNotes}
                  isEditable={isEditing}
                  onChange={handleDescriptionChange}
                  placeholder="Add your thoughts about why you saved this..."
                  className="prose prose-lg dark:prose-invert max-w-none prose-p:text-gray-700 dark:prose-p:text-white/90 prose-p:leading-relaxed"
                  multiline
                  rows={4}
                />
              </div>
            ) : userNotes ? (
              <div className="prose prose-lg dark:prose-invert max-w-none prose-p:text-gray-700 dark:prose-p:text-white/90 prose-p:leading-relaxed">
                <p className="text-xl leading-relaxed">{userNotes}</p>
              </div>
            ) : isOwner ? (
              <button
                onClick={toggleEditMode}
                className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
              >
                Click "Edit" to add your notes about this saved item...
              </button>
            ) : (
              <p className="text-gray-400 dark:text-white/40 italic">No notes added yet.</p>
            )}
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
                    onClick={() => openToolTray(tool.slug)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
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

          {/* Topics */}
          {project.topics && project.topics.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.topics.slice(0, 6).map((topic: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70 border border-gray-200 dark:border-white/10"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Call to Action - Visit Source */}
          {sourceUrl && (
            <div className="mb-10">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group"
                style={{
                  background: `linear-gradient(135deg, ${categoryFromColor}, ${categoryToColor})`,
                  boxShadow: `0 4px 20px ${categoryFromColor}40`,
                }}
              >
                <span>Visit Source</span>
                <ArrowTopRightOnSquareIcon className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <p className="mt-3 text-gray-400 dark:text-white/40 text-sm">{sourceDomain}</p>
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
        <ToolTray isOpen={isToolTrayOpen} onClose={closeToolTray} toolSlug={selectedToolSlug} />
      )}
    </>
  );
}
