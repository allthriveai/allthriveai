import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { XMarkIcon, HeartIcon, ChatBubbleLeftIcon, ArrowRightIcon, TrophyIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import * as FaIcons from 'react-icons/fa';
import { HeroVideo } from './hero/HeroVideo';
import { ToolTray } from '@/components/tools/ToolTray';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { toggleProjectLike, getProjectBySlug } from '@/services/projects';
import { getOptimizedImageUrl } from '@/utils/imageOptimization';
import type { Project } from '@/types/models';

// Threshold for dismissing the tray (in pixels)
const DISMISS_THRESHOLD = 100;
// Velocity threshold for dismissing (pixels per ms)
const VELOCITY_THRESHOLD = 0.3;

interface ProjectPreviewTrayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  /** Optional ref to the feed scroll container for scroll-to-close on mobile */
  feedScrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Determine if a project is a video project
 */
function isVideoProject(project: Project): boolean {
  if (project.type === 'video') return true;
  if (project.content?.heroDisplayMode === 'video') return true;
  if (project.content?.heroVideoUrl) return true;

  // Check for video content in sections
  const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
  const sectionContent = project.content?.sections?.[0]?.content || {};
  const directVideoUrl = (videoContent as any).url || (typeof sectionContent === 'object' && 'url' in sectionContent ? sectionContent.url : '');
  if (directVideoUrl) return true;

  // Check if featuredImageUrl is a video file
  if (project.featuredImageUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(project.featuredImageUrl)) {
    return true;
  }

  return false;
}

/**
 * Get the video URL for a video project
 */
function getVideoUrl(project: Project): string | null {
  if (project.content?.heroVideoUrl) return project.content.heroVideoUrl;

  const videoContent = typeof project.content?.video === 'object' ? project.content.video : {};
  const sectionContent = project.content?.sections?.[0]?.content || {};
  const directVideoUrl = (videoContent as any).url || (typeof sectionContent === 'object' && 'url' in sectionContent ? sectionContent.url : '');
  if (directVideoUrl) return directVideoUrl as string;

  if (project.featuredImageUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(project.featuredImageUrl)) {
    return project.featuredImageUrl;
  }

  return null;
}

/**
 * Extract teaser content from project
 * Returns full content since the tray supports scrolling and markdown rendering
 */
function extractTeaserContent(project: Project): string {
  // 1. Check for overview section description (supports markdown)
  const overviewSection = project.content?.sections?.find(
    (s: any) => s.type === 'overview'
  );
  if (overviewSection?.content?.description) {
    return overviewSection.content.description as string;
  }

  // 2. Check for hero quote
  if (project.content?.heroQuote) {
    const quote = project.content.heroQuote as string;
    return `> ${quote}`;
  }

  // 3. Fall back to project description
  if (project.description) {
    return project.description;
  }

  return '';
}

/**
 * Check if project is a battle
 */
function isBattleProject(project: Project): boolean {
  return project.type === 'battle' && !!project.content?.battleResult;
}

// Helper to get FA icon component by name
function getFaIcon(iconName: string): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null;
  const Icon = (FaIcons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  return Icon || null;
}

export function ProjectPreviewTray({ isOpen, onClose, project, feedScrollContainerRef }: ProjectPreviewTrayProps) {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Like state
  const [isLiked, setIsLiked] = useState(project?.isLikedByUser ?? false);
  const [heartCount, setHeartCount] = useState(project?.heartCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  // Tool tray state
  const [showToolTray, setShowToolTray] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');

  // Enriched project with full content (fetched when tray opens)
  const [enrichedProject, setEnrichedProject] = useState<Project | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  // Track the visual open state (delayed to allow animation)
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Mobile swipe-to-dismiss state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ y: number; time: number; scrollTop: number } | null>(null);
  const isMobileRef = useRef(false);

  // Check if we're on mobile (only enable swipe gestures on mobile)
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Store onClose in ref to avoid stale closure in scroll handler
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Feed scroll detection - close tray when user scrolls down on the feed behind it (mobile only)
  useEffect(() => {
    if (!isOpen || !feedScrollContainerRef?.current || !isMobileRef.current) return;

    const feedContainer = feedScrollContainerRef.current;
    let lastScrollTop = feedContainer.scrollTop;
    let scrollDownAccumulator = 0;
    const SCROLL_DOWN_THRESHOLD = 80; // pixels of downward scroll to trigger close

    const handleFeedScroll = () => {
      const currentScrollTop = feedContainer.scrollTop;
      const delta = currentScrollTop - lastScrollTop;

      if (delta > 0) {
        // Scrolling down - accumulate
        scrollDownAccumulator += delta;
        if (scrollDownAccumulator > SCROLL_DOWN_THRESHOLD) {
          onCloseRef.current();
          scrollDownAccumulator = 0;
        }
      } else {
        // Scrolling up - reset accumulator
        scrollDownAccumulator = 0;
      }

      lastScrollTop = currentScrollTop;
    };

    feedContainer.addEventListener('scroll', handleFeedScroll, { passive: true });
    return () => {
      feedContainer.removeEventListener('scroll', handleFeedScroll);
    };
  }, [isOpen, feedScrollContainerRef]);

  // Reset drag state when tray closes
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      touchStartRef.current = null;
    }
  }, [isOpen]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      // First render the component (in closed position)
      setShouldRender(true);
      // Then after a frame, trigger the open animation
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      // Immediately start close animation
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Reset like state and close tool tray when project changes
  useEffect(() => {
    if (project) {
      setIsLiked(project.isLikedByUser ?? false);
      setHeartCount(project.heartCount ?? 0);
    }
    // Close tool tray when switching to a different project
    setShowToolTray(false);
    setSelectedToolSlug('');
  }, [project?.id]);

  // Fetch full project content when tray opens (for non-battle projects without rich content)
  useEffect(() => {
    if (!isOpen || !project) {
      setEnrichedProject(null);
      return;
    }

    // Battle projects already have the data they need from the list serializer
    if (isBattleProject(project)) {
      setEnrichedProject(null);
      return;
    }

    // Check if we need to fetch - look for sections in content
    const hasRichContent = (project.content?.sections?.length ?? 0) > 0;
    if (hasRichContent) {
      setEnrichedProject(null);
      return;
    }

    // Fetch full project data
    const fetchFullProject = async () => {
      setIsLoadingContent(true);
      try {
        const fullProject = await getProjectBySlug(project.username, project.slug);
        setEnrichedProject(fullProject);
      } catch (error) {
        console.error('Failed to fetch full project:', error);
        setEnrichedProject(null);
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchFullProject();
  }, [isOpen, project?.id, project?.username, project?.slug]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Track drag state in refs for native event handlers (to avoid stale closures)
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  // Sync refs with state
  isDraggingRef.current = isDragging;
  dragOffsetRef.current = dragOffset;

  // Mobile swipe-to-dismiss using native event listeners
  // IMPORTANT: Must use native listeners with { passive: false } for iOS Safari
  // React's synthetic touch events are passive by default, which prevents preventDefault()
  useEffect(() => {
    const tray = trayRef.current;
    if (!tray || !isMobileRef.current) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const scrollContainer = scrollContainerRef.current;

      touchStartRef.current = {
        y: touch.clientY,
        time: Date.now(),
        scrollTop: scrollContainer?.scrollTop ?? 0,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartRef.current.y;
      const scrollContainer = scrollContainerRef.current;

      // Check if user is at the bottom of the scroll container
      const isAtBottom = scrollContainer
        ? scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 5
        : false;

      // Check if user is at the top of the scroll container
      const isAtTop = scrollContainer ? scrollContainer.scrollTop <= 0 : true;

      // Allow drag dismiss in two cases:
      // 1. Swiping down and at top of scroll (or not scrolled yet)
      // 2. Swiping up (continuing scroll) and at bottom of scroll
      const shouldAllowDrag =
        (deltaY > 0 && isAtTop) || // Swiping down from top
        (deltaY < 0 && isAtBottom); // Swiping up at bottom (overscroll)

      if (shouldAllowDrag) {
        // Prevent the scroll container from scrolling - THIS WORKS with { passive: false }
        e.preventDefault();

        // For swipe up at bottom, convert to downward drag
        // (user swipes up, tray moves down)
        const effectiveDelta = deltaY < 0 ? Math.abs(deltaY) : deltaY;

        // Apply resistance to make drag feel natural
        const resistance = 0.6;
        const dragAmount = effectiveDelta * resistance;

        setIsDragging(true);
        setDragOffset(Math.max(0, dragAmount));
      }
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !isDraggingRef.current) {
        touchStartRef.current = null;
        return;
      }

      const endTime = Date.now();
      const duration = endTime - touchStartRef.current.time;
      const velocity = dragOffsetRef.current / duration; // pixels per ms

      // Dismiss if dragged far enough or with enough velocity
      const shouldDismiss = dragOffsetRef.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD;

      if (shouldDismiss) {
        // Animate to full dismiss
        setDragOffset(window.innerHeight);
        // Close after animation
        setTimeout(() => {
          onCloseRef.current();
        }, 200);
      } else {
        // Snap back to original position
        setDragOffset(0);
      }

      setIsDragging(false);
      touchStartRef.current = null;
    };

    // Attach with { passive: false } to allow preventDefault() on iOS Safari
    tray.addEventListener('touchstart', handleTouchStart, { passive: true });
    tray.addEventListener('touchmove', handleTouchMove, { passive: false });
    tray.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      tray.removeEventListener('touchstart', handleTouchStart);
      tray.removeEventListener('touchmove', handleTouchMove);
      tray.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiking || !project) return;

    setIsLiking(true);
    try {
      const result = await toggleProjectLike(project.id);
      setIsLiked(result.liked);
      setHeartCount(result.heartCount);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleViewFullProject = () => {
    if (project) {
      onClose();
      navigate(`/${project.username}/${project.slug}`);
    }
  };

  if (!shouldRender || !project) return null;

  const isVideo = isVideoProject(project);
  const videoUrl = isVideo ? getVideoUrl(project) : null;
  const teaserContent = extractTeaserContent(project);
  const projectUrl = `/${project.username}/${project.slug}`;
  const isBattle = isBattleProject(project);

  // Render battle-specific content
  const renderBattleContent = () => {
    const battleResult = project.content?.battleResult;
    if (!battleResult) return null;

    // Backend serializer now converts to camelCase
    const mySubmission = battleResult.mySubmission;
    const opponentSubmission = battleResult.opponentSubmission;
    const opponent = battleResult.opponent;
    const challengeText = battleResult.challengeText || project.title;
    const won = battleResult.won;
    const isTie = battleResult.isTie;

    return (
      <>
        {/* Battle Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                  Prompt Battle
                </span>
                {won && !isTie && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500 text-white flex items-center gap-1">
                    <TrophyIcon className="w-3 h-3" />
                    Victory
                  </span>
                )}
                {isTie && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-500 text-white">
                    Tie
                  </span>
                )}
              </div>
              <h1 className="text-sm font-medium text-gray-300 leading-snug line-clamp-2">
                {challengeText}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Battle Content - VS Layout */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800">
          {/* Your Submission */}
          <div className="p-4">
            <div className="relative">
              {/* Player label */}
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/${project.username}`}
                  className="text-sm font-medium text-cyan-400 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  @{project.username}
                </Link>
                {won && !isTie && (
                  <div className="p-1 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                    <TrophyIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              {/* Submission image */}
              <div className="relative rounded-lg overflow-hidden border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                {mySubmission?.imageUrl ? (
                  <img
                    src={getOptimizedImageUrl(mySubmission.imageUrl, { width: 600 })}
                    alt={`${project.username}'s submission`}
                    className="w-full h-auto object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                    <span className="text-slate-600 text-sm">No image</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex items-center justify-center py-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="mx-4 px-4 py-1.5 rounded-full bg-slate-800 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <span className="text-sm font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                VS
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />
          </div>

          {/* Opponent Submission */}
          <div className="p-4 pt-2">
            <div className="relative">
              {/* Player label */}
              <div className="flex items-center gap-2 mb-2">
                {opponent?.username ? (
                  <Link
                    to={`/${opponent.username}`}
                    className="text-sm font-medium text-pink-400 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                  >
                    @{opponent.username}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-pink-400">Opponent</span>
                )}
                {!won && !isTie && (
                  <div className="p-1 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                    <TrophyIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              {/* Submission image */}
              <div className="relative rounded-lg overflow-hidden border-2 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                {opponentSubmission?.imageUrl ? (
                  <img
                    src={getOptimizedImageUrl(opponentSubmission.imageUrl, { width: 600 })}
                    alt="Opponent's submission"
                    className="w-full h-auto object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                    <span className="text-slate-600 text-sm">No image</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prompts & Scores Section */}
          <div className="px-4 pb-4 space-y-4">
            {/* Your Submission Card */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-cyan-500/30">
              {/* Player header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-semibold text-white">You</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-cyan-500 text-white">
                  You
                </span>
              </div>

              {/* Prompt box */}
              {mySubmission?.prompt && (
                <div className="p-3 mb-3 rounded-lg border border-cyan-500/40 bg-slate-900/50">
                  <p className="text-sm text-gray-200 italic leading-relaxed">
                    "{mySubmission.prompt}"
                  </p>
                </div>
              )}

              {/* Criteria scores - 2x2 grid */}
              {mySubmission?.criteriaScores && Object.keys(mySubmission.criteriaScores).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {Object.entries(mySubmission.criteriaScores).map(([criteria, score]) => (
                    <div key={criteria} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50">
                      <span className="text-xs text-gray-400">{criteria}</span>
                      <span className="text-sm font-semibold text-cyan-400">{score as number}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback */}
              {mySubmission?.feedback && (
                <p className="text-xs text-cyan-300/80 italic leading-relaxed line-clamp-3">
                  {mySubmission.feedback}
                </p>
              )}
            </div>

            {/* Opponent Submission Card */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-amber-500/30">
              {/* Player header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-semibold text-white">
                  {opponent?.username || 'Opponent'}
                </span>
              </div>

              {/* Prompt box */}
              {opponentSubmission?.prompt && (
                <div className="p-3 mb-3 rounded-lg border border-amber-500/40 bg-slate-900/50">
                  <p className="text-sm text-gray-200 italic leading-relaxed">
                    "{opponentSubmission.prompt}"
                  </p>
                </div>
              )}

              {/* Criteria scores - 2x2 grid */}
              {opponentSubmission?.criteriaScores && Object.keys(opponentSubmission.criteriaScores).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {Object.entries(opponentSubmission.criteriaScores).map(([criteria, score]) => (
                    <div key={criteria} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50">
                      <span className="text-xs text-gray-400">{criteria}</span>
                      <span className="text-sm font-semibold text-amber-400">{score as number}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback */}
              {opponentSubmission?.feedback && (
                <p className="text-xs text-amber-300/80 italic leading-relaxed line-clamp-3">
                  {opponentSubmission.feedback}
                </p>
              )}
            </div>
          </div>

          {/* Tool badges */}
          {project.toolsDetails && project.toolsDetails.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-xs text-gray-500 mb-2">Tools used:</p>
              <div className="flex flex-wrap gap-2">
                {project.toolsDetails.slice(0, 3).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedToolSlug(tool.slug);
                      setShowToolTray(true);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-700 text-gray-300 flex items-center gap-1.5 hover:bg-slate-600 transition-colors cursor-pointer"
                  >
                    {tool.logoUrl && (
                      <img src={tool.logoUrl} alt={tool.name} className="w-3.5 h-3.5 rounded" />
                    )}
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-cyan-500/30 bg-slate-900">
          {/* Action buttons */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Like button */}
              <button
                onClick={handleLike}
                disabled={isLiking || !isAuthenticated}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50 bg-slate-800 hover:bg-slate-700"
              >
                {isLiked ? (
                  <HeartIconSolid className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4 text-gray-400" />
                )}
                {heartCount > 0 && (
                  <span className="text-xs font-medium text-gray-300">
                    {heartCount}
                  </span>
                )}
              </button>

              {/* Comment button */}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 bg-slate-800 hover:bg-slate-700"
                onClick={() => {
                  onClose();
                  navigate(`${projectUrl}#comments`);
                }}
              >
                <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-300">Comment</span>
              </button>
            </div>
          </div>

          {/* View Full Battle CTA */}
          <button
            onClick={handleViewFullProject}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-medium transition-colors"
          >
            View Full Battle
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </>
    );
  };

  // Render standard project content
  const renderStandardContent = () => {
    // Use enriched project data if available, otherwise fall back to original
    const displayProject = enrichedProject || project;
    const sections = displayProject.content?.sections || [];

    // Extract specific sections
    const overviewSection = sections.find((s: any) => s.type === 'overview');
    const featuresSection = sections.find((s: any) => s.type === 'features');
    const gallerySection = sections.find((s: any) => s.type === 'gallery');
    const demoSection = sections.find((s: any) => s.type === 'demo');

    // Get features (limit to 3 for preview)
    const features = featuresSection?.content?.features?.slice(0, 3) || [];

    // Get gallery images (limit to 4 for preview)
    const galleryImages = gallerySection?.content?.images?.slice(0, 4) || [];

    // Get CTAs from demo section
    const ctas = demoSection?.content?.ctas || [];

    // Get headline from overview
    const headline = overviewSection?.content?.headline;

    return (
      <>
        {/* Header - Fixed with opaque background for readability */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {project.title}
              </h1>
              <Link
                to={`/${project.username}`}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                by @{project.username}
              </Link>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {/* Video or Featured Image */}
          <div className="p-4">
            {isVideo && videoUrl ? (
              <div className="rounded-lg overflow-hidden">
                <HeroVideo
                  videoUrl={videoUrl}
                  redditPermalink={project.content?.reddit?.permalink}
                  autoplay
                />
              </div>
            ) : project.featuredImageUrl ? (
              <div className="relative w-full rounded-lg overflow-hidden">
                <img
                  src={getOptimizedImageUrl(project.featuredImageUrl, { width: 600 })}
                  alt={project.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            ) : null}
          </div>

          {/* Category and Tool badges */}
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {project.categoriesDetails?.slice(0, 3).map((category) => (
                <span
                  key={category.id}
                  className="px-2.5 py-1 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: category.color ? `${category.color}20` : 'rgba(34, 211, 238, 0.2)',
                    color: category.color || '#22d3ee',
                  }}
                >
                  {category.name}
                </span>
              ))}
              {project.toolsDetails?.slice(0, 3).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setSelectedToolSlug(tool.slug);
                    setShowToolTray(true);
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  {tool.logoUrl && (
                    <img src={tool.logoUrl} alt={tool.name} className="w-3.5 h-3.5 rounded" />
                  )}
                  {tool.name}
                </button>
              ))}
            </div>
          </div>

          {/* Headline (if available) */}
          {headline && (
            <div className="px-4 pb-3">
              <p className="text-base font-medium text-gray-900 dark:text-white leading-snug">
                {headline}
              </p>
            </div>
          )}

          {/* Description / Teaser */}
          {teaserContent && (
            <div className="px-4 pb-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown>{teaserContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Loading indicator for enriched content */}
          {isLoadingContent && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                Loading more details...
              </div>
            </div>
          )}

          {/* Key Features (if available) */}
          {features.length > 0 && (
            <div className="px-4 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Key Features
              </h3>
              <div className="space-y-2">
                {features.map((feature: any, index: number) => {
                  const IconComponent = getFaIcon(feature.icon);
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
                    >
                      {IconComponent && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <IconComponent className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {feature.title}
                        </p>
                        {feature.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {feature.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gallery Preview (if available) */}
          {galleryImages.length > 0 && (
            <div className="px-4 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Gallery
              </h3>
              <div className={`grid gap-2 ${galleryImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {galleryImages.map((image: any, index: number) => (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden aspect-video bg-gray-100 dark:bg-slate-800"
                  >
                    <img
                      src={getOptimizedImageUrl(image.url || image, { width: 300 })}
                      alt={image.caption || `Gallery image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs from Demo Section */}
          {ctas.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {ctas.slice(0, 2).map((cta: any, index: number) => (
                  <a
                    key={index}
                    href={cta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    {cta.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.content?.tags && project.content.tags.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {(project.content.tags as string[]).slice(0, 5).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          {/* Action buttons */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Like button */}
              <button
                onClick={handleLike}
                disabled={isLiking || !isAuthenticated}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {isLiked ? (
                  <HeartIconSolid className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
                {heartCount > 0 && (
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {heartCount}
                  </span>
                )}
              </button>

              {/* Comment button */}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {
                  onClose();
                  navigate(`${projectUrl}#comments`);
                }}
              >
                <ChatBubbleLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Comment</span>
              </button>
            </div>
          </div>

          {/* View Full Project CTA */}
          <button
            onClick={handleViewFullProject}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
          >
            View Full Project
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </>
    );
  };

  // Use portal to render tray at document body level to escape parent overflow/z-index constraints
  return createPortal(
    <>
      {/* Backdrop overlay - transparent on desktop to allow feed scrolling, visible on mobile */}
      <div
        className={`fixed inset-0 z-40 md:pointer-events-none ${
          isDragging ? '' : 'transition-opacity duration-300 ease-in-out'
        } ${visuallyOpen && dragOffset === 0 ? 'opacity-100 bg-black/30 md:bg-transparent' : ''} ${
          !visuallyOpen && dragOffset === 0 ? 'opacity-0 pointer-events-none' : ''
        }`}
        style={{
          // Fade backdrop as user drags
          opacity: dragOffset > 0 ? Math.max(0, 1 - dragOffset / 300) : undefined,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer - Smooth slide animation
          On desktop: shifts left when topic tray is open to show both side by side
          On mobile: stays at right-0 (topic tray overlays on top) */}
      <aside
        ref={trayRef}
        className={`fixed top-0 right-0 h-full w-full md:w-96 lg:w-[28rem] border-l border-gray-200 dark:border-white/10 shadow-2xl z-40 overflow-hidden flex flex-col ${
          isDragging ? '' : 'transition-all duration-300 ease-in-out'
        } ${visuallyOpen && dragOffset === 0 ? 'translate-x-0' : ''} ${
          !visuallyOpen && dragOffset === 0 ? 'translate-x-full' : ''
        } ${showToolTray ? 'md:right-[28rem]' : ''}`}
        style={{
          backgroundColor: isBattle
            ? 'rgb(15, 23, 42)' // slate-900 for battles
            : (theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'),
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          // Apply drag transform on mobile
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Mobile drag handle indicator */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        {isBattle ? renderBattleContent() : renderStandardContent()}
      </aside>

      {/* Tool Tray - Opens when clicking a tool badge */}
      {project?.toolsDetails && project.toolsDetails.length > 0 && showToolTray && (
        <ToolTray
          isOpen={showToolTray}
          onClose={() => setShowToolTray(false)}
          toolSlug={selectedToolSlug || project.toolsDetails[0].slug}
        />
      )}
    </>,
    document.body
  );
}
