import { useState, useEffect } from 'react';
import { ChevronUpIcon, ClipboardDocumentIcon, CheckIcon, HeartIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface SlideUpElement {
  type: 'image' | 'video' | 'text';
  content: string;
  caption?: string;
}

interface SlideUpHeroProps {
  element1?: SlideUpElement;
  element2?: SlideUpElement;
  tools?: Array<{ id: number; name: string; slug: string; logoUrl?: string }>;
  onToolClick?: (toolSlug: string) => void;
  // Heart/Like functionality
  isLiked?: boolean;
  heartCount?: number;
  onLikeToggle?: () => void;
  // Comment functionality
  onCommentClick?: () => void;
  isAuthenticated?: boolean;
  // Controlled expansion state (optional)
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

function TextWithCopy({ content, caption, fontSize }: { content: string; caption?: string; fontSize: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 md:p-8">
      <div className="max-w-3xl w-full">
        <p
          className="text-slate-900 dark:text-white leading-relaxed drop-shadow-lg"
          style={{ fontSize, lineHeight: '1.5' }}
        >
          {content}
        </p>
        {caption && (
          <p className="mt-4 text-sm text-center text-slate-600 dark:text-white/80 italic drop-shadow-md">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

function renderElement(element: SlideUpElement | undefined) {
  if (!element || !element.content) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-400">No content</p>
      </div>
    );
  }

  const parseVideoUrl = (url: string) => {
    if (!url) return null;

    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (youtubeMatch) {
      return { platform: 'youtube', id: youtubeMatch[1] };
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return { platform: 'vimeo', id: vimeoMatch[1] };
    }

    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/(\w+)/);
    if (loomMatch) {
      return { platform: 'loom', id: loomMatch[1] };
    }

    return null;
  };

  switch (element.type) {
    case 'image': {
      return (
        <div className="w-full h-full flex flex-col">
          <img
            src={element.content}
            alt={element.caption || 'Hero image'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
            }}
          />
          {element.caption && (
            <p className="mt-2 text-sm text-center text-slate-600 dark:text-white/80 drop-shadow-md">
              {element.caption}
            </p>
          )}
        </div>
      );
    }

    case 'video': {
      const videoInfo = parseVideoUrl(element.content);

      // Check if it's an MP4 video file (direct video URL)
      const isDirectVideo = element.content.match(/\.(mp4|webm|ogg)$/i) || element.content.includes('/projects/videos/');

      if (!videoInfo && !isDirectVideo) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-400">Invalid video URL</p>
          </div>
        );
      }

      if (isDirectVideo) {
        // Render native video player for MP4/WebM/OGG
        return (
          <div className="w-full h-full flex flex-col">
            <div className="relative w-full overflow-hidden">
              <video
                src={element.content}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto block"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            {element.caption && (
              <p className="mt-2 text-sm text-center text-slate-600 dark:text-white/80 drop-shadow-md">
                {element.caption}
              </p>
            )}
          </div>
        );
      }

      // Render embedded video (YouTube/Vimeo/Loom)
      let embedUrl = '';
      if (videoInfo!.platform === 'youtube') {
        embedUrl = `https://www.youtube.com/embed/${videoInfo!.id}?rel=0&autoplay=0`;
      } else if (videoInfo!.platform === 'vimeo') {
        embedUrl = `https://player.vimeo.com/video/${videoInfo!.id}`;
      } else if (videoInfo!.platform === 'loom') {
        embedUrl = `https://www.loom.com/embed/${videoInfo!.id}`;
      }

      return (
        <div className="w-full h-full flex flex-col">
          <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '9/16' }}>
            <iframe
              src={embedUrl}
              title={element.caption || 'Video'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {element.caption && (
            <p className="mt-2 text-sm text-center text-slate-600 dark:text-white/80 drop-shadow-md">
              {element.caption}
            </p>
          )}
        </div>
      );
    }

    case 'text': {
      const textLength = element.content.trim().length;
      let fontSize;
      if (textLength < 100) {
        fontSize = 'clamp(1.25rem, 2.5vw, 2rem)';
      } else if (textLength < 200) {
        fontSize = 'clamp(1rem, 2vw, 1.5rem)';
      } else if (textLength < 400) {
        fontSize = 'clamp(0.875rem, 1.5vw, 1.25rem)';
      } else {
        fontSize = 'clamp(0.75rem, 1.25vw, 1rem)';
      }

      return (
        <TextWithCopy
          content={element.content}
          caption={element.caption}
          fontSize={fontSize}
        />
      );
    }

    default:
      return null;
  }
}

export function SlideUpHero({
  element1,
  element2,
  tools,
  onToolClick,
  isLiked = false,
  heartCount = 0,
  onLikeToggle,
  onCommentClick,
  isAuthenticated = false,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
}: SlideUpHeroProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;

  const toggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalIsExpanded(!internalIsExpanded);
    }
  };

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand on mobile after a delay
  useEffect(() => {
    if (isMobile && element2 && !onToggleExpanded) {
      // Only auto-expand if we're using internal state (not controlled)
      const timer = setTimeout(() => {
        setInternalIsExpanded(true);
      }, 2000); // Show element2 after 2 seconds on mobile

      return () => clearTimeout(timer);
    }
  }, [isMobile, element2, onToggleExpanded]);

  const handleToggle = () => {
    toggleExpanded();
  };

  const handleCopy = async () => {
    if (element2?.type === 'text' && element2.content) {
      try {
        await navigator.clipboard.writeText(element2.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative group">
        {/* Main Container */}
        <div className="relative overflow-hidden">
          {/* Element 1 - Always visible (background) */}
          <div className="relative">
            {renderElement(element1)}
          </div>

          {/* Element 2 - Slides up as overlay */}
          {element2 && (
            <>
              {/* Backdrop overlay when expanded */}
              <div
                className={`absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-opacity duration-500 ${
                  isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={handleToggle}
              />

              {/* Slide-up panel */}
              <div
                className={`absolute inset-x-0 bottom-0 transition-transform duration-700 ease-out ${
                  isExpanded ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{
                  maxHeight: '85%',
                }}
              >
                <div className="relative h-full bg-white/80 dark:bg-gray-900/40 backdrop-blur-3xl rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-white/20">
                  {/* Extra glass layer for depth */}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 dark:from-white/10 to-transparent rounded-t-3xl pointer-events-none" />
                  {/* Handle bar */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-400/50 dark:bg-white/30 rounded-full backdrop-blur-sm" />

                  {/* Copy button - only show for text content */}
                  {element2?.type === 'text' && (
                    <button
                      onClick={handleCopy}
                      className="absolute top-4 right-16 p-2 rounded-full bg-slate-200/70 dark:bg-white/10 backdrop-blur-xl hover:bg-slate-300 dark:hover:bg-white/20 border border-slate-300 dark:border-white/20 transition-all hover:scale-105 active:scale-95 shadow-lg"
                      aria-label="Copy text"
                    >
                      {copied ? (
                        <CheckIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                      ) : (
                        <ClipboardDocumentIcon className="w-5 h-5 text-slate-600 dark:text-white" />
                      )}
                    </button>
                  )}

                  {/* Close button */}
                  <button
                    onClick={handleToggle}
                    className="absolute top-4 right-4 p-2 rounded-full bg-slate-200/70 dark:bg-white/10 backdrop-blur-xl hover:bg-slate-300 dark:hover:bg-white/20 border border-slate-300 dark:border-white/20 transition-all hover:scale-105 active:scale-95 shadow-lg"
                    aria-label="Close"
                  >
                    <ChevronUpIcon className="w-5 h-5 text-slate-600 dark:text-white rotate-180" />
                  </button>

                  {/* Content */}
                  <div className="h-full overflow-y-auto pt-12 pb-6 px-4 md:px-6">
                    {renderElement(element2)}

                    {/* Actions and Tools - Single Row */}
                    <div className="mt-6 pt-6 border-t border-white/30">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Heart/Like Button */}
                        <button
                          onClick={onLikeToggle}
                          disabled={!isAuthenticated}
                          className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-sm border border-white/30 hover:bg-white/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg group"
                          aria-label={isLiked ? 'Unlike' : 'Like'}
                        >
                          {isLiked ? (
                            <HeartIconSolid className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
                          ) : (
                            <HeartIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          )}
                          <span className="font-medium">{heartCount}</span>
                        </button>

                        {/* Comment Button */}
                        <button
                          onClick={onCommentClick}
                          className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-sm border border-white/30 hover:bg-white/30 transition-all hover:scale-105 active:scale-95 shadow-lg group"
                          aria-label="Comment"
                        >
                          <ChatBubbleLeftIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Divider */}
                        {tools && tools.length > 0 && (
                          <div className="h-6 w-px bg-white/30 mx-1" />
                        )}

                        {/* Tools pills */}
                        {tools && tools.length > 0 && tools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => onToolClick?.(tool.slug)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md text-white rounded-full text-sm border border-white/30 hover:bg-white/30 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                          >
                            {tool.logoUrl && (
                              <img
                                src={tool.logoUrl}
                                alt={tool.name}
                                className="w-4 h-4 object-contain"
                              />
                            )}
                            <span>{tool.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subtle bottom indicator - tap/click to expand */}
              {!isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
                  {/* Gradient fade to indicate more content */}
                  <div className="h-20 bg-gradient-to-t from-black/30 to-transparent" />

                  {/* Interactive indicator */}
                  <button
                    onClick={handleToggle}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1 group"
                    aria-label="Show More"
                  >
                    {/* Animated chevron */}
                    <div className="animate-bounce">
                      <ChevronUpIcon className="w-6 h-6 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                    </div>
                    {/* Optional text hint */}
                    <span className="text-xs font-medium text-white/80 group-hover:text-white drop-shadow-md transition-colors">
                      Tap for more
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
