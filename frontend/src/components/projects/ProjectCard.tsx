import { Link, useNavigate } from 'react-router-dom';
import { useState, memo } from 'react';
import type { Project } from '@/types/models';
import { useProjectPreviewTraySafe } from '@/context/ProjectPreviewTrayContext';
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
  TrophyIcon,
  VideoCameraIcon,
  NewspaperIcon,
  MegaphoneIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid, MegaphoneIcon as MegaphoneIconSolid, StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { toggleProjectLike, deleteProjectById, toggleProjectPromotion, toggleProjectInShowcase } from '@/services/projects';
import { ProjectModal } from './ProjectModal';
import { CommentTray } from './CommentTray';
import { ToolTray } from '@/components/tools/ToolTray';
import { SlideUpHero } from './SlideUpHero';
import { useAuth } from '@/hooks/useAuth';
import { useReward } from 'react-rewards';
import { getCategoryColors } from '@/utils/categoryColors';
import { DynamicGradientCard } from './DynamicGradientCard';
import { generateSrcSet, generateSizes, getOptimizedImageUrl } from '@/utils/imageOptimization';

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
  onCardClick?: (projectId: number) => void;  // Optional callback for tracking clicks (called before navigation)
  isInShowcase?: boolean;  // Is this project in the user's profile showcase section
  onShowcaseToggle?: (projectId: number, added: boolean) => void;  // Callback when showcase status changes
  showShowcaseButton?: boolean;  // Show the add/remove from showcase button
  priority?: boolean;  // Load image eagerly (for above-the-fold content)
  enableInlinePreview?: boolean;  // Opens tray instead of navigating (for explore feed)
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github_repo: CodeBracketIcon,
  figma_design: SwatchIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  reddit_thread: ChatBubbleOvalLeftEllipsisIcon,
  video: VideoCameraIcon,
  rss_article: NewspaperIcon,
  battle: TrophyIcon,
  other: DocumentTextIcon,
};

const typeLabels = PROJECT_TYPE_LABELS;

export const ProjectCard = memo(function ProjectCard({ project, selectionMode = false, isSelected = false, onSelect, isOwner = false, variant = 'default', onDelete, onToggleShowcase, userAvatarUrl, onCommentClick, onCardClick, isInShowcase = false, onShowcaseToggle, showShowcaseButton = false, priority = false, enableInlinePreview = false }: ProjectCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const projectPreviewContext = useProjectPreviewTraySafe();
  const openProjectPreview = projectPreviewContext?.openProjectPreview;
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
  const [isPromoted, setIsPromoted] = useState(project.isPromoted ?? false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [inShowcase, setInShowcase] = useState(isInShowcase);
  const [isTogglingShowcase, setIsTogglingShowcase] = useState(false);
  const Icon = typeIcons[project.type] || DocumentTextIcon;
  const projectUrl = `/${project.username}/${project.slug}`;

  // Check if user is admin (includes superusers via isAdminRole)
  const isAdmin = user?.isAdminRole || user?.role === 'admin';
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
      return;
    }
    // Track click before navigation (fire and forget)
    if (onCardClick) {
      onCardClick(project.id);
    }
    // If inline preview is enabled, open tray instead of navigating
    if (enableInlinePreview && openProjectPreview) {
      e.preventDefault();
      openProjectPreview(project);
      return;
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

  const handlePromoteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPromoting) return;

    setIsPromoting(true);
    try {
      const result = await toggleProjectPromotion(project.id);
      setIsPromoted(result.isPromoted);
    } catch (error) {
      console.error('Failed to toggle promotion:', error);
      alert('Failed to toggle promotion. Please try again.');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleShowcaseClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTogglingShowcase) return;

    setIsTogglingShowcase(true);
    try {
      const result = await toggleProjectInShowcase(project.id);
      setInShowcase(result.added);
      if (onShowcaseToggle) {
        onShowcaseToggle(project.id, result.added);
      }
    } catch (error: any) {
      console.error('Failed to toggle showcase:', error);
      const errorMsg = error?.response?.data?.error || 'Failed to update showcase. Please try again.';
      alert(errorMsg);
    } finally {
      setIsTogglingShowcase(false);
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

    // For battle projects, show both submission images side by side
    if (project.type === 'battle' && project.content?.battleResult) {
      const battleResult = project.content.battleResult;
      return {
        type: 'battle' as const,
        myImageUrl: battleResult.mySubmission?.imageUrl,
        opponentImageUrl: battleResult.opponentSubmission?.imageUrl,
        won: battleResult.won,
        isTie: battleResult.isTie,
        challengeText: battleResult.challengeText,
      };
    }

    // For Reddit threads, check if there's video data in the reddit metadata (fallback)
    if (project.type === 'reddit_thread' && !heroMode) {
      const redditData = project.content?.reddit;
      // Check for video URL in Reddit metadata
      const videoUrl = redditData?.videoUrl;
      const isVideo = redditData?.isVideo;

      if (isVideo && videoUrl) {
        return { type: 'video' as const, url: videoUrl };
      }
    }

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

    // For video projects, check for direct video URL in content.video or featuredImageUrl
    if (project.type === 'video') {
      const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
      const sectionContent = project.content?.sections?.[0]?.content || {};
      const directVideoUrl = videoContent.url || (typeof sectionContent === 'object' && 'url' in sectionContent ? sectionContent.url : '');

      if (directVideoUrl) {
        return { type: 'video' as const, url: directVideoUrl };
      }

      // Also check if featuredImageUrl is actually a video file (for explore page where content is null)
      if (project.featuredImageUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(project.featuredImageUrl)) {
        return { type: 'video' as const, url: project.featuredImageUrl };
      }
    }

    // Fallback: use featuredImageUrl > bannerUrl > gradient (as last resort)
    // Also check if featuredImageUrl is a video file (regardless of project type)
    if (project.featuredImageUrl) {
      if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(project.featuredImageUrl)) {
        return { type: 'video' as const, url: project.featuredImageUrl };
      }
      return { type: 'image' as const, url: project.featuredImageUrl };
    }
    const cover = (project.content as Record<string, unknown>)?.coverImage || (project.content as Record<string, unknown>)?.cover;
    if (cover && typeof cover === 'object' && 'url' in cover && typeof cover.url === 'string') {
      return { type: 'image' as const, url: cover.url };
    }
    if (project.bannerUrl) {
      return { type: 'image' as const, url: project.bannerUrl };
    }

    // Create a gradient placeholder with project title
    // Use category color for meaningful gradients, fallback to deterministic gradient
    const primaryCategory = project.categoriesDetails?.[0];

    // Get raw colors for animated gradient
    const { from, to } = getCategoryColors(primaryCategory?.color, project.id);

    // Create large dramatic swooping gradients like the Suncatcher design
    const gradientStyle: React.CSSProperties = {
      backgroundImage: `radial-gradient(ellipse 120% 150% at 95% -20%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 40%, transparent 70%), radial-gradient(ellipse 140% 180% at -10% 110%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 35%, transparent 65%), linear-gradient(135deg, ${from} 0%, ${to} 50%, ${from} 100%)`,
    };

    // Return a special type to render gradient instead of image
    return {
      type: 'gradient' as const,
      gradientStyle,
      title: project.title,
      categoryName: primaryCategory?.name, // Include category name for potential display
      fromColor: from,
      toColor: to,
    };
  };

  // Keep users on-site for all project types (including RSS articles which now show expert reviews)
  // Use div instead of Link when in selection mode or when inline preview is enabled
  const CardWrapper = (selectionMode || enableInlinePreview) ? 'div' : Link;
  const cardProps = (selectionMode || enableInlinePreview)
    ? { onClick: handleClick, style: { cursor: 'pointer' } }
    : { to: projectUrl, onClick: handleClick };

  // Masonry variant - Flexible height for text, portrait for media
  if (variant === 'masonry') {
    const heroElement = getHeroElement();
    // Treat quote and slideup cards as media cards for styling purposes (dark mode overlay style)
    const isMediaCard = ['image', 'video', 'slideshow', 'quote', 'slideup', 'gradient', 'battle'].includes(heroElement.type) || (heroElement.type === 'image' && project.type !== 'github_repo');
    const isQuote = heroElement.type === 'quote';
    const isSlideup = heroElement.type === 'slideup';
    const isGradient = heroElement.type === 'gradient';
    const isBattle = heroElement.type === 'battle';

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
        {...(cardProps as any)}
        className={`block relative overflow-hidden shadow-lg hover:shadow-neon group cursor-pointer ${
          isSelected ? 'ring-4 ring-primary-500' : ''
        } ${dynamicHeightClass} ${dynamicWidthClass} ${!imageLoaded && (heroElement.type === 'image' || heroElement.type === 'slideshow') ? 'min-h-[400px]' : ''}`}
        style={{ borderRadius: 'var(--radius)' }}
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
            {heroElement.type === 'image' && (() => {
              // Check if this is a YouTube Short or vertical video - show thumbnail with vertical aspect
              const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
              const sectionContent = project.content?.sections?.[0]?.content || {};
              // Check content flags first
              const hasVerticalFlag = videoContent.isShort || videoContent.isVertical || (typeof sectionContent === 'object' && ('isShort' in sectionContent ? sectionContent.isShort : false)) || (typeof sectionContent === 'object' && ('isVertical' in sectionContent ? sectionContent.isVertical : false)) || false;
              // Also auto-detect from URL pattern (youtube.com/shorts/) - check heroVideoUrl or section content
              const videoUrl = project.content?.heroVideoUrl || (typeof sectionContent === 'object' && 'url' in sectionContent ? sectionContent.url : '') || '';
              const urlIsShort = typeof videoUrl === 'string' && (videoUrl.includes('/shorts/') || videoUrl.includes('youtube.com/shorts'));
              const isYouTubeShort = hasVerticalFlag || urlIsShort;

              if (isYouTubeShort) {
                return (
                  <div className="relative w-full flex justify-center bg-slate-900 pb-36 md:pb-0">
                    <div className="relative w-full" style={{ aspectRatio: '9 / 16' }}>
                      {!imageLoaded && (
                        <div className="absolute inset-0 w-full h-full bg-gray-800 animate-shimmer bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-lg" style={{ backgroundSize: '200% 200%' }} />
                      )}
                      <img
                        src={getOptimizedImageUrl(heroElement.url, { width: 400 })}
                        srcSet={generateSrcSet(heroElement.url, [280, 400, 560])}
                        sizes="(max-width: 640px) 280px, 400px"
                        alt={project.title}
                        className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
                        loading={priority ? 'eager' : 'lazy'}
                        decoding={priority ? 'sync' : 'async'}
                        fetchPriority={priority ? 'high' : 'auto'}
                        onLoad={() => {
                          setTimeout(() => setImageLoaded(true), 50);
                        }}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div className="relative w-full" style={{ minHeight: imageLoaded ? 'auto' : '400px' }}>
                  {/* Loading placeholder */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 w-full h-full bg-gray-800 animate-shimmer bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800" style={{ backgroundSize: '200% 200%' }} />
                  )}
                  <img
                    src={getOptimizedImageUrl(heroElement.url, { width: 800 })}
                    srcSet={generateSrcSet(heroElement.url, [400, 600, 800, 1200])}
                    sizes={generateSizes(400, 600, 800)}
                    alt={project.title}
                    className={`w-full h-auto object-cover transition-opacity duration-300 ${!imageLoaded ? 'opacity-0' : 'opacity-100'} ${!imageIsPortrait ? 'pb-36 md:pb-0' : ''}`}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding={priority ? 'sync' : 'async'}
                    fetchPriority={priority ? 'high' : 'auto'}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImageIsPortrait(img.naturalHeight > img.naturalWidth * 1.2);
                      // Small delay to ensure smooth transition
                      setTimeout(() => setImageLoaded(true), 50);
                    }}
                  />
                </div>
              );
            })()}

            {isGradient && heroElement.type === 'gradient' && (
              <DynamicGradientCard
                title={heroElement.title || ''}
                fromColor={heroElement.fromColor || '#0F52BA'}
                toColor={heroElement.toColor || '#0a3d8a'}
                categoryName={heroElement.categoryName}
                projectId={project.id}
              />
            )}

            {heroElement.type === 'video' && (() => {
              // Check if this is a YouTube Short or vertical video
              const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
              const sectionContent = project.content?.sections?.[0]?.content || {};
              // Check content flags first
              const hasVerticalFlag = videoContent.isShort || videoContent.isVertical || (typeof sectionContent === 'object' && ('isShort' in sectionContent ? sectionContent.isShort : false)) || (typeof sectionContent === 'object' && ('isVertical' in sectionContent ? sectionContent.isVertical : false)) || false;
              // Also auto-detect from URL pattern (youtube.com/shorts/)
              const urlIsShort = heroElement.url?.includes('/shorts/') || heroElement.url?.includes('youtube.com/shorts');
              const isYouTubeShort = hasVerticalFlag || urlIsShort;

              // Only autoplay videos from midjourney-reddit-agent in the explore feed
              const shouldAutoplay = project.username === 'midjourney-reddit-agent';

              // Parse video URL to get embed URL (autoplay only for midjourney-reddit-agent)
              const parseVideoUrl = (url: string) => {
                const autoplayParam = shouldAutoplay ? '1' : '0';

                // YouTube Shorts pattern
                const shortsMatch = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
                if (shortsMatch) {
                  return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=${autoplayParam}&mute=1&loop=1&controls=0&playsinline=1`;
                }

                // YouTube patterns
                const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
                if (youtubeMatch) {
                  return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=${autoplayParam}&mute=1&loop=1&controls=0&playsinline=1`;
                }

                // Vimeo patterns
                const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                if (vimeoMatch) {
                  return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=${shouldAutoplay ? '1' : '0'}&muted=1&loop=1&background=1`;
                }

                // Loom patterns
                const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
                if (loomMatch) {
                  return `https://www.loom.com/embed/${loomMatch[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true&autoplay=${autoplayParam}`;
                }

                // Direct video file
                return url;
              };

              const embedUrl = parseVideoUrl(heroElement.url);
              const isEmbedUrl = embedUrl !== heroElement.url;

              // YouTube Shorts use vertical 9:16 aspect ratio
              // Note: YouTube iframes always render at 16:9, so we need extra height
              // to accommodate the player while showing the vertical video properly
              if (isYouTubeShort) {
                return (
                  <div className="relative w-full flex justify-center bg-slate-900 pb-36 md:pb-0">
                    <div className="relative w-full max-w-[360px]" style={{ aspectRatio: '9 / 16' }}>
                      <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }

              return isEmbedUrl ? (
                <div className="relative w-full aspect-video bg-slate-900 pb-36 md:pb-0">
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
                  className="w-full h-auto block pb-36 md:pb-0"
                  autoPlay={shouldAutoplay}
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
                  src={getOptimizedImageUrl(heroElement.images[0], { width: 800 })}
                  srcSet={generateSrcSet(heroElement.images[0], [400, 600, 800, 1200])}
                  sizes={generateSizes(400, 600, 800)}
                  alt={project.title}
                  className={`w-full h-auto block transition-opacity duration-300 ${!imageLoaded ? 'opacity-0' : 'opacity-100'} ${!imageIsPortrait ? 'pb-36 md:pb-0' : ''}`}
                  loading={priority ? 'eager' : 'lazy'}
                  decoding={priority ? 'sync' : 'async'}
                  fetchPriority={priority ? 'high' : 'auto'}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageIsPortrait(img.naturalHeight > img.naturalWidth * 1.2);
                    // Small delay to ensure smooth transition
                    setTimeout(() => setImageLoaded(true), 50);
                  }}
                />
              </div>
            )}

            {/* Battle Card - Vertical 9:16 layout for mobile optimization */}
            {isBattle && heroElement.type === 'battle' && (
              <div className="relative w-full bg-slate-900 pb-36 md:pb-0">
                <div className="relative w-full" style={{ aspectRatio: '9 / 16' }}>
                  {/* Stacked vertical layout */}
                  <div className="absolute inset-0 flex flex-col">
                    {/* First submission - top half */}
                    <div className="flex-1 relative overflow-hidden">
                      {heroElement.myImageUrl ? (
                        <img
                          src={getOptimizedImageUrl(heroElement.myImageUrl, { width: 400 })}
                          srcSet={generateSrcSet(heroElement.myImageUrl, [280, 400, 560])}
                          sizes="(max-width: 640px) 280px, 400px"
                          alt="Battle submission"
                          className="w-full h-full object-cover"
                          loading={priority ? 'eager' : 'lazy'}
                          decoding={priority ? 'sync' : 'async'}
                          fetchPriority={priority ? 'high' : 'auto'}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <span className="text-slate-600 text-sm">No image</span>
                        </div>
                      )}
                      {/* Winner badge on first image (if this submission won) */}
                      {heroElement.won && (
                        <div className="absolute top-2 left-2 p-1.5 rounded-full bg-amber-500 shadow-lg">
                          <TrophyIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Divider gap */}
                    <div className="h-1 bg-slate-900" />

                    {/* Second submission - bottom half */}
                    <div className="flex-1 relative overflow-hidden">
                      {heroElement.opponentImageUrl ? (
                        <img
                          src={getOptimizedImageUrl(heroElement.opponentImageUrl, { width: 400 })}
                          srcSet={generateSrcSet(heroElement.opponentImageUrl, [280, 400, 560])}
                          sizes="(max-width: 640px) 280px, 400px"
                          alt="Battle submission"
                          className="w-full h-full object-cover"
                          loading={priority ? 'eager' : 'lazy'}
                          decoding={priority ? 'sync' : 'async'}
                          fetchPriority={priority ? 'high' : 'auto'}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <span className="text-slate-600 text-sm">No image</span>
                        </div>
                      )}
                      {/* Winner badge on second image (if opponent won) */}
                      {!heroElement.won && !heroElement.isTie && (
                        <div className="absolute top-2 left-2 p-1.5 rounded-full bg-amber-500 shadow-lg">
                          <TrophyIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VS Badge in center */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                      <span className="text-xs font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                        VS
                      </span>
                    </div>
                  </div>

                  {/* Tie badge at bottom (only show if it's a tie) */}
                  {heroElement.isTie && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                      <div className="px-3 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm bg-slate-700/80 text-slate-300">
                        TIE
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isQuote && (
              <div
                className="absolute inset-0"
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
                  onCommentClick={() => handleCommentClick({} as React.MouseEvent)}
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

        {/* CURATED ARTICLE WITH IMAGE: Title + Description + Category overlay */}
        {/* Uses glassmorphism effect for a premium feel - only shown when card has an actual image */}
        {project.type === 'rss_article' && heroElement.type === 'image' && (() => {
          // Extract short description from overview section content
          const overviewSection = project.content?.sections?.find((s: any) => s.type === 'overview');
          const fullDescription = overviewSection?.content?.description || '';
          // Get first sentence or first 120 chars for card preview
          const firstSentence = fullDescription.split(/[.!?]\s/)[0];
          const shortDesc = firstSentence.length > 120
            ? firstSentence.substring(0, 120).trim() + '...'
            : firstSentence + (fullDescription.length > firstSentence.length ? '...' : '');
          // Clean markdown headers from description
          const cleanDesc = shortDesc.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
          const primaryCategory = project.categoriesDetails?.[0];

          return (
            <div className="absolute bottom-4 left-4 right-4 z-20 opacity-100 group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
              <div className="backdrop-blur-xl bg-black/30 rounded-lg p-4 shadow-lg">
                {/* Category badge */}
                {primaryCategory && (
                  <div className="mb-2">
                    <span
                      className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full text-white/90"
                      style={{ backgroundColor: primaryCategory.color ? `${primaryCategory.color}99` : 'rgba(34, 211, 238, 0.6)' }}
                    >
                      {primaryCategory.name}
                    </span>
                  </div>
                )}
                {/* Title */}
                <h3 className="text-lg font-bold line-clamp-2 leading-snug text-white drop-shadow-sm mb-1.5">
                  {project.title}
                </h3>
                {/* Short description */}
                {cleanDesc && (
                  <p className="text-sm text-white/80 line-clamp-2 leading-relaxed">
                    {cleanDesc}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* GRADIENT OVERLAY & FOOTER - Shows on hover for all cards */}
        {/* For curated articles WITH images: appears on hover (replacing the static title) */}
        {/* For other cards (including curated without images): shows by default on mobile, hover on desktop */}
        <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          project.type === 'rss_article' && heroElement.type === 'image'
            ? 'opacity-0 group-hover:opacity-100'  // Curated with image: hidden by default, show on hover
            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'  // Others: mobile default, desktop hover
        }`}>
          <div className="relative p-5 pt-4">
            {/* Glassmorphism backdrop */}
            <div className="absolute inset-0 overflow-hidden rounded-b-[var(--radius)]">
              {/* Gradient background - forest, navy, black blend (darker) */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-black to-blue-950/40" />
              {/* Frosted glass layer */}
              <div className="absolute inset-0 backdrop-blur-md bg-white/[0.04]" />
              {/* Subtle inner highlight */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.05]" />
            </div>
            <h3 className="relative z-10 text-xl font-bold mb-1 line-clamp-2 leading-tight text-white drop-shadow-md">
              {project.title}
            </h3>

            {project.description && (
              <p className="relative z-10 text-sm mb-3 line-clamp-2 leading-relaxed font-medium text-white/90 drop-shadow-sm">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {project.content?.tags && project.content.tags.length > 0 && (
              <div className="relative z-10 flex flex-wrap gap-1.5 mb-3">
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

            <div className="relative z-10 flex items-center justify-between pt-1">
              {/* Left side - Avatar and Action buttons */}
              <div className="flex items-center gap-2">
                {/* User Avatar - Special treatment for curated articles */}
                {!selectionMode && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/${project.username}`);
                    }}
                    className={`rounded-full border-2 border-white/80 shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0 hover:border-white hover:scale-105 transition-all cursor-pointer ${
                      project.type === 'rss_article'
                        ? 'w-8 h-8 bg-gradient-to-br from-cyan-400 to-emerald-400'
                        : 'w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600'
                    }`}
                    aria-label={project.type === 'rss_article' ? `Curated by ${project.username}` : `View ${project.username}'s profile`}
                    title={project.type === 'rss_article' ? `Curated by ${project.username}` : undefined}
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

                {/* Add to Showcase Button - Owner only */}
                {showShowcaseButton && isOwner && !selectionMode && (
                  <button
                    onClick={handleShowcaseClick}
                    disabled={isTogglingShowcase}
                    className={`p-1.5 rounded-full transition-all hover:scale-105 group/showcase backdrop-blur-md border disabled:opacity-50 cursor-pointer ${
                      inShowcase
                        ? 'bg-yellow-500 border-yellow-400 hover:bg-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                        : 'bg-white/10 border-white/10 hover:bg-white/20'
                    }`}
                    aria-label={inShowcase ? "Remove from Projects showcase" : "Add to Projects showcase"}
                    title={inShowcase ? "Remove from Projects showcase" : "Add to Projects showcase"}
                  >
                    {inShowcase ? (
                      <StarIconSolid className="w-4 h-4 text-white group-hover/showcase:scale-110 transition-transform drop-shadow-sm" />
                    ) : (
                      <StarIcon className="w-4 h-4 text-white group-hover/showcase:scale-110 transition-transform drop-shadow-sm" />
                    )}
                  </button>
                )}

                {/* Admin Promote Button */}
                {isAdmin && !selectionMode && (
                  <button
                    onClick={handlePromoteClick}
                    disabled={isPromoting}
                    className={`p-1.5 rounded-full transition-all hover:scale-105 group/promote backdrop-blur-md border disabled:opacity-50 ${
                      isPromoted
                        ? 'bg-amber-500 border-amber-400 hover:bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                        : 'bg-white/10 border-white/10 hover:bg-white/20'
                    }`}
                    aria-label={isPromoted ? "Remove promotion" : "Promote to top of feed"}
                    title={isPromoted ? "Remove from promoted (Admin)" : "Promote to top of feed (Admin)"}
                  >
                    {isPromoted ? (
                      <MegaphoneIconSolid className="w-4 h-4 text-white group-hover/promote:scale-110 transition-transform drop-shadow-sm" />
                    ) : (
                      <MegaphoneIcon className="w-4 h-4 text-white group-hover/promote:scale-110 transition-transform drop-shadow-sm" />
                    )}
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

              {/* Right side - Tools (for regular projects) or Topics (for curated articles) */}
              {project.type === 'rss_article' ? (
                // For curated articles, show category/topic badges
                project.categoriesDetails && project.categoriesDetails.length > 0 && (
                  <div className="flex items-center gap-1">
                    {project.categoriesDetails.slice(0, 2).map((category) => (
                      <span
                        key={category.id}
                        className="px-2 py-1 text-[10px] font-semibold rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white backdrop-blur-md border border-cyan-500/30"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                )
              ) : (
                // For regular projects, show tools
                project.toolsDetails && project.toolsDetails.length > 0 && (
                  <button
                    onClick={handleToolClick}
                    className="p-2 rounded-full transition-all hover:scale-110 bg-white/80 backdrop-blur-md border border-white/30 hover:bg-white/90 shadow-sm cursor-pointer"
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
                )
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

      {/* Tool Tray - render only when explicitly opened to avoid offscreen shadows */}
      {project.toolsDetails && project.toolsDetails.length > 0 && showToolTray && (
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
      {...(cardProps as any)}
      className={`block glass-subtle hover:glass-strong overflow-hidden group relative cursor-pointer ${
        isSelected ? 'ring-4 ring-primary-500' : ''
      }`}
      style={{ borderRadius: 'var(--radius)' }}
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
          className="w-full h-full object-cover"
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
});
