import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { useReward } from 'react-rewards';
import { toggleProjectLike } from '@/services/projects';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import {
  ChatBubbleLeftRightIcon,
  ArrowUpIcon,
  ClockIcon,
  UserIcon,
  LinkIcon,
  HeartIcon,
  ShareIcon,
  ArrowLeftIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface RedditThreadLayoutProps {
  project: Project;
}

export function RedditThreadLayout({ project }: RedditThreadLayoutProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [localProject, setLocalProject] = useState(project);
  const [isLiking, setIsLiking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFeedbackSidebarOpen, setIsFeedbackSidebarOpen] = useState(false);

  const redditData = localProject.content?.reddit;

  // Debug logging
  console.log('RedditThreadLayout - redditData:', redditData);
  console.log('RedditThreadLayout - thumbnail_url:', redditData?.thumbnail_url);
  console.log('RedditThreadLayout - thumbnailUrl:', redditData?.thumbnailUrl);
  console.log('RedditThreadLayout - selftext:', redditData?.selftext?.substring(0, 100));
  console.log('RedditThreadLayout - selftext_html:', redditData?.selftext_html?.substring(0, 200));

  // React Rewards for project likes
  const { reward: rewardLike } = useReward('likeReward', 'emoji', {
    emoji: ['💗'],
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
  });

  if (!redditData) {
    return null;
  }

  const {
    subreddit,
    author,
    permalink,
    score,
    numComments,
    num_comments,
    createdUtc,
    created_utc,
    thumbnailUrl,
    thumbnail_url,
    selftext,
    selftextHtml,
    selftext_html,
    upvoteRatio,
    upvote_ratio,
    linkFlairText,
    link_flair_text,
    linkFlairBackgroundColor,
    link_flair_background_color,
  } = redditData;
  
  // Handle both snake_case and camelCase
  const thumbnailImage = thumbnailUrl || thumbnail_url;
  const postSelftext = selftext || '';
  const postSelftextHtml = selftextHtml || selftext_html || '';
  const upvotePercentage = upvoteRatio || upvote_ratio || 0;
  const linkFlair = linkFlairText || link_flair_text || '';
  const linkFlairBgColor = linkFlairBackgroundColor || link_flair_background_color || '';
  const commentCount = numComments || num_comments || 0;
  const postScore = score || 0;

  // Clean author name (remove /u/ prefix if present)
  const cleanAuthor = author?.replace(/^\/u\//, '') || 'unknown';

  // Extract clean post content from description (strip HTML and convert to markdown)
  const extractPostContent = (description: string): string => {
    if (!description) return '';

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = description;

    // Get the markdown content div if it exists
    const mdDiv = tempDiv.querySelector('.md');
    const textContent = mdDiv ? mdDiv.textContent : tempDiv.textContent;

    // Clean up extra whitespace and return
    return textContent?.trim() || '';
  };

  const postContent = extractPostContent(localProject.description || '');

  // Convert markdown to HTML for rendering
  const postContentHtml = postContent ? marked.parse(postContent) as string : '';

  // Format the date
  const postDate = createdUtc || created_utc;
  const formattedDate = postDate
    ? new Date(postDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const handleToggleLike = async () => {
    if (!isAuthenticated) return;

    setIsLiking(true);
    try {
      const result = await toggleProjectLike(localProject.id);
      setLocalProject({
        ...localProject,
        isLikedByUser: result.liked,
        heartCount: result.heartCount,
      });

      if (result.liked) {
        rewardLike();
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/${localProject.username}/${localProject.slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const getShareUrls = () => {
    const shareUrl = encodeURIComponent(`${window.location.origin}/${localProject.username}/${localProject.slug}`);
    const title = encodeURIComponent(localProject.title);
    const text = encodeURIComponent(`Check out "${localProject.title}" - Reddit discussion from r/${subreddit}`);

    return {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      reddit: `https://reddit.com/submit?url=${shareUrl}&title=${title}`,
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-primary-900">
      {/* Navigation Bar with Glassmorphism */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-gray-900/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects/explore')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Explore</span>
              </button>
              <Link
                to={`/${localProject.username}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="hidden sm:inline">@{localProject.username}</span>
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                id="likeReward"
                onClick={handleToggleLike}
                disabled={!isAuthenticated || isLiking}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all backdrop-blur-md border ${
                  localProject.isLikedByUser
                    ? 'bg-pink-500/90 border-pink-400/50 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {localProject.isLikedByUser ? (
                  <HeartIconSolid className="w-5 h-5" />
                ) : (
                  <HeartIcon className="w-5 h-5" />
                )}
                <span>{localProject.heartCount}</span>
              </button>

              <button
                onClick={() => setIsFeedbackSidebarOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
              >
                <ShareIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Card with Glassmorphism */}
        <div className="relative mb-8">
          {/* Glowing backdrop */}
          <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-50" />

          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Thumbnail Hero Image */}
            {thumbnailImage && thumbnailImage !== 'self' && thumbnailImage !== 'default' && (
              <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center min-h-[400px] relative overflow-hidden">
                {/* Blurred background */}
                <div
                  className="absolute inset-0 blur-2xl opacity-40"
                  style={{
                    backgroundImage: `url(${thumbnailImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Sharp image in center */}
                <img
                  src={thumbnailImage}
                  alt={localProject.title}
                  className="relative z-10 max-w-full max-h-[800px] w-auto object-contain shadow-2xl"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.parentElement?.style?.setProperty('display', 'none');
                  }}
                />
              </div>
            )}

            <div className="p-8">
              {/* Subreddit, Flair, and Author */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-400/30 backdrop-blur-md">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-semibold text-orange-300">r/{subreddit}</span>
                </div>

                <a 
                  href={`https://www.reddit.com/user/${cleanAuthor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 backdrop-blur-md hover:bg-blue-500/30 transition-colors"
                >
                  <UserIcon className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-blue-300">u/{cleanAuthor}</span>
                </a>

                {linkFlair && (
                  <div 
                    className="px-4 py-2 rounded-xl font-semibold text-sm border backdrop-blur-md"
                    style={{
                      backgroundColor: linkFlairBgColor ? `${linkFlairBgColor}40` : 'rgba(99, 102, 241, 0.2)',
                      borderColor: linkFlairBgColor ? `${linkFlairBgColor}60` : 'rgba(99, 102, 241, 0.3)',
                      color: '#e0e7ff',
                    }}
                  >
                    {linkFlair}
                  </div>
                )}
              </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {localProject.title}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-6 text-white/70 mb-6">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                <span>u/{cleanAuthor}</span>
              </div>
              {formattedDate && (
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>

            {/* Post Selftext Content */}
            {(postSelftextHtml || postSelftext) && (
              <div className="mb-6">
                <div className="prose prose-lg prose-invert max-w-none p-6 rounded-xl bg-white/5 border border-white/10">
                  {postSelftextHtml ? (
                    <div 
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(postSelftextHtml)
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {postSelftext}
                    </div>
                  )}
                </div>
              </div>
            )}

              {/* View on Reddit CTA */}
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] transition-all"
                >
                  <LinkIcon className="w-5 h-5" />
                  View Full Discussion on Reddit
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="relative">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">Discussion Details</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-white/60">Community</span>
                <span className="text-white font-semibold">r/{subreddit}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10 bg-white/5 -mx-8 px-8 py-4">
                <span className="text-white/60">Original Author</span>
                <a 
                  href={`https://www.reddit.com/user/${cleanAuthor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white font-bold hover:text-orange-400 transition-colors"
                >
                  <UserIcon className="w-5 h-5" />
                  <span>u/{cleanAuthor}</span>
                </a>
              </div>
              {postScore > 0 && (
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-white/60">Reddit Score</span>
                  <span className="text-white font-semibold">{postScore.toLocaleString()} upvotes</span>
                </div>
              )}
              {commentCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Reddit Comments</span>
                  <span className="text-white font-semibold">{commentCount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="mt-8 p-6 rounded-xl bg-orange-500/10 border border-orange-400/30 backdrop-blur-md">
              <h3 className="text-orange-300 font-semibold mb-2 flex items-center gap-2">
                <span className="text-xl">⚠️</span> Disclaimer
              </h3>
              <p className="text-orange-200/80 text-sm leading-relaxed">
                This content was originally posted on Reddit by <strong>u/{cleanAuthor}</strong> and is not created, owned, or affiliated with AllThrive. 
                We curate these discussions to help our community find valuable AI insights. 
                All credit belongs to the original authors.
              </p>
            </div>
          </div>
        </div>

        {/* AllThrive Metadata Card */}
        <div className="relative mt-8">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">AllThrive</h2>

            <div className="space-y-6">
              {/* Tools */}
              {localProject.tools && localProject.tools.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-3">Tools</h3>
                  <div className="flex flex-wrap gap-2">
                    {localProject.tools.map((tool) => (
                      <span
                        key={tool.id}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-sm font-medium"
                      >
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {localProject.categories && localProject.categories.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-3">Category</h3>
                  <div className="flex flex-wrap gap-2">
                    {localProject.categories.map((category) => (
                      <span
                        key={category.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              {localProject.topics && localProject.topics.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-3">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {localProject.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-200 text-sm font-medium"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6">Share Thread</h3>

            <div className="space-y-3 mb-6">
              <a
                href={getShareUrls().twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 border border-[#1DA1F2]/30 text-white transition-colors"
              >
                <span className="font-medium">Share on X (Twitter)</span>
              </a>

              <a
                href={getShareUrls().linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 border border-[#0A66C2]/30 text-white transition-colors"
              >
                <span className="font-medium">Share on LinkedIn</span>
              </a>

              <a
                href={getShareUrls().reddit}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#FF4500]/20 hover:bg-[#FF4500]/30 border border-[#FF4500]/30 text-white transition-colors"
              >
                <span className="font-medium">Share on Reddit</span>
              </a>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
              >
                {linkCopied ? (
                  <span className="text-green-400 font-medium">Link Copied!</span>
                ) : (
                  <>
                    <LinkIcon className="w-5 h-5" />
                    <span className="font-medium">Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Sidebar - You can expand this similar to ProjectDetailPage */}
      {isFeedbackSidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsFeedbackSidebarOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[500px] bg-gray-900 border-l border-white/10 shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Comments</h3>
                <button
                  onClick={() => setIsFeedbackSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-white/60 text-sm">
                Comments feature coming soon for Reddit threads!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
