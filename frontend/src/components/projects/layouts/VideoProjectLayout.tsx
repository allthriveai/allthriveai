/**
 * VideoProjectLayout - Layout optimized for video projects (YouTube, etc.)
 *
 * Features a full-width video player at the top with project details below.
 * Designed for curated YouTube content where the video is the primary focus.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProjectContext } from '@/context/ProjectContext';
import { updateProject } from '@/services/projects';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
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

  // Extract video info from content
  const videoContent = project.content?.video || {};
  const sectionContent = project.content?.sections?.[0]?.content || {};
  const videoId = videoContent.videoId || sectionContent.videoId;
  const channelName = videoContent.channelName || '';
  const channelId = videoContent.channelId || '';

  // Detect if this is a YouTube Short (vertical video)
  // Check both video metadata and section content for isShort flag
  const isShort = videoContent.isShort || sectionContent.isShort || false;
  const duration = videoContent.duration || sectionContent.duration || 0;

  // Build YouTube embed URL - disable autoplay for desktop/tablet
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0` : null;
  const youtubeUrl = videoId
    ? (isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`)
    : project.externalUrl;
  const channelUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : null;

  return (
    <>
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

        {/* Video Player - Responsive layout for Shorts (9:16) vs Regular (16:9) */}
        {isShort ? (
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
          // Regular video - 16:9 aspect ratio, full width
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {project.title}
            </h1>

            {/* Channel and Date Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {channelName && channelUrl && (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {channelName}
                </a>
              )}
              <span>•</span>
              <span>
                {new Date(project.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <span>•</span>
              <span>Curated by</span>
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
              externalUrl={youtubeUrl}
              variant="compact"
            />
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {project.description}
            </p>
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

        {/* Topics Pills */}
        {project.topics && project.topics.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topics</p>
            <div className="flex flex-wrap gap-2">
              {project.topics.map((topic, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700"
                >
                  {topic}
                </span>
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
