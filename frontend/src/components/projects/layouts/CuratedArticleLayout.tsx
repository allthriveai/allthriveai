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
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';
import { useProjectContext } from '@/context/ProjectContext';
import { getCategoryColors } from '@/utils/categoryColors';
import { ProjectActions } from '../shared/ProjectActions';
import { ShareModal } from '../shared/ShareModal';
import { CommentTray } from '../CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';

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
  } = useProjectContext();

  // Tool tray state
  const [isToolTrayOpen, setIsToolTrayOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');

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
  const expertReview = project.description || overview?.content?.description || '';

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

          {/* Topics Covered */}
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
    </>
  );
}
