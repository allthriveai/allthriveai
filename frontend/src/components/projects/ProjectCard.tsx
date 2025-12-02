import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Project } from '@/types/models';
import {
  QUOTE_CARD_SIZE,
  MAX_VISIBLE_TAGS,
  GRADIENT_OVERLAY,
  PROJECT_TYPE_LABELS,
} from './constants';
import {
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeSlashIcon,
  EyeIcon,
  HeartIcon,
  ChevronUpIcon,
  ChatBubbleLeftIcon,
  SwatchIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { toggleProjectLike, deleteProjectById } from '@/services/projects';
import { ProjectModal } from './ProjectModal';
import { CommentTray } from './CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { SlideUpHero } from './SlideUpHero';
import { useAuth } from '@/hooks/useAuth';
import { useReward } from 'react-rewards';

interface ProjectCardProps {
  project: Project;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (projectId: number) => void;
  isOwner?: boolean;  // Is the current user the owner of this project
  variant?: 'default' | 'masonry';  // Layout variant
  onDelete?: (projectId: number) => void;
  onToggleShowcase?: (projectId: number) => void;
  userAvatarUrl?: string;  // Owner's avatar URL
  onCommentClick?: (project: Project) => void;  // Optional callback for page-level comment panel
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github_repo: CodeBracketIcon,
  figma_design: SwatchIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  reddit_thread: ChatBubbleOvalLeftEllipsisIcon,
  other: DocumentTextIcon,
};

const typeLabels = PROJECT_TYPE_LABELS;

export function ProjectCard({ project, selectionMode = false, isSelected = false, onSelect, isOwner = false, variant = 'default', onDelete, onToggleShowcase, userAvatarUrl, onCommentClick }: ProjectCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(project.isLikedByUser);
  const [heartCount, setHeartCount] = useState(project.heartCount);
  const [isLiking, setIsLiking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCommentTray, setShowCommentTray] = useState(false);
  const [showToolTray, setShowToolTray] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');
  const [slideUpExpanded, setSlideUpExpanded] = useState(false);
  const [imageIsPortrait, setImageIsPortrait] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const Icon = typeIcons[project.type] || DocumentTextIcon;
  const projectUrl = `/${project.username}/${project.slug}`;

  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  // User can delete if they're the owner OR if they're an admin
  const canDelete = isOwner || isAdmin;

  // React Rewards for project likes
  const { reward: rewardLike } = useReward(`likeReward-${project.id}`, 'emoji', {
    emoji: ['💗'],
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
  });

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      onSelect(project.id);
    }
  };

  const handleLike = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLiking) return;

    setIsLiking(true);
    try {
      const result = await toggleProjectLike(project.id);
      setIsLiked(result.liked);
      setHeartCount(result.heartCount);

      // Trigger pink heart celebration when liked
      if (result.liked) {
        rewardLike();
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      // Use the admin delete endpoint that works with any project
      await deleteProjectById(project.id);

      // Call onDelete callback if provided
      if (onDelete) {
        onDelete(project.id);
      }

      // Optionally reload the page or update the UI
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // If page-level callback is provided, use it
    if (onCommentClick) {
      onCommentClick(project);
      return;
    }
    // Otherwise, use local comment tray
    setShowToolTray(false);
    setShowCommentTray(true);
  };

  const handleMoreInfoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  const handleToolClick = (e: React.MouseEvent, toolSlug?: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Close other trays first
    setShowCommentTray(false);
    if (toolSlug) {
      setSelectedToolSlug(toolSlug);
    }
    setShowToolTray(true);
  };

  // Get hero element to display
  const getHeroElement = () => {
    const heroMode = project.content?.heroDisplayMode;

    // If hero mode is specified, use that (regardless of variant)
    if (heroMode === 'image' && project.featuredImageUrl) {
      return { type: 'image' as const, url: project.featuredImageUrl };
    }
    if (heroMode === 'video' && project.content?.heroVideoUrl) {
      return { type: 'video' as const, url: project.content.heroVideoUrl };
    }
    if (heroMode === 'slideshow' && project.content?.heroSlideshowImages && project.content.heroSlideshowImages.length > 0) {
      return { type: 'slideshow' as const, images: project.content.heroSlideshowImages };
    }
    if (heroMode === 'quote' && project.content?.heroQuote) {
      return { type: 'quote' as const, text: project.content.heroQuote };
    }
    if (heroMode === 'slideup' && project.content?.heroSlideUpElement1) {
      return {
        type: 'slideup' as const,
        element1: project.content.heroSlideUpElement1,
        element2: project.content.heroSlideUpElement2
      };
    }

    // Fallback: use featuredImageUrl > bannerUrl > Unsplash random image
    if (project.featuredImageUrl) {
      return { type: 'image' as const, url: project.featuredImageUrl };
    }
    const cover = (project.content as Record<string, unknown>)?.coverImage || (project.content as Record<string, unknown>)?.cover;
    if (cover?.url) {
      return { type: 'image' as const, url: cover.url };
    }
    if (project.bannerUrl) {
      return { type: 'image' as const, url: project.bannerUrl };
    }

    // Create a gradient placeholder with project title
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-indigo-500 to-blue-600',
      'from-yellow-500 to-orange-600',
    ];
    const gradientIndex = project.id ? project.id % gradients.length : 0;

    // Return a special type to render gradient instead of image
    return {
      type: 'gradient' as const,
      gradient: gradients[gradientIndex],
      title: project.title
    };
  };

  const CardWrapper = selectionMode ? 'div' : Link;
  const cardProps = selectionMode
    ? { onClick: handleClick, style: { cursor: 'pointer' } }
    : { to: projectUrl };

  // Masonry variant - Flexible height for text, portrait for media
  if (variant === 'masonry') {
    const heroElement = getHeroElement();
    // Treat quote and slideup cards as media cards for styling purposes (dark mode overlay style)
    const isMediaCard = ['image', 'video', 'slideshow', 'quote', 'slideup', 'gradient'].includes(heroElement.type) || (heroElement.type === 'image' && project.type !== 'github_repo');
    const isQuote = heroElement.type === 'quote';
    const isSlideup = heroElement.type === 'slideup';
    const isGradient = heroElement.type === 'gradient';

    // Get gradient colors for quote cards
    const gradientFrom = project.content?.heroGradientFrom || GRADIENT_OVERLAY.DEFAULT_FROM;
    const gradientTo = project.content?.heroGradientTo || GRADIENT_OVERLAY.DEFAULT_TO;

    // Determine dynamic size based on hero element type and content
    const getDynamicSizeClass = () => {
      // Quote cards - vary based on text length (keep fixed heights for text content)
      if (isQuote && heroElement.type === 'quote') {
        const textLength = heroElement.text?.length || 0;
        if (textLength < QUOTE_CARD_SIZE.SHORT) return { height: QUOTE_CARD_SIZE.HEIGHT_SHORT, width: '' };
        if (textLength < QUOTE_CARD_SIZE.MEDIUM) return { height: QUOTE_CARD_SIZE.HEIGHT_MEDIUM, width: '' };
        return { height: QUOTE_CARD_SIZE.HEIGHT_LONG, width: '' };
      }

      // SlideUp cards - natural height
      if (isSlideup) {
        return { height: '', width: '' };
      }

      // Video cards - no min-height, let video determine size
      if (heroElement.type === 'video') {
        return { height: '', width: '' };
      }

      // Slideshow - no min-height, let images determine size
      if (heroElement.type === 'slideshow') {
        return { height: '', width: '' };
      }

      // Image cards - no forced height, let content determine size
      if (heroElement.type === 'image') {
        return { height: '', width: '' };
      }

      // Default - no forced height
      return { height: '', width: '' };
    };

    const { height: dynamicHeightClass, width: dynamicWidthClass } = getDynamicSizeClass();

    return (
      <>
      <CardWrapper
        {...(cardProps as React.ComponentProps<typeof Link>)}
        className={`block relative rounded overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 group ${
          isSelected ? 'ring-4 ring-primary-500' : ''
        } ${dynamicHeightClass} ${dynamicWidthClass} ${!imageLoaded && (heroElement.type === 'image' || heroElement.type === 'slideshow') ? 'min-h-[400px]' : ''}`}
      >

        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-4 left-4 z-30">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect && onSelect(project.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded border-2 border-white shadow-lg cursor-pointer"
            />
          </div>
        )}

        {/* BACKGROUND LAYER */}
        <div className={`${isQuote ? 'absolute inset-0 bg-gray-900 flex items-center justify-center' : 'relative'} ${heroElement.type === 'image' ? 'bg-gray-900' : ''}`}>
            {heroElement.type === 'image' && (
              <div className="relative w-full" style={{ minHeight: imageLoaded ? 'auto' : '400px' }}>
                {/* Loading placeholder */}
                {!imageLoaded && (
                  <div className="absolute inset-0 w-full h-full bg-gray-800 animate-shimmer bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800" style={{ backgroundSize: '200% 200%' }} />
                )}
                <img
                  src={heroElement.url}
                  alt={project.title}
                  className={`w-full h-auto object-cover ${!imageIsPortrait ? 'pb-40 md:pb-0' : ''} transition-opacity duration-300 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
                  loading="lazy"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageIsPortrait(img.naturalHeight > img.naturalWidth * 1.2);
                    // Small delay to ensure smooth transition
                    setTimeout(() => setImageLoaded(true), 50);
                  }}
                />
              </div>
            )}

            {isGradient && heroElement.type === 'gradient' && (
              <div className={`w-full aspect-[4/3] bg-gradient-to-br ${heroElement.gradient} flex items-center justify-center p-8 pb-48 md:pb-8`}>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white drop-shadow-lg">
                    {heroElement.title}
                  </h3>
                </div>
              </div>
            )}

            {heroElement.type === 'video' && (() => {
              // Parse video URL to get embed URL
              const parseVideoUrl = (url: string) => {
                // YouTube patterns
                const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
                if (youtubeMatch) {
                  return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&mute=1&loop=1&controls=0`;
                }

                // Vimeo patterns
                const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                if (vimeoMatch) {
                  return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1`;
                }

                // Loom patterns
                const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
                if (loomMatch) {
                  return `https://www.loom.com/embed/${loomMatch[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`;
                }

                // Direct video file
                return url;
              };

              const embedUrl = parseVideoUrl(heroElement.url);
              const isEmbedUrl = embedUrl !== heroElement.url;

              return isEmbedUrl ? (
                <div className="relative w-full aspect-video bg-black pb-40 md:pb-0">
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  src={heroElement.url}
                  className="w-full h-auto block pb-40 md:pb-0"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              );
            })()}

            {heroElement.type === 'slideshow' && (
              <div className="relative w-full" style={{ minHeight: imageLoaded ? 'auto' : '400px' }}>
                {/* Loading placeholder */}
                {!imageLoaded && (
                  <div className="absolute inset-0 w-full h-full bg-gray-800 animate-shimmer bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800" style={{ backgroundSize: '200% 200%' }} />
                )}
                <img
                  src={heroElement.images[0]}
                  alt={project.title}
                  className={`w-full h-auto block ${!imageIsPortrait ? 'pb-40 md:pb-0' : ''} transition-opacity duration-300 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
                  loading="lazy"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageIsPortrait(img.naturalHeight > img.naturalWidth * 1.2);
                    // Small delay to ensure smooth transition
                    setTimeout(() => setImageLoaded(true), 50);
                  }}
                />
              </div>
            )}

            {isQuote && (
              <div
                className="absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                style={{
                  background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`
                }}
              >
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none" />
              </div>
            )}

            {isSlideup && heroElement.element1 && heroElement.element2 && (
              <div onClick={(e) => e.preventDefault()}>
                <SlideUpHero
                  element1={heroElement.element1}
                  element2={heroElement.element2}
                  tools={project.toolsDetails}
                  onToolClick={(slug) => {
                    // Close other trays first
                    setShowCommentTray(false);
                    setSelectedToolSlug(slug);
                    setShowToolTray(true);
                  }}
                  isLiked={isLiked}
                  heartCount={heartCount}
                  onLikeToggle={handleLike}
                  onCommentClick={handleCommentClick}
                  isAuthenticated={isAuthenticated}
                  isExpanded={slideUpExpanded}
                  onToggleExpanded={() => setSlideUpExpanded(!slideUpExpanded)}
                />
              </div>
            )}
        </div>

        {/* CONTENT LAYER */}
        {/* Quote Content - Positioned to avoid footer overlap */}
        {isQuote && (
          <div className="absolute top-0 left-0 right-0 bottom-40 px-6 flex items-center justify-center z-10 pointer-events-none overflow-hidden">
             <p className="text-lg md:text-xl font-medium leading-relaxed tracking-normal drop-shadow-sm font-sans line-clamp-[8] text-white/95 text-center">
               “{heroElement.text}”
             </p>
          </div>
        )}


        {/* Repo Content (Flex Flow for non-media) */}
        {!isMediaCard && (
          <div className="relative w-full h-full flex flex-col min-h-[320px] bg-slate-900">
            {project.type === 'github_repo' && (
              <div className="absolute inset-0 opacity-50 pointer-events-none">
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              </div>
            )}
            <div className="flex-1 p-8 flex flex-col items-center justify-center relative z-10">
               {project.type === 'github_repo' && (
                 <div className="w-full flex flex-col items-center gap-4 opacity-80">
                    <CodeBracketIcon className="w-16 h-16 text-slate-400" />
                    <div className="w-full space-y-2 opacity-50">
                      <div className="h-2 w-3/4 bg-slate-600 rounded mx-auto" />
                      <div className="h-2 w-1/2 bg-slate-600 rounded mx-auto" />
                      <div className="h-2 w-5/6 bg-slate-600 rounded mx-auto" />
                    </div>
                 </div>
               )}
            </div>
            <div className="h-4 shrink-0" />
          </div>
        )}

        {/* GRADIENT OVERLAY & FOOTER */}
        {/* Always render footer absolute at bottom for seamless overlay look */}
        {/* Show by default on mobile (md:opacity-0), show on hover on desktop (md:group-hover:opacity-100) */}
        <div className="absolute bottom-0 left-0 right-0 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          {/* Gradient Background for smooth overlay fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent -top-64 md:-top-40" />

          <div className="relative p-5 pt-2">
            <h3 className="text-xl font-bold mb-1 line-clamp-2 leading-tight text-white drop-shadow-md">
              {project.title}
            </h3>

            {project.description && (
              <p className="text-sm mb-3 line-clamp-2 leading-relaxed font-medium text-white/90 drop-shadow-sm">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {project.content.tags.slice(0, MAX_VISIBLE_TAGS).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/10 text-white backdrop-blur-md border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {/* Left side - Avatar and Action buttons */}
              <div className="flex items-center gap-2">
                {/* User Avatar */}
                {!selectionMode && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/${project.username}`);
                    }}
                    className="w-9 h-9 rounded-full border-2 border-white/80 shadow-lg overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 hover:border-white hover:scale-105 transition-all cursor-pointer"
                    aria-label={`View ${project.username}'s profile`}
                  >
                    {userAvatarUrl ? (
                      <img
                        src={userAvatarUrl}
                        alt={project.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Show user initials on error
                          const target = e.target as HTMLImageElement;
                          const parent = target.parentElement;
                          if (parent) {
                            const initial = project.username?.[0]?.toUpperCase() || 'U';
                            parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white font-bold text-sm">${initial}</div>`;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                        {project.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </button>
                )}

                {/* Heart/Like Button */}
                <button
                  id={`likeReward-${project.id}`}
                  onClick={handleLike}
                  disabled={isLiking}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50 group/heart bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20"
                >
                  {isLiked ? (
                    <HeartIconSolid className="w-4 h-4 text-red-500 group-hover/heart:scale-110 transition-transform drop-shadow-sm" />
                  ) : (
                    <HeartIcon className="w-4 h-4 text-white group-hover/heart:scale-110 transition-transform drop-shadow-sm" />
                  )}
                  {heartCount > 0 && (
                    <span className="text-xs font-bold text-white">
                      {heartCount}
                    </span>
                  )}
                </button>

                {/* Comment Button */}
                <button
                  onClick={handleCommentClick}
                  className="p-1.5 rounded-full transition-all hover:scale-105 group/comment bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20"
                  aria-label="Comment"
                >
                  <ChatBubbleLeftIcon className="w-4 h-4 text-white group-hover/comment:scale-110 transition-transform drop-shadow-sm" />
                </button>

                {/* Up Arrow - More Info or Slide Up */}
                {isSlideup && project.content?.heroSlideUpElement1 && project.content?.heroSlideUpElement2 ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSlideUpExpanded(!slideUpExpanded);
                    }}
                    className="p-1.5 rounded-full transition-all hover:scale-105 group/more bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20"
                    aria-label="Toggle slide up"
                  >
                    <ChevronUpIcon className="w-4 h-4 text-white group-hover/more:scale-110 transition-transform drop-shadow-sm" />
                  </button>
                ) : project.content?.heroSlideUpElement1 && project.content?.heroSlideUpElement2 && (
                  <button
                    onClick={handleMoreInfoClick}
                    className="p-1.5 rounded-full transition-all hover:scale-105 group/more bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20"
                    aria-label="More info"
                  >
                    <ChevronUpIcon className="w-4 h-4 text-white group-hover/more:scale-110 transition-transform drop-shadow-sm" />
                  </button>
                )}

                {/* Admin Delete Button */}
                {canDelete && !selectionMode && (
                  <button
                    onClick={handleDeleteClick}
                    className="p-1.5 rounded-full transition-all hover:scale-105 group/delete bg-red-500/20 backdrop-blur-md border border-red-500/30 hover:bg-red-500/30"
                    aria-label="Delete project"
                    title={isAdmin && !isOwner ? "Delete project (Admin)" : "Delete project"}
                  >
                    <TrashIcon className="w-4 h-4 text-red-400 group-hover/delete:scale-110 transition-transform drop-shadow-sm" />
                  </button>
                )}
              </div>

              {/* Right side - Tools */}
              {project.toolsDetails && project.toolsDetails.length > 0 && (
                <button
                  onClick={handleToolClick}
                  className="p-2 rounded-full transition-all hover:scale-110 bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 cursor-pointer"
                  title={project.toolsDetails[0].name}
                >
                  {project.toolsDetails[0].logoUrl ? (
                    <img
                      src={project.toolsDetails[0].logoUrl}
                      alt={project.toolsDetails[0].name}
                      className="w-5 h-5 rounded object-contain"
                    />
                  ) : (
                    <CodeBracketIcon className="w-5 h-5 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

      </CardWrapper>

      {/* Project Modal for slide-up hero */}
      <ProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        project={project}
        isAuthenticated={isAuthenticated}
        isLiked={isLiked}
        heartCount={heartCount}
        onLikeToggle={() => handleLike()}
        showComments={false}
      />

      {/* Comment Tray - only render if no page-level callback provided */}
      {!onCommentClick && (
        <CommentTray
          isOpen={showCommentTray}
          onClose={() => setShowCommentTray(false)}
          project={project}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Tool Tray */}
      {project.toolsDetails && project.toolsDetails.length > 0 && (
        <ToolTray
          isOpen={showToolTray}
          onClose={() => setShowToolTray(false)}
          toolSlug={selectedToolSlug || project.toolsDetails[0].slug}
        />
      )}
    </>
    );
  }

  return (
    <CardWrapper
      {...(cardProps as React.ComponentProps<typeof Link>)}
      className={`block glass-subtle hover:glass-strong transition-all duration-300 rounded-xl overflow-hidden group relative ${
        isSelected ? 'ring-4 ring-primary-500' : ''
      }`}
    >
      {/* Selection checkbox - positioned absolutely over the card */}
      {selectionMode && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect && onSelect(project.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
          />
        </div>
      )}

      {/* Thumbnail or placeholder */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={project.bannerUrl || '/allthrive-placeholder.svg'}
          alt={project.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

          {/* Type badge and Menu button */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {canDelete && !selectionMode && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-lg transition-all hover:scale-110"
                title="Options"
              >
                <EllipsisVerticalIcon className="w-4 h-4" />
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      navigate(`/${project.username}/${project.slug}/edit`);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <PencilIcon className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      if (onToggleShowcase) onToggleShowcase(project.id);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(false);
                      if (onDelete) onDelete(project.id);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
          <span className="px-2 py-1 text-xs font-medium rounded-full glass-strong border border-white/20 text-slate-700 dark:text-slate-300">
            {typeLabels[project.type]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
          {project.title}
        </h3>

        {project.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Tags */}
        {project.content?.tags && project.content.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.content.tags.slice(0, MAX_VISIBLE_TAGS).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs rounded-md bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
            {project.content.tags.length > MAX_VISIBLE_TAGS && (
              <span className="px-2 py-1 text-xs text-slate-500 dark:text-slate-500">
                +{project.content.tags.length - MAX_VISIBLE_TAGS} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-1">
            <Icon className="w-4 h-4" />
            <span>/{project.slug}</span>
          </div>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </CardWrapper>
  );
}
