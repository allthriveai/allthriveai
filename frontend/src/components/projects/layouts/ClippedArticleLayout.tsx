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

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { useProjectContext } from '@/context/ProjectContext';
import { getCategoryColors } from '@/utils/categoryColors';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { OverviewSection } from '../sections/OverviewSection';
import { FeaturesSection } from '../sections/FeaturesSection';
import { GallerySection } from '../sections/GallerySection';
import { VideoSection } from '../sections/VideoSection';
import { LinksSection } from '../sections/LinksSection';
import type { ProjectSection, OverviewSectionContent, FeaturesSectionContent, GallerySectionContent, VideoSectionContent, LinksSectionContent } from '@/types/sections';

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
    isAuthenticated,
  } = useProjectContext();

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

  // Find specific sections
  const overviewSection = sections.find(s => s.type === 'overview' && s.enabled);
  const featuresSection = sections.find(s => s.type === 'features' && s.enabled);
  const videoSection = sections.find(s => s.type === 'video' && s.enabled);
  const gallerySection = sections.find(s => s.type === 'gallery' && s.enabled);
  const linksSection = sections.find(s => s.type === 'links' && s.enabled);

  // Debug logging
  console.log('ClippedArticleLayout sections:', sections.map(s => ({ type: s.type, enabled: s.enabled })));
  console.log('Video section found:', videoSection);

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
          {/* If no hero, add some top padding */}
          {!heroImage && <div className="pt-16" />}

          {/* Title & Source - Positioned to overlap hero slightly */}
          <div className={heroImage ? '-mt-24 relative z-10' : ''}>
            {/* Category Badge */}
            {primaryCategory && (
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
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
              {project.title}
            </h1>

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

          {/* Overview/Description */}
          {overviewSection ? (
            <div className="mb-12">
              <OverviewSection content={overviewSection.content as OverviewSectionContent} />
            </div>
          ) : project.description && (
            <div className="mb-12">
              <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          {/* Features Section */}
          {featuresSection && (
            <div className="mb-12">
              <FeaturesSection content={featuresSection.content as FeaturesSectionContent} />
            </div>
          )}

          {/* Video Section */}
          {videoSection && (
            <div className="mb-12">
              <VideoSection content={videoSection.content as VideoSectionContent} />
            </div>
          )}

          {/* Gallery Section */}
          {gallerySection && (
            <div className="mb-12">
              <GallerySection content={gallerySection.content as GallerySectionContent} />
            </div>
          )}

          {/* Links Section */}
          {linksSection && (
            <div className="mb-12">
              <LinksSection content={linksSection.content as LinksSectionContent} />
            </div>
          )}

          {/* Tools Mentioned */}
          {project.toolsDetails && project.toolsDetails.length > 0 && (
            <div className="mb-12">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Tools Mentioned
              </h3>
              <div className="flex flex-wrap gap-3">
                {project.toolsDetails.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => openToolTray(tool.slug)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {tool.logoUrl && (
                      <img
                        src={tool.logoUrl}
                        alt={tool.name}
                        className="w-5 h-5 rounded object-cover"
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tool.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {project.topics && project.topics.length > 0 && (
            <div className="mb-12">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-500 dark:text-white/50">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.topics.slice(0, 8).map((topic: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                  >
                    {topic}
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
    </>
  );
}
