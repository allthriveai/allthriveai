import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Tool, Taxonomy } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { useReward } from 'react-rewards';
import { toggleProjectLike, updateProjectTags, getTools, getTaxonomies } from '@/services/projects';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserIcon,
  LinkIcon,
  HeartIcon,
  ShareIcon,
  ArrowLeftIcon,
  PencilIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon,
  PlusIcon,
  TagIcon,
  WrenchScrewdriverIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

// Configure marked for Reddit-style markdown
marked.setOptions({
  breaks: true,  // Convert \n to <br>
  gfm: true,     // GitHub Flavored Markdown (strikethrough, tables, etc.)
});

// Reusable className constants
const ICON_BUTTON_CLASS = 'flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md';
const SECTION_HEADER_CLASS = 'text-sm font-semibold text-white/60 mb-3';
const TAG_CONTAINER_CLASS = 'flex flex-wrap gap-2';

interface RedditThreadLayoutProps {
  project: Project;
}

export function RedditThreadLayout({ project }: RedditThreadLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [localProject, setLocalProject] = useState(project);
  const [isLiking, setIsLiking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFeedbackSidebarOpen, setIsFeedbackSidebarOpen] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Admin check
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin;

  // Admin edit state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Taxonomy[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>(project.tools || []);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(project.categories || []);
  const [editTopics, setEditTopics] = useState<string[]>(project.topics || []);
  const [newTopic, setNewTopic] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);

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
      setSelectedToolIds(localProject.tools || []);
      setSelectedCategoryIds(localProject.categories || []);
      setEditTopics(localProject.topics || []);
    }
  }, [isAdminPanelOpen, canEdit, localProject.tools, localProject.categories, localProject.topics]);

  // Handle saving tools, categories, and topics
  const handleSaveTags = async () => {
    if (isSavingTags) return;
    setIsSavingTags(true);
    setAdminError(null);

    try {
      const updatedProject = await updateProjectTags(localProject.id, {
        tools: selectedToolIds,
        categories: selectedCategoryIds,
        topics: editTopics,
      });
      setLocalProject(updatedProject);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setAdminError(`Failed to save tags: ${errMsg}`);
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

  // Move tool up in the order
  const handleMoveToolUp = (toolId: number) => {
    setSelectedToolIds(prev => {
      const index = prev.indexOf(toolId);
      if (index <= 0) return prev;
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };

  // Move tool down in the order
  const handleMoveToolDown = (toolId: number) => {
    setSelectedToolIds(prev => {
      const index = prev.indexOf(toolId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
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

  const redditData = localProject.content?.reddit;

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
    linkFlairText,
    link_flair_text,
    linkFlairBackgroundColor,
    link_flair_background_color,
    isVideo,
    is_video,
    videoUrl,
    video_url,
  } = redditData;

  // Handle both snake_case and camelCase
  const thumbnailImage = thumbnailUrl || thumbnail_url;
  const postSelftext = selftext || '';
  const postSelftextHtml = selftextHtml || selftext_html || '';
  const linkFlair = linkFlairText || link_flair_text || '';
  const linkFlairBgColor = linkFlairBackgroundColor || link_flair_background_color || '';
  const commentCount = numComments || num_comments || 0;
  const postScore = score || 0;
  const hasVideo = isVideo || is_video || false;
  // Use heroVideoUrl from project content (downloaded videos) if available, otherwise use reddit metadata
  const postVideoUrl = localProject.content?.heroVideoUrl || videoUrl || video_url || '';

  // Clean author name (remove /u/ prefix if present)
  const cleanAuthor = author?.replace(/^\/u\//, '') || 'unknown';

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
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all backdrop-blur-md"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                id="likeReward"
                onClick={handleToggleLike}
                disabled={!isAuthenticated || isLiking}
                className={`flex items-center gap-2 px-4 py-2 font-semibold transition-all backdrop-blur-md border ${
                  localProject.isLikedByUser
                    ? 'bg-pink-500/90 border-pink-400/50 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ borderRadius: 'var(--radius)' }}
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
                className={ICON_BUTTON_CLASS}
                style={{ borderRadius: 'var(--radius)' }}
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className={ICON_BUTTON_CLASS}
                style={{ borderRadius: 'var(--radius)' }}
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
          <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-pink-500/20 blur-2xl opacity-50" style={{ borderRadius: '8px' }} />

          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl" style={{ borderRadius: 'var(--radius)' }}>
            {/* Video Player or Thumbnail Hero Image */}
            {hasVideo && postVideoUrl ? (
              <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  loop
                  playsInline
                  poster={thumbnailImage && thumbnailImage !== 'self' && thumbnailImage !== 'default' ? thumbnailImage : undefined}
                  className="w-full h-full object-contain"
                  preload="metadata"
                >
                  <source src={postVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                {/* Note: Only show warning for v.redd.it URLs (not our downloaded videos) */}
                {postVideoUrl.includes('v.redd.it') && (
                  <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-lg text-white/70 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>No audio available</span>
                    {permalink && (
                      <a href={permalink} target="_blank" rel="noopener noreferrer" className="underline hover:text-white ml-2">
                        Watch on Reddit
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : thumbnailImage && thumbnailImage !== 'self' && thumbnailImage !== 'default' ? (
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
            ) : null}

            <div className="p-8">
              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {localProject.title}
              </h1>

              {/* Subreddit, Author, Date, and Flair Pills - Below Title */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-400/30 backdrop-blur-md"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-semibold text-orange-300">r/{subreddit}</span>
                </div>

                <a
                  href={`https://www.reddit.com/user/${cleanAuthor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 backdrop-blur-md hover:bg-blue-500/30 transition-colors"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <UserIcon className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-blue-300">u/{cleanAuthor}</span>
                </a>

                {formattedDate && (
                  <div
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 backdrop-blur-md"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    <ClockIcon className="w-5 h-5 text-white/60" />
                    <span className="font-medium text-white/70">{formattedDate}</span>
                  </div>
                )}

                {linkFlair && (
                  <span
                    className="px-3 py-1.5 font-medium text-sm border backdrop-blur-md"
                    style={{
                      borderRadius: 'var(--radius)',
                      backgroundColor: linkFlairBgColor ? `${linkFlairBgColor}40` : 'rgba(99, 102, 241, 0.2)',
                      borderColor: linkFlairBgColor ? `${linkFlairBgColor}60` : 'rgba(99, 102, 241, 0.3)',
                      color: '#e0e7ff',
                    }}
                  >
                    {linkFlair}
                  </span>
                )}
              </div>

            {/* Post Selftext Content */}
            {(postSelftextHtml || postSelftext) && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-white/50 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
                  <span>Discussion</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                </h2>
                <div
                  className="reddit-prose max-w-none p-6 sm:p-8 bg-white/5 border border-white/10 backdrop-blur-md"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  {postSelftextHtml ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(postSelftextHtml)
                      }}
                    />
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(marked.parse(postSelftext) as string)
                      }}
                    />
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
                  className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] transition-all"
                  style={{ borderRadius: 'var(--radius)' }}
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
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 shadow-xl" style={{ borderRadius: 'var(--radius)' }}>
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
            <div
              className="mt-8 p-6 bg-orange-500/10 border border-orange-400/30 backdrop-blur-md"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <h3 className="text-orange-300 font-semibold mb-2 flex items-center gap-2">
                <span className="text-xl">⚠️</span> Disclaimer
              </h3>
              <p className="text-orange-200/80 text-sm leading-relaxed">
                This content was originally posted on Reddit by <strong>u/{cleanAuthor}</strong> and is not created, owned, or affiliated with All Thrive.
                We curate these discussions to help our community find valuable AI insights.
                All credit belongs to the original authors.
              </p>
            </div>
          </div>
        </div>

        {/* All Thrive Metadata Card */}
        <div className="relative mt-8">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 shadow-xl" style={{ borderRadius: 'var(--radius)' }}>
            <h2 className="text-2xl font-bold text-white mb-6">All Thrive</h2>

            <div className="space-y-6">
              {/* Tools */}
              {localProject.toolsDetails && localProject.toolsDetails.length > 0 && (
                <div>
                  <h3 className={SECTION_HEADER_CLASS}>Tools</h3>
                  <div className={TAG_CONTAINER_CLASS}>
                    {localProject.toolsDetails.map((tool) => (
                      <span
                        key={tool.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-sm font-medium"
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt={tool.name} className="w-4 h-4 rounded object-cover" />
                        )}
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories (hidden if hideCategories is true) */}
              {!localProject.hideCategories && localProject.categoriesDetails && localProject.categoriesDetails.length > 0 && (
                <div>
                  <h3 className={SECTION_HEADER_CLASS}>Category</h3>
                  <div className={TAG_CONTAINER_CLASS}>
                    {localProject.categoriesDetails.map((category) => (
                      <span
                        key={category.id}
                        className="px-3 py-1.5 bg-primary-500/20 border border-primary-400/30 text-primary-200 text-sm font-medium"
                        style={{ borderRadius: 'var(--radius)' }}
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
                  <h3 className={SECTION_HEADER_CLASS}>Topics</h3>
                  <div className={TAG_CONTAINER_CLASS}>
                    {localProject.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-purple-500/20 border border-purple-400/30 text-purple-200 text-sm font-medium"
                        style={{ borderRadius: 'var(--radius)' }}
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
          <div
            className="bg-gray-900 border border-white/10 shadow-2xl max-w-md w-full p-6 backdrop-blur-xl"
            style={{ borderRadius: 'var(--radius)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-6">Share Thread</h3>

            <div className="space-y-3 mb-6">
              <a
                href={getShareUrls().twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 border border-[#1DA1F2]/30 text-white transition-colors"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <span className="font-medium">Share on X (Twitter)</span>
              </a>

              <a
                href={getShareUrls().linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 border border-[#0A66C2]/30 text-white transition-colors"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <span className="font-medium">Share on LinkedIn</span>
              </a>

              <a
                href={getShareUrls().reddit}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-3 bg-[#FF4500]/20 hover:bg-[#FF4500]/30 border border-[#FF4500]/30 text-white transition-colors"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <span className="font-medium">Share on Reddit</span>
              </a>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
                style={{ borderRadius: 'var(--radius)' }}
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
                  className="p-2 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  style={{ borderRadius: 'var(--radius)' }}
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

      {/* Admin Edit Button - Fixed position */}
      {canEdit && !isAdminPanelOpen && (
        <button
          onClick={() => setIsAdminPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-all hover:scale-105"
          title="Admin Edit"
        >
          <PencilIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Edit</span>
        </button>
      )}

      {/* Backdrop for admin panel - render BEFORE panel so it's behind */}
      {canEdit && isAdminPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsAdminPanelOpen(false)}
        />
      )}

      {/* Admin Edit Panel - Slide-in from right */}
      {canEdit && isAdminPanelOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-gray-900 shadow-2xl border-l border-white/10 flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <PencilIcon className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-white">Admin Edit</h3>
            </div>
            <button
              onClick={() => setIsAdminPanelOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Error Display */}
            {adminError && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-sm text-red-400">{adminError}</p>
              </div>
            )}

            {/* Tools, Categories, and Topics Section */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Tools & Tags
              </h4>

              {/* Tools Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Tools Mentioned
                </label>
                {/* Search Input */}
                <input
                  type="text"
                  value={toolSearchQuery}
                  onChange={(e) => setToolSearchQuery(e.target.value)}
                  placeholder="Search tools..."
                  className="w-full px-3 py-2 mb-2 border border-white/20 rounded-lg bg-white/5 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {/* Selected Tools - Reorderable list */}
                <div className="space-y-1 mb-2">
                  {selectedToolIds.map((toolId, index) => {
                    const tool = availableTools.find(t => t.id === toolId);
                    if (!tool) return null;
                    return (
                      <div
                        key={toolId}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
                          index === 0
                            ? 'bg-amber-900/40 border-amber-600 text-amber-100'
                            : 'bg-white/5 border-white/20 text-white/80'
                        }`}
                      >
                        <Bars3Icon className="w-3 h-3 text-white/40 flex-shrink-0" />
                        {tool.logoUrl && (
                          <img src={tool.logoUrl} alt="" className="w-4 h-4 rounded flex-shrink-0" />
                        )}
                        <span className="text-xs flex-1 truncate">
                          {index === 0 && <span className="text-amber-400 mr-1">#1</span>}
                          {tool.name}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleMoveToolUp(toolId)}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUpIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveToolDown(toolId)}
                            disabled={index === selectedToolIds.length - 1}
                            className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDownIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleToggleTool(toolId)}
                            className="p-0.5 hover:bg-red-500/20 hover:text-red-400 rounded"
                            title="Remove"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedToolIds.length > 0 && (
                  <p className="text-xs text-white/40 mb-2">First tool shown on project cards</p>
                )}
                {/* Available Tools Dropdown */}
                <div className="max-h-32 overflow-y-auto border border-white/10 rounded-lg bg-white/5">
                  {filteredTools.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-white/40">No tools found</p>
                  ) : (
                    filteredTools.slice(0, 20).map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => handleToggleTool(tool.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          selectedToolIds.includes(tool.id)
                            ? 'bg-amber-900/20 text-amber-300'
                            : 'hover:bg-white/10 text-white/70'
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
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => handleToggleCategory(category.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        selectedCategoryIds.includes(category.id)
                          ? 'bg-blue-900/30 text-blue-200 border-blue-700'
                          : 'bg-white/5 text-white/60 border-white/20 hover:border-white/40'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics (Freeform Tags) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Topics
                </label>
                {/* Current Topics */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white/10 text-white/80 border border-white/20"
                    >
                      <TagIcon className="w-3 h-3" />
                      {topic}
                      <button
                        onClick={() => handleRemoveTopic(topic)}
                        className="ml-1 hover:text-red-400"
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
                    className="flex-1 px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTopic}
                    disabled={!newTopic.trim()}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              </div>

              {/* Save Tags Button */}
              <button
                type="button"
                onClick={handleSaveTags}
                disabled={isSavingTags}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
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
          </div>
        </div>
      )}
    </div>
  );
}
